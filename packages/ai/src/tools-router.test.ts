import { describe, expect, it } from "bun:test";
import { actionTools, allTools, queryTools } from "./tools/definitions";
import {
  detectToolIntent,
  getToolsForMessage,
  getToolsForMessageAsync,
  getToolsForMessageSync,
  needsTools,
} from "./tools/router";

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

    it("detects 'tell me about my kanban board' as query", () => {
      const result = detectToolIntent("tell me about my kanban board");
      expect(result.intent).toBe("query");
    });

    it("detects 'give me the workspace overview' as query", () => {
      const result = detectToolIntent("give me the workspace overview");
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

    it("detects 'the kanban board is empty' as both", () => {
      const result = detectToolIntent("the kanban board is empty");
      expect(result.intent).toBe("both");
    });

    it("detects 'todo items are piling up' as both", () => {
      const result = detectToolIntent("todo items are piling up");
      expect(result.intent).toBe("both");
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

    it("returns none for random text without keywords", () => {
      const result = detectToolIntent("lorem ipsum dolor sit amet");
      expect(result.intent).toBe("none");
    });
  });

  describe("query keyword without entity returns query", () => {
    it("classifies 'what is the weather' as query (keyword present)", () => {
      const result = detectToolIntent("what is the weather");
      expect(result.intent).toBe("query");
    });

    it("classifies 'show me the way' as query", () => {
      const result = detectToolIntent("show me the way");
      expect(result.intent).toBe("query");
    });

    it("classifies 'give me an example' as query", () => {
      const result = detectToolIntent("give me an example");
      expect(result.intent).toBe("query");
    });

    it("classifies 'tell me a story' as query", () => {
      const result = detectToolIntent("tell me a story");
      expect(result.intent).toBe("query");
    });
  });

  describe("action keyword without entity returns both", () => {
    it("classifies 'create something amazing' as both", () => {
      const result = detectToolIntent("create something amazing");
      expect(result.intent).toBe("both");
      expect(result.tools).toBe(allTools);
    });

    it("classifies 'I want to add more' as both", () => {
      const result = detectToolIntent("I want to add more");
      expect(result.intent).toBe("both");
    });

    it("classifies 'let me edit this' as both", () => {
      const result = detectToolIntent("let me edit this");
      expect(result.intent).toBe("both");
    });

    it("classifies 'please modify the settings' as both", () => {
      const result = detectToolIntent("please modify the settings");
      expect(result.intent).toBe("both");
    });
  });

  describe("special characters in keywords", () => {
    it("handles messages with regex special characters", () => {
      const result = detectToolIntent("create a task with [brackets]");
      expect(result.intent).toBe("action");
    });

    it("handles messages with dots and asterisks", () => {
      const result = detectToolIntent("find tasks.*");
      expect(result.intent).toBe("query");
    });

    it("handles messages with parentheses", () => {
      const result = detectToolIntent("create (new) task");
      expect(result.intent).toBe("action");
    });
  });

  describe("reason strings", () => {
    it("provides reason for query intent", () => {
      const result = detectToolIntent("find tasks on board");
      expect(result.reason).toBeTruthy();
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it("provides reason for action intent", () => {
      const result = detectToolIntent("create a new task");
      expect(result.reason).toBeTruthy();
    });

    it("provides reason for both intent", () => {
      const result = detectToolIntent("delete the task");
      expect(result.reason).toBeTruthy();
    });

    it("provides reason for none intent", () => {
      const result = detectToolIntent("hello");
      expect(result.reason).toBeTruthy();
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

  it("returns true for entity-only messages", () => {
    expect(needsTools("I have a task")).toBe(true);
  });

  it("returns true for action keyword without entity", () => {
    expect(needsTools("create something")).toBe(true);
  });

  it("returns true for query keyword without entity", () => {
    expect(needsTools("show me")).toBe(true);
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

  it("returns allTools for entity-only messages", () => {
    const tools = getToolsForMessage("I have a task");
    expect(tools).toBe(allTools);
  });

  it("returns allTools for destructive messages", () => {
    const tools = getToolsForMessage("delete this task");
    expect(tools).toBe(allTools);
  });
});

describe("getToolsForMessageSync", () => {
  it("returns queryTools for query messages", () => {
    const tools = getToolsForMessageSync("find blocked tasks on this board");
    expect(tools).toBe(queryTools);
  });

  it("returns actionTools for action messages", () => {
    const tools = getToolsForMessageSync("create a new task");
    expect(tools).toBe(actionTools);
  });

  it("returns null for chat messages", () => {
    const tools = getToolsForMessageSync("hello");
    expect(tools).toBeNull();
  });

  it("returns allTools for destructive messages", () => {
    const tools = getToolsForMessageSync("delete this task");
    expect(tools).toBe(allTools);
  });

  it("returns allTools for action keyword without entity", () => {
    const tools = getToolsForMessageSync("create something");
    expect(tools).toBe(allTools);
  });

  it("returns queryTools for query keyword without entity", () => {
    const tools = getToolsForMessageSync("show me");
    expect(tools).toBe(queryTools);
  });
});

describe("getToolsForMessageAsync", () => {
  it("returns tools, classification, and queueStatus", async () => {
    const result = await getToolsForMessageAsync(
      "find tasks on board",
      "fake-api-key"
    );

    expect(result).toHaveProperty("tools");
    expect(result).toHaveProperty("classification");
    expect(result).toHaveProperty("queueStatus");
    expect(result.classification).toHaveProperty("intent");
    expect(result.classification).toHaveProperty("confidence");
    expect(result.classification).toHaveProperty("reason");
    expect(result.queueStatus).toHaveProperty("position");
    expect(result.queueStatus).toHaveProperty("estimatedWaitMs");
    expect(result.queueStatus).toHaveProperty("isQueued");
  });

  it("classification intent matches tools returned", async () => {
    const result = await getToolsForMessageAsync("hello", "fake-api-key");

    if (result.classification.intent === "none") {
      expect(result.tools).toBeNull();
    }
  });

  it("queueStatus.isQueued is boolean", async () => {
    const result = await getToolsForMessageAsync(
      "show me tasks",
      "fake-api-key"
    );

    expect(typeof result.queueStatus.isQueued).toBe("boolean");
  });

  it("queueStatus.position is non-negative", async () => {
    const result = await getToolsForMessageAsync(
      "create a task",
      "fake-api-key"
    );

    expect(result.queueStatus.position).toBeGreaterThanOrEqual(0);
  });

  it("queueStatus.estimatedWaitMs is non-negative", async () => {
    const result = await getToolsForMessageAsync(
      "delete a task",
      "fake-api-key"
    );

    expect(result.queueStatus.estimatedWaitMs).toBeGreaterThanOrEqual(0);
  });
});
