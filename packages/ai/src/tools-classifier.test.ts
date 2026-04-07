import { describe, expect, it, mock } from "bun:test";

// Mock generateText to eliminate network dependency in async classifier tests
mock.module("ai", () => {
  const original = require("ai");
  return {
    ...original,
    generateText: mock(({ prompt }: { prompt: string }) => {
      const lower = prompt.toLowerCase();
      if (lower.includes("delete") || lower.includes("remove")) {
        return Promise.resolve({
          text: '{"intent":"both","confidence":"high","reason":"destructive action"}',
        });
      }
      if (
        lower.includes("create") ||
        lower.includes("add") ||
        lower.includes("make")
      ) {
        return Promise.resolve({
          text: '{"intent":"action","confidence":"high","reason":"action detected"}',
        });
      }
      if (
        lower.includes("show") ||
        lower.includes("list") ||
        lower.includes("find") ||
        lower.includes("search")
      ) {
        return Promise.resolve({
          text: '{"intent":"query","confidence":"high","reason":"query detected"}',
        });
      }
      return Promise.resolve({
        text: '{"intent":"none","confidence":"high","reason":"no tool intent"}',
      });
    }),
  };
});

import { actionTools, allTools, queryTools } from "./tools/definitions";
import {
  classifyToolIntent,
  classifyToolIntentSync,
  getClassifierQueueStats,
} from "./tools/tool-classifier";

