import type { AiMessage } from "@lumen/ai/types";
import { prisma } from "@lumen/db";
import { createLogger } from "@lumen/logger";
import {
  getTracer,
  recordSpanError,
  SpanStatusCode,
} from "@lumen/logger/tracer";
import {
  decryptContent,
  encryptContent,
  isEncryptionEnabled,
} from "../lib/encryption";
import {
  generateConversationTitle,
  shouldGenerateTitle,
} from "./title-generator";

const logger = createLogger({ name: "ai:conversation-service" });
const tracer = getTracer("lumen-ai");
const SUMMARIZATION_THRESHOLD = 50;
const summarizationInProgress = new Set<string>();

async function triggerAutoSummarization(conversationId: string): Promise<void> {
  // Avoid duplicate summarization runs
  if (summarizationInProgress.has(conversationId)) {
    return;
  }

  summarizationInProgress.add(conversationId);

  try {
    // Dynamic import to avoid circular dependency
    const { summarizeConversation } = await import("./summarization");

    logger.info("Auto-summarization triggered", { conversationId });

    const result = await summarizeConversation(conversationId, {
      deleteOldMessages: true,
    });

    if (result.success) {
      logger.info("Auto-summarization completed", {
        conversationId,
        messagesArchived: result.messagesArchived,
      });
    }
  } catch (error) {
    logger.error("Auto-summarization failed", {
      conversationId,
      error: error instanceof Error ? error.message : "Unknown",
    });
  } finally {
    summarizationInProgress.delete(conversationId);
  }
}

// Log encryption status on module load
if (isEncryptionEnabled()) {
  logger.info("AI message encryption is ENABLED");
} else {
  logger.warn(
    "AI message encryption is DISABLED. Set AI_ENCRYPTION_KEY for production."
  );
}

const pendingTitleGenerations = new Map<
  string,
  (title: string | null) => void
>();

export function onTitleGenerated(
  conversationId: string,
  callback: (title: string | null) => void
): () => void {
  pendingTitleGenerations.set(conversationId, callback);
  return () => pendingTitleGenerations.delete(conversationId);
}

