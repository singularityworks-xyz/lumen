import { describe, expect, it } from "bun:test";
import type {
  ActionInstructionData,
  AiConversation,
  AiMessage,
  AiMessageRole,
  ChatRequest,
  ChatResponse,
  ContextSnapshot,
  PendingAction,
  StreamEvent,
  ToolCall,
  ToolResult,
} from "./types/messages";

describe("AiMessageRole type", () => {
  it("accepts valid role values", () => {
    const roles: AiMessageRole[] = ["user", "assistant", "tool"];
    expect(roles.length).toBe(3);
  });
});

describe("ToolCall interface", () => {
  it("can be constructed with required fields", () => {
    const call: ToolCall = {
      arguments: { query: "test" },
      id: "call-1",
      name: "searchTasks",
    };
    expect(call.id).toBe("call-1");
    expect(call.name).toBe("searchTasks");
    expect(call.arguments).toEqual({ query: "test" });
    expect(call.result).toBeUndefined();
  });

  it("can include optional result field", () => {
    const call: ToolCall = {
      arguments: {},
      id: "call-2",
      name: "getWorkspaceOverview",
      result: { boardCount: 3 },
    };
    expect(call.result).toEqual({ boardCount: 3 });
  });
});

describe("ToolResult interface", () => {
  it("can be constructed with result", () => {
    const tr: ToolResult = {
      result: { tasks: [] },
      toolCallId: "call-1",
    };
    expect(tr.toolCallId).toBe("call-1");
    expect(tr.error).toBeUndefined();
  });

  it("can include error field", () => {
    const tr: ToolResult = {
      error: "Board not found",
      result: null,
      toolCallId: "call-1",
    };
    expect(tr.error).toBe("Board not found");
  });
});

describe("PendingAction interface", () => {
  it("can be constructed", () => {
    const action: PendingAction = {
      description: "Delete task",
      params: { taskId: "t1" },
      tool: "deleteTask",
    };
    expect(action.tool).toBe("deleteTask");
    expect(action.params).toEqual({ taskId: "t1" });
  });
});

describe("ContextSnapshot interface", () => {
  it("can be constructed with all fields", () => {
    const snapshot: ContextSnapshot = {
      currentBoardId: "b1",
      selectedBoardIds: ["b1"],
      selectedTaskIds: ["t1", "t2"],
      viewportCenter: { x: 500, y: 300 },
      viewportZoom: 1.5,
    };
    expect(snapshot.currentBoardId).toBe("b1");
    expect(snapshot.selectedTaskIds.length).toBe(2);
    expect(snapshot.viewportCenter.x).toBe(500);
  });

  it("can have null currentBoardId", () => {
    const snapshot: ContextSnapshot = {
      currentBoardId: null,
      selectedBoardIds: [],
      selectedTaskIds: [],
      viewportCenter: { x: 0, y: 0 },
      viewportZoom: 1,
    };
    expect(snapshot.currentBoardId).toBeNull();
  });
});

describe("AiMessage interface", () => {
  it("can represent a user message", () => {
    const msg: AiMessage = {
      content: "Hello",
      createdAt: "2025-01-01T00:00:00.000Z",
      id: "msg-1",
      role: "user",
    };
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("Hello");
  });

  it("can represent an assistant message with metadata", () => {
    const msg: AiMessage = {
      content: "Here are your tasks",
      createdAt: "2025-01-01T00:00:01.000Z",
      id: "msg-2",
      role: "assistant",
      metadata: {
        duration: 1200,
        model: "gpt-oss-120b",
        usage: { totalTokens: 150 },
      },
    };
    expect(msg.metadata?.duration).toBe(1200);
    expect(msg.metadata?.usage?.totalTokens).toBe(150);
  });

  it("can represent an assistant message with tool calls", () => {
    const msg: AiMessage = {
      content: "",
      createdAt: "2025-01-01T00:00:02.000Z",
      id: "msg-3",
      role: "assistant",
      toolCalls: [
        {
          arguments: { query: "deploy" },
          id: "call-1",
          name: "searchTasks",
        },
      ],
    };
    expect(msg.toolCalls?.length).toBe(1);
  });

  it("can represent a tool result message", () => {
    const msg: AiMessage = {
      content: '{"tasks":[]}',
      createdAt: "2025-01-01T00:00:03.000Z",
      id: "msg-4",
      role: "tool",
      toolCallId: "call-1",
      toolName: "searchTasks",
      toolResult: { tasks: [] },
    };
    expect(msg.role).toBe("tool");
    expect(msg.toolCallId).toBe("call-1");
  });

  it("can represent a streaming message", () => {
    const msg: AiMessage = {
      content: "Loading...",
      createdAt: "2025-01-01T00:00:04.000Z",
      id: "msg-5",
      isStreaming: true,
      role: "assistant",
    };
    expect(msg.isStreaming).toBe(true);
  });

  it("can represent an errored message", () => {
    const msg: AiMessage = {
      content: "",
      createdAt: "2025-01-01T00:00:05.000Z",
      error: "Rate limit exceeded",
      id: "msg-6",
      role: "assistant",
    };
    expect(msg.error).toBe("Rate limit exceeded");
  });

  it("can represent a message with pending action requiring confirmation", () => {
    const msg: AiMessage = {
      content: "I will delete this task.",
      createdAt: "2025-01-01T00:00:06.000Z",
      id: "msg-7",
      pendingAction: {
        description: "Delete task Fix bug",
        params: { taskId: "t1" },
        tool: "deleteTask",
      },
      requiresConfirmation: true,
      role: "assistant",
    };
    expect(msg.requiresConfirmation).toBe(true);
    expect(msg.pendingAction?.tool).toBe("deleteTask");
  });
});

