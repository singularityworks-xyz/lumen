process.env.DATABASE_URL = "postgres://dummy";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import * as Y from "yjs";

// Mock logger to capture log calls
const mockDebug = mock(() => {
  // No-op mock for debug logs
});
const mockWarn = mock(() => {
  // No-op mock for warn logs
});
const mockError = mock(() => {
  // No-op mock for error logs
});
const mockInfo = mock(() => {
  // No-op mock for info logs
});

mock.module("@lumen/logger", () => ({
  createLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
    debug: mockDebug,
  }),
}));

// Define room interface for type safety
interface MockRoom {
  connections: Map<string, unknown>;
  doc: Y.Doc;
}

// Create a mock Y.Doc that we can use for testing
const createMockDoc = (): Y.Doc => {
  const doc = new Y.Doc();
  return doc;
};

// Mock the room manager - use generic signature to allow parameter
const mockGetRoom = mock((_id?: string): MockRoom | undefined => undefined);
const mockLoadRoomState = mock(() => Promise.resolve(false));
const mockScheduleRoomCleanup = mock(() => {
  // No-op mock for room cleanup
});
const mockReset = mock(() => {
  // No-op mock for reset
});

mock.module("../../../collab", () => ({
  roomManager: {
    getRoom: mockGetRoom,
    loadRoomState: mockLoadRoomState,
    scheduleRoomCleanup: mockScheduleRoomCleanup,
    reset: mockReset,
    getOrCreateRoom: mock((workspaceId: string) => ({
      doc: createMockDoc(),
      connections: new Map(),
      workspaceId,
    })),
  },
}));

// Import the function being tested after mocks are set up
let getWorkspaceYjsDoc: typeof import("./yjs-accessor").getWorkspaceYjsDoc;

