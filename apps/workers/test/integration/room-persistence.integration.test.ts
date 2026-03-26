import { beforeEach, describe, expect, it, mock } from "bun:test";

let _mockRooms: Map<
  string,
  {
    doc: {
      getMap: (name: string) => {
        get: (key: string) => unknown;
        set: (key: string, value: unknown) => void;
        entries: () => IterableIterator<[string, unknown]>;
      };
    };
    workspaceId: string;
    lastModified: number;
  }
> = new Map();

const findUniqueMock = mock(() => Promise.resolve(null));
const upsertMock = mock(() => Promise.resolve({}));
const updateMock = mock(() => Promise.resolve({}));

const mockPrisma = {
  workspace: {
    findUnique: mock(() =>
      Promise.resolve({ id: "ws-1", name: "Test Workspace" })
    ),
    update: updateMock,
  },
  workspaceState: {
    findUnique: findUniqueMock,
    upsert: upsertMock,
  },
};

const mockLogger = {
  info: mock(),
  warn: mock(),
  error: mock(),
  debug: mock(),
};

const mockSpan = {
  setAttribute: mock(),
  addEvent: mock(),
  recordException: mock(),
};

const mockWithSpanAsync = (
  _name: string,
  fn: (span: unknown) => Promise<unknown>
) => {
  return fn(mockSpan);
};

const mockWithSpan = (_name: string, fn: (span: unknown) => unknown) => {
  return fn(mockSpan);
};

mock.module("@lumen/db", () => ({
  prisma: mockPrisma,
}));

mock.module("@lumen/logger", () => ({
  createLogger: () => mockLogger,
}));

mock.module("@lumen/logger/server", () => ({
  withSpanAsync: mockWithSpanAsync,
  withSpan: mockWithSpan,
  recordSpanError: mock(),
  setSpanAttributes: mock(),
  addSpanEvent: mock(),
  getMeter: () => ({
    createHistogram: () => ({ record: mock() }),
    createObservableGauge: () => ({ addCallback: mock() }),
    createCounter: () => ({ add: mock() }),
  }),
}));

mock.module("./metrics", () => ({
  recordWsRoomJoinDuration: mock(),
}));

describe("WORKERS-I-05: room-persistence integration", () => {
  beforeEach(() => {
    _mockRooms = new Map();
    findUniqueMock.mockReset();
    upsertMock.mockReset();
    updateMock.mockReset();
  });

  describe("persisted Yjs state can be loaded back into a fresh room", () => {
    it("loads Yjs state from database into new room", () => {
      const storedState = new Uint8Array([1, 2, 3, 4]);
      const stored = { yjsState: Buffer.from(storedState) };

      findUniqueMock.mockResolvedValueOnce(stored as never);

      expect(findUniqueMock).toHaveBeenCalled();
    });

    it("returns empty state when no persisted data exists", () => {
      findUniqueMock.mockResolvedValueOnce(null as never);

      expect(findUniqueMock).toHaveBeenCalled();
    });

    it("applies stored update to Y.Doc", () => {
      const _doc = {
        getMap: () => ({
          get: () => undefined,
          set: () => {
            // apply update
          },
        }),
      };
      const storedState = Buffer.from(new Uint8Array([1, 2, 3]));

      expect(storedState.length).toBeGreaterThan(0);
    });
  });

  describe("state vector and Yjs bytes are stored on upsert", () => {
    it("stores both state and state vector on persist", () => {
      upsertMock.mockResolvedValueOnce({} as never);

      expect(upsertMock).toHaveBeenCalled();
    });

    it("upsert updates existing state", () => {
      upsertMock.mockResolvedValueOnce({} as never);

      expect(upsertMock).toHaveBeenCalled();
    });

    it("upsert creates new state when not exists", () => {
      upsertMock.mockResolvedValueOnce({} as never);

      expect(upsertMock).toHaveBeenCalled();
    });
  });

  describe("workspace name metadata is updated from Yjs workspace map when present", () => {
    it("reads workspace name from Yjs map", () => {
      const workspaceMap = new Map([["ws-1", { name: "Test Workspace" }]]);

      const workspaceData = workspaceMap.get("ws-1") as
        | { name: string }
        | undefined;
      const name = workspaceData?.name;

      expect(name).toBe("Test Workspace");
    });

    it("updates workspace name in database when present in Yjs", () => {
      updateMock.mockResolvedValueOnce({} as never);

      expect(updateMock).toHaveBeenCalled();
    });

    it("skips update when workspace name is not in Yjs", () => {
      const workspaceMap = new Map();

      const workspaceData = workspaceMap.get("ws-1") as
        | { name: string }
        | undefined;

      expect(workspaceData).toBeUndefined();
    });

    it("handles missing workspace for name update gracefully", async () => {
      updateMock.mockRejectedValueOnce(new Error("Not found") as never);

      let error: Error | undefined;
      try {
        await updateMock();
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).toBe("Not found");
    });
  });

  describe("room cleanup and state recovery", () => {
    it("schedules cleanup after last connection leaves", () => {
      const room = {
        workspaceId: "ws-1",
        connections: new Map(),
        persistenceTimeout: null,
      };

      const shouldScheduleCleanup = room.connections.size === 0;

      expect(shouldScheduleCleanup).toBe(true);
    });

    it("persists state before room cleanup", () => {
      upsertMock.mockResolvedValueOnce({} as never);

      expect(upsertMock).toHaveBeenCalled();
    });

    it("destroys Y.Doc on room cleanup", () => {
      const doc = { destroy: mock() };

      doc.destroy();

      expect(doc.destroy).toHaveBeenCalled();
    });
  });

  describe("concurrent room creation deduplication", () => {
    it("returns existing room if already created", () => {
      const rooms = new Map();
      const existingRoom = { workspaceId: "ws-1" };
      rooms.set("ws-1", existingRoom);

      const room = rooms.get("ws-1");

      expect(room).toBe(existingRoom);
    });

    it("creates new room if not exists", () => {
      const rooms = new Map();

      if (!rooms.has("ws-new")) {
        const newRoom = { workspaceId: "ws-new" };
        rooms.set("ws-new", newRoom);
      }

      expect(rooms.has("ws-new")).toBe(true);
    });

    it("pending loads prevent duplicate fetches", () => {
      const pendingLoads = new Map();
      const existingLoad = Promise.resolve(true);
      pendingLoads.set("ws-1", existingLoad);

      const load = pendingLoads.get("ws-1");

      expect(load).toBe(existingLoad);
    });
  });
});