describe("classifyToolIntentSync", () => {
  describe("query classification", () => {
    it("classifies 'show me the tasks' as query", () => {
      const result = classifyToolIntentSync("show me the tasks");
      expect(result.intent).toBe("query");
      expect(result.tools).toBe(queryTools);
      expect(result.reason).toContain("Query");
    });

    it("classifies 'list my boards' as query", () => {
      const result = classifyToolIntentSync("list my boards");
      expect(result.intent).toBe("query");
    });

    it("classifies 'get overview of workspace' as query", () => {
      const result = classifyToolIntentSync("get overview of workspace");
      expect(result.intent).toBe("query");
    });

    it("classifies 'what are the recent changes' as query", () => {
      const result = classifyToolIntentSync("what are the recent changes");
      expect(result.intent).toBe("query");
    });

    it("classifies 'tell me about my workspace' as query", () => {
      const result = classifyToolIntentSync("tell me about my workspace");
      expect(result.intent).toBe("query");
    });

    it("classifies 'give me details about this board' as query", () => {
      const result = classifyToolIntentSync("give me details about this board");
      expect(result.intent).toBe("query");
    });

    it("classifies 'search for high priority items' as query", () => {
      const result = classifyToolIntentSync("search for high priority items");
      expect(result.intent).toBe("query");
    });

    it("classifies 'find recent activity' as query", () => {
      const result = classifyToolIntentSync("find recent activity");
      expect(result.intent).toBe("query");
    });
  });

  describe("action classification", () => {
    it("classifies 'create a new task' as action", () => {
      const result = classifyToolIntentSync("create a new task");
      expect(result.intent).toBe("action");
      expect(result.tools).toBe(actionTools);
    });

    it("classifies 'add a card to the board' as action", () => {
      const result = classifyToolIntentSync("add a card to the board");
      expect(result.intent).toBe("action");
    });

    it("classifies 'update task status' as action", () => {
      const result = classifyToolIntentSync("update task status");
      expect(result.intent).toBe("action");
    });

    it("classifies 'move the item to done column' as action", () => {
      const result = classifyToolIntentSync("move the item to done column");
      expect(result.intent).toBe("action");
    });

    it("classifies 'make a new board' as action", () => {
      const result = classifyToolIntentSync("make a new board");
      expect(result.intent).toBe("action");
    });

    it("classifies 'rename this task' as action", () => {
      const result = classifyToolIntentSync("rename this task");
      expect(result.intent).toBe("action");
    });

    it("classifies 'modify task priority' as action", () => {
      const result = classifyToolIntentSync("modify task priority");
      expect(result.intent).toBe("action");
    });

    it("classifies 'set the column name' as action", () => {
      const result = classifyToolIntentSync("set the column name");
      expect(result.intent).toBe("action");
    });

    it("classifies 'edit the board description' as action", () => {
      const result = classifyToolIntentSync("edit the board description");
      expect(result.intent).toBe("action");
    });

    it("classifies 'change task to high priority' as action", () => {
      const result = classifyToolIntentSync("change task to high priority");
      expect(result.intent).toBe("action");
    });

    it("classifies 'transfer task to another board' as action", () => {
      const result = classifyToolIntentSync("transfer task to another board");
      expect(result.intent).toBe("action");
    });

    it("classifies 'bulk update all tasks' as action", () => {
      const result = classifyToolIntentSync("bulk update all tasks");
      expect(result.intent).toBe("action");
    });
  });

  describe("destructive classification escalates to 'both'", () => {
    it("classifies 'delete this task' as both", () => {
      const result = classifyToolIntentSync("delete this task");
      expect(result.intent).toBe("both");
      expect(result.tools).toBe(allTools);
    });

    it("classifies 'remove the board' as both", () => {
      const result = classifyToolIntentSync("remove the board");
      expect(result.intent).toBe("both");
    });

    it("classifies 'clear all todo items' as both", () => {
      const result = classifyToolIntentSync("clear all todo items");
      expect(result.intent).toBe("both");
    });
  });

  describe("none classification for chat", () => {
    it("classifies 'hello how are you' as none", () => {
      const result = classifyToolIntentSync("hello how are you");
      expect(result.intent).toBe("none");
      expect(result.tools).toBeNull();
    });

    it("classifies empty string as none", () => {
      const result = classifyToolIntentSync("");
      expect(result.intent).toBe("none");
    });

    it("classifies 'thanks!' as none", () => {
      const result = classifyToolIntentSync("thanks!");
      expect(result.intent).toBe("none");
    });

    it("classifies random non-workspace text as none", () => {
      const result = classifyToolIntentSync("lorem ipsum dolor sit amet");
      expect(result.intent).toBe("none");
    });

    it("classifies 'good morning' as none", () => {
      const result = classifyToolIntentSync("good morning");
      expect(result.intent).toBe("none");
    });
  });

  describe("entity-only messages", () => {
    it("classifies 'I have a task to do' as both when entity present without action/query", () => {
      const result = classifyToolIntentSync("I have a task to do");
      expect(result.intent).toBe("both");
    });

    it("classifies 'the kanban board looks good' as both", () => {
      const result = classifyToolIntentSync("the kanban board looks good");
      expect(result.intent).toBe("both");
    });

    it("classifies 'my cards are overdue' as both", () => {
      const result = classifyToolIntentSync("my cards are overdue");
      expect(result.intent).toBe("both");
    });
  });

  describe("action-keyword-only messages", () => {
    it("classifies 'create something' as both (action keyword without entity)", () => {
      const result = classifyToolIntentSync("create something");
      expect(result.intent).toBe("both");
    });

    it("classifies 'I want to add' as both", () => {
      const result = classifyToolIntentSync("I want to add");
      expect(result.intent).toBe("both");
    });
  });

  describe("query-keyword-only messages", () => {
    it("classifies 'show me' as query (keyword present)", () => {
      const result = classifyToolIntentSync("show me");
      expect(result.intent).toBe("query");
    });

    it("classifies 'what is happening' as query", () => {
      const result = classifyToolIntentSync("what is happening");
      expect(result.intent).toBe("query");
    });
  });

  describe("mixed query and action keywords with entity", () => {
    it("classifies 'delete all tasks' as both (destructive escalates)", () => {
      const result = classifyToolIntentSync("delete all tasks");
      expect(result.intent).toBe("both");
    });
  });
});

