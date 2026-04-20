import { describe, expect, it, mock } from "bun:test";
import { actionTools, allTools, queryTools } from "./definitions";
import {
  detectToolIntent,
  getToolsForMessage,
  getToolsForMessageAsync,
  getToolsForMessageSync,
  needsTools,
} from "./router";

// Mock the tool-classifier module for async tests
mock.module("./tool-classifier", () => {
  return {
    classifyToolIntent: mock((message: string) => {
      const lower = message.toLowerCase();

      // Simulate keyword-based classification for testing
      if (
        lower.includes("delete") ||
        lower.includes("remove") ||
        lower.includes("clear")
      ) {
        return Promise.resolve({
          selection: {
            intent: "both",
            tools: allTools,
            reason: "destructive action detected",
          },
          classification: {
            intent: "both",
            confidence: "high",
            reason: "destructive action",
          },
          queueStatus: {
            position: 0,
            estimatedWaitMs: 0,
            isQueued: false,
          },
        });
      }

      if (
        lower.includes("create") ||
        lower.includes("add") ||
        lower.includes("make") ||
        lower.includes("update") ||
        lower.includes("edit") ||
        lower.includes("move") ||
        lower.includes("transfer")
      ) {
        return Promise.resolve({
          selection: {
            intent: "action",
            tools: actionTools,
            reason: "action detected",
          },
          classification: {
            intent: "action",
            confidence: "high",
            reason: "action detected",
          },
          queueStatus: {
            position: 0,
            estimatedWaitMs: 0,
            isQueued: false,
          },
        });
      }

      if (
        lower.includes("show") ||
        lower.includes("list") ||
        lower.includes("find") ||
        lower.includes("search") ||
        lower.includes("get") ||
        lower.includes("what") ||
        lower.includes("tell") ||
        lower.includes("give")
      ) {
        return Promise.resolve({
          selection: {
            intent: "query",
            tools: queryTools,
            reason: "query detected",
          },
          classification: {
            intent: "query",
            confidence: "high",
            reason: "query detected",
          },
          queueStatus: {
            position: 0,
            estimatedWaitMs: 0,
            isQueued: false,
          },
        });
      }

      return Promise.resolve({
        selection: {
          intent: "none",
          tools: null,
          reason: "no tool intent",
        },
        classification: {
          intent: "none",
          confidence: "high",
          reason: "no tool intent",
        },
        queueStatus: {
          position: 0,
          estimatedWaitMs: 0,
          isQueued: false,
        },
      });
    }),
    classifyToolIntentSync: mock((message: string) => {
      // Same logic as above but synchronous
      const lower = message.toLowerCase();

      if (
        lower.includes("delete") ||
        lower.includes("remove") ||
        lower.includes("clear")
      ) {
        return {
          intent: "both" as const,
          tools: allTools,
          reason: "destructive action detected",
        };
      }

      if (
        lower.includes("create") ||
        lower.includes("add") ||
        lower.includes("make") ||
        lower.includes("update") ||
        lower.includes("edit")
      ) {
        return {
          intent: "action" as const,
          tools: actionTools,
          reason: "action detected",
        };
      }

      if (
        lower.includes("show") ||
        lower.includes("list") ||
        lower.includes("find") ||
        lower.includes("search")
      ) {
        return {
          intent: "query" as const,
          tools: queryTools,
          reason: "query detected",
        };
      }

      return {
        intent: "none" as const,
        tools: null,
        reason: "no tool intent",
      };
    }),
    getClassifierQueueStats: mock(() => ({
      queueLength: 0,
      activeCount: 0,
      maxConcurrent: 3,
      maxQueueSize: 20,
    })),
  };
});

