import { describe, expect, it } from "bun:test";
import { actionTools, allTools, queryTools } from "./tools/definitions";
import {
  detectToolIntent,
  getToolsForMessage,
  needsTools,
} from "./tools/router";

describe("detectToolIntent column entities", () => {
  it("detects column as entity keyword", () => {
    const result = detectToolIntent("show the column");
    expect(result.intent).toBe("query");
  });

  it("detects columns as entity keyword", () => {
    const result = detectToolIntent("show the columns");
    expect(result.intent).toBe("query");
  });

  it("detects lane as entity keyword", () => {
    const result = detectToolIntent("create a new lane");
    expect(result.intent).toBe("action");
  });
});

describe("detectToolIntent word boundaries", () => {
  it("does NOT match task inside taskmaster", () => {
    const result = detectToolIntent("taskmaster is a game");
    expect(result.intent).toBe("none");
  });

  it("does NOT match board inside surfboard", () => {
    const result = detectToolIntent("surfboard is fun");
    expect(result.intent).toBe("none");
  });

  it("does NOT match card inside discard", () => {
    const result = detectToolIntent("discard this idea");
    expect(result.intent).toBe("none");
  });

  it("matches task as standalone word", () => {
    const result = detectToolIntent("I have a task");
    expect(result.intent).toBe("both");
  });
});

describe("detectToolIntent untested action keywords", () => {
  it("detects transfer as action keyword", () => {
    const result = detectToolIntent("transfer this task to done");
    expect(result.intent).toBe("action");
  });

  it("detects bulk as action keyword", () => {
    const result = detectToolIntent("bulk update tasks");
    expect(result.intent).toBe("action");
  });

  it("detects set as action keyword", () => {
    const result = detectToolIntent("set the task priority");
    expect(result.intent).toBe("action");
  });

  it("detects new as action keyword", () => {
    const result = detectToolIntent("new task for sprint");
    expect(result.intent).toBe("action");
  });

  it("detects multiple as action keyword with entity", () => {
    const result = detectToolIntent("delete multiple tasks");
    expect(result.intent).toBe("both");
  });
});

describe("detectToolIntent untested query keywords", () => {
  it("detects which as query keyword", () => {
    const result = detectToolIntent("which task is blocked");
    expect(result.intent).toBe("query");
  });

  it("detects how many as query keyword", () => {
    const result = detectToolIntent("how many tasks are done");
    expect(result.intent).toBe("query");
  });

  it("detects overview as query keyword", () => {
    const result = detectToolIntent("give me the overview");
    expect(result.intent).toBe("query");
  });

  it("detects summary as query keyword", () => {
    const result = detectToolIntent("show summary of tasks");
    expect(result.intent).toBe("query");
  });

  it("detects details as query keyword", () => {
    const result = detectToolIntent("get details for this task");
    expect(result.intent).toBe("query");
  });

  it("detects status as query keyword", () => {
    const result = detectToolIntent("what is the status of this task");
    expect(result.intent).toBe("query");
  });

  it("detects workspace as query keyword", () => {
    const result = detectToolIntent("tell me about the workspace");
    expect(result.intent).toBe("query");
  });
});

describe("detectToolIntent reason strings", () => {
  it("query plus entity reason mentions Query", () => {
    const result = detectToolIntent("show me the tasks");
    expect(result.reason).toContain("Query");
  });

  it("action plus entity reason mentions Action", () => {
    const result = detectToolIntent("create a new task");
    expect(result.reason).toContain("Action");
  });

  it("destructive reason mentions Destructive", () => {
    const result = detectToolIntent("delete this task");
    expect(result.reason).toContain("Destructive");
  });

  it("no-keyword reason mentions keyword", () => {
    const result = detectToolIntent("hello world");
    expect(result.reason).toContain("keyword");
  });
});

describe("detectToolIntent edge cases", () => {
  it("handles empty string", () => {
    const result = detectToolIntent("");
    expect(result.intent).toBe("none");
    expect(result.tools).toBeNull();
  });

  it("handles whitespace-only string", () => {
    const result = detectToolIntent("   ");
    expect(result.intent).toBe("none");
  });

  it("handles mixed case", () => {
    const result = detectToolIntent("CREATE A NEW TASK");
    expect(result.intent).toBe("action");
  });

  it("handles special regex characters in message", () => {
    const result = detectToolIntent(
      "create a task with (parens) and [brackets]"
    );
    expect(result.intent).toBe("action");
  });

  it("returns queryTools for query intent", () => {
    const result = detectToolIntent("search for tasks");
    expect(result.tools).toBe(queryTools);
  });

  it("returns actionTools for action intent", () => {
    const result = detectToolIntent("create a new task");
    expect(result.tools).toBe(actionTools);
  });

  it("returns allTools for destructive intent", () => {
    const result = detectToolIntent("delete this task");
    expect(result.tools).toBe(allTools);
  });

  it("returns null tools for none intent", () => {
    const result = detectToolIntent("hello");
    expect(result.tools).toBeNull();
  });
});

describe("needsTools edge cases", () => {
  it("returns true for entity-only messages", () => {
    expect(needsTools("I have a task")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(needsTools("")).toBe(false);
  });

  it("returns false for pure chat messages", () => {
    expect(needsTools("how are you today?")).toBe(false);
  });

  it("returns true for query-only messages", () => {
    expect(needsTools("what is the weather?")).toBe(true);
  });
});

describe("getToolsForMessage edge cases", () => {
  it("returns queryTools for search query", () => {
    const tools = getToolsForMessage("find the tasks");
    expect(tools).toBe(queryTools);
  });

  it("returns null for casual chat", () => {
    const tools = getToolsForMessage("good morning!");
    expect(tools).toBeNull();
  });

  it("returns allTools for remove the board", () => {
    const tools = getToolsForMessage("remove the board");
    expect(tools).toBe(allTools);
  });
});
