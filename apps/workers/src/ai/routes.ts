import {
  buildSystemPrompt,
  getToolsForMessage,
  type StreamEvent,
} from "@lumen/ai";
import { prisma } from "@lumen/db";
import { createLogger } from "@lumen/logger";
import {
  getTracer,
  recordSpanError,
  SpanStatusCode,
} from "@lumen/logger/tracer";
import { Elysia, sse, t } from "elysia";
import { auth } from "../auth/config/auth";
import { getCollaborator } from "../collab/helpers";
import { toHeaders } from "../utils/headers";
import {
  addMessage,
  clearConversation,
  getOrCreateConversation,
  toApiMessages,
} from "./chats/conversation-service";
import { buildMessagesFromHistory } from "./lib/message-builder";
import { recordAiRequest, recordStreamDuration } from "./lib/metrics";
import { getQueueStats, isUpstashEnabled } from "./lib/request-queue";
import { streamWithFallback } from "./lib/streaming";
import type { HistoryMessage } from "./lib/types";
import { generateMessageId, parseRateLimitError } from "./lib/utils";
import { isAiEnabled } from "./providers";

const logger = createLogger({ name: "ai:routes" });
const tracer = getTracer("lumen-ai");

export const aiRoutes = new Elysia({ name: "ai-routes" })
  .get("/api/ai/health", () => ({
    enabled: isAiEnabled(),
    status: isAiEnabled() ? "ready" : "disabled",
  }))

  .post(
    "/api/ai/chat",
    // biome-ignore lint/suspicious/useAwait: Necessary for streaming response
    async ({ body, headers, set }) => {
      const {
        workspaceId,
        message,
        context: _context,
        history,
        workspaceSnapshot,
        ephemeral,
      } = body;

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
        const workspaceAccess = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { ownerId: true },
        });

        if (workspaceAccess) {
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

          // Only persist conversation for non-ephemeral (shared) workspaces
          let conversation: { id: string } | null = null;
          if (ephemeral) {
            span.setAttribute("ai.ephemeral", true);
            logger.debug("Ephemeral mode - skipping conversation persistence", {
              workspaceId,
            });
          } else {
            conversation = await getOrCreateConversation(workspaceId);
            span.setAttribute("ai.conversation_id", conversation.id);

            const userMessageId = generateMessageId();
            await addMessage(conversation.id, {
              id: userMessageId,
              role: "user",
              content: message,
              contextSnapshot: _context,
            });
          }

          // Build messages from history
          const messages = history
            ? buildMessagesFromHistory(history as HistoryMessage[])
            : [];

          // Add current user message
          messages.push({
            role: "user",
            content: message,
          });

          span.addEvent("ai.stream_start");

          return (async function* () {
            let modelUsed = "unknown";
            let fullContent = "";
            let hasToolCalls = false;

            try {
              const startEvent: StreamEvent = {
                type: "message_start",
                messageId,
              };
              yield sse({ event: "message", data: startEvent });

              try {
                const tools = getToolsForMessage(message);
                const streamCtx = {
                  workspaceId,
                  userId: session.user.id,
                  snapshot: workspaceSnapshot,
                };

                for await (const part of streamWithFallback({
                  systemPrompt,
                  messages,
                  messageId,
                  tools,
                  ctx: streamCtx,
                })) {
                  modelUsed = part.modelUsed;

                  if (part.type === "chunk") {
                    fullContent += part.chunk;
                    const deltaEvent: StreamEvent = {
                      type: "content_delta",
                      content: part.chunk,
                    };
                    yield sse({ event: "message", data: deltaEvent });
                  } else if (part.type === "tool_call") {
                    hasToolCalls = true;
                    const toolEvent: StreamEvent = {
                      type: "tool_call_start",
                      toolName: part.toolName,
                      toolCallId: part.toolCallId,
                    };
                    yield sse({ event: "message", data: toolEvent });
                  } else if (part.type === "tool_result") {
                    const resultEvent: StreamEvent = {
                      type: "tool_call_result",
                      toolCallId: part.toolCallId,
                      result: part.output,
                    };
                    yield sse({ event: "message", data: resultEvent });
                  }
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

              if (fullContent.length === 0 && !hasToolCalls) {
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

              // Only save assistant message for non-ephemeral workspaces
              if (conversation) {
                try {
                  const { titleWillGenerate } = await addMessage(
                    conversation.id,
                    {
                      id: messageId,
                      role: "assistant",
                      content: fullContent,
                    }
                  );

                  if (titleWillGenerate) {
                    span.setAttribute("ai.title_generation_started", true);
                    logger.info("Title generation started asynchronously", {
                      conversationId: conversation.id,
                    });
                  }
                } catch (saveError) {
                  logger.error("Failed to save assistant message", {
                    workspaceId,
                    messageId,
                    error:
                      saveError instanceof Error
                        ? saveError.message
                        : "Unknown",
                  });
                }
              }

              recordStreamDuration(streamDuration, {
                model: modelUsed,
                success: true,
              });
              recordAiRequest({
                model: modelUsed,
                workspaceId,
                status: "success",
              });

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
        workspaceSnapshot: t.Optional(
          t.Object({
            name: t.String(),
            boards: t.Array(
              t.Object({
                id: t.String(),
                name: t.String(),
                description: t.Optional(t.String()),
                accentColor: t.Optional(t.String()),
                icon: t.Optional(t.String()),
                columns: t.Array(
                  t.Object({
                    id: t.String(),
                    name: t.String(),
                    description: t.Optional(t.String()),
                    position: t.Number(),
                    accentColor: t.Optional(t.String()),
                    icon: t.Optional(t.String()),
                    tasks: t.Array(
                      t.Object({
                        id: t.String(),
                        title: t.String(),
                        description: t.Optional(t.String()),
                        priority: t.Union([
                          t.Literal("low"),
                          t.Literal("medium"),
                          t.Literal("high"),
                        ]),
                        status: t.Union([
                          t.Literal("todo"),
                          t.Literal("done"),
                          t.Literal("trash"),
                        ]),
                        progress: t.Number(),
                        position: t.Number(),
                        dueDate: t.Optional(t.String()),
                        tags: t.Optional(t.Array(t.String())),
                        assignedTo: t.Optional(t.String()),
                      })
                    ),
                  })
                ),
              })
            ),
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
              toolCalls: t.Optional(
                t.Array(
                  t.Object({
                    id: t.String(),
                    name: t.String(),
                    arguments: t.Record(t.String(), t.Unknown()),
                  })
                )
              ),
              toolCallId: t.Optional(t.String()),
              toolName: t.Optional(t.String()),
              toolResult: t.Optional(t.Unknown()),
            })
          )
        ),
        /** If true, don't persist conversation to database (for local workspaces) */
        ephemeral: t.Optional(t.Boolean()),
      }),
    }
  )

  .get(
    "/api/ai/conversation/:workspaceId",
    async ({ params, headers, set }) => {
      const { workspaceId } = params;

      const session = await auth.api.getSession({
        headers: toHeaders(headers),
      });
      if (!session) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const workspaceAccess = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { ownerId: true },
      });

      if (workspaceAccess) {
        const isOwner = workspaceAccess.ownerId === session.user.id;
        if (!isOwner) {
          const collaborator = await getCollaborator(
            workspaceId,
            session.user.id
          );
          if (!collaborator) {
            set.status = 403;
            return { error: "Access denied" };
          }
        }
      }

      try {
        const conversation = await getOrCreateConversation(workspaceId);
        const messages = await toApiMessages(conversation.messages);
        return {
          id: conversation.id,
          workspaceId: conversation.workspaceId,
          title: conversation.title,
          messageCount: conversation.messageCount,
          messages,
          lastActiveAt: conversation.lastActiveAt.toISOString(),
          createdAt: conversation.createdAt.toISOString(),
        };
      } catch (error) {
        logger.error("Failed to get conversation", {
          workspaceId,
          error: error instanceof Error ? error.message : "Unknown",
        });
        set.status = 500;
        return { error: "Failed to load conversation" };
      }
    },
    {
      params: t.Object({
        workspaceId: t.String(),
      }),
    }
  )

  .delete(
    "/api/ai/conversation/:workspaceId",
    async ({ params, headers, set }) => {
      const { workspaceId } = params;

      const session = await auth.api.getSession({
        headers: toHeaders(headers),
      });
      if (!session) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const workspaceAccess = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { ownerId: true },
      });

      if (workspaceAccess) {
        const isOwner = workspaceAccess.ownerId === session.user.id;
        if (!isOwner) {
          const collaborator = await getCollaborator(
            workspaceId,
            session.user.id
          );
          if (!collaborator) {
            set.status = 403;
            return { error: "Access denied" };
          }
        }
      }

      try {
        const conversation = await prisma.aiConversation.findUnique({
          where: { workspaceId },
          select: { id: true },
        });

        if (conversation) {
          await clearConversation(conversation.id);
          logger.info("Conversation cleared", {
            workspaceId,
            userId: session.user.id,
          });
        }

        return { success: true };
      } catch (error) {
        logger.error("Failed to clear conversation", {
          workspaceId,
          error: error instanceof Error ? error.message : "Unknown",
        });
        set.status = 500;
        return { error: "Failed to clear conversation" };
      }
    },
    {
      params: t.Object({
        workspaceId: t.String(),
      }),
    }
  )

  .get("/api/ai/queue-stats", () => {
    const stats = getQueueStats();
    return {
      queueLength: stats.queueLength,
      remaining: stats.remaining,
      activeRequests: stats.activeRequests,
      isProcessing: stats.isProcessing,
      usingUpstash: isUpstashEnabled(),
      rateLimit: 30,
      windowSizeSeconds: 60,
    };
  })

  .post("/api/ai/maintenance", async ({ headers, set }) => {
    const session = await auth.api.getSession({
      headers: toHeaders(headers),
    });
    if (!session) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { runMaintenanceTasks } = await import("./chats/summarization");

    logger.info("Running AI maintenance tasks", {
      userId: session.user.id,
    });

    runMaintenanceTasks().catch((error) => {
      logger.error("Maintenance tasks failed", {
        error: error instanceof Error ? error.message : "Unknown",
      });
    });

    return {
      message: "Maintenance tasks started",
      note: "Tasks running in background",
    };
  });
