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
import { getCollaborator } from "../collab/helpers";
import { toHeaders } from "../utils/headers";
import {
  recordAiError,
  recordAiRequest,
  recordModelFallback,
  recordRateLimitHit,
  recordStreamDuration,
} from "./metrics";
import {
  getModel,
  getModelChain,
  isAiEnabled,
  isRateLimitError,
} from "./providers";

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

  if (isRateLimitError(error)) {
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

async function* streamWithFallback(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  workspaceId: string,
  messageId: string
): AsyncGenerator<{ chunk: string; modelUsed: string }, void, unknown> {
  const modelChain = getModelChain();

  for (let i = 0; i < modelChain.length; i++) {
    const modelName = modelChain[i];
    const isLastModel = i === modelChain.length - 1;

    // Create a child span for each model attempt
    const modelSpan = tracer.startSpan(`ai.model.${modelName}`, {
      attributes: {
        "ai.model": modelName,
        "ai.attempt": i + 1,
        "ai.total_models": modelChain.length,
        "ai.is_fallback": i > 0,
        "ai.workspace_id": workspaceId,
        "ai.message_id": messageId,
      },
    });

    try {
      logger.info("Attempting model", {
        workspaceId,
        messageId,
        model: modelName,
        attempt: i + 1,
        totalModels: modelChain.length,
        isFallback: i > 0,
      });

      const model = getModel(modelName);
      const result = streamText({
        model,
        system: systemPrompt,
        messages,
      });

      modelSpan.addEvent("ai.stream_start");

      for await (const chunk of result.textStream) {
        yield { chunk, modelUsed: modelName };
      }

      // Success - record metrics and end span
      modelSpan.addEvent("ai.stream_complete");
      modelSpan.setStatus({ code: SpanStatusCode.OK });
      modelSpan.end();

      logger.info("Model streaming completed", {
        workspaceId,
        messageId,
        model: modelName,
        isFallback: i > 0,
      });
      return;
    } catch (error) {
      const rateLimited = isRateLimitError(error);

      // Record error on span
      recordSpanError(modelSpan, error);
      modelSpan.setAttribute("ai.rate_limited", rateLimited);
      modelSpan.end();

      logger.warn("Model failed", {
        workspaceId,
        messageId,
        model: modelName,
        isRateLimit: rateLimited,
        error: error instanceof Error ? error.message : "Unknown",
        willTryNext: !isLastModel && rateLimited,
      });

      // Record metrics
      if (rateLimited) {
        recordRateLimitHit({ model: modelName });
        recordAiError({ model: modelName, errorType: "rate_limit" });
      } else {
        recordAiError({ model: modelName, errorType: "api_error" });
      }

      // Only try next model if this was a rate limit error
      if (!rateLimited || isLastModel) {
        throw error;
      }

      // Record fallback metric
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

  throw new Error("All models exhausted");
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
        const streamStartTime = performance.now();

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

        // Verify workspace access - check if user is owner or collaborator
        // Note: Local workspaces may not exist in the database yet, so absence
        // doesn't mean unauthorized - we allow access to local workspaces
        const workspaceAccess = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { ownerId: true },
        });

        if (workspaceAccess) {
          // Workspace exists in database - verify user has access
          const isOwner = workspaceAccess.ownerId === session.user.id;
          if (!isOwner) {
            const collaborator = await getCollaborator(
              workspaceId,
              session.user.id
            );
            if (!collaborator) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: "Forbidden: User is not a member of this workspace",
              });
              span.end();
              set.status = 403;
              logger.warn("Unauthorized workspace access attempt", {
                userId: session.user.id,
                workspaceId,
                operation: "ai.chat",
              });
              return {
                error: "Access denied: You are not a member of this workspace",
              };
            }
          }
        }
        // If workspace doesn't exist in DB, assume it's a local workspace owned by the user

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
                select: { id: true, name: true },
              },
            },
          });

          // Calculate total members including owner if they're not in collaborators
          const ownerIncluded = workspace?.owner
            ? collaborators.some((c) => c.user.id === workspace.owner.id)
              ? 0
              : 1
            : 0;
          const totalMembers = collaborators.length + ownerIncluded;
          const isShared = totalMembers > 1;

          const collaboratorList = collaborators
            .filter((c) => c.user.id !== session.user.id)
            .map((c) => ({
              name: c.user.name ?? "Unknown",
              role: c.role as "owner" | "admin" | "member" | "viewer",
            }));

          const systemPrompt = buildSystemPrompt({
            userName: session.user.name ?? undefined,
            workspaceId,
            workspaceName: workspace?.name ?? undefined,
            isShared,
            totalMembers,
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

          return (async function* () {
            let modelUsed = "unknown";
            let fullContent = "";

            try {
              const startEvent: StreamEvent = {
                type: "message_start",
                messageId,
              };
              yield sse({ event: "message", data: startEvent });

              try {
                for await (const {
                  chunk,
                  modelUsed: model,
                } of streamWithFallback(
                  systemPrompt,
                  messages,
                  workspaceId,
                  messageId
                )) {
                  modelUsed = model;
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
                  modelUsed,
                  error:
                    streamError instanceof Error
                      ? streamError.message
                      : "Unknown",
                  isRateLimit: parsedError.isRateLimit,
                });

                const streamDuration =
                  (performance.now() - streamStartTime) / 1000;
                recordStreamDuration(streamDuration, {
                  model: modelUsed,
                  success: false,
                });
                recordAiRequest({
                  model: modelUsed,
                  workspaceId,
                  status: parsedError.isRateLimit ? "rate_limited" : "error",
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

              const streamDuration =
                (performance.now() - streamStartTime) / 1000;

              // Check if we got empty content (might indicate a silent error)
              if (fullContent.length === 0) {
                logger.warn("AI stream completed with empty content", {
                  workspaceId,
                  messageId,
                  modelUsed,
                });

                recordStreamDuration(streamDuration, {
                  model: modelUsed,
                  success: false,
                });
                recordAiRequest({
                  model: modelUsed,
                  workspaceId,
                  status: "error",
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

              // Record success metrics
              recordStreamDuration(streamDuration, {
                model: modelUsed,
                success: true,
              });
              recordAiRequest({
                model: modelUsed,
                workspaceId,
                status: "success",
              });

              // Set final span attributes
              span.setAttribute("ai.model_used", modelUsed);
              span.setAttribute("ai.response_length", fullContent.length);
              span.setAttribute("ai.stream_duration_seconds", streamDuration);
              span.addEvent("ai.stream_complete");
              span.setStatus({ code: SpanStatusCode.OK });
              span.end();

              logger.info("AI chat completed", {
                workspaceId,
                messageId,
                modelUsed,
                responseLength: fullContent.length,
                streamDurationSeconds: streamDuration.toFixed(3),
              });
            } catch (error) {
              recordSpanError(span, error);
              span.end();

              const parsedError = parseRateLimitError(error);
              const streamDuration =
                (performance.now() - streamStartTime) / 1000;

              // Record error metrics
              recordStreamDuration(streamDuration, {
                model: modelUsed,
                success: false,
              });
              recordAiRequest({
                model: modelUsed,
                workspaceId,
                status: parsedError.isRateLimit ? "rate_limited" : "error",
              });

              logger.error("AI streaming error", {
                workspaceId,
                messageId,
                modelUsed,
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

          // Record error metrics
          recordAiRequest({
            model: "unknown",
            workspaceId,
            status: parsedError.isRateLimit ? "rate_limited" : "error",
          });

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
