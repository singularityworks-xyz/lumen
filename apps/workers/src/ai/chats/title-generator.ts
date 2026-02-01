import { createLogger } from "@lumen/logger";
import {
  getTracer,
  recordSpanError,
  SpanStatusCode,
} from "@lumen/logger/tracer";
import { generateText } from "ai";
import { aiRequestQueue } from "../lib/request-queue";
import { getModel, isRateLimitError } from "../providers";

const logger = createLogger({ name: "ai:title-generator" });
const tracer = getTracer("lumen-ai");

const MAX_RETRIES = 2;
const INITIAL_DELAY_MS = 2000;
const MAX_DELAY_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
  // Exponential backoff: 2s, 4s, 8s... capped at MAX_DELAY_MS
  const delay = Math.min(INITIAL_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  // Add jitter (+-20%) to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.round(delay + jitter);
}

const TITLE_GENERATION_PROMPT = `You are a title generator for a kanban/task management chat assistant named Larity.
Given a conversation between a user and Larity, generate a short, descriptive title (3-7 words) that summarizes the main topic or intent.

Guidelines:
- Be concise and specific
- Focus on the user's main goal or question
- Use action words when appropriate (e.g., "Creating task board", "Organizing project tasks")
- Don't include "Larity" or "AI" in the title
- Don't use quotation marks in the title
- Use title case

Respond with ONLY the title, nothing else.`;

export interface TitleGenerationInput {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

// Internal function that actually generates the title
// This is wrapped by the queue for rate limiting
async function generateTitleInternal(
  conversationText: string,
  messageCount: number
): Promise<string | null> {
  const model = getModel("llama3.1-8b");

  const result = await generateText({
    model,
    system: TITLE_GENERATION_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate a title for this conversation:\n\n${conversationText}`,
      },
    ],
    maxOutputTokens: 50,
    temperature: 0.3,
  });

  const title = result.text.trim();

  // Validate the title
  if (!title || title.length < 2 || title.length > 100) {
    logger.warn("Generated title invalid", {
      title,
      messageCount,
    });
    return null;
  }

  return title;
}

export async function generateConversationTitle(
  input: TitleGenerationInput
): Promise<string | null> {
  const span = tracer.startSpan("ai.generateTitle");
  span.setAttributes({
    "ai.message_count": input.messages.length,
  });

  // Format messages for the title generation prompt
  const conversationText = input.messages
    .slice(0, 6)
    .map(
      (m) =>
        `${m.role === "user" ? "User" : "Larity"}: ${m.content.slice(0, 500)}`
    )
    .join("\n\n");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      if (attempt > 0) {
        const delay = getRetryDelay(attempt - 1);
        logger.info("Retrying title generation", {
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          delayMs: delay,
        });
        await sleep(delay);
      }

      // Use the queue for rate limiting - title generation is low priority
      const { result: title, wasQueued } = await aiRequestQueue.enqueue(
        () => generateTitleInternal(conversationText, input.messages.length),
        { priority: "low", workspaceId: "title-generation" }
      );

      if (wasQueued) {
        logger.info("Title generation was queued due to rate limiting");
      }

      if (!title) {
        span.setAttribute("ai.title_valid", false);
        span.end();
        return null;
      }

      logger.info("Generated conversation title", {
        title,
        messageCount: input.messages.length,
        attempts: attempt + 1,
        wasQueued,
      });

      span.setAttribute("ai.title", title);
      span.setAttribute("ai.title_length", title.length);
      span.setAttribute("ai.attempts", attempt + 1);
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return title;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");

      // Only retry on rate limit errors
      if (!isRateLimitError(error)) {
        recordSpanError(span, error);
        span.end();

        logger.error("Failed to generate conversation title", {
          error: lastError.message,
          messageCount: input.messages.length,
          attempt: attempt + 1,
        });

        return null;
      }

      logger.warn("Rate limited during title generation", {
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        error: lastError.message,
      });
    }
  }

  // All retries exhausted
  recordSpanError(span, lastError);
  span.setAttribute("ai.attempts", MAX_RETRIES);
  span.end();

  logger.error("Failed to generate conversation title after retries", {
    error: lastError?.message ?? "Unknown",
    messageCount: input.messages.length,
    attempts: MAX_RETRIES,
  });

  return null;
}

export function shouldGenerateTitle(
  messageCount: number,
  hasExistingTitle: boolean
): boolean {
  return messageCount >= 4 && !hasExistingTitle;
}
