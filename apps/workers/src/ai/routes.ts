import type { StreamEvent } from "@lumen/ai";
import { createLogger } from "@lumen/logger";
import { streamText } from "ai";
import { Elysia, sse, t } from "elysia";
import { auth } from "../auth/config/auth";
import { toHeaders } from "../utils/headers";
import { getModel, isAiEnabled } from "./providers";
import { buildSystemPrompt } from "./system-prompt";

const logger = createLogger({ name: "ai:routes" });

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
    async ({ body, headers, set }) => {
      const { workspaceId, message, context: _context, history } = body;

      const session = await auth.api.getSession({
        headers: toHeaders(headers),
      });
      if (!session) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      if (!isAiEnabled()) {
        set.status = 503;
        return { error: "AI features are not configured" };
      }

      const messageId = generateMessageId();

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

        const result = streamText({
          model,
          system: systemPrompt,
          messages,
        });

        // Use Elysia's sse helper to wrap the AI stream
        // This returns an async generator that yields SSE events
        return (async function* () {
          try {
            // Send message_start event
            const startEvent: StreamEvent = {
              type: "message_start",
              messageId,
            };
            yield sse({ event: "message", data: startEvent });

            let fullContent = "";

            // Stream content deltas from AI
            for await (const chunk of result.textStream) {
              fullContent += chunk;
              const deltaEvent: StreamEvent = {
                type: "content_delta",
                content: chunk,
              };
              yield sse({ event: "message", data: deltaEvent });
            }

            // Send message_complete event
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

            logger.info("AI chat completed", {
              workspaceId,
              messageId,
              responseLength: fullContent.length,
            });
          } catch (error) {
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