describe("AiConversation interface", () => {
  it("can be constructed with required fields", () => {
    const conv: AiConversation = {
      createdAt: "2025-01-01T00:00:00.000Z",
      id: "conv-1",
      lastActiveAt: "2025-01-01T01:00:00.000Z",
      messageCount: 2,
      messages: [],
      updatedAt: "2025-01-01T01:00:00.000Z",
      workspaceId: "ws-1",
    };
    expect(conv.id).toBe("conv-1");
    expect(conv.messageCount).toBe(2);
  });

  it("can include optional summary and title", () => {
    const conv: AiConversation = {
      createdAt: "2025-01-01T00:00:00.000Z",
      id: "conv-2",
      lastActiveAt: "2025-01-01T01:00:00.000Z",
      messageCount: 10,
      messages: [],
      summary: "Discussion about sprint planning",
      summaryUpToIndex: 5,
      title: "Sprint Planning",
      updatedAt: "2025-01-01T01:00:00.000Z",
      workspaceId: "ws-1",
    };
    expect(conv.summary).toBe("Discussion about sprint planning");
    expect(conv.title).toBe("Sprint Planning");
    expect(conv.summaryUpToIndex).toBe(5);
  });
});

describe("StreamEvent discriminated union", () => {
  it("can represent message_start", () => {
    const event: StreamEvent = {
      type: "message_start",
      messageId: "msg-1",
    };
    expect(event.type).toBe("message_start");
    if (event.type === "message_start") {
      expect(event.messageId).toBe("msg-1");
    }
  });

  it("can represent content_delta", () => {
    const event: StreamEvent = {
      type: "content_delta",
      content: "Hello",
    };
    if (event.type === "content_delta") {
      expect(event.content).toBe("Hello");
    }
  });

  it("can represent tool_call_start", () => {
    const event: StreamEvent = {
      type: "tool_call_start",
      toolName: "searchTasks",
      toolCallId: "call-1",
    };
    if (event.type === "tool_call_start") {
      expect(event.toolName).toBe("searchTasks");
    }
  });

  it("can represent tool_call_result", () => {
    const event: StreamEvent = {
      type: "tool_call_result",
      toolCallId: "call-1",
      result: { tasks: [] },
    };
    if (event.type === "tool_call_result") {
      expect(event.result).toEqual({ tasks: [] });
    }
  });

  it("can represent action_instruction", () => {
    const instruction: ActionInstructionData = {
      type: "createTask",
      boardId: "b1",
      title: "New Task",
    };
    const event: StreamEvent = {
      type: "action_instruction",
      toolCallId: "call-1",
      instruction,
      message: "Create task",
    };
    if (event.type === "action_instruction") {
      expect(event.instruction.type).toBe("createTask");
    }
  });

  it("can represent confirmation_required", () => {
    const event: StreamEvent = {
      type: "confirmation_required",
      messageId: "msg-1",
      action: {
        description: "Delete task",
        params: { taskId: "t1" },
        tool: "deleteTask",
      },
    };
    if (event.type === "confirmation_required") {
      expect(event.action.tool).toBe("deleteTask");
    }
  });

  it("can represent message_complete", () => {
    const msg: AiMessage = {
      content: "Done",
      createdAt: "2025-01-01T00:00:00.000Z",
      id: "msg-1",
      role: "assistant",
    };
    const event: StreamEvent = {
      type: "message_complete",
      message: msg,
    };
    if (event.type === "message_complete") {
      expect(event.message.content).toBe("Done");
    }
  });

  it("can represent title_generated", () => {
    const event: StreamEvent = {
      type: "title_generated",
      title: "Sprint Planning",
    };
    if (event.type === "title_generated") {
      expect(event.title).toBe("Sprint Planning");
    }
  });

  it("can represent queue_status", () => {
    const event: StreamEvent = {
      type: "queue_status",
      position: 3,
      estimatedWaitMs: 600,
      isQueued: true,
    };
    if (event.type === "queue_status") {
      expect(event.position).toBe(3);
    }
  });

  it("can represent error", () => {
    const event: StreamEvent = {
      type: "error",
      error: "Rate limit exceeded",
    };
    if (event.type === "error") {
      expect(event.error).toBe("Rate limit exceeded");
    }
  });

  it("accepts all 10 action instruction types", () => {
    const types: ActionInstructionData["type"][] = [
      "createTask",
      "updateTask",
      "deleteTask",
      "moveTask",
      "createBoard",
      "updateBoard",
      "deleteBoard",
      "createColumn",
      "bulkUpdateTasks",
      "bulkDeleteTasks",
    ];
    expect(types.length).toBe(10);
  });
});

describe("ChatRequest and ChatResponse", () => {
  it("ChatRequest can be constructed", () => {
    const req: ChatRequest = {
      context: {
        currentBoardId: null,
        selectedBoardIds: [],
        selectedTaskIds: [],
        viewportCenter: { x: 0, y: 0 },
        viewportZoom: 1,
      },
      message: "Show my tasks",
      workspaceId: "ws-1",
    };
    expect(req.message).toBe("Show my tasks");
  });

  it("ChatResponse can be constructed", () => {
    const res: ChatResponse = {
      conversationId: "conv-1",
      messageId: "msg-1",
    };
    expect(res.conversationId).toBe("conv-1");
  });
});
