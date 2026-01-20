import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createLogger } from "@lumen/logger";
import { generateText } from "ai";
import { actionTools, allTools, queryTools, toolMetadata } from "./definitions";
import type { ClassificationResult, QueueStatus, ToolSelection } from "./types";

const logger = createLogger({ name: "ai:tool-classifier" });

// Re-export for convenience
export type { ClassificationResult, QueueStatus } from "./types";

// Fast model for classification
const CLASSIFIER_MODEL = "llama3.1-8b";

// Keyword lists for fallback detection
const ACTION_KEYWORDS = [
  "create",
  "add",
  "new",
  "make",
  "update",
  "edit",
  "change",
  "modify",
  "set",
  "rename",
  "delete",
  "remove",
  "clear",
  "move",
  "transfer",
  "bulk",
  "all",
  "multiple",
];

const QUERY_KEYWORDS = [
  "show",
  "list",
  "get",
  "find",
  "search",
  "what",
  "which",
  "how many",
  "overview",
  "summary",
  "details",
  "info",
  "status",
  "recent",
  "activity",
  "changes",
  "name",
  "workspace",
  "tell",
  "give",
];

const ENTITY_KEYWORDS = [
  "board",
  "boards",
  "kanban",
  "task",
  "tasks",
  "item",
  "items",
  "card",
  "cards",
  "todo",
  "todos",
  "column",
  "columns",
  "lane",
  "lanes",
];

// Keyword-based tool intent detection (fallback)
function detectToolIntentKeywords(message: string): ToolSelection {
  const lower = message.toLowerCase();

  const hasKeyword = (keywords: string[]) =>
    keywords.some((keyword) => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      return regex.test(lower);
    });

  const hasActionKeyword = hasKeyword(ACTION_KEYWORDS);
  const hasQueryKeyword = hasKeyword(QUERY_KEYWORDS);
  const hasEntityKeyword = hasKeyword(ENTITY_KEYWORDS);

  logger.debug("Keyword detection analysis", {
    messageLength: message.length,
    hasActionKeyword,
    hasQueryKeyword,
    hasEntityKeyword,
  });

  // No relevant keywords
  if (!(hasEntityKeyword || hasActionKeyword || hasQueryKeyword)) {
    const result = {
      intent: "none" as const,
      tools: null,
      reason: "No workspace-related keywords detected",
    };
    logger.debug("Keyword fallback result: no tools", {
      intent: result.intent,
    });
    return result;
  }

  // Action + entity = action tools
  if (hasActionKeyword && hasEntityKeyword) {
    const isDestructive = hasKeyword(["delete", "remove", "clear"]);
    if (isDestructive) {
      const result = {
        intent: "both" as const,
        tools: allTools,
        reason: "Destructive action detected",
      };
      logger.debug("Keyword fallback result: destructive action", {
        intent: result.intent,
      });
      return result;
    }
    const result = {
      intent: "action" as const,
      tools: actionTools,
      reason: "Action intent with entity",
    };
    logger.debug("Keyword fallback result: action", { intent: result.intent });
    return result;
  }

  // Query + entity = query tools
  if (hasQueryKeyword && hasEntityKeyword) {
    const result = {
      intent: "query" as const,
      tools: queryTools,
      reason: "Query intent with entity",
    };
    logger.debug("Keyword fallback result: query", { intent: result.intent });
    return result;
  }

  // Entity alone or action/query alone = use both/appropriate
  if (hasEntityKeyword) {
    const result = {
      intent: "both" as const,
      tools: allTools,
      reason: "Entity mentioned, unclear intent",
    };
    logger.debug("Keyword fallback result: entity only", {
      intent: result.intent,
    });
    return result;
  }
  if (hasActionKeyword) {
    const result = {
      intent: "both" as const,
      tools: allTools,
      reason: "Action keyword detected",
    };
    logger.debug("Keyword fallback result: action keyword only", {
      intent: result.intent,
    });
    return result;
  }
  if (hasQueryKeyword) {
    const result = {
      intent: "query" as const,
      tools: queryTools,
      reason: "Query keyword detected",
    };
    logger.debug("Keyword fallback result: query keyword only", {
      intent: result.intent,
    });
    return result;
  }

  return { intent: "none", tools: null, reason: "No tool intent detected" };
}

// Simple in-memory queue for classifier requests
class ClassifierQueue {
  private readonly queue: Array<{
    id: string;
    resolve: (result: ClassificationResult) => void;
    reject: (error: Error) => void;
    message: string;
    apiKey: string;
    previousMessage?: string;
    timestamp: number;
  }> = [];
  private processing = false;
  private readonly maxConcurrent = 3;
  private readonly maxQueueSize = 20;
  private activeCount = 0;

