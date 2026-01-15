import { prisma } from "@lumen/db";
import { createLogger } from "@lumen/logger";
import { getTracer, SpanStatusCode } from "@lumen/logger/tracer";
import { generateText } from "ai";
import { decryptContent, encryptContent } from "../lib/encryption";
import { aiRequestQueue } from "../lib/request-queue";
import { getModel } from "../providers";

const logger = createLogger({ name: "ai:summarization" });
const tracer = getTracer("lumen-ai");
const SUMMARIZATION_THRESHOLD = 50;
const MESSAGES_TO_KEEP = 20;
const CONVERSATION_TTL_DAYS = 30;

const SUMMARIZATION_PROMPT = `You are a conversation summarizer. Given a conversation between a user and Larity (an AI assistant for kanban/task management), create a concise summary that captures:
1. The main topics discussed
2. Key decisions or actions taken
3. Important context that might be relevant for future conversations

Keep the summary under 500 words. Focus on factual information and user preferences.
Format as a brief paragraph, not bullet points.

Respond with ONLY the summary, nothing else.`;

export async function needsSummarization(
  conversationId: string
): Promise<boolean> {
  const conversation = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
    select: { messageCount: true, summaryUpToIndex: true },
  });

  if (!conversation) {
    return false;
  }

  // Need to summarize if we have more than threshold messages
  // and haven't summarized recently
  const unsummarizedMessages =
    conversation.messageCount - conversation.summaryUpToIndex;
  return unsummarizedMessages >= SUMMARIZATION_THRESHOLD;
}

export async function summarizeConversation(
  conversationId: string,
  options: { deleteOldMessages?: boolean } = {}
): Promise<{ success: boolean; summary?: string; messagesArchived?: number }> {
  const { deleteOldMessages = true } = options;
  const span = tracer.startSpan("ai.summarizeConversation");
  span.setAttribute("ai.conversation_id", conversationId);

  try {
    const conversation = await prisma.aiConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    });

    if (!conversation) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: "Not found" });
      span.end();
      return { success: false };
    }

    // Get messages to summarize (all except the most recent MESSAGES_TO_KEEP)
    const messagesToKeep = conversation.messages.slice(-MESSAGES_TO_KEEP);
    const messagesToSummarize = conversation.messages.slice(
      0,
      -MESSAGES_TO_KEEP
    );

    if (messagesToSummarize.length === 0) {
      logger.info("No messages to summarize", { conversationId });
      span.end();
      return { success: true, messagesArchived: 0 };
    }

    // Decrypt messages for summarization
    const decryptedMessages = await Promise.all(
      messagesToSummarize.map(async (m) => ({
        role: m.role,
        content: await decryptContent(m.content),
      }))
    );

    // Format messages for the LLM
    const conversationText = decryptedMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map(
        (m) =>
          `${m.role === "user" ? "User" : "Larity"}: ${m.content.slice(0, 1000)}`
      )
      .join("\n\n");

    // Generate summary using the queue for rate limiting
    const { result: summary } = await aiRequestQueue.enqueue(
      async () => {
        const model = getModel("llama3.1-8b");
        const result = await generateText({
          model,
          system: SUMMARIZATION_PROMPT,
          messages: [
            {
              role: "user",
              content: `Summarize this conversation:\n\n${conversationText}`,
            },
          ],
          maxOutputTokens: 500,
          temperature: 0.3,
        });
        return result.text.trim();
      },
      { priority: "low", workspaceId: conversationId }
    );

    if (!summary) {
      logger.warn("Failed to generate summary", { conversationId });
      span.end();
      return { success: false };
    }

    // Encrypt the summary before storing
    const encryptedSummary = await encryptContent(summary);

    // Combine with existing summary if present
    let combinedSummary = encryptedSummary;
    if (conversation.summary) {
      const existingSummary = await decryptContent(conversation.summary);
      const newCombined = `Previous context:\n${existingSummary}\n\nMore recent:\n${summary}`;
      combinedSummary = await encryptContent(newCombined);
    }

    // Update conversation with new summary
    await prisma.$transaction(async (tx) => {
      // Update the conversation summary
      await tx.aiConversation.update({
        where: { id: conversationId },
        data: {
          summary: combinedSummary,
          summaryUpToIndex: conversation.messageCount - messagesToKeep.length,
        },
      });

      // Optionally delete old messages
      if (deleteOldMessages && messagesToSummarize.length > 0) {
        const messageIds = messagesToSummarize.map((m) => m.id);
        await tx.aiMessage.deleteMany({
          where: {
            id: { in: messageIds },
          },
        });

        // Update message count
        await tx.aiConversation.update({
          where: { id: conversationId },
          data: {
            messageCount: messagesToKeep.length,
          },
        });
      }
    });

    logger.info("Conversation summarized", {
      conversationId,
      messagesArchived: messagesToSummarize.length,
      summaryLength: summary.length,
      deletedOldMessages: deleteOldMessages,
    });

    span.setAttribute("ai.messages_archived", messagesToSummarize.length);
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    return {
      success: true,
      summary,
      messagesArchived: messagesToSummarize.length,
    };
  } catch (error) {
    logger.error("Failed to summarize conversation", {
      conversationId,
      error: error instanceof Error ? error.message : "Unknown",
    });
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.end();
    return { success: false };
  }
}

