// Set environment variables BEFORE any imports that use env.ts
process.env.DATABASE_URL = "postgres://dummy";
process.env.NODE_ENV = "development";
process.env.WEB_URL = "http://localhost:3000";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-secret-must-be-21-chars-long!!";
process.env.BETTER_AUTH_TRUSTED_ORIGINS = "";
process.env.GITHUB_CLIENT_ID = "test-github-client-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-client-secret";
process.env.JWKS_ENCRYPTION_KEY = "test-jwks-encryption-key-32chars!!";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

// Mock Y.Doc with a simple Map-based implementation
function createMockDoc() {
  const maps = new Map<string, Map<string, unknown>>();
  return {
    getMap<T = unknown>(name: string): Map<string, T> {
      if (!maps.has(name)) {
        maps.set(name, new Map());
      }
      return maps.get(name) as Map<string, T>;
    },
    transact(fn: () => void) {
      fn();
    },
  };
}

type MockDoc = ReturnType<typeof createMockDoc>;

const globalMockStore = (
  globalThis as unknown as {
    __textBoardMockStore__: { doc: MockDoc; returnNull: boolean } | undefined;
  }
).__textBoardMockStore__;

const mockState = globalMockStore ?? {
  doc: createMockDoc(),
  returnNull: false,
};

(
  globalThis as unknown as { __textBoardMockStore__: typeof mockState }
).__textBoardMockStore__ = mockState;

mock.module("./yjs-accessor", () => ({
  getWorkspaceYjsDoc: (_workspaceId: string) => {
    if (mockState.returnNull) {
      return Promise.resolve(null);
    }
    return Promise.resolve(mockState.doc);
  },
  logger: {
    info: mock(() => undefined),
    error: mock(() => undefined),
    warn: mock(() => undefined),
    debug: mock(() => undefined),
  },
}));

const mockDoc = () => mockState.doc;

let executeCreateTextBoard: typeof import("./create-text-board").executeCreateTextBoard;
let executeUpdateTextBoard: typeof import("./update-text-board").executeUpdateTextBoard;
let executeDeleteTextBoard: typeof import("./delete-text-board").executeDeleteTextBoard;

beforeAll(async () => {
  const createTextBoard = await import("./create-text-board");
  const updateTextBoard = await import("./update-text-board");
  const deleteTextBoard = await import("./delete-text-board");

  executeCreateTextBoard = createTextBoard.executeCreateTextBoard;
  executeUpdateTextBoard = updateTextBoard.executeUpdateTextBoard;
  executeDeleteTextBoard = deleteTextBoard.executeDeleteTextBoard;
});

const baseCtx = {
  workspaceId: "ws-1",
  userId: "user-1",
  ephemeral: false,
};

const ephemeralCtx = { ...baseCtx, ephemeral: true };

function seedTextBoard(doc: MockDoc, id = "tb-1") {
  const textBoardsMap = doc.getMap("textBoards");
  const textBoardPositionsMap = doc.getMap("textBoardPositions");
  const workspaceMap = doc.getMap("workspace");

  textBoardsMap.set(id, {
    id,
    workspace_id: "ws-1",
    name: "Launch todos",
    created_by: "user-1",
    created_at: "2023-01-01",
    content: JSON.stringify({ type: "doc", content: [] }),
  });
  textBoardPositionsMap.set(id, { id, x: 10, y: 10, zIndex: 1 });
  workspaceMap.set("data", { id: "ws-1", name: "Test Workspace" });
}

beforeEach(() => {
  mockState.returnNull = false;
  mockState.doc = createMockDoc();
  seedTextBoard(mockState.doc);
});

afterAll(() => {
  mockState.returnNull = false;
});

