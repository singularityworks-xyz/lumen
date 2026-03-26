import { describe, expect, it } from "bun:test";
import { actionTools, allTools, queryTools } from "../../src/tools/definitions";
import {
  classifyToolIntentSync,
  getClassifierQueueStats,
} from "../../src/tools/tool-classifier";

describe("classifyToolIntentSync", () => {
  describe("query classification", () => {
    it("classifies 'show me the tasks' as query", () => {
      const result = classifyToolIntentSync("show me the tasks");
      expect(result.intent).toBe("query");
      expect(result.tools).toBe(queryTools);
      expect(result.reason).toContain("Query");
    });

    it("classifies 'list all boards' as query", () => {
      const result = classifyToolIntentSync("list all boards");
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
  });

  describe("entity-only messages", () => {
    it("classifies 'I have a task to do' as both when entity present without action/query", () => {
      const result = classifyToolIntentSync("I have a task to do");
      expect(result.intent).toBe("both");
    });
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
