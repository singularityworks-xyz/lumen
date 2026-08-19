import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const mockLogger = mock(() => {
  // intentionally empty mock
});

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    debug: mockLogger,
    error: mockLogger,
    info: mockLogger,
    warn: mockLogger,
  }),
}));

interface AddParams {
  containerTag: string;
  content?: string;
  customId?: string;
  metadata?: Record<string, string>;
  taskType?: string;
}

interface ProfileParams {
  containerTag: string;
}

interface SearchParams {
  containerTag?: string;
  q?: string;
  searchMode?: string;
}

interface FakeClient {
  add: ReturnType<
    typeof mock<(params: AddParams) => Promise<{ id: string; status: string }>>
  >;
  profile: ReturnType<
    typeof mock<
      (
        params: ProfileParams
      ) => Promise<{ profile: { static: string[]; dynamic: string[] } }>
    >
  >;
  search: ReturnType<
    typeof mock<
      (params?: SearchParams) => Promise<{
        results: Array<{
          memory: string;
          similarity: number;
          context?: { related?: Array<{ memory: string; relation: string }> };
        }>;
      }>
    >
  >;
}

const mockIsMemoryEnabled = mock(() => true);
const mockGetSupermemoryClient = mock((): FakeClient | null => null);

mock.module("./supermemory-client", () => ({
  getSupermemoryClient: mockGetSupermemoryClient,
  isMemoryEnabled: mockIsMemoryEnabled,
}));

type MemoryServiceModule = typeof import("./memory-service");

const memoryService = (await import(
  `./memory-service?${Date.now()}`
)) as MemoryServiceModule;

const {
  conversationCustomId,
  recallMemory,
  retainConversationTurn,
  userContainerTag,
  workspaceContainerTag,
} = memoryService;

function createFakeClient(): FakeClient {
  return {
    add: mock((_params: AddParams) =>
      Promise.resolve({ id: "doc_1", status: "queued" })
    ),
    profile: mock((_params: ProfileParams) =>
      Promise.resolve({
        profile: {
          static: ["Prefers boards organized by sprint"],
          dynamic: ["Working on Q3 launch"],
        },
      })
    ),
    search: mock((_params?: SearchParams) =>
      Promise.resolve({
        results: [
          {
            memory: "Auth task blocked on API keys",
            similarity: 0.87,
            context: {
              related: [
                { memory: "Alice handles frontend", relation: "related" },
              ],
            },
          },
        ],
      })
    ),
  };
}

beforeEach(() => {
  mockIsMemoryEnabled.mockImplementation(() => true);
  mockLogger.mockClear();
});

afterEach(() => {
  mock.restore();
});

describe("container tag helpers", () => {
  it("builds user container tags", () => {
    expect(userContainerTag("abc123")).toBe("user_abc123");
  });

  it("builds workspace container tags", () => {
    expect(workspaceContainerTag("ws_789")).toBe("workspace_ws_789");
  });

  it("builds conversation custom ids", () => {
    expect(conversationCustomId("conv_1")).toBe("conv_conv_1");
  });
});