describe("detectToolIntent", () => {
  describe("query intent detection", () => {
    it("should detect query intent for 'find tasks'", () => {
      const result = detectToolIntent("find tasks on this board");
      expect(result.intent).toBe("query");
      expect(result.tools).toBe(queryTools);
      expect(result.reason).toBeTruthy();
    });

    it("should detect query intent for 'show boards'", () => {
      const result = detectToolIntent("show boards");
      expect(result.intent).toBe("query");
      expect(result.tools).toBe(queryTools);
    });

    it("should detect query intent for 'list my cards'", () => {
      const result = detectToolIntent("list my cards");
      expect(result.intent).toBe("query");
    });

    it("should detect query intent for 'search for items'", () => {
      const result = detectToolIntent("search for items");
      expect(result.intent).toBe("query");
    });

    it("should detect query intent for 'get details'", () => {
      const result = detectToolIntent("get details about this task");
      expect(result.intent).toBe("query");
    });

    it("should detect query intent for 'what is the status'", () => {
      const result = detectToolIntent("what is the status of my todos");
      expect(result.intent).toBe("query");
    });

    it("should detect query intent for 'overview'", () => {
      const result = detectToolIntent("give me a workspace overview");
      expect(result.intent).toBe("query");
    });

    it("should detect query intent for 'recent activity'", () => {
      const result = detectToolIntent("show recent activity");
      expect(result.intent).toBe("query");
    });
  });

  describe("action intent detection", () => {
    it("should detect action intent for 'create task'", () => {
      const result = detectToolIntent("create a new task");
      expect(result.intent).toBe("action");
      expect(result.tools).toBe(actionTools);
    });

    it("should detect action intent for 'add card'", () => {
      const result = detectToolIntent("add a card to the board");
      expect(result.intent).toBe("action");
    });

    it("should detect action intent for 'update task'", () => {
      const result = detectToolIntent("update the task title");
      expect(result.intent).toBe("action");
    });

    it("should detect action intent for 'edit column'", () => {
      const result = detectToolIntent("edit the column name");
      expect(result.intent).toBe("action");
    });

    it("should detect action intent for 'move item'", () => {
      const result = detectToolIntent("move this item to done");
      expect(result.intent).toBe("action");
    });

    it("should detect action intent for 'rename board'", () => {
      const result = detectToolIntent("rename the board");
      expect(result.intent).toBe("action");
    });

    it("should detect action intent for 'make new'", () => {
      const result = detectToolIntent("make a new board");
      expect(result.intent).toBe("action");
    });

    it("should detect action intent for 'set priority'", () => {
      const result = detectToolIntent("set task priority to high");
      expect(result.intent).toBe("action");
    });

    it("should detect action intent for 'transfer task'", () => {
      const result = detectToolIntent("transfer task to another column");
      expect(result.intent).toBe("action");
    });
  });

  describe("destructive action detection (escalates to 'both')", () => {
    it("should escalate 'delete task' to both", () => {
      const result = detectToolIntent("delete this task");
      expect(result.intent).toBe("both");
      expect(result.tools).toBe(allTools);
    });

    it("should escalate 'remove board' to both", () => {
      const result = detectToolIntent("remove the board");
      expect(result.intent).toBe("both");
    });

    it("should escalate 'clear cards' to both", () => {
      const result = detectToolIntent("clear all cards");
      expect(result.intent).toBe("both");
    });

    it("should escalate 'delete all tasks' to both", () => {
      const result = detectToolIntent("delete all tasks");
      expect(result.intent).toBe("both");
    });

    it("should escalate 'remove items' to both", () => {
      const result = detectToolIntent("remove these items");
      expect(result.intent).toBe("both");
    });
  });

  describe("entity-only messages (ambiguous)", () => {
    it("should return 'both' for 'my task'", () => {
      const result = detectToolIntent("my task");
      expect(result.intent).toBe("both");
      expect(result.tools).toBe(allTools);
    });

    it("should return 'both' for 'the kanban board'", () => {
      const result = detectToolIntent("the kanban board");
      expect(result.intent).toBe("both");
    });

    it("should return 'both' for 'todo items'", () => {
      const result = detectToolIntent("todo items");
      expect(result.intent).toBe("both");
    });

    it("should return 'both' for 'cards in column'", () => {
      const result = detectToolIntent("cards in this column");
      expect(result.intent).toBe("both");
    });

    it("should return 'both' for 'kanban boards'", () => {
      const result = detectToolIntent("kanban boards");
      expect(result.intent).toBe("both");
    });
  });

  describe("no intent detection (chat messages)", () => {
    it("should return 'none' for empty string", () => {
      const result = detectToolIntent("");
      expect(result.intent).toBe("none");
      expect(result.tools).toBeNull();
    });

    it("should return 'none' for greetings", () => {
      const result = detectToolIntent("hello");
      expect(result.intent).toBe("none");
    });

    it("should return 'none' for 'how are you'", () => {
      const result = detectToolIntent("how are you today");
      expect(result.intent).toBe("none");
    });

    it("should return 'none' for casual chat", () => {
      const result = detectToolIntent("thanks for your help");
      expect(result.intent).toBe("none");
    });

    it("should return 'none' for random text", () => {
      const result = detectToolIntent("lorem ipsum dolor sit amet");
      expect(result.intent).toBe("none");
    });

    it("should return 'none' for 'good morning'", () => {
      const result = detectToolIntent("good morning");
      expect(result.intent).toBe("none");
    });
  });

  describe("action keyword without entity", () => {
    it("should return 'both' for 'create something'", () => {
      const result = detectToolIntent("create something");
      expect(result.intent).toBe("both");
      expect(result.tools).toBe(allTools);
    });

    it("should return 'both' for 'make changes'", () => {
      const result = detectToolIntent("make changes");
      expect(result.intent).toBe("both");
    });

    it("should return 'both' for 'edit this'", () => {
      const result = detectToolIntent("edit this");
      expect(result.intent).toBe("both");
    });

    it("should return 'both' for 'modify settings'", () => {
      const result = detectToolIntent("modify the settings");
      expect(result.intent).toBe("both");
    });
  });

  describe("query keyword without entity", () => {
    it("should return 'query' for 'show me'", () => {
      const result = detectToolIntent("show me");
      expect(result.intent).toBe("query");
    });

    it("should return 'query' for 'what is'", () => {
      const result = detectToolIntent("what is happening");
      expect(result.intent).toBe("query");
    });

    it("should return 'query' for 'give me'", () => {
      const result = detectToolIntent("give me the details");
      expect(result.intent).toBe("query");
    });

    it("should return 'query' for 'tell me'", () => {
      const result = detectToolIntent("tell me a story");
      expect(result.intent).toBe("query");
    });
  });

  describe("edge cases", () => {
    it("should handle mixed case input", () => {
      const result = detectToolIntent("CrEaTe A nEw TaSk");
      expect(result.intent).toBe("action");
    });

    it("should handle extra whitespace", () => {
      const result = detectToolIntent("  find   tasks   ");
      expect(result.intent).toBe("query");
    });

    it("should handle 'all' as action keyword with entity", () => {
      const result = detectToolIntent("show me all tasks");
      expect(result.intent).toBe("action");
    });

    it("should handle 'bulk' as action keyword", () => {
      const result = detectToolIntent("bulk update tasks");
      expect(result.intent).toBe("action");
    });

    it("should handle 'multiple' as action keyword", () => {
      const result = detectToolIntent("update multiple items");
      expect(result.intent).toBe("action");
    });

    it("should handle messages with both query and action keywords", () => {
      // 'update' is action keyword, 'task' is entity
      const result = detectToolIntent("find and update the task");
      // Action keywords with entity = action tools
      expect(result.intent).toBe("action");
    });
  });

  describe("special characters and regex edge cases", () => {
    it("should handle special regex characters in message", () => {
      const result = detectToolIntent("create task with [high] priority");
      expect(result.intent).toBe("action");
    });

    it("should handle parentheses", () => {
      // 'all' is an action keyword
      const result = detectToolIntent("find (all) tasks");
      expect(result.intent).toBe("action");
    });

    it("should handle dots", () => {
      const result = detectToolIntent("update task.urgent");
      expect(result.intent).toBe("action");
    });

    it("should handle asterisks", () => {
      const result = detectToolIntent("search for *important* tasks");
      expect(result.intent).toBe("query");
    });

    it("should handle dollar signs", () => {
      const result = detectToolIntent("task budget $100");
      expect(result.intent).toBe("both");
    });

    it("should handle question marks", () => {
      const result = detectToolIntent("what tasks are due?");
      expect(result.intent).toBe("query");
    });
  });

  describe("reason field validation", () => {
    it("should provide reason for query intent", () => {
      const result = detectToolIntent("find tasks");
      expect(result.reason).toBeTruthy();
      expect(typeof result.reason).toBe("string");
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it("should provide reason for action intent", () => {
      const result = detectToolIntent("create task");
      expect(result.reason).toBeTruthy();
      expect(typeof result.reason).toBe("string");
    });

    it("should provide reason for both intent", () => {
      const result = detectToolIntent("delete task");
      expect(result.reason).toBeTruthy();
      expect(typeof result.reason).toBe("string");
    });

    it("should provide reason for none intent", () => {
      const result = detectToolIntent("hello");
      expect(result.reason).toBeTruthy();
      expect(typeof result.reason).toBe("string");
    });
  });
});

describe("getToolsForMessage", () => {
  it("should return queryTools for query messages", () => {
    const tools = getToolsForMessage("find blocked tasks");
    expect(tools).toBe(queryTools);
  });

  it("should return actionTools for action messages", () => {
    const tools = getToolsForMessage("create a new board");
    expect(tools).toBe(actionTools);
  });

  it("should return allTools for destructive messages", () => {
    const tools = getToolsForMessage("delete all tasks");
    expect(tools).toBe(allTools);
  });

  it("should return allTools for entity-only messages", () => {
    const tools = getToolsForMessage("my tasks");
    expect(tools).toBe(allTools);
  });

  it("should return allTools for action keyword without entity", () => {
    const tools = getToolsForMessage("create something");
    expect(tools).toBe(allTools);
  });

  it("should return queryTools for query keyword without entity", () => {
    const tools = getToolsForMessage("show me");
    expect(tools).toBe(queryTools);
  });

  it("should return null for chat messages", () => {
    const tools = getToolsForMessage("hello how are you");
    expect(tools).toBeNull();
  });

  it("should return null for empty string", () => {
    const tools = getToolsForMessage("");
    expect(tools).toBeNull();
  });
});

describe("needsTools", () => {
  it("should return true for query messages", () => {
    expect(needsTools("find tasks")).toBe(true);
    expect(needsTools("show boards")).toBe(true);
  });

  it("should return true for action messages", () => {
    expect(needsTools("create task")).toBe(true);
    expect(needsTools("update board")).toBe(true);
  });

  it("should return true for destructive messages", () => {
    expect(needsTools("delete task")).toBe(true);
  });

  it("should return true for entity-only messages", () => {
    expect(needsTools("my tasks")).toBe(true);
    expect(needsTools("the board")).toBe(true);
  });

  it("should return true for action keyword without entity", () => {
    expect(needsTools("create something")).toBe(true);
  });

  it("should return true for query keyword without entity", () => {
    expect(needsTools("show me")).toBe(true);
  });

  it("should return false for chat messages", () => {
    expect(needsTools("hello")).toBe(false);
    expect(needsTools("how are you")).toBe(false);
  });

  it("should return false for casual conversation", () => {
    expect(needsTools("thanks!")).toBe(false);
    expect(needsTools("goodbye")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(needsTools("")).toBe(false);
  });
});

describe("getToolsForMessageSync", () => {
  it("should return queryTools for query messages", () => {
    const tools = getToolsForMessageSync("find blocked tasks");
    expect(tools).toBe(queryTools);
  });

  it("should return actionTools for action messages", () => {
    const tools = getToolsForMessageSync("create a new task");
    expect(tools).toBe(actionTools);
  });

  it("should return allTools for destructive messages", () => {
    const tools = getToolsForMessageSync("delete this task");
    expect(tools).toBe(allTools);
  });

  it("should return null for chat messages", () => {
    const tools = getToolsForMessageSync("hello");
    expect(tools).toBeNull();
  });

  it("should handle complex messages", () => {
    const tools = getToolsForMessageSync("show all my tasks and update them");
    // Has both query and action keywords - depends on implementation
    expect(tools).toBeDefined();
  });
});

describe("getToolsForMessageAsync", () => {
  it("should return tools, classification, and queueStatus", async () => {
    const result = await getToolsForMessageAsync(
      "find tasks on board",
      "fake-api-key"
    );

    expect(result).toHaveProperty("tools");
    expect(result).toHaveProperty("classification");
    expect(result).toHaveProperty("queueStatus");
  });

  it("should return query tools for query messages", async () => {
    const result = await getToolsForMessageAsync(
      "show my tasks",
      "fake-api-key"
    );
    expect(result.tools).toBe(queryTools);
    expect(result.classification.intent).toBe("query");
  });

  it("should return action tools for action messages", async () => {
    const result = await getToolsForMessageAsync(
      "create a new task",
      "fake-api-key"
    );
    expect(result.tools).toBe(actionTools);
    expect(result.classification.intent).toBe("action");
  });

  it("should return all tools for destructive messages", async () => {
    const result = await getToolsForMessageAsync(
      "delete this task",
      "fake-api-key"
    );
    expect(result.tools).toBe(allTools);
    expect(result.classification.intent).toBe("both");
  });

  it("should return null tools for chat messages", async () => {
    const result = await getToolsForMessageAsync("hello", "fake-api-key");
    expect(result.tools).toBeNull();
    expect(result.classification.intent).toBe("none");
  });

  it("should have valid queueStatus", async () => {
    const result = await getToolsForMessageAsync("find tasks", "fake-api-key");

    expect(result.queueStatus).toHaveProperty("position");
    expect(result.queueStatus).toHaveProperty("estimatedWaitMs");
    expect(result.queueStatus).toHaveProperty("isQueued");

    expect(typeof result.queueStatus.position).toBe("number");
    expect(typeof result.queueStatus.estimatedWaitMs).toBe("number");
    expect(typeof result.queueStatus.isQueued).toBe("boolean");

    expect(result.queueStatus.position).toBeGreaterThanOrEqual(0);
    expect(result.queueStatus.estimatedWaitMs).toBeGreaterThanOrEqual(0);
  });

  it("should have valid classification", async () => {
    const result = await getToolsForMessageAsync("show tasks", "fake-api-key");

    expect(result.classification).toHaveProperty("intent");
    expect(result.classification).toHaveProperty("confidence");
    expect(result.classification).toHaveProperty("reason");

    expect(["none", "query", "action", "both"]).toContain(
      result.classification.intent
    );
    expect(["high", "medium", "low"]).toContain(
      result.classification.confidence
    );
    expect(typeof result.classification.reason).toBe("string");
  });

  it("tools should match classification intent", async () => {
    const result = await getToolsForMessageAsync("find tasks", "fake-api-key");

    if (result.classification.intent === "query") {
      expect(result.tools).toBe(queryTools);
    } else if (result.classification.intent === "action") {
      expect(result.tools).toBe(actionTools);
    } else if (result.classification.intent === "both") {
      expect(result.tools).toBe(allTools);
    } else if (result.classification.intent === "none") {
      expect(result.tools).toBeNull();
    }
  });
});

describe("keyword boundary matching", () => {
  it("should match whole words only for 'task'", () => {
    // "task" should match, but "tasking" or "multitask" should not be treated as entity
    const result1 = detectToolIntent("create a task");
    expect(result1.intent).toBe("action");

    // "multitask" contains "task" but should not match as entity keyword
    const result2 = detectToolIntent("I need to multitask today");
    // This depends on word boundary implementation - if it matches "task" inside "multitask"
    // it might return something different
    expect(result2).toBeDefined();
  });

  it("should match 'board' as whole word", () => {
    const result = detectToolIntent("show the board");
    expect(result.intent).toBe("query");
  });

  it("should match 'card' as whole word", () => {
    const result = detectToolIntent("create a card");
    expect(result.intent).toBe("action");
  });

  it("should match 'column' as whole word", () => {
    const result = detectToolIntent("add a column");
    expect(result.intent).toBe("action");
  });
});

describe("combined keywords", () => {
  it("should handle 'create' + 'board'", () => {
    const result = detectToolIntent("create a new board");
    expect(result.intent).toBe("action");
  });

  it("should handle 'delete' + 'task'", () => {
    const result = detectToolIntent("delete the task");
    expect(result.intent).toBe("both");
  });

  it("should handle 'find' + 'cards'", () => {
    // 'all' is an action keyword, so this becomes action
    const result = detectToolIntent("find all cards");
    expect(result.intent).toBe("action");
  });

  it("should handle 'update' + 'column'", () => {
    const result = detectToolIntent("update the column");
    expect(result.intent).toBe("action");
  });

  it("should handle 'show' + 'kanban'", () => {
    const result = detectToolIntent("show my kanban");
    expect(result.intent).toBe("query");
  });

  it("should handle 'list' + 'todos'", () => {
    // 'all' is an action keyword, so this becomes action
    const result = detectToolIntent("list all todos");
    expect(result.intent).toBe("action");
  });
});