export async function cleanupOldConversations(): Promise<{
  conversationsDeleted: number;
  messagesDeleted: number;
}> {
  const span = tracer.startSpan("ai.cleanupOldConversations");

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CONVERSATION_TTL_DAYS);

    // Find old conversations
    const oldConversations = await prisma.aiConversation.findMany({
      where: {
        lastActiveAt: { lt: cutoffDate },
      },
      select: { id: true, messageCount: true },
    });

    if (oldConversations.length === 0) {
      span.end();
      return { conversationsDeleted: 0, messagesDeleted: 0 };
    }

    const conversationIds = oldConversations.map((c) => c.id);
    const totalMessages = oldConversations.reduce(
      (sum, c) => sum + c.messageCount,
      0
    );

    // Delete messages first (due to foreign key)
    await prisma.aiMessage.deleteMany({
      where: { conversationId: { in: conversationIds } },
    });

    // Then delete conversations
    await prisma.aiConversation.deleteMany({
      where: { id: { in: conversationIds } },
    });

    logger.info("Cleaned up old conversations", {
      conversationsDeleted: conversationIds.length,
      messagesDeleted: totalMessages,
      cutoffDate: cutoffDate.toISOString(),
    });

    span.setAttribute("ai.conversations_deleted", conversationIds.length);
    span.setAttribute("ai.messages_deleted", totalMessages);
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    return {
      conversationsDeleted: conversationIds.length,
      messagesDeleted: totalMessages,
    };
  } catch (error) {
    logger.error("Failed to cleanup old conversations", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.end();
    return { conversationsDeleted: 0, messagesDeleted: 0 };
  }
}

export async function runMaintenanceTasks(): Promise<void> {
  logger.info("Starting AI maintenance tasks");

  // 1. Find conversations that need summarization
  const conversationsNeedingSummary = await prisma.aiConversation.findMany({
    where: {
      messageCount: { gte: SUMMARIZATION_THRESHOLD },
    },
    select: { id: true, messageCount: true, summaryUpToIndex: true },
  });

  for (const conv of conversationsNeedingSummary) {
    const unsummarized = conv.messageCount - conv.summaryUpToIndex;
    if (unsummarized >= SUMMARIZATION_THRESHOLD) {
      await summarizeConversation(conv.id);
    }
  }

  // 2. Cleanup old conversations
  await cleanupOldConversations();

  logger.info("AI maintenance tasks completed");
}