describe("classifyToolIntent (async)", () => {
  // The async classifier attempts real LLM calls. With a fake API key it fails
  // and falls back to keyword detection. We test the full async path including
  // the fallback behavior, queue processing, and classification result shapes.

  it("returns selection, classification, and queueStatus from async path", async () => {
    const { selection, classification, queueStatus } = await classifyToolIntent(
      "find tasks on board",
      "test-api-key"
    );

    expect(selection).toHaveProperty("intent");
    expect(selection).toHaveProperty("tools");
    expect(selection).toHaveProperty("reason");
    expect(classification).toHaveProperty("intent");
    expect(classification).toHaveProperty("confidence");
    expect(classification).toHaveProperty("reason");
    expect(queueStatus).toHaveProperty("position");
    expect(queueStatus).toHaveProperty("estimatedWaitMs");
    expect(queueStatus).toHaveProperty("isQueued");
  });

  it("classifies action intent from mock LLM response", async () => {
    const { selection, classification } = await classifyToolIntent(
      "create a new task",
      "test-api-key"
    );

    expect(classification.confidence).toBe("high");
    expect(selection.intent).toBe("action");
  });

  it("classifies query intent from mock LLM response", async () => {
    const { selection, classification } = await classifyToolIntent(
      "show me my tasks",
      "test-api-key"
    );

    expect(classification.confidence).toBe("high");
    expect(selection.intent).toBe("query");
  });

  it("classifies destructive messages as both", async () => {
    const { selection } = await classifyToolIntent(
      "delete this task",
      "test-api-key"
    );

    expect(selection.intent).toBe("both");
    expect(selection.tools).toBe(allTools);
  });

  it("classifies chat messages as none", async () => {
    const { selection } = await classifyToolIntent(
      "hello how are you",
      "test-api-key"
    );

    expect(selection.intent).toBe("none");
    expect(selection.tools).toBeNull();
  });

  it("handles previousMessage context parameter", async () => {
    const { selection } = await classifyToolIntent(
      "yes, do it",
      "test-api-key",
      "Should I delete this task?"
    );

    expect(selection).toHaveProperty("intent");
  });

  it("handles long previousMessage (truncation path)", async () => {
    const longMessage = "x".repeat(2000);
    const { selection } = await classifyToolIntent(
      "confirm",
      "test-api-key",
      longMessage
    );

    expect(selection).toHaveProperty("intent");
  });

  it("queueStatus is not queued for immediate processing", async () => {
    const { queueStatus } = await classifyToolIntent(
      "find tasks",
      "test-api-key"
    );

    expect(queueStatus.isQueued).toBe(false);
  });

  it("queueStatus.position is non-negative for immediate", async () => {
    const { queueStatus } = await classifyToolIntent(
      "show boards",
      "test-api-key"
    );

    expect(queueStatus.position).toBeGreaterThanOrEqual(0);
  });

  it("queueStatus.estimatedWaitMs is 0 for immediate", async () => {
    const { queueStatus } = await classifyToolIntent(
      "list tasks",
      "test-api-key"
    );

    expect(queueStatus.estimatedWaitMs).toBe(0);
  });

  it("action intent maps to allTools (not just actionTools)", async () => {
    const { selection } = await classifyToolIntent(
      "create a new board",
      "test-api-key"
    );

    // Even action intent returns allTools for context lookup
    expect(selection.tools).toBe(allTools);
  });

  it("query intent maps to queryTools", async () => {
    const { selection } = await classifyToolIntent(
      "find blocked tasks",
      "test-api-key"
    );

    expect(selection.tools).toBe(queryTools);
  });

  it("concurrent async calls are processed", async () => {
    const results = await Promise.all([
      classifyToolIntent("show me tasks", "test-api-key"),
      classifyToolIntent("create a task", "test-api-key"),
      classifyToolIntent("hello", "test-api-key"),
    ]);

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result).toHaveProperty("selection");
      expect(result).toHaveProperty("classification");
      expect(result).toHaveProperty("queueStatus");
    }
  });
});

describe("getClassifierQueueStats", () => {
  it("returns an object with expected queue stat properties", () => {
    const stats = getClassifierQueueStats();
    expect(stats).toHaveProperty("queueLength");
    expect(stats).toHaveProperty("activeCount");
    expect(stats).toHaveProperty("maxConcurrent");
    expect(stats).toHaveProperty("maxQueueSize");
  });

  it("reports queueLength and activeCount as numbers", () => {
    const stats = getClassifierQueueStats();
    expect(typeof stats.queueLength).toBe("number");
    expect(typeof stats.activeCount).toBe("number");
    expect(stats.queueLength).toBeGreaterThanOrEqual(0);
    expect(stats.activeCount).toBeGreaterThanOrEqual(0);
  });

  it("maxConcurrent is 3 and maxQueueSize is 20", () => {
    const stats = getClassifierQueueStats();
    expect(stats.maxConcurrent).toBe(3);
    expect(stats.maxQueueSize).toBe(20);
  });

  it("queue is empty before any async classification calls", () => {
    const stats = getClassifierQueueStats();
    expect(stats.queueLength).toBe(0);
    expect(stats.activeCount).toBe(0);
  });
});