describe("executeCreateTextBoard", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeCreateTextBoard(
      { name: "Notes", content: "- [ ] a" },
      ephemeralCtx
    );
    expect(result.success).toBe(true);
    expect(result.instruction?.type).toBe("createTextBoard");
    expect(result.instruction?.name).toBe("Notes");
    expect(result.instruction?.content).toBe("- [ ] a");
  });

  it("creates a text board with converted TipTap JSON content", async () => {
    const result = await executeCreateTextBoard(
      { name: "Launch todos", content: "- [ ] Ship it\n- [x] Test it" },
      baseCtx
    );
    expect(result.success).toBe(true);
    const data = result.data as { textBoardId: string; name: string };
    expect(data.textBoardId.startsWith("tb_")).toBe(true);
    expect(data.name).toBe("Launch todos");

    const textBoardsMap = mockDoc().getMap("textBoards");
    const textBoard = textBoardsMap.get(data.textBoardId) as Record<
      string,
      unknown
    >;
    expect(textBoard.workspace_id).toBe("ws-1");
    expect(textBoard.created_by).toBe("user-1");

    const content = JSON.parse(textBoard.content as string) as {
      content?: unknown[];
    };
    expect(Array.isArray(content.content)).toBe(true);
    expect(JSON.stringify(content.content)).toContain("taskList");

    const positionsMap = mockDoc().getMap("textBoardPositions");
    expect(positionsMap.has(data.textBoardId)).toBe(true);
  });

  it("creates a text board without content when not provided", async () => {
    const result = await executeCreateTextBoard({ name: "Empty" }, baseCtx);
    expect(result.success).toBe(true);
    const data = result.data as { textBoardId: string };
    const textBoardsMap = mockDoc().getMap("textBoards");
    const textBoard = textBoardsMap.get(data.textBoardId) as Record<
      string,
      unknown
    >;
    expect(textBoard.content).toBeUndefined();
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeCreateTextBoard({ name: "Fail" }, baseCtx);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Workspace not loaded");
  });
});

describe("executeUpdateTextBoard", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeUpdateTextBoard(
      { textBoardId: "tb-1", updates: { name: "Updated" } },
      ephemeralCtx
    );
    expect(result.success).toBe(true);
    expect(result.instruction?.type).toBe("updateTextBoard");
    expect(
      (result.instruction as { updates?: { name?: string } }).updates?.name
    ).toBe("Updated");
  });

  it("updates name, description, and converts content to TipTap JSON", async () => {
    const result = await executeUpdateTextBoard(
      {
        textBoardId: "tb-1",
        updates: { name: "Renamed", content: "# Heading\n\n- [ ] todo" },
      },
      baseCtx
    );
    expect(result.success).toBe(true);

    const textBoardsMap = mockDoc().getMap("textBoards");
    const textBoard = textBoardsMap.get("tb-1") as Record<string, unknown>;
    expect(textBoard.name).toBe("Renamed");
    const content = JSON.parse(textBoard.content as string) as {
      content?: Array<{ type: string }>;
    };
    expect(content.content?.[0]?.type).toBe("heading");
    expect(content.content?.[1]?.type).toBe("taskList");
    expect(textBoard.updated_at).toBeDefined();
  });

  it("clears description with null", async () => {
    await executeUpdateTextBoard(
      { textBoardId: "tb-1", updates: { description: null } },
      baseCtx
    );
    const textBoardsMap = mockDoc().getMap("textBoards");
    const textBoard = textBoardsMap.get("tb-1") as Record<string, unknown>;
    expect(textBoard.description).toBeUndefined();
  });

  it("fails when text board not found", async () => {
    const result = await executeUpdateTextBoard(
      { textBoardId: "tb-missing", updates: { name: "X" } },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Text board not found");
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeUpdateTextBoard(
      { textBoardId: "tb-1", updates: { name: "X" } },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Workspace not loaded");
  });
});

describe("executeDeleteTextBoard", () => {
  it("returns instruction in ephemeral mode", async () => {
    const result = await executeDeleteTextBoard(
      { textBoardId: "tb-1" },
      ephemeralCtx
    );
    expect(result.success).toBe(true);
    expect(result.instruction?.type).toBe("deleteTextBoard");
  });

  it("deletes text board and its position", async () => {
    const result = await executeDeleteTextBoard(
      { textBoardId: "tb-1" },
      baseCtx
    );
    expect(result.success).toBe(true);
    expect((result.data as { message: string }).message).toContain(
      "Launch todos"
    );
    expect(mockDoc().getMap("textBoards").has("tb-1")).toBe(false);
    expect(mockDoc().getMap("textBoardPositions").has("tb-1")).toBe(false);
  });

  it("fails when text board not found", async () => {
    const result = await executeDeleteTextBoard(
      { textBoardId: "tb-missing" },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Text board not found");
  });

  it("fails when workspace not loaded", async () => {
    mockState.returnNull = true;
    const result = await executeDeleteTextBoard(
      { textBoardId: "tb-1" },
      baseCtx
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Workspace not loaded");
  });
});
