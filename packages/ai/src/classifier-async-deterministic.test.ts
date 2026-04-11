import { beforeEach, describe, expect, it, mock } from "bun:test";

let mockCallCount = 0;
let mockShouldFail = false;
let mockShouldTimeout = false;
let mockDelayMs = 0;

mock.module("ai", () => {
  const original = require("ai");
  return {
    ...original,
    generateText: mock(({ prompt }: { prompt: string }) => {
      mockCallCount++;
      if (mockShouldFail) {
        throw new Error("Network error");
      }
      if (mockShouldTimeout) {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timed out")), 100);
        });
      }
      if (mockDelayMs > 0) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              text: '{"intent":"query","confidence":"high","reason":"delayed response"}',
            });
          }, mockDelayMs);
        });
      }
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

describe("ClassifierQueue deterministic async tests", () => {
  beforeEach(() => {
    mockCallCount = 0;
    mockShouldFail = false;
    mockShouldTimeout = false;
    mockDelayMs = 0;
  });

  describe("queue cleanup between test cases", () => {
    it("queue is empty before first call", () => {
      const stats = getClassifierQueueStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.activeCount).toBe(0);
    });

    it("queue returns to idle after a single call completes", async () => {
      await classifyToolIntent("show tasks", "test-key");
      const stats = getClassifierQueueStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.activeCount).toBe(0);
    });

    it("queue returns to idle after multiple sequential calls", async () => {
      await classifyToolIntent("show tasks", "test-key");
      await classifyToolIntent("create task", "test-key");
      await classifyToolIntent("hello", "test-key");
      const stats = getClassifierQueueStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.activeCount).toBe(0);
    });

    it("queue returns to idle after concurrent calls complete", async () => {
      await Promise.all([
        classifyToolIntent("show tasks", "test-key"),
        classifyToolIntent("create task", "test-key"),
        classifyToolIntent("delete task", "test-key"),
      ]);
      const stats = getClassifierQueueStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.activeCount).toBe(0);
    });
  });

  describe("work leakage prevention", () => {
    it("no leftover queue items after rejected LLM calls", async () => {
      mockShouldFail = true;
      const results = await Promise.allSettled([
        classifyToolIntent("show tasks", "test-key"),
        classifyToolIntent("create task", "test-key"),
      ]);

      for (const r of results) {
        expect(r.status).toBe("fulfilled");
        if (r.status === "fulfilled") {
          expect(r.value.classification.confidence).toBe("low");
        }
      }

      const stats = getClassifierQueueStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.activeCount).toBe(0);
    });

    it("each call invokes the mock exactly once per request", async () => {
      mockCallCount = 0;
      await classifyToolIntent("show tasks", "test-key");
      expect(mockCallCount).toBe(1);

      mockCallCount = 0;
      await Promise.all([
        classifyToolIntent("show tasks", "test-key"),
        classifyToolIntent("create task", "test-key"),
        classifyToolIntent("hello", "test-key"),
      ]);
      expect(mockCallCount).toBe(3);
    });

    it("results from one test do not leak into the next", async () => {
      const result1 = await classifyToolIntent("show tasks", "test-key");
      expect(result1.selection.intent).toBe("query");

      const result2 = await classifyToolIntent("create task", "test-key");
      expect(result2.selection.intent).toBe("action");

      const result3 = await classifyToolIntent("hello", "test-key");
      expect(result3.selection.intent).toBe("none");
    });
  });

  describe("retry exhaustion", () => {
    it("falls back to keyword detection on LLM error", async () => {
      mockShouldFail = true;

      const result = await classifyToolIntent("show me tasks", "test-key");

      expect(result.classification.confidence).toBe("low");
      expect(result.classification.intent).toBe("query");
      expect(result.classification.reason).toContain("keyword fallback");
    });

    it("falls back to keyword detection when LLM is slow (simulated timeout)", async () => {
      mockShouldTimeout = true;

      const result = await classifyToolIntent("delete task", "test-key");

      expect(result.classification.confidence).toBe("low");
      expect(result.classification.intent).toBe("both");

      mockShouldTimeout = false;
    });

    it("queue full scenario falls back immediately to keywords", async () => {
      const stats = getClassifierQueueStats();
      expect(stats.maxQueueSize).toBe(20);
      expect(stats.maxConcurrent).toBe(3);

      const results = await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          classifyToolIntent(`message ${i} about tasks`, "test-key")
        )
      );

      for (const result of results) {
        expect(result.classification.intent).toBeDefined();
        expect(["none", "query", "action", "both"]).toContain(
          result.classification.intent
        );
      }

      const finalStats = getClassifierQueueStats();
      expect(finalStats.queueLength).toBe(0);
      expect(finalStats.activeCount).toBe(0);
    });
  });

  describe("deterministic async queue behavior", () => {
    it("processes queued items in FIFO order", async () => {
      mockDelayMs = 10;

      const order: string[] = [];
      const trackOrder = (msg: string) =>
        classifyToolIntent(msg, "test-key").then((r) => {
          order.push(msg);
          return r;
        });

      await Promise.all([
        trackOrder("first query"),
        trackOrder("second query"),
        trackOrder("third query"),
      ]);

      expect(order).toEqual(["first query", "second query", "third query"]);
    });

    it("concurrent requests under maxConcurrent are processed in parallel", async () => {
      mockCallCount = 0;
      mockDelayMs = 50;

      const start = Date.now();
      await Promise.all([
        classifyToolIntent("show tasks", "test-key"),
        classifyToolIntent("create task", "test-key"),
        classifyToolIntent("hello", "test-key"),
      ]);
      const elapsed = Date.now() - start;

      expect(mockCallCount).toBe(3);
      expect(elapsed).toBeLessThan(mockDelayMs * 3);
    });

    it("queue stats correctly reflect maxConcurrent=3 and maxQueueSize=20", () => {
      const stats = getClassifierQueueStats();
      expect(stats.maxConcurrent).toBe(3);
      expect(stats.maxQueueSize).toBe(20);
    });

    it("classification result has all required fields", async () => {
      const result = await classifyToolIntent("show my tasks", "test-key");

      expect(result).toHaveProperty("selection");
      expect(result).toHaveProperty("classification");
      expect(result).toHaveProperty("queueStatus");

      expect(result.selection).toHaveProperty("intent");
      expect(result.selection).toHaveProperty("tools");
      expect(result.selection).toHaveProperty("reason");

      expect(result.classification).toHaveProperty("intent");
      expect(result.classification).toHaveProperty("confidence");
      expect(result.classification).toHaveProperty("reason");

      expect(result.queueStatus).toHaveProperty("position");
      expect(result.queueStatus).toHaveProperty("estimatedWaitMs");
      expect(result.queueStatus).toHaveProperty("isQueued");
    });
  });

  describe("network isolation", () => {
    it("mocked generateText prevents real network calls", async () => {
      mockCallCount = 0;

      await classifyToolIntent("test message", "test-key");

      expect(mockCallCount).toBe(1);
    });

    it("all classifier calls use the mock, not real API", async () => {
      mockCallCount = 0;

      await Promise.all([
        classifyToolIntent("msg1", "test-key"),
        classifyToolIntent("msg2", "test-key"),
        classifyToolIntent("msg3", "test-key"),
      ]);

      expect(mockCallCount).toBe(3);
    });
  });
});