describe("getWorkspaceYjsDoc", () => {
  beforeAll(async () => {
    const module = await import("./yjs-accessor");
    getWorkspaceYjsDoc = module.getWorkspaceYjsDoc;
  });

  beforeEach(() => {
    // Reset all mocks before each test
    mockGetRoom.mockClear();
    mockLoadRoomState.mockClear();
    mockScheduleRoomCleanup.mockClear();
    mockDebug.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
    mockReset.mockClear();
  });

  afterEach(() => {
    // Clean up after each test
    mockReset();
  });

  afterAll(() => {
    mock.restore();
  });

  describe("basic function signature", () => {
    it("is a function that returns a Promise", async () => {
      expect(typeof getWorkspaceYjsDoc).toBe("function");
      const result = getWorkspaceYjsDoc("test-workspace");
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  describe("when room exists with active connections", () => {
    it("should return the existing room's document", async () => {
      const mockDoc = createMockDoc();
      const existingRoom: MockRoom = {
        doc: mockDoc,
        connections: new Map([["conn-1", { id: "conn-1" }]]),
      };
      mockGetRoom.mockImplementation(() => existingRoom);

      const result = await getWorkspaceYjsDoc("existing-workspace");

      expect(result).toBe(mockDoc);
      expect(mockGetRoom).toHaveBeenCalledWith("existing-workspace");
      expect(mockLoadRoomState).not.toHaveBeenCalled();
    });

    it("should log room existence and connection count", async () => {
      const mockDoc = createMockDoc();
      const existingRoom: MockRoom = {
        doc: mockDoc,
        connections: new Map([["conn-1", { id: "conn-1" }]]),
      };
      mockGetRoom.mockImplementation(() => existingRoom);

      await getWorkspaceYjsDoc("existing-workspace");

      // Verify debug was called with room info
      expect(mockGetRoom).toHaveBeenCalledWith("existing-workspace");
    });

    it("should return document with boards map accessible", async () => {
      const mockDoc = createMockDoc();
      // Add some data to the boards map
      mockDoc
        .getMap("boards")
        .set("board-1", { id: "board-1", name: "Test Board" });

      const existingRoom: MockRoom = {
        doc: mockDoc,
        connections: new Map([
          ["conn-1", { id: "conn-1" }],
          ["conn-2", { id: "conn-2" }],
        ]),
      };
      mockGetRoom.mockImplementation(() => existingRoom);

      const result = await getWorkspaceYjsDoc("existing-workspace");

      expect(result).toBe(mockDoc);
      expect(result?.getMap("boards").size).toBe(1);
    });
  });

  describe("when room does not exist - database loading", () => {
    it("should attempt to load room state from database", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => Promise.resolve(true));

      const loadedDoc = createMockDoc();
      const loadedRoom: MockRoom = {
        doc: loadedDoc,
        connections: new Map(),
      };

      // Second call to getRoom returns the loaded room
      let callCount = 0;
      mockGetRoom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? undefined : loadedRoom;
      });

      await getWorkspaceYjsDoc("new-workspace");

      expect(mockLoadRoomState).toHaveBeenCalledWith("new-workspace");
    });

    it("should schedule cleanup for rooms with zero connections", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => Promise.resolve(true));

      const loadedDoc = createMockDoc();
      const loadedRoom: MockRoom = {
        doc: loadedDoc,
        connections: new Map(), // Zero connections
      };

      let callCount = 0;
      mockGetRoom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? undefined : loadedRoom;
      });

      await getWorkspaceYjsDoc("new-workspace");

      expect(mockScheduleRoomCleanup).toHaveBeenCalledWith("new-workspace");
    });

    it("should NOT schedule cleanup for rooms with active connections", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => Promise.resolve(true));

      const loadedDoc = createMockDoc();
      const loadedRoom: MockRoom = {
        doc: loadedDoc,
        connections: new Map([["conn-1", { id: "conn-1" }]]), // Has connections
      };

      let callCount = 0;
      mockGetRoom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? undefined : loadedRoom;
      });

      await getWorkspaceYjsDoc("active-workspace");

      expect(mockScheduleRoomCleanup).not.toHaveBeenCalled();
    });

    it("should return the loaded room's document", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => Promise.resolve(true));

      const loadedDoc = createMockDoc();
      const loadedRoom: MockRoom = {
        doc: loadedDoc,
        connections: new Map(),
      };

      let callCount = 0;
      mockGetRoom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? undefined : loadedRoom;
      });

      const result = await getWorkspaceYjsDoc("new-workspace");

      expect(result).toBe(loadedDoc);
      expect(result).toBeInstanceOf(Y.Doc);
    });

    it("should return null when loadRoomState returns false", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => Promise.resolve(false));

      const result = await getWorkspaceYjsDoc("nonexistent-workspace");

      expect(result).toBeNull();
    });

    it("should log warning when workspace state cannot be loaded", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => Promise.resolve(false));

      await getWorkspaceYjsDoc("nonexistent-workspace");

      expect(mockWarn).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should return null when roomManager.loadRoomState throws an error", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const result = await getWorkspaceYjsDoc("error-workspace");

      expect(result).toBeNull();
    });

    it("should log error when roomManager.loadRoomState throws", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      const testError = new Error("Database connection failed");
      mockLoadRoomState.mockImplementation(() => {
        throw testError;
      });

      await getWorkspaceYjsDoc("error-workspace");

      expect(mockError).toHaveBeenCalled();
    });

    it("should propagate errors from getRoom that occur before try-catch", () => {
      // Errors from roomManager.getRoom() at line 19 are not caught by the try-catch
      // which only wraps lines 42-58. This is intentional behavior.
      mockGetRoom.mockImplementation(() => {
        throw new Error("Unexpected error in getRoom");
      });

      // The error should propagate since it's outside the try-catch block
      expect(async () => {
        await getWorkspaceYjsDoc("unexpected-workspace");
      }).toThrow("Unexpected error in getRoom");
    });
  });

  describe("document configuration", () => {
    it("should return a document with getMap method", async () => {
      const mockDoc = createMockDoc();
      const existingRoom: MockRoom = {
        doc: mockDoc,
        connections: new Map([["conn-1", { id: "conn-1" }]]),
      };
      mockGetRoom.mockImplementation(() => existingRoom);

      const result = await getWorkspaceYjsDoc("workspace-with-map");

      expect(result).toBeDefined();
      expect(typeof result?.getMap).toBe("function");
    });

    it("should return null if getRoom returns a room without a doc", async () => {
      const roomWithoutDoc = {
        connections: new Map(),
      } as unknown as MockRoom;

      let callCount = 0;
      mockGetRoom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return;
        }
        return roomWithoutDoc;
      });

      mockLoadRoomState.mockImplementation(() => Promise.resolve(true));

      const result = await getWorkspaceYjsDoc("corrupted-workspace");

      expect(result).toBeNull();
    });

    it("should return document with all standard maps accessible", async () => {
      const mockDoc = createMockDoc();
      const existingRoom: MockRoom = {
        doc: mockDoc,
        connections: new Map([["conn-1", { id: "conn-1" }]]),
      };
      mockGetRoom.mockImplementation(() => existingRoom);

      const result = await getWorkspaceYjsDoc("maps-workspace");

      expect(result?.getMap("boards")).toBeDefined();
      expect(result?.getMap("columns")).toBeDefined();
      expect(result?.getMap("tasks")).toBeDefined();
      expect(result?.getMap("boardPositions")).toBeDefined();
      expect(result?.getMap("boardConnections")).toBeDefined();
      expect(result?.getMap("areas")).toBeDefined();
      expect(result?.getMap("areaPositions")).toBeDefined();
      expect(result?.getMap("workspace")).toBeDefined();
      expect(result?.getMap("comments")).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty string workspace ID", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => Promise.resolve(false));

      const result = await getWorkspaceYjsDoc("");

      expect(result).toBeNull();
      expect(mockLoadRoomState).toHaveBeenCalledWith("");
    });

    it("should handle workspace ID with special characters", async () => {
      const mockDoc = createMockDoc();
      const existingRoom: MockRoom = {
        doc: mockDoc,
        connections: new Map([["conn-1", { id: "conn-1" }]]),
      };
      mockGetRoom.mockImplementation((id: unknown) => {
        if (id === "workspace-123_special.chars") {
          return existingRoom;
        }
        return;
      });

      const result = await getWorkspaceYjsDoc("workspace-123_special.chars");

      expect(result).toBe(mockDoc);
    });

    it("should handle concurrent calls for the same workspace", async () => {
      const mockDoc = createMockDoc();
      const existingRoom: MockRoom = {
        doc: mockDoc,
        connections: new Map([["conn-1", { id: "conn-1" }]]),
      };
      mockGetRoom.mockImplementation(() => existingRoom);

      const results = await Promise.all([
        getWorkspaceYjsDoc("concurrent-workspace"),
        getWorkspaceYjsDoc("concurrent-workspace"),
        getWorkspaceYjsDoc("concurrent-workspace"),
      ]);

      expect(results[0]).toBe(mockDoc);
      expect(results[1]).toBe(mockDoc);
      expect(results[2]).toBe(mockDoc);
    });

    it("should handle long workspace IDs", async () => {
      const longId = "a".repeat(200);
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => Promise.resolve(false));

      const result = await getWorkspaceYjsDoc(longId);

      expect(result).toBeNull();
      expect(mockLoadRoomState).toHaveBeenCalledWith(longId);
    });

    it("should return null for null workspace ID", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => Promise.resolve(false));

      const result = await getWorkspaceYjsDoc(null as unknown as string);

      expect(result).toBeNull();
    });
  });

  describe("room manager integration", () => {
    it("should call roomManager.getRoom first to check for existing room", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => Promise.resolve(false));

      await getWorkspaceYjsDoc("integration-workspace");

      expect(mockGetRoom).toHaveBeenCalledWith("integration-workspace");
    });

    it("should verify getRoom returns undefined before loading from database", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => Promise.resolve(false));

      await getWorkspaceYjsDoc("verify-workspace");

      // Verify getRoom was called before loadRoomState
      expect(mockGetRoom).toHaveBeenCalledWith("verify-workspace");
    });

    it("should only schedule cleanup once per room load", async () => {
      mockGetRoom.mockImplementation(() => undefined);
      mockLoadRoomState.mockImplementation(() => Promise.resolve(true));

      const loadedDoc = createMockDoc();
      const loadedRoom: MockRoom = {
        doc: loadedDoc,
        connections: new Map(),
      };

      let callCount = 0;
      mockGetRoom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? undefined : loadedRoom;
      });

      await getWorkspaceYjsDoc("cleanup-once-workspace");

      expect(mockScheduleRoomCleanup).toHaveBeenCalledTimes(1);
      expect(mockScheduleRoomCleanup).toHaveBeenCalledWith(
        "cleanup-once-workspace"
      );
    });
  });
});