async function generateTitleAsync(
  conversationId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<void> {
  try {
    const title = await generateConversationTitle({ messages });

    if (title) {
      await prisma.aiConversation.update({
        where: { id: conversationId },
        data: { title },
      });

      logger.info("Generated and saved conversation title", {
        conversationId,
        title,
      });

      // Notify any registered callback
      const callback = pendingTitleGenerations.get(conversationId);
      if (callback) {
        callback(title);
        pendingTitleGenerations.delete(conversationId);
      }
    }
  } catch (error) {
    logger.error("Async title generation failed", {
      conversationId,
      error: error instanceof Error ? error.message : "Unknown",
    });
  }
}

export type ConversationWithMessages = {
  id: string;
  workspaceId: string;
  title: string | null;
  summary: string | null;
  summaryUpToIndex: number;
  messageCount: number;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    toolCalls: unknown;
    toolCallId: string | null;
    toolName: string | null;
    contextSnapshot: unknown;
    requiresConfirmation: boolean;
    pendingAction: unknown;
    metadata: unknown;
    confirmedAt: Date | null;
    createdAt: Date;
  }>;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export async function getOrCreateConversation(
  workspaceId: string,
  userId: string
): Promise<ConversationWithMessages> {
  const span = tracer.startSpan("ai.getOrCreateConversation");
  span.setAttribute("ai.workspace_id", workspaceId);
  span.setAttribute("ai.user_id", userId);

  try {
    // Try to find existing conversation
    let conversation = await prisma.aiConversation.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      // Create new conversation
      conversation = await prisma.aiConversation.create({
        data: {
          workspaceId,
          userId,
          messageCount: 0,
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      logger.info("Created new AI conversation", {
        conversationId: conversation.id,
        workspaceId,
        userId,
      });
    }

    span.setAttribute("ai.conversation_id", conversation.id);
    span.setAttribute("ai.message_count", conversation.messageCount);
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    return conversation;
  } catch (error) {
    recordSpanError(span, error);
    span.end();
    throw error;
  }
}

export async function addMessage(
  conversationId: string,
  message: {
    id: string;
    role: "user" | "assistant" | "tool";
    content: string;
    toolCalls?: unknown;
    toolCallId?: string;
    toolName?: string;
    contextSnapshot?: unknown;
    requiresConfirmation?: boolean;
    pendingAction?: unknown;
    metadata?: unknown;
  }
): Promise<{ message: AiMessage; titleWillGenerate?: boolean }> {
  const span = tracer.startSpan("ai.addMessage");
  span.setAttributes({
    "ai.conversation_id": conversationId,
    "ai.message_id": message.id,
    "ai.role": message.role,
    "ai.content_length": message.content.length,
  });

  try {
    const encryptedContent = await encryptContent(message.content);
    const result = await prisma.$transaction(async (tx) => {
      // Create the message
      const createdMessage = await tx.aiMessage.create({
        data: {
          id: message.id,
          conversationId,
          role: message.role,
          content: encryptedContent,
          toolCalls: message.toolCalls ?? undefined,
          toolCallId: message.toolCallId ?? undefined,
          toolName: message.toolName ?? undefined,
          contextSnapshot: message.contextSnapshot ?? undefined,
          requiresConfirmation: message.requiresConfirmation ?? false,
          pendingAction: message.pendingAction ?? undefined,
          metadata: message.metadata ?? undefined,
        },
      });

      // Update conversation message count and last active
      const updatedConversation = await tx.aiConversation.update({
        where: { id: conversationId },
        data: {
          messageCount: { increment: 1 },
          lastActiveAt: new Date(),
        },
        select: {
          messageCount: true,
          title: true,
        },
      });

      return { createdMessage, updatedConversation };
    });

    const aiMessage: AiMessage = {
      id: result.createdMessage.id,
      role: result.createdMessage.role as "user" | "assistant" | "tool",
      content: result.createdMessage.content,
      toolCalls: result.createdMessage.toolCalls as AiMessage["toolCalls"],
      toolCallId: result.createdMessage.toolCallId ?? undefined,
      toolName: result.createdMessage.toolName ?? undefined,
      contextSnapshot: result.createdMessage
        .contextSnapshot as AiMessage["contextSnapshot"],
      requiresConfirmation: result.createdMessage.requiresConfirmation,
      pendingAction: result.createdMessage
        .pendingAction as AiMessage["pendingAction"],
      metadata: result.createdMessage.metadata as AiMessage["metadata"],
      confirmedAt: result.createdMessage.confirmedAt?.toISOString(),
      createdAt: result.createdMessage.createdAt.toISOString(),
    };

    let titleWillGenerate = false;

    // Check if we should generate a title
    if (
      shouldGenerateTitle(
        result.updatedConversation.messageCount,
        !!result.updatedConversation.title
      )
    ) {
      // Fetch recent messages for title generation
      const recentMessages = await prisma.aiMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: 6,
        select: { role: true, content: true },
      });

      const decryptedMessages = await Promise.all(
        recentMessages.map(async (m) => ({
          role: m.role,
          content: await decryptContent(m.content),
        }))
      );

      const messagesToUse = decryptedMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      if (messagesToUse.length >= 4) {
        titleWillGenerate = true;
        // Fire and forget - don't block the response
        // The caller can register a callback via onTitleGenerated to get notified
        generateTitleAsync(conversationId, messagesToUse);
      }
    }

    // Check if we need to auto-summarize (fire and forget)
    if (result.updatedConversation.messageCount >= SUMMARIZATION_THRESHOLD) {
      triggerAutoSummarization(conversationId);
    }

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    return { message: aiMessage, titleWillGenerate };
  } catch (error) {
    recordSpanError(span, error);
    span.end();
    throw error;
  }
}

export async function getConversationContext(
  conversationId: string,
  limit = 20
): Promise<{
  summary: string | null;
  messages: Array<{ role: string; content: string }>;
}> {
  const span = tracer.startSpan("ai.getConversationContext");
  span.setAttribute("ai.conversation_id", conversationId);
  span.setAttribute("ai.limit", limit);

  try {
    const conversation = await prisma.aiConversation.findUnique({
      where: { id: conversationId },
      select: {
        summary: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: limit,
          select: { role: true, content: true },
        },
      },
    });

    if (!conversation) {
      span.end();
      return { summary: null, messages: [] };
    }

    // Decrypt messages and reverse to get chronological order
    const decryptedMessages = await Promise.all(
      conversation.messages.map(async (m) => ({
        role: m.role,
        content: await decryptContent(m.content),
      }))
    );
    const messages = decryptedMessages.reverse();

    span.setAttribute("ai.message_count", messages.length);
    span.setAttribute("ai.has_summary", !!conversation.summary);
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    // Also decrypt summary if present
    const summary = conversation.summary
      ? await decryptContent(conversation.summary)
      : null;

    return {
      summary,
      messages,
    };
  } catch (error) {
    recordSpanError(span, error);
    span.end();
    throw error;
  }
}