describe("recallMemory", () => {
  it("returns an empty block when memory is disabled", async () => {
    mockIsMemoryEnabled.mockImplementation(() => false);

    const result = await recallMemory({
      query: "what's the status?",
      userId: "user_1",
    });

    expect(result.isEmpty).toBe(true);
    expect(result.text).toBe("");
    expect(mockGetSupermemoryClient).not.toHaveBeenCalled();
  });

  it("returns an empty block when the client is unavailable", async () => {
    mockGetSupermemoryClient.mockImplementation(() => null);

    const result = await recallMemory({
      query: "hi",
      userId: "user_1",
    });

    expect(result.isEmpty).toBe(true);
  });

  it("queries profile and memory search for user and workspace containers", async () => {
    const client = createFakeClient();
    mockGetSupermemoryClient.mockImplementation(() => client);

    await recallMemory({
      query: "what did we decide about the auth task?",
      userId: "user_1",
      workspaceId: "ws_2",
    });

    // user container
    expect(client.profile).toHaveBeenCalledWith(
      expect.objectContaining({ containerTag: "user_user_1" })
    );
    expect(client.search).toHaveBeenCalledWith(
      expect.objectContaining({
        containerTag: "user_user_1",
        searchMode: "memories",
        q: "what did we decide about the auth task?",
      })
    );

    // workspace container
    expect(client.profile).toHaveBeenCalledWith(
      expect.objectContaining({ containerTag: "workspace_ws_2" })
    );
    expect(client.search).toHaveBeenCalledWith(
      expect.objectContaining({ containerTag: "workspace_ws_2" })
    );
  });

  it("skips the workspace container when no workspaceId is given", async () => {
    const client = createFakeClient();
    mockGetSupermemoryClient.mockImplementation(() => client);

    await recallMemory({ query: "hi", userId: "user_1" });

    expect(
      client.profile.mock.calls.every(
        (call: unknown[]) =>
          (call[0] as { containerTag: string }).containerTag === "user_user_1"
      )
    ).toBe(true);
  });

  it("renders user and workspace sections with facts", async () => {
    const client = createFakeClient();
    mockGetSupermemoryClient.mockImplementation(() => client);

    const result = await recallMemory({
      query: "auth task",
      userId: "user_1",
      workspaceId: "ws_2",
    });

    expect(result.isEmpty).toBe(false);
    expect(result.text).toContain("## Long-Term Memory Context");
    expect(result.text).toContain("### About this user");
    expect(result.text).toContain("Prefers boards organized by sprint");
    expect(result.text).toContain("Working on Q3 launch");
    expect(result.text).toContain("### About this workspace");
    expect(result.text).toContain("Auth task blocked on API keys");
    expect(result.text).toContain("Alice handles frontend");
  });

  it("deduplicates identical facts", async () => {
    const client = createFakeClient();
    client.search.mockImplementation(async () => ({
      results: [
        { memory: "Same fact", similarity: 0.9 },
        { memory: "Same fact", similarity: 0.8 },
        { memory: "Another fact", similarity: 0.7 },
      ],
    }));
    mockGetSupermemoryClient.mockImplementation(() => client);

    const result = await recallMemory({
      query: "x",
      userId: "user_1",
    });

    const occurrences = result.text.split("Same fact").length - 1;
    expect(occurrences).toBe(1);
    expect(result.text).toContain("Another fact");
  });

  it("fails soft when the client throws", async () => {
    const client = createFakeClient();
    client.profile.mockImplementation(() =>
      Promise.reject(new Error("supermemory down"))
    );
    client.search.mockImplementation(() =>
      Promise.reject(new Error("supermemory down"))
    );
    mockGetSupermemoryClient.mockImplementation(() => client);

    const result = await recallMemory({
      query: "x",
      userId: "user_1",
      workspaceId: "ws_2",
    });

    expect(result.isEmpty).toBe(true);
  });

  it("fails soft when a container query times out", async () => {
    const client = createFakeClient();
    client.search.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ results: [] }), 10_000);
        })
    );
    mockGetSupermemoryClient.mockImplementation(() => client);

    const result = await recallMemory({
      query: "x",
      userId: "user_1",
    });

    // The user section still renders from the profile that succeeded
    expect(result.isEmpty).toBe(false);
    expect(result.text).toContain("Prefers boards organized by sprint");
  });
});

describe("retainConversationTurn", () => {
  const input = {
    userId: "user_1",
    workspaceId: "ws_2",
    conversationId: "conv_9",
    userMessage: "move the auth task to In Review",
    assistantMessage: "Moved it. Done.",
    toolCalls: [{ name: "moveTask", arguments: { taskId: "t_1" } }],
  };

  it("does nothing when memory is disabled", async () => {
    mockIsMemoryEnabled.mockImplementation(() => false);
    const client = createFakeClient();
    mockGetSupermemoryClient.mockImplementation(() => client);

    await retainConversationTurn(input);

    expect(client.add).not.toHaveBeenCalled();
  });

  it("adds the turn to the user and workspace containers", async () => {
    const client = createFakeClient();
    mockGetSupermemoryClient.mockImplementation(() => client);

    await retainConversationTurn(input);

    expect(client.add).toHaveBeenCalledTimes(2);

    const userCall = client.add.mock.calls[0]?.[0];
    expect(userCall?.containerTag).toBe("user_user_1");
    expect(userCall?.customId).toBe("conv_conv_9");
    expect(userCall?.taskType).toBe("memory");
    expect(userCall?.metadata?.workspaceId).toBe("ws_2");
    expect(userCall?.content).toContain(
      "user: move the auth task to In Review"
    );
    expect(userCall?.content).toContain("assistant: Moved it. Done.");
    expect(userCall?.content).toContain('moveTask({"taskId":"t_1"})');

    const workspaceCall = client.add.mock.calls[1]?.[0];
    expect(workspaceCall?.containerTag).toBe("workspace_ws_2");
  });

  it("only retains under the user container when there is no workspace", async () => {
    const client = createFakeClient();
    mockGetSupermemoryClient.mockImplementation(() => client);

    await retainConversationTurn({ ...input, workspaceId: undefined });

    expect(client.add).toHaveBeenCalledTimes(1);
    expect(client.add.mock.calls[0]?.[0]?.containerTag).toBe("user_user_1");
  });

  it("never throws when the client fails", async () => {
    const client = createFakeClient();
    client.add.mockImplementation(() =>
      Promise.reject(new Error("add failed"))
    );
    mockGetSupermemoryClient.mockImplementation(() => client);

    await expect(retainConversationTurn(input)).resolves.toBeUndefined();
  });

  it("truncates overly long messages", async () => {
    const client = createFakeClient();
    mockGetSupermemoryClient.mockImplementation(() => client);

    const longMessage = "x".repeat(10_000);
    await retainConversationTurn({ ...input, userMessage: longMessage });

    const content = client.add.mock.calls[0]?.[0]?.content ?? "";
    expect(content.length).toBeLessThan(10_000);
    expect(content).toContain("(truncated)");
  });
});
