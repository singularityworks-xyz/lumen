import { describe, expect, it } from "bun:test";
import { actionTools, allTools, queryTools } from "../../src/tools/definitions";
import {
  detectToolIntent,
  getToolsForMessage,
  needsTools,
} from "../../src/tools/router";

describe("detectToolIntent", () => {
  describe("query intent", () => {
    it("detects 'find blocked tasks on this board' as query", () => {
      const result = detectToolIntent("find blocked tasks on this board");
      expect(result.intent).toBe("query");
      expect(result.tools).toBe(queryTools);
    });

    it("detects 'what is the status of my todo items' as query", () => {
      const result = detectToolIntent("what is the status of my todo items");
      expect(result.intent).toBe("query");
    });

    it("detects 'list recent activity' as query", () => {
      const result = detectToolIntent("list recent activity");
      expect(result.intent).toBe("query");
    });

    it("detects 'search for cards with priority high' as query", () => {
      const result = detectToolIntent("search for cards with priority high");
      expect(result.intent).toBe("query");
    });

    it("detects 'get details for the task' as query", () => {
      const result = detectToolIntent("get details for the task");
      expect(result.intent).toBe("query");
    });
  });

  describe("action intent", () => {
    it("detects 'create a new task' as action", () => {
      const result = detectToolIntent("create a new task");
      expect(result.intent).toBe("action");
      expect(result.tools).toBe(actionTools);
    });

    it("detects 'add a card to the board' as action", () => {
      const result = detectToolIntent("add a card to the board");
      expect(result.intent).toBe("action");
    });

    it("detects 'update the task title' as action", () => {
      const result = detectToolIntent("update the task title");
      expect(result.intent).toBe("action");
    });

    it("detects 'move this item to done' as action", () => {
      const result = detectToolIntent("move this item to done");
      expect(result.intent).toBe("action");
    });

    it("detects 'make a new board' as action", () => {
      const result = detectToolIntent("make a new board");
      expect(result.intent).toBe("action");
    });

    it("detects 'show me all tasks' as action because 'all' is an action keyword", () => {
      const result = detectToolIntent("show me all tasks");
      expect(result.intent).toBe("action");
      expect(result.tools).toBe(actionTools);
    });
  });

  describe("destructive actions escalate to 'both'", () => {
    it("detects 'delete this task' as both", () => {
      const result = detectToolIntent("delete this task");
      expect(result.intent).toBe("both");
      expect(result.tools).toBe(allTools);
    });

    it("detects 'remove the board' as both", () => {
      const result = detectToolIntent("remove the board");
      expect(result.intent).toBe("both");
    });

    it("detects 'clear all cards' as both", () => {
      const result = detectToolIntent("clear all cards");
      expect(result.intent).toBe("both");
    });
  });

  describe("ambiguous entity-only messages", () => {
    it("detects 'I have a task' as both (entity without clear intent)", () => {
      const result = detectToolIntent("I have a task");
      expect(result.intent).toBe("both");
      expect(result.tools).toBe(allTools);
    });

    it("detects 'tell me about my kanban board' as query", () => {
      const result = detectToolIntent("tell me about my kanban board");
      expect(result.intent).toBe("query");
    });
  });

  describe("no-entity chat returns 'none'", () => {
    it("returns none for greeting", () => {
      const result = detectToolIntent("hello how are you");
      expect(result.intent).toBe("none");
      expect(result.tools).toBeNull();
    });

    it("returns none for empty string", () => {
      const result = detectToolIntent("");
      expect(result.intent).toBe("none");
    });

    it("returns none for casual chat", () => {
      const result = detectToolIntent("thanks for your help!");
      expect(result.intent).toBe("none");
    });
  });

  describe("query keyword without entity still returns query", () => {
    it("classifies 'what is the weather' as query (keyword present)", () => {
      const result = detectToolIntent("what is the weather");
      expect(result.intent).toBe("query");
    });
  });
});

describe("needsTools", () => {
  it("returns true for messages that need tools", () => {
    expect(needsTools("find blocked tasks")).toBe(true);
    expect(needsTools("create a new board")).toBe(true);
  });

  it("returns false for chat messages", () => {
    expect(needsTools("hello")).toBe(false);
    expect(needsTools("how are you?")).toBe(false);
  });
});

describe("getToolsForMessage", () => {
  it("returns queryTools for query messages", () => {
    const tools = getToolsForMessage("find blocked tasks on this board");
    expect(tools).toBe(queryTools);
  });

  it("returns actionTools for action messages", () => {
    const tools = getToolsForMessage("create a new task");
    expect(tools).toBe(actionTools);
  });

  it("returns null for chat messages", () => {
    const tools = getToolsForMessage("hello");
    expect(tools).toBeNull();
  });
});