export async function deleteMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  const span = tracer.startSpan("ai.deleteMessage");
  span.setAttributes({
    "ai.conversation_id": conversationId,
    "ai.message_id": messageId,
  });

  try {
    await prisma.$transaction(async (tx) => {
      // Check if message exists and belongs to conversation
      const message = await tx.aiMessage.findUnique({
        where: { id: messageId },
        select: { conversationId: true },
      });

      if (!message || message.conversationId !== conversationId) {
        return;
      }

      await tx.aiMessage.delete({
        where: { id: messageId },
      });

      // Update message count
      await tx.aiConversation.update({
        where: { id: conversationId },
        data: {
          messageCount: { decrement: 1 },
        },
      });
    });

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  } catch (error) {
    recordSpanError(span, error);
    span.end();
    throw error;
  }
}

export async function clearConversation(conversationId: string): Promise<void> {
  const span = tracer.startSpan("ai.clearConversation");
  span.setAttribute("ai.conversation_id", conversationId);

  try {
    await prisma.$transaction([
      prisma.aiMessage.deleteMany({
        where: { conversationId },
      }),
      prisma.aiConversation.update({
        where: { id: conversationId },
        data: {
          messageCount: 0,
          summary: null,
          summaryUpToIndex: 0,
          title: null,
          lastActiveAt: new Date(),
        },
      }),
    ]);

    logger.info("Cleared AI conversation", { conversationId });

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  } catch (error) {
    recordSpanError(span, error);
    span.end();
    throw error;
  }
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  await prisma.aiConversation.update({
    where: { id: conversationId },
    data: { title },
  });
}

export async function toApiMessages(
  dbMessages: ConversationWithMessages["messages"]
): Promise<AiMessage[]> {
  // Decrypt all messages in parallel
  const decryptedMessages = await Promise.all(
    dbMessages.map(async (m) => ({
      id: m.id,
      role: m.role as "user" | "assistant" | "tool",
      content: await decryptContent(m.content),
      toolCalls: m.toolCalls as AiMessage["toolCalls"],
      toolCallId: m.toolCallId ?? undefined,
      toolName: m.toolName ?? undefined,
      contextSnapshot: m.contextSnapshot as AiMessage["contextSnapshot"],
      requiresConfirmation: m.requiresConfirmation,
      pendingAction: m.pendingAction as AiMessage["pendingAction"],
      metadata: m.metadata as AiMessage["metadata"],
      confirmedAt: m.confirmedAt?.toISOString(),
      createdAt: m.createdAt.toISOString(),
    }))
  );

  return decryptedMessages;
}
