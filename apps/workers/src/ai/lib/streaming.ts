import type { ActionInstructionData } from "@lumen/ai";
import { createLogger } from "@lumen/logger";
import {
  getTracer,
  recordSpanError,
  SpanStatusCode,
} from "@lumen/logger/tracer";
import { type ModelMessage, streamText } from "ai";
import { getModel, getModelChain, isRateLimitError } from "../providers";
import { executeTool } from "../tools/tool-executor";
import {
  recordAiError,
  recordModelFallback,
  recordRateLimitHit,
} from "./metrics";
import type {
  AiSdkMessage,
  StreamOptions,
  StreamResult,
  TextPart,
  ToolCallInfo,
  ToolCallPart,
} from "./types";

const logger = createLogger({ name: "ai:streaming" });
const tracer = getTracer("lumen-ai");

const MAX_STEPS = 5;

export async function* streamWithFallback(
  opts: StreamOptions
): AsyncGenerator<StreamResult, void, unknown> {
  const { systemPrompt, messageId, tools, ctx } = opts;
  const messages: AiSdkMessage[] = [...opts.messages];
  const modelChain = getModelChain();

  for (let step = 0; step < MAX_STEPS; step++) {
    let stepFinished = false;
    const toolCallsInStep: ToolCallInfo[] = [];
    let fullContentInStep = "";

    for (let i = 0; i < modelChain.length; i++) {
      const modelName = modelChain[i];
      const isLastModel = i === modelChain.length - 1;

      const modelSpan = tracer.startSpan(`ai.model.${modelName}`, {
        attributes: {
          "ai.model": modelName,
          "ai.attempt": i + 1,
          "ai.total_models": modelChain.length,
          "ai.is_fallback": i > 0,
          "ai.workspace_id": ctx.workspaceId,
          "ai.message_id": messageId,
          "ai.tools_enabled": !!tools,
          "ai.step": step + 1,
        },
      });

      try {
        logger.info("Attempting model", {
          workspaceId: ctx.workspaceId,
          messageId,
          model: modelName,
          attempt: i + 1,
          totalModels: modelChain.length,
          isFallback: i > 0,
          toolsEnabled: !!tools,
          step: step + 1,
        });

        const model = getModel(modelName);

        const streamOptions: Parameters<typeof streamText>[0] = {
          model,
          system: systemPrompt,
          messages: messages as ModelMessage[],
        };

        if (tools) {
          // @ts-expect-error - Dynamic tools type
          streamOptions.tools = tools;
        }

        const result = streamText(streamOptions);

        modelSpan.addEvent("ai.stream_start");

        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            const chunk = part.text ?? "";
            fullContentInStep += chunk;
            yield { type: "chunk", chunk, modelUsed: modelName };
          } else if (part.type === "tool-call") {
            const toolCallPart = part as unknown as {
              toolCallId: string;
              toolName: string;
              input: unknown;
            };

            yield {
              type: "tool_call",
              toolCallId: toolCallPart.toolCallId,
              toolName: toolCallPart.toolName,
              input: toolCallPart.input as Record<string, unknown>,
              modelUsed: modelName,
            };

            const toolResult = await executeTool(
              toolCallPart.toolName,
              toolCallPart.input as Record<string, unknown>,
              ctx
            );

            toolCallsInStep.push({
              ...toolCallPart,
              output: toolResult,
            });

            // Check if the result contains an action instruction (for ephemeral/local workspaces)
            const resultData = toolResult.data as
              | { actionInstruction?: unknown; message?: string }
              | undefined;
            if (resultData?.actionInstruction) {
              yield {
                type: "action_instruction" as const,
                toolCallId: toolCallPart.toolCallId,
                instruction:
                  resultData.actionInstruction as ActionInstructionData,
                message: resultData.message ?? "Action pending",
                modelUsed: modelName,
              };
            }

            yield {
              type: "tool_result",
              toolCallId: toolCallPart.toolCallId,
              output: toolResult,
              modelUsed: modelName,
            };
          }
        }

        modelSpan.addEvent("ai.stream_complete");
        modelSpan.setStatus({ code: SpanStatusCode.OK });
        modelSpan.end();

        logger.info("Model streaming completed for step", {
          workspaceId: ctx.workspaceId,
          messageId,
          model: modelName,
          isFallback: i > 0,
          step: step + 1,
        });

        stepFinished = true;
        break;
      } catch (error) {
        const rateLimited = isRateLimitError(error);

        recordSpanError(modelSpan, error);
        modelSpan.setAttribute("ai.rate_limited", rateLimited);
        modelSpan.end();

        logger.warn("Model failed", {
          workspaceId: ctx.workspaceId,
          messageId,
          model: modelName,
          isRateLimit: rateLimited,
          error: error instanceof Error ? error.message : "Unknown",
          willTryNext: !isLastModel && rateLimited,
        });

        if (rateLimited) {
          recordRateLimitHit({ model: modelName });
          recordAiError({ model: modelName, errorType: "rate_limit" });
        } else {
          recordAiError({ model: modelName, errorType: "api_error" });
        }

        if (!rateLimited || isLastModel) {
          throw error;
        }

        if (i + 1 < modelChain.length) {
          const nextModel = modelChain[i + 1];
          recordModelFallback({
            fromModel: modelName,
            toModel: nextModel,
            reason: "rate_limit",
          });
        }
      }
    }

    if (!stepFinished) {
      throw new Error("All models exhausted");
    }

    // Check if we should continue to next step (if there were tool calls)
    if (toolCallsInStep.length > 0) {
      // Add assistant message with tool calls as content parts
      const assistantContent: Array<TextPart | ToolCallPart> = [];

      if (fullContentInStep) {
        assistantContent.push({
          type: "text" as const,
          text: fullContentInStep,
        });
      }

      for (const tc of toolCallsInStep) {
        assistantContent.push({
          type: "tool-call" as const,
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: tc.input as Record<string, unknown>,
        });
      }

      messages.push({
        role: "assistant",
        content: assistantContent,
      });

      messages.push({
        role: "tool",
        content: toolCallsInStep.map((tc) => ({
          type: "tool-result" as const,
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          output: { type: "json" as const, value: tc.output },
        })),
      });
    } else {
      return;
    }
  }
}