  async enqueue(
    message: string,
    apiKey: string,
    previousMessage?: string
  ): Promise<{ result: ClassificationResult; queueStatus: QueueStatus }> {
    const id = crypto.randomUUID();
    const position = this.queue.length;

    logger.debug("Classification request received", {
      requestId: id,
      messagePreview: message.slice(0, 50),
      queueLength: position,
      activeCount: this.activeCount,
      hasContext: !!previousMessage,
    });

    // If queue is full, fall back to keyword matching immediately
    if (position >= this.maxQueueSize) {
      logger.warn("Queue full, using keyword fallback", {
        requestId: id,
        queueLength: position,
        maxQueueSize: this.maxQueueSize,
      });
      const fallback = detectToolIntentKeywords(message);
      return {
        result: {
          intent: fallback.intent,
          confidence: "low",
          reason: "Queue full - used keyword fallback",
        },
        queueStatus: {
          position: -1,
          estimatedWaitMs: 0,
          isQueued: false,
        },
      };
    }

    const queueStatus: QueueStatus = {
      position: position + 1,
      estimatedWaitMs: position * 200, // ~200ms per classification
      isQueued: position > 0 || this.activeCount >= this.maxConcurrent,
    };

    // If we can process immediately
    if (this.activeCount < this.maxConcurrent) {
      logger.debug("Processing immediately", {
        requestId: id,
        activeCount: this.activeCount,
        maxConcurrent: this.maxConcurrent,
      });
      this.activeCount += 1;
      try {
        const result = await this.classify(
          message,
          apiKey,
          id,
          previousMessage
        );
        return { result, queueStatus: { ...queueStatus, isQueued: false } };
      } finally {
        this.activeCount -= 1;
        this.scheduleProcessQueue();
      }
    }

    // Otherwise queue it
    logger.info("Request queued for classification", {
      requestId: id,
      position: queueStatus.position,
      estimatedWaitMs: queueStatus.estimatedWaitMs,
    });
    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        resolve: (result) => {
          resolve({ result, queueStatus });
        },
        reject,
        message,
        apiKey,
        previousMessage,
        timestamp: Date.now(),
      });
    });
  }

  private scheduleProcessQueue(): void {
    setTimeout(() => {
      this.processQueue().catch(() => {
        // Errors are handled in classify
      });
    }, 0);
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    if (this.activeCount >= this.maxConcurrent) {
      return;
    }

    this.processing = true;
    logger.debug("Processing queue", {
      queueLength: this.queue.length,
      activeCount: this.activeCount,
    });

    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const item = this.queue.shift();
      if (!item) {
        break;
      }

      const waitTime = Date.now() - item.timestamp;
      logger.info("Processing queued request", {
        requestId: item.id,
        waitTimeMs: waitTime,
        remainingInQueue: this.queue.length,
      });

      this.activeCount += 1;

      try {
        const result = await this.classify(
          item.message,
          item.apiKey,
          item.id,
          item.previousMessage
        );
        item.resolve(result);
      } catch (error) {
        logger.error("Classification failed for queued request", {
          requestId: item.id,
          error: error instanceof Error ? error.message : String(error),
        });
        item.reject(error instanceof Error ? error : new Error(String(error)));
      } finally {
        this.activeCount -= 1;
      }
    }

    this.processing = false;

    // Check if more items were added while processing
    if (this.queue.length > 0) {
      this.scheduleProcessQueue();
    }
  }

  private async classify(
    message: string,
    apiKey: string,
    requestId?: string,
    previousMessage?: string
  ): Promise<ClassificationResult> {
    const startTime = Date.now();
    const logId = requestId ?? "direct";

    logger.debug("Starting LLM classification", {
      requestId: logId,
      model: CLASSIFIER_MODEL,
      messageLength: message.length,
      hasContext: !!previousMessage,
    });

    const provider = createOpenAICompatible({
      name: "cerebras",
      apiKey,
      baseURL: "https://api.cerebras.ai/v1",
    });

    const model = provider.chatModel(CLASSIFIER_MODEL);

    // Build tool descriptions for the prompt
    const toolDescriptions = Object.entries(toolMetadata)
      .map(
        ([name, meta]) => `- ${name}: ${meta.description} [${meta.category}]`
      )
      .join("\n");

    const systemPrompt = `You are a tool selection classifier for a task management app called Larity.
Your job is to analyze user messages and determine if they need tools to answer.

Available tools:
${toolDescriptions}

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "intent": "none" | "query" | "action" | "both",
  "confidence": "high" | "medium" | "low",
  "reason": "brief explanation",
  "suggestedTools": ["tool1", "tool2"] // optional, only if intent is not "none"
}

Guidelines:
- "none": General chat, greetings, questions about the AI itself, or requests that don't need workspace data
- "query": Questions about workspace name, ID, members, boards, tasks, columns, activity, or any other workspace details
- "action": Requests to create, update, delete, or modify anything, or CONFIRMING a previous action request (e.g. "yes", "do it")
- "both": Complex requests that need both reading and writing

Context:
Previous Assistant Message: "${previousMessage || "none"}"

Be generous with tool detection - if the user asks about the "workspace", "boards", or anything specific to the current context, use "query".
If the previous message asked for confirmation and the user says "yes" or "confirm", classify as "action".`;

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        prompt: message,
        maxOutputTokens: 150,
        // Low temperature for consistent classification
        temperature: 0.1,
      });

      const durationMs = Date.now() - startTime;

      // Parse the JSON response
      const text = result.text.trim();
      // Handle potential markdown code blocks
      const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();

      logger.debug("LLM response received", {
        requestId: logId,
        durationMs,
        responseLength: text.length,
        rawResponse: text.slice(0, 200),
      });

      try {
        const parsed = JSON.parse(jsonStr) as ClassificationResult;
        const classification = {
          intent: parsed.intent || "none",
          confidence: parsed.confidence || "medium",
          reason: parsed.reason || "LLM classification",
          suggestedTools: parsed.suggestedTools,
        };

        logger.info("LLM classification completed", {
          requestId: logId,
          durationMs,
          intent: classification.intent,
          confidence: classification.confidence,
          reason: classification.reason,
          suggestedTools: classification.suggestedTools,
        });

        return classification;
      } catch (parseError) {
        // If JSON parsing fails, fall back to keyword detection
        logger.warn("LLM response parsing failed, using keyword fallback", {
          requestId: logId,
          durationMs,
          rawResponse: text.slice(0, 200),
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        });
        const fallback = detectToolIntentKeywords(message);
        return {
          intent: fallback.intent,
          confidence: "low",
          reason: "LLM response parsing failed - used keyword fallback",
        };
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      // On any error, fall back to keyword detection
      logger.error("LLM classification failed, using keyword fallback", {
        requestId: logId,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });
      const fallback = detectToolIntentKeywords(message);
      return {
        intent: fallback.intent,
        confidence: "low",
        reason: `LLM error: ${error instanceof Error ? error.message : "unknown"} - used keyword fallback`,
      };
    }
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      activeCount: this.activeCount,
      maxConcurrent: this.maxConcurrent,
      maxQueueSize: this.maxQueueSize,
    };
  }
}

