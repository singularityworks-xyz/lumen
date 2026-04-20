import { afterAll, describe, expect, it, mock } from "bun:test";

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  }),
}));

import { buildMessagesFromHistory } from "./message-builder";
import type { AiSdkMessage, HistoryMessage, ToolCallPart } from "./types";

describe("buildMessagesFromHistory", () => {
  it("converts user messages to AI SDK format", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "Hello" },
      { role: "user", content: "How are you?" },
    ];

    const result = buildMessagesFromHistory(history);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: "user", content: "Hello" });
    expect(result[1]).toEqual({ role: "user", content: "How are you?" });
  });

  it("converts plain assistant messages to AI SDK format", () => {
    const history: HistoryMessage[] = [
      { role: "assistant", content: "I am fine, thanks!" },
    ];

    const result = buildMessagesFromHistory(history);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: "assistant",
      content: "I am fine, thanks!",
    });
  });

  it("converts assistant tool-call messages into structured AI SDK format", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "Let me check that for you.",
        toolCalls: [
          {
            id: "call-1",
            name: "get_weather",
            arguments: { city: "London" },
          },
        ],
      },
    ];

    const result = buildMessagesFromHistory(history);

    expect(result).toHaveLength(1);
    const msg = result[0] as AiSdkMessage;
    expect(msg.role).toBe("assistant");
    expect(Array.isArray(msg.content)).toBe(true);

    const parts = msg.content as Array<
      ToolCallPart | { type: "text"; text: string }
    >;
    expect(parts).toHaveLength(2);

    // Text part
    expect(parts[0]).toEqual({
      type: "text",
      text: "Let me check that for you.",
    });

    // Tool call part
    expect(parts[1]).toEqual({
      type: "tool-call",
      toolCallId: "call-1",
      toolName: "get_weather",
      args: { city: "London" },
      input: { city: "London" },
    });
  });

  it("converts assistant with multiple tool calls", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "call-a", name: "tool_a", arguments: { x: 1 } },
          { id: "call-b", name: "tool_b", arguments: { y: 2 } },
        ],
      },
    ];

    const result = buildMessagesFromHistory(history);
    const parts = result[0].content as ToolCallPart[];
    // Empty content string is falsy so no text part
    expect(parts).toHaveLength(2);
    expect(parts[0].toolCallId).toBe("call-a");
    expect(parts[1].toolCallId).toBe("call-b");
  });

  it("tool results parse JSON content when explicit toolResult is absent", () => {
    const history: HistoryMessage[] = [
      {
        role: "tool",
        content: '{"temp": 22, "unit": "C"}',
        toolCallId: "call-1",
        toolName: "get_weather",
      },
    ];

    const result = buildMessagesFromHistory(history);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("tool");
    const parts = result[0].content as Array<{
      type: "tool-result";
      output: { type: "json"; value: unknown };
    }>;
    expect(parts[0].type).toBe("tool-result");
    expect(parts[0].output.type).toBe("json");
    expect(parts[0].output.value).toEqual({ temp: 22, unit: "C" });
  });

  it("tool results use explicit toolResult when provided", () => {
    const history: HistoryMessage[] = [
      {
        role: "tool",
        content: "ignored",
        toolCallId: "call-1",
        toolName: "get_weather",
        toolResult: { explicit: true },
      },
    ];

    const result = buildMessagesFromHistory(history);
    const parts = result[0].content as Array<{
      output: { type: "json"; value: unknown };
    }>;
    expect(parts[0].output.value).toEqual({ explicit: true });
  });

  it("tool results fall back to raw content when JSON parsing fails", () => {
    const history: HistoryMessage[] = [
      {
        role: "tool",
        content: "not valid json {{{",
        toolCallId: "call-1",
        toolName: "get_weather",
      },
    ];

    const result = buildMessagesFromHistory(history);
    const parts = result[0].content as Array<{
      output: { type: "json"; value: unknown };
    }>;
    expect(parts[0].output.value).toBe("not valid json {{{");
  });

  it("malformed tool messages are skipped instead of corrupting conversation history", () => {
    const history: HistoryMessage[] = [
      { role: "user", content: "What's the weather?" },
      {
        role: "tool",
        content: "some result",
        // Missing toolCallId and toolName
      },
      {
        role: "tool",
        content: "another result",
        toolCallId: "call-2",
        // Missing toolName
      },
      {
        role: "tool",
        content: "valid result",
        toolCallId: "call-3",
        toolName: "get_weather",
      },
    ];

    const result = buildMessagesFromHistory(history);

    // Only the user message and the valid tool message should be present
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("tool");
  });

  it("filters out assistant tool calls with missing id or name", () => {
    const history: HistoryMessage[] = [
      {
        role: "assistant",
        content: "Let me help",
        toolCalls: [
          { id: "call-ok", name: "good_tool", arguments: {} },
          { id: "", name: "no_id", arguments: {} },
          { id: "call-no-name", name: "", arguments: {} },
        ],
      },
    ];

    const result = buildMessagesFromHistory(history);
    const parts = result[0].content as Array<{
      type: string;
      toolCallId?: string;
    }>;
    const toolCallParts = parts.filter((p) => p.type === "tool-call");
    expect(toolCallParts).toHaveLength(1);
    expect(toolCallParts[0].toolCallId).toBe("call-ok");
  });
});

afterAll(() => {
  mock.restore();
});
