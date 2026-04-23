import { describe, expect, it } from "bun:test";
import {
  classifyToolIntentSync,
  getClassifierQueueStats,
} from "./tool-classifier";

describe("classifyToolIntentSync edge cases", () => {
  it("handles empty string", () => {
    const result = classifyToolIntentSync("");
    expect(result.intent).toBe("none");
    expect(result.tools).toBeNull();
  });

  it("handles whitespace-only string", () => {
    const result = classifyToolIntentSync("   \n\t  ");
    expect(result.intent).toBe("none");
  });

  it("handles mixed case input", () => {
    const result = classifyToolIntentSync("CREATE A NEW TASK");
    expect(result.intent).toBe("action");
  });

  it("handles special regex characters", () => {
    const result = classifyToolIntentSync("create task (urgent)");
    expect(result.intent).toBe("action");
  });

  it("correctly maps query intent to query tools", () => {
    const result = classifyToolIntentSync("show me the tasks");
    expect(result.intent).toBe("query");
    expect(result.tools).not.toBeNull();
    if (result.tools) {
      expect(Object.keys(result.tools)).toContain("searchTasks");
      expect(Object.keys(result.tools)).toContain("getWorkspaceOverview");
    }
  });

  it("correctly maps action intent to action tools", () => {
    const result = classifyToolIntentSync("create a new task");
    expect(result.intent).toBe("action");
    expect(result.tools).not.toBeNull();
    if (result.tools) {
      expect(Object.keys(result.tools)).toContain("createTask");
      expect(Object.keys(result.tools)).toContain("updateTask");
    }
  });

  it("correctly maps destructive intent to all tools", () => {
    const result = classifyToolIntentSync("delete this task");
    expect(result.intent).toBe("both");
    expect(result.tools).not.toBeNull();
    if (result.tools) {
      const toolNames = Object.keys(result.tools);
      expect(toolNames).toContain("deleteTask");
      expect(toolNames).toContain("searchTasks");
      expect(toolNames.length).toBe(15);
    }
  });

  it("returns null tools for none intent", () => {
    const result = classifyToolIntentSync("hello friend");
    expect(result.tools).toBeNull();
  });

  it("handles multiple entities in message", () => {
    const result = classifyToolIntentSync("move task to board column");
    expect(result.intent).toBe("action");
  });
});

describe("getClassifierQueueStats", () => {
  it("returns all required properties", () => {
    const stats = getClassifierQueueStats();
    expect(stats).toHaveProperty("queueLength");
    expect(stats).toHaveProperty("activeCount");
    expect(stats).toHaveProperty("maxConcurrent");
    expect(stats).toHaveProperty("maxQueueSize");
  });

  it("queueLength is a non-negative integer", () => {
    const stats = getClassifierQueueStats();
    expect(Number.isInteger(stats.queueLength)).toBe(true);
    expect(stats.queueLength).toBeGreaterThanOrEqual(0);
  });

  it("activeCount is a non-negative integer", () => {
    const stats = getClassifierQueueStats();
    expect(Number.isInteger(stats.activeCount)).toBe(true);
    expect(stats.activeCount).toBeGreaterThanOrEqual(0);
  });

  it("maxConcurrent is 3", () => {
    const stats = getClassifierQueueStats();
    expect(stats.maxConcurrent).toBe(3);
  });

  it("maxQueueSize is 20", () => {
    const stats = getClassifierQueueStats();
    expect(stats.maxQueueSize).toBe(20);
  });
});
