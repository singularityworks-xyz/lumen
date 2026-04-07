import { describe, expect, it, mock } from "bun:test";

// Mock generateText to eliminate network dependency
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
        lower.includes("search") ||
        lower.includes("task") ||
        lower.includes("board") ||
        lower.includes("column")
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

import {
  classifyToolIntent,
  getClassifierQueueStats,
} from "./tools/tool-classifier";

describe("ClassifierQueue concurrent behavior", () => {
  it("queue stats reflect concurrent request state", async () => {
    const beforeStats = getClassifierQueueStats();
    expect(beforeStats.activeCount).toBe(0);
    expect(beforeStats.queueLength).toBe(0);

    const apiKey = "test-invalid-key";

    const result = await classifyToolIntent("show me tasks", apiKey);
    expect(result.classification).toBeDefined();
    expect(result.classification.intent).toBeDefined();
    expect(result.queueStatus).toBeDefined();
    expect(typeof result.queueStatus.position).toBe("number");
    expect(typeof result.queueStatus.estimatedWaitMs).toBe("number");
    expect(typeof result.queueStatus.isQueued).toBe("boolean");

    const afterStats = getClassifierQueueStats();
    expect(afterStats.activeCount).toBe(0);
  });

  it("concurrent calls all resolve with classification results", async () => {
    const apiKey = "test-invalid-key";
    const messages = [
      "show me tasks",
      "create a new board",
      "delete this task",
      "find blocked items",
      "list all columns",
    ];

    const promises = messages.map((msg) => classifyToolIntent(msg, apiKey));

    const results = await Promise.all(promises);

    expect(results.length).toBe(5);
    for (const result of results) {
      expect(result.classification).toBeDefined();
      expect(result.classification.intent).toBeDefined();
      expect(["none", "query", "action", "both"]).toContain(
        result.classification.intent
      );
      expect(result.selection).toBeDefined();
      expect(result.selection.reason).toBeDefined();
      expect(typeof result.selection.reason).toBe("string");
      expect(result.queueStatus).toBeDefined();
    }
  });

  it("concurrent calls all return valid tool selections", async () => {
    const apiKey = "test-invalid-key";

    const promises = Array.from({ length: 8 }, (_, i) =>
      classifyToolIntent(`message ${i} about tasks`, apiKey)
    );

    const results = await Promise.all(promises);

    for (const result of results) {
      // Each should have a valid selection
      expect(["none", "query", "action", "both"]).toContain(
        result.selection.intent
      );

      // If tools are provided, they should have the expected structure
      if (result.selection.tools) {
        const toolNames = Object.keys(result.selection.tools);
        expect(toolNames.length).toBeGreaterThan(0);
      }
    }
  });

  it("classifyToolIntent with previousMessage context passes through", async () => {
    const apiKey = "test-invalid-key";

    const result = await classifyToolIntent(
      "yes, do it",
      apiKey,
      "Should I delete the task?"
    );

    expect(result.classification).toBeDefined();
    expect(result.selection).toBeDefined();
  });

  it("classifyToolIntent truncates long previousMessage", async () => {
    const apiKey = "test-invalid-key";
    const longMessage = "x".repeat(2000);

    const result = await classifyToolIntent("confirm", apiKey, longMessage);

    expect(result.classification).toBeDefined();
    // Should not throw or hang with long context
  });

  it("queue status reports correct position for queued items", async () => {
    const apiKey = "test-invalid-key";

    const result = await classifyToolIntent("show tasks", apiKey);

    // With a single call, position should indicate immediate processing
    expect(result.queueStatus.position).toBeGreaterThanOrEqual(0);
  });
});