// Singleton queue instance
const classifierQueue = new ClassifierQueue();

// Classify a message to determine which tools are needed.
// Uses LLM for intelligent classification with keyword fallback.
// Respects privacy - only sends the message text, no workspace data.
export async function classifyToolIntent(
  message: string,
  apiKey: string,
  previousMessage?: string
): Promise<{
  selection: ToolSelection;
  classification: ClassificationResult;
  queueStatus: QueueStatus;
}> {
  logger.debug("classifyToolIntent called", {
    messagePreview: message.slice(0, 50),
    hasContext: !!previousMessage,
  });

  const { result, queueStatus } = await classifierQueue.enqueue(
    message,
    apiKey,
    previousMessage
  );

  // Convert classification to tool selection
  let tools: typeof allTools | typeof queryTools | typeof actionTools | null =
    null;
  let toolCount = 0;

  switch (result.intent) {
    case "query":
      tools = queryTools;
      toolCount = Object.keys(queryTools).length;
      break;
    case "action":
      // Actions often require context (IDs, names) found via queries.
      // So we provide all tools to ensure the model can look up what it needs.
      tools = allTools;
      toolCount = Object.keys(allTools).length;
      break;
    case "both":
      tools = allTools;
      toolCount = Object.keys(allTools).length;
      break;
    default:
      tools = null;
      toolCount = 0;
      break;
  }

  const selection: ToolSelection = {
    intent: result.intent,
    tools,
    reason: result.reason,
  };

  logger.info("Tool selection complete", {
    intent: selection.intent,
    toolCount,
    confidence: result.confidence,
    reason: selection.reason,
    wasQueued: queueStatus.isQueued,
  });

  return { selection, classification: result, queueStatus };
}

// Quick synchronous check using keywords only (for fallback or when queue is full)
export function classifyToolIntentSync(message: string): ToolSelection {
  return detectToolIntentKeywords(message);
}

// Get current queue statistics
export function getClassifierQueueStats() {
  return classifierQueue.getStats();
}
