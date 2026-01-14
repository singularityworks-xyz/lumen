import type { StreamEvent } from "@lumen/ai";
import { createLogger } from "@lumen/logger";
import {
  getTracer,
  recordSpanError,
  SpanStatusCode,
} from "@lumen/logger/tracer";
import { streamText } from "ai";
import { Elysia, sse, t } from "elysia";
import { auth } from "../auth/config/auth";
import { toHeaders } from "../utils/headers";
import { getModel, isAiEnabled } from "./providers";
import { buildSystemPrompt } from "./system-prompt";

const logger = createLogger({ name: "ai:routes" });
const tracer = getTracer("lumen-ai");

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export const aiRoutes = new Elysia({ name: "ai-routes" })
  .get("/api/ai/health", () => ({
    enabled: isAiEnabled(),
    status: isAiEnabled() ? "ready" : "disabled",
  }))

  .post(
    "/api/ai/chat",
    // biome-ignore lint/suspicious/useAwait: Necessary for streaming response
    async ({ body, headers, set }) => {
      const { workspaceId, message, context: _context, history } = body;

      return tracer.startActiveSpan("ai.chat", async (span) => {
        span.setAttributes({
          "ai.workspace_id": workspaceId,
          "ai.message_length": message.length,
          "ai.history_length": history?.length ?? 0,
        });

        const session = await auth.api.getSession({
          headers: toHeaders(headers),
        });
        if (!session) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: "Unauthorized",
          });
          span.end();
          set.status = 401;
          return { error: "Unauthorized" };
        }

        span.setAttribute("ai.user_id", session.user.id);

        if (!isAiEnabled()) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: "AI not configured",
          });
          span.end();
          set.status = 503;
          return { error: "AI features are not configured" };
        }

        const messageId = generateMessageId();
        span.setAttribute("ai.message_id", messageId);

        logger.info("Starting AI chat", {
          workspaceId,
          userId: session.user.id,
          messageId,
          messageLength: message.length,
          historyLength: history?.length ?? 0,
        });

        try {
          const model = getModel();
          const systemPrompt = buildSystemPrompt({
            workspaceId,
            userName: session.user.name ?? undefined,
          });

          const messages: Array<{
            role: "user" | "assistant";
            content: string;
          }> = [];

          if (history) {
            for (const msg of history) {
              if (msg.role === "user" || msg.role === "assistant") {
                messages.push({
                  role: msg.role,
                  content: msg.content,
                });
              }
            }
          }

          messages.push({
            role: "user",
            content: message,
          });

          span.addEvent("ai.stream_start");

          const result = streamText({
            model,
            system: systemPrompt,
            messages,
          });

          // Note: span.end() is called inside the generator when streaming completes
          return (async function* () {
            try {
              const startEvent: StreamEvent = {
                type: "message_start",
                messageId,
              };
              yield sse({ event: "message", data: startEvent });

              let fullContent = "";

              for await (const chunk of result.textStream) {
                fullContent += chunk;
                const deltaEvent: StreamEvent = {
                  type: "content_delta",
                  content: chunk,
                };
                yield sse({ event: "message", data: deltaEvent });
              }

              const completeEvent: StreamEvent = {
                type: "message_complete",
                message: {
                  id: messageId,
                  role: "assistant",
                  content: fullContent,
                  createdAt: new Date().toISOString(),
                },
              };
              yield sse({ event: "message", data: completeEvent });

              span.setAttribute("ai.response_length", fullContent.length);
              span.addEvent("ai.stream_complete");
              span.setStatus({ code: SpanStatusCode.OK });
              span.end();

              logger.info("AI chat completed", {
                workspaceId,
                messageId,
                responseLength: fullContent.length,
              });
            } catch (error) {
              recordSpanError(span, error);
              span.end();

              logger.error("AI streaming error", {
                workspaceId,
                messageId,
                error: error instanceof Error ? error.message : "Unknown",
              });

              const errorEvent: StreamEvent = {
                type: "error",
                error:
                  error instanceof Error ? error.message : "An error occurred",
              };
              yield sse({ event: "error", data: errorEvent });
            }
          })();
        } catch (error) {
          recordSpanError(span, error);
          span.end();

          logger.error("AI chat error", {
            workspaceId,
            error: error instanceof Error ? error.message : "Unknown",
            stack: error instanceof Error ? error.stack : undefined,
          });

          set.status = 500;
          return {
            error: "Failed to process chat request",
            message: error instanceof Error ? error.message : "Unknown error",
          };
        }
      });
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        message: t.String(),
        context: t.Optional(
          t.Object({
            currentBoardId: t.Union([t.String(), t.Null()]),
            selectedTaskIds: t.Array(t.String()),
            selectedBoardIds: t.Array(t.String()),
            viewportCenter: t.Object({
              x: t.Number(),
              y: t.Number(),
            }),
            viewportZoom: t.Number(),
          })
        ),
        history: t.Optional(
          t.Array(
            t.Object({
              role: t.Union([
                t.Literal("user"),
                t.Literal("assistant"),
                t.Literal("tool"),
              ]),
              content: t.String(),
            })
          )
        ),
      }),
    }
  );
