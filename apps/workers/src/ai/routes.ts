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
import { streamText } from "ai";
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
import {
  recordAiError,
  recordAiRequest,
  recordModelFallback,
  recordRateLimitHit,
  recordStreamDuration,
} from "./lib/metrics";
import { getQueueStats, isUpstashEnabled } from "./lib/request-queue";
import {
  getModel,
  getModelChain,
  isAiEnabled,
  isRateLimitError,
} from "./providers";
import { executeTool } from "./tools/tool-executor";

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

type StreamResult =
  | {
      type: "chunk";
      chunk: string;
      modelUsed: string;
    }
  | {
      type: "tool_call";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      modelUsed: string;
    }
  | {
      type: "tool_result";
      toolCallId: string;
      result: unknown;
      modelUsed: string;
    };

type StreamContext = {
  workspaceId: string;
  userId: string;
};

type StreamOptions = {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  messageId: string;
  tools: Record<string, unknown> | null;
  ctx: StreamContext;
};

async function* streamWithFallback(
  opts: StreamOptions
): AsyncGenerator<StreamResult, void, unknown> {
  const { systemPrompt, messages, messageId, tools, ctx } = opts;
  const modelChain = getModelChain();

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
      });

      const model = getModel(modelName);

      const streamOptions: Parameters<typeof streamText>[0] = {
        model,
        system: systemPrompt,
        messages,
      };

      if (tools) {
        // @ts-expect-error - Dynamic tools type
        streamOptions.tools = tools;
      }

      const result = streamText(streamOptions);

      modelSpan.addEvent("ai.stream_start");

      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          // biome-ignore lint/suspicious/noExplicitAny: TODO: infer types here
          const chunk = (part as any).textDelta ?? (part as any).text ?? "";
          yield { type: "chunk", chunk, modelUsed: modelName };
        } else if (part.type === "tool-call") {
          const toolCallPart = part as unknown as {
            toolCallId: string;
            toolName: string;
            args: unknown;
          };
          yield {
            type: "tool_call",
            toolCallId: toolCallPart.toolCallId,
            toolName: toolCallPart.toolName,
            args: toolCallPart.args as Record<string, unknown>,
            modelUsed: modelName,
          };

          const toolResult = await executeTool(
            toolCallPart.toolName,
            toolCallPart.args as Record<string, unknown>,
            ctx
          );

          yield {
            type: "tool_result",
            toolCallId: toolCallPart.toolCallId,
            result: toolResult,
            modelUsed: modelName,
          };
        }
      }

      // Success - record metrics and end span
      modelSpan.addEvent("ai.stream_complete");
      modelSpan.setStatus({ code: SpanStatusCode.OK });
      modelSpan.end();

      logger.info("Model streaming completed", {
        workspaceId: ctx.workspaceId,
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
        workspaceId: ctx.workspaceId,
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

          // Get or create conversation for this workspace
          const conversation = await getOrCreateConversation(workspaceId);
          span.setAttribute("ai.conversation_id", conversation.id);

          // Save user message to database
          const userMessageId = generateMessageId();
          await addMessage(conversation.id, {
            id: userMessageId,
            role: "user",
            content: message,
            contextSnapshot: _context,
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
            let hasToolCalls = false;

            try {
              const startEvent: StreamEvent = {
                type: "message_start",
                messageId,
              };
              yield sse({ event: "message", data: startEvent });

              try {
                // Determine tools needed for this message
                const tools = getToolsForMessage(message);
                const streamCtx = { workspaceId, userId: session.user.id };

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
                      result: part.result,
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

              // Check if we got empty content (might indicate a silent error)
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

              // Save assistant message to database
              // Title generation happens asynchronously via callback
              try {
                const { titleWillGenerate } = await addMessage(
                  conversation.id,
                  {
                    id: messageId,
                    role: "assistant",
                    content: fullContent,
                  }
                );

                // If title will be generated, the callback will be called later
                // We don't block the response waiting for it
                if (titleWillGenerate) {
                  span.setAttribute("ai.title_generation_started", true);
                  logger.info("Title generation started asynchronously", {
                    conversationId: conversation.id,
                  });
                }
              } catch (saveError) {
                // Log but don't fail the request if saving fails
                logger.error("Failed to save assistant message", {
                  workspaceId,
                  messageId,
                  error:
                    saveError instanceof Error ? saveError.message : "Unknown",
                });
              }

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
  )

  // Get conversation for a workspace
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

      // Verify workspace access
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

  // Clear conversation
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

      // Verify workspace access
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

  // Get queue stats
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

  // Run maintenance tasks (summarization and cleanup)
  // This should be called periodically via cron or manually by admins
  .post("/api/ai/maintenance", async ({ headers, set }) => {
    // Verify admin authentication
    const session = await auth.api.getSession({
      headers: toHeaders(headers),
    });
    if (!session) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    // Import dynamically to avoid circular dependencies
    const { runMaintenanceTasks } = await import("./chats/summarization");

    logger.info("Running AI maintenance tasks", {
      userId: session.user.id,
    });

    // Run in background, return immediately
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
