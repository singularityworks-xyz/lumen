import { buildSystemPrompt, type StreamEvent } from "@lumen/ai";
import { prisma } from "@lumen/db";
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

const logger = createLogger({ name: "ai:routes" });
const tracer = getTracer("lumen-ai");
const RETRY_MATCH_REGEX = /retry in (\d+(?:\.\d+)?)/i;

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function parseRateLimitError(error: unknown): {
  isRateLimit: boolean;
  retryAfterSeconds?: number;
  message: string;
} {
  if (!(error instanceof Error)) {
    return { isRateLimit: false, message: "An error occurred" };
  }

  const errorMessage = error.message;

  if (
    errorMessage.includes("quota") ||
    errorMessage.includes("rate limit") ||
    errorMessage.includes("429") ||
    errorMessage.includes("RESOURCE_EXHAUSTED")
  ) {
    const retryMatch = errorMessage.match(RETRY_MATCH_REGEX);
    const retryAfterSeconds = retryMatch
      ? Math.ceil(Number.parseFloat(retryMatch[1]))
      : 60;

    return {
      isRateLimit: true,
      retryAfterSeconds,
      message: `Rate limit reached. Please wait ${retryAfterSeconds} seconds before trying again.`,
    };
  }

  return { isRateLimit: false, message: errorMessage };
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
          const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: {
              name: true,
              owner: {
                select: { id: true, name: true, email: true },
              },
            },
          });
          const collaborators = await prisma.workspaceCollaborator.findMany({
            where: { workspaceId },
            select: {
              role: true,
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          });

          const isShared = collaborators.length > 1;

          const collaboratorList = collaborators
            .filter((c) => c.user.id !== session.user.id)
            .map((c) => ({
              name: c.user.name ?? "Unknown",
              email: c.user.email ?? undefined,
              role: c.role as "owner" | "admin" | "member" | "viewer",
            }));

          const systemPrompt = buildSystemPrompt({
            userName: session.user.name ?? undefined,
            userEmail: session.user.email ?? undefined,
            workspaceId,
            workspaceName: workspace?.name ?? undefined,
            isShared,
            collaborators:
              collaboratorList.length > 0 ? collaboratorList : undefined,
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

          return (async function* () {
            try {
              const startEvent: StreamEvent = {
                type: "message_start",
                messageId,
              };
              yield sse({ event: "message", data: startEvent });

              let fullContent = "";

              try {
                for await (const chunk of result.textStream) {
                  fullContent += chunk;
                  const deltaEvent: StreamEvent = {
                    type: "content_delta",
                    content: chunk,
                  };
                  yield sse({ event: "message", data: deltaEvent });
                }
              } catch (streamError) {
                const parsedError = parseRateLimitError(streamError);

                logger.error("AI stream iteration error", {
                  workspaceId,
                  messageId,
                  error:
                    streamError instanceof Error
                      ? streamError.message
                      : "Unknown",
                  isRateLimit: parsedError.isRateLimit,
                });

                const errorEvent: StreamEvent = {
                  type: "error",
                  error: parsedError.message,
                };
                yield sse({ event: "error", data: errorEvent });

                recordSpanError(span, streamError);
                span.end();
                return;
              }

              // Check if we got empty content (might indicate a silent error)
              if (fullContent.length === 0) {
                logger.warn("AI stream completed with empty content", {
                  workspaceId,
                  messageId,
                });

                const errorEvent: StreamEvent = {
                  type: "error",
                  error:
                    "Failed to generate response. Please try again in a moment.",
                };
                yield sse({ event: "error", data: errorEvent });

                span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: "Empty response",
                });
                span.end();
                return;
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

              const parsedError = parseRateLimitError(error);

              logger.error("AI streaming error", {
                workspaceId,
                messageId,
                error: error instanceof Error ? error.message : "Unknown",
                isRateLimit: parsedError.isRateLimit,
                retryAfterSeconds: parsedError.retryAfterSeconds,
              });

              const errorEvent: StreamEvent = {
                type: "error",
                error: parsedError.message,
              };
              yield sse({ event: "error", data: errorEvent });
            }
          })();
        } catch (error) {
          recordSpanError(span, error);
          span.end();

          const parsedError = parseRateLimitError(error);

          logger.error("AI chat error", {
            workspaceId,
            error: error instanceof Error ? error.message : "Unknown",
            isRateLimit: parsedError.isRateLimit,
            retryAfterSeconds: parsedError.retryAfterSeconds,
          });

          set.status = parsedError.isRateLimit ? 429 : 500;
          return {
            error: parsedError.message,
            isRateLimit: parsedError.isRateLimit,
            retryAfterSeconds: parsedError.retryAfterSeconds,
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
