import type { ActionInstructionData, ToolExecutionResult } from "@lumen/ai";
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
import { aiRequestQueue } from "./request-queue";
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

// Conservative token estimate for capacity reservation:
// ~3 chars per token for prompts, plus headroom for the completion.
// Tool-enabled responses can run up to MAX_STEPS generation steps before the
// reservation is reconciled with reported usage, so the completion allowance
// is scaled by the step count — under-reserving would let concurrent
// multi-step streams exceed the rolling provider budget.
const CHARS_PER_TOKEN = 3;
const COMPLETION_TOKEN_RESERVE = 2048;

function estimateTokens(
  systemPrompt: string,
  messages: AiSdkMessage[]
): number {
  let charCount = systemPrompt.length;
  for (const message of messages) {
    charCount += JSON.stringify(message)?.length ?? 0;
  }
  return (
    Math.ceil(charCount / CHARS_PER_TOKEN) +
    COMPLETION_TOKEN_RESERVE * MAX_STEPS
  );
}

export async function* streamWithFallback(
  opts: StreamOptions
): AsyncGenerator<StreamResult, void, unknown> {
  const { systemPrompt, ctx } = opts;
  const messages: AiSdkMessage[] = [...opts.messages];

  // Acquire a request slot and token budget before talking to the model, so
  // concurrent users are queued within GeneralCompute's 100 req/min and
  // 200k tokens/min limits. Released with real usage once the stream ends.
  const { reservation } = await aiRequestQueue.reserveCapacity({
    priority: "normal",
    workspaceId: ctx.workspaceId,
    estimatedTokens: estimateTokens(systemPrompt, messages),
  });

  let actualTokens = 0;
  let producedOutput = false;

  try {
    // Manual iteration so we can tell whether the stream produced anything
    // before being aborted (e.g. the client disconnected mid-stream, which
    // never emits the usage part)
    const steps = streamSteps(opts, (usage) => {
      if (usage.totalTokens > 0) {
        actualTokens += usage.totalTokens;
      }
    });
    let next = await steps.next();
    while (!next.done) {
      producedOutput = true;
      yield next.value;
      next = await steps.next();
    }
  } finally {
    // Prefer provider-reported usage; fall back to the initial estimate when
    // output was produced but no usage event arrived (aborted stream), so
    // real consumption is never released as zero. Zero is only used when the
    // stream failed before producing anything (no tokens were consumed).
    const tokensToRelease =
      actualTokens > 0
        ? actualTokens
        : producedOutput
          ? estimateTokens(systemPrompt, messages)
          : 0;
    await reservation?.releaseTokens(tokensToRelease);
  }
}

async function* streamSteps(
  opts: StreamOptions,
  onUsage: (usage: { totalTokens: number }) => void
): AsyncGenerator<StreamResult, void, unknown> {
  const { systemPrompt, messageId, tools, ctx } = opts;
  const messages: AiSdkMessage[] = [...opts.messages];
  const modelChain = getModelChain();

  for (let step = 0; step < MAX_STEPS; step++) {
    let stepFinished = false;
    let stepRequiresConfirmation = false;
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
            // AI SDK stream events use 'input', but message format uses 'args'
            const toolCallPart = part as unknown as {
              toolCallId: string;
              toolName: string;
              // Stream event property name
              input: unknown;
            };

            logger.debug("Tool-call stream event", {
              toolCallId: toolCallPart.toolCallId,
              toolName: toolCallPart.toolName,
              hasInput: toolCallPart.input !== undefined,
            });

            yield {
              type: "tool_call",
              toolCallId: toolCallPart.toolCallId,
              toolName: toolCallPart.toolName,
              input: toolCallPart.input as Record<string, unknown>,
              modelUsed: modelName,
            };

            let toolResult: ToolExecutionResult;
            try {
              toolResult = await executeTool(
                toolCallPart.toolName,
                toolCallPart.input as Record<string, unknown>,
                ctx
              );
            } catch (error) {
              // Create a failure result object on tool execution error
              toolResult = {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                data: null,
              };
            }

            // Check if tool requires confirmation
            if (toolResult.requiresConfirmation) {
              stepRequiresConfirmation = true;
              yield {
                type: "confirmation_required",
                messageId,
                action: {
                  tool: toolCallPart.toolName,
                  params: toolCallPart.input as Record<string, unknown>,
                  description: `Confirm ${toolCallPart.toolName}`,
                },
                modelUsed: modelName,
              };
            }

            toolCallsInStep.push({
              toolCallId: toolCallPart.toolCallId,
              toolName: toolCallPart.toolName,
              input: toolCallPart.input as Record<string, unknown>,
              output: toolResult,
            });

            // Check if the result contains an action instruction (for ephemeral/local workspaces)
            // Skip if tool execution failed
            if (toolResult.success !== false) {
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
            }

            yield {
              type: "tool_result",
              toolCallId: toolCallPart.toolCallId,
              output: toolResult,
              modelUsed: modelName,
            };
          }
        }

        try {
          const usage = await result.usage;
          const totalTokens = usage.totalTokens ?? 0;
          onUsage({ totalTokens });
          yield {
            type: "usage",
            usage: {
              promptTokens: usage.inputTokens ?? 0,
              completionTokens: usage.outputTokens ?? 0,
              totalTokens,
            },
            modelUsed: modelName,
          };
        } catch (e) {
          logger.warn("Failed to get usage stats", {
            error: e instanceof Error ? e.message : "Unknown",
            model: modelName,
          });
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

        logger.warn("Model failed, attempting fallback", {
          workspaceId: ctx.workspaceId,
          messageId,
          model: modelName,
          isRateLimit: rateLimited,
          error: error instanceof Error ? error.message : "Unknown",
          willTryNext: !isLastModel,
        });

        if (rateLimited) {
          recordRateLimitHit({ model: modelName });
          recordAiError({ model: modelName, errorType: "rate_limit" });
        } else {
          recordAiError({ model: modelName, errorType: "api_error" });
        }

        if (isLastModel) {
          throw error;
        }

        if (i + 1 < modelChain.length) {
          const nextModel = modelChain[i + 1];
          recordModelFallback({
            fromModel: modelName,
            toModel: nextModel,
            reason: rateLimited ? "rate_limit" : "error",
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
        // IMPORTANT: The openai-compatible provider reads 'input', not 'args'!
        // But AI SDK Core expects 'args' for type validation.
        // We provide both to satisfy everyone.
        const toolCallContent: ToolCallPart = {
          type: "tool-call",
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.input,
          input: tc.input,
        };
        logger.info("Adding tool-call to assistant message", {
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
        });
        assistantContent.push(toolCallContent);
      }

      const assistantMsg = {
        role: "assistant" as const,
        content: assistantContent,
      };
      logger.info(`Assistant message for step ${step + 1}`, {
        contentLength: assistantContent.length,
      });
      messages.push(assistantMsg);

      const toolMsg = {
        role: "tool" as const,
        content: toolCallsInStep.map((tc) => ({
          type: "tool-result" as const,
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          output: { type: "json" as const, value: tc.output },
        })),
      };
      logger.info(`Tool message for step ${step + 1}`, {
        toolCallCount: toolCallsInStep.length,
      });
      messages.push(toolMsg);

      if (stepRequiresConfirmation) {
        logger.info("Stopping stream due to confirmation requirement");
        return;
      }
    } else {
      return;
    }
  }
}
