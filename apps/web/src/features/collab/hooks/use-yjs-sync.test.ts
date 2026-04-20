import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import * as Y from "yjs";

// Store state and subscribers (must be defined before mock module declarations)
type StoreSubscriber = (state: StoreState, prevState: StoreState) => void;

interface Task {
  board_id: string;
  column_id: string;
  created_at: string;
  created_by: string;
  id: string;
  position: number;
  priority: "low" | "medium" | "high";
  progress: number;
  status: "todo" | "done" | "trash";
  title: string;
  updated_at: string;
}

interface DiffResult<T> {
  added: T[];
  changed: T[];
  removed: string[];
}

interface StoreState {
  areaDialogs: Record<string, unknown>;
  areaDragOrigins: Record<string, unknown>;
  areaPositions: { byId: Record<string, unknown>; allIds: string[] };
  areas: { byId: Record<string, unknown>; allIds: string[] };
  boardConnections: { byId: Record<string, unknown>; allIds: string[] };
  boardDialogs: Record<string, unknown>;
  boardPositions: { byId: Record<string, unknown>; allIds: string[] };
  boardQuickActions: Record<string, unknown>;
  boards: { byId: Record<string, unknown>; allIds: string[] };
  chatMessages: { byId: Record<string, unknown>; allIds: string[] };
  columnDialogs: Record<string, unknown>;
  columnQuickActions: Record<string, unknown>;
  columns: { byId: Record<string, unknown>; allIds: string[] };
  comments: { byId: Record<string, unknown>; allIds: string[] };
  connectionDialog: unknown;
  createTaskModals: Record<string, unknown>;
  currentWorkspaceId: string | null;
  taskQuickActions: Record<string, unknown>;
  tasks: { byId: Record<string, unknown>; allIds: string[] };
  workspaces: { byId: Record<string, unknown>; allIds: string[] };
}

let storeSubscribers: StoreSubscriber[] = [];

function createDefaultState(overrides: Partial<StoreState> = {}): StoreState {
  return {
    currentWorkspaceId: null,
    boards: { byId: {}, allIds: [] },
    columns: { byId: {}, allIds: [] },
    tasks: { byId: {}, allIds: [] },
    boardPositions: { byId: {}, allIds: [] },
    boardConnections: { byId: {}, allIds: [] },
    areas: { byId: {}, allIds: [] },
    areaPositions: { byId: {}, allIds: [] },
    comments: { byId: {}, allIds: [] },
    areaDialogs: {},
    boardQuickActions: {},
    boardDialogs: {},
    connectionDialog: null,
    createTaskModals: {},
    columnQuickActions: {},
    columnDialogs: {},
    taskQuickActions: {},
    areaDragOrigins: {},
    chatMessages: { byId: {}, allIds: [] },
    workspaces: { byId: {}, allIds: [] },
    ...overrides,
  };
}

let storeState: StoreState = createDefaultState();

// --- Mock React hooks BEFORE importing the module under test ---

const useRefMockValues = new Map<string, { current: unknown }>();
const useCallbackResults = new Map<string, unknown>();
const useEffectCalls: unknown[][] = [];

// Mock React module first
mock.module("react", () => ({
  useRef: mock(<T>(initialValue: T): { current: T } => {
    const key = `${useRefMockValues.size}`;
    if (!useRefMockValues.has(key)) {
      useRefMockValues.set(key, { current: initialValue });
    }
    return useRefMockValues.get(key) as { current: T };
  }),
  useCallback: mock(<T extends (...args: unknown[]) => unknown>(fn: T): T => {
    const key = fn.toString();
    useCallbackResults.set(key, fn);
    return fn;
  }),
  useEffect: mock(
    (effect: () => undefined | (() => void), deps?: unknown[]) => {
      useEffectCalls.push([effect, deps]);
      // Execute effect immediately for testing
      const cleanup = effect();
      if (typeof cleanup === "function") {
        // Store cleanup for later
        useEffectCalls.push([cleanup, deps]);
      }
    }
  ),
}));

// --- Mock external dependencies ---

const mockLogger = {
  info: mock(),
  warn: mock(),
  error: mock(),
  debug: mock(),
};

mock.module("@lumen/logger", () => ({
  createLogger: () => mockLogger,
}));

// Mock state-sync module
const mockInitializeYjsForWorkspace = mock();
const mockApplyYjsToStateWithRepair = mock(() => ({}));
const mockObserveYjsChanges = mock(() => () => {
  /* no-op cleanup function */
});

mock.module("@/src/features/collab/sync/state-sync", () => ({
  initializeYjsForWorkspace: mockInitializeYjsForWorkspace,
  applyYjsToStateWithRepair: mockApplyYjsToStateWithRepair,
  observeYjsChanges: mockObserveYjsChanges,
}));

// Mock syncs module
const createMockSync = () => ({
  setInYjs: mock(),
  deleteFromYjs: mock(),
  batchSetInYjs: mock(),
  initializeYjs: mock(),
  applyFromYjs: mock(() => ({ byId: {}, allIds: [] })),
});

const mockBoardSync = createMockSync();
const mockColumnSync = createMockSync();
const mockTaskSync = createMockSync();
const mockBoardPositionSync = createMockSync();
const mockBoardConnectionSync = createMockSync();
const mockAreaSync = createMockSync();
const mockAreaPositionSync = createMockSync();
const mockAreaDialogSync = createMockSync();
const mockWorkspaceSync = createMockSync();
const mockBoardQuickActionsSync = createMockSync();
const mockBoardDialogSync = createMockSync();
const mockConnectionDialogSync = createMockSync();
const mockCreateTaskModalSync = createMockSync();
const mockColumnQuickActionsSync = createMockSync();
const mockColumnDialogSync = createMockSync();
const mockTaskQuickActionsSync = createMockSync();
const mockAreaDragOriginSync = createMockSync();
const mockCommentSync = createMockSync();
const mockChatMessageSync = createMockSync();

mock.module("@/src/features/collab/sync/syncs", () => ({
  boardSync: mockBoardSync,
  columnSync: mockColumnSync,
  taskSync: mockTaskSync,
  boardPositionSync: mockBoardPositionSync,
  boardConnectionSync: mockBoardConnectionSync,
  areaSync: mockAreaSync,
  areaPositionSync: mockAreaPositionSync,
  areaDialogSync: mockAreaDialogSync,
  workspaceSync: mockWorkspaceSync,
  boardQuickActionsSync: mockBoardQuickActionsSync,
  boardDialogSync: mockBoardDialogSync,
  connectionDialogSync: mockConnectionDialogSync,
  createTaskModalSync: mockCreateTaskModalSync,
  columnQuickActionsSync: mockColumnQuickActionsSync,
  columnDialogSync: mockColumnDialogSync,
  taskQuickActionsSync: mockTaskQuickActionsSync,
  areaDragOriginSync: mockAreaDragOriginSync,
  commentSync: mockCommentSync,
  chatMessageSync: mockChatMessageSync,
}));

// Mock deep-equals
const mockDiffEntityMaps = mock(<T>() => ({
  added: [] as T[],
  changed: [] as T[],
  removed: [] as string[],
}));

mock.module("@/src/features/collab/utils/deep-equals", () => ({
  diffEntityMaps: mockDiffEntityMaps,
}));

// Mock Kanban store
const mockUseKanbanStore = Object.assign(() => storeState, {
  getState: mock(() => storeState),
  setState: mock((updater: unknown) => {
    if (typeof updater === "function") {
      storeState = (updater as (s: StoreState) => StoreState)(storeState);
    } else {
      storeState = { ...storeState, ...(updater as object) };
    }
  }),
  subscribe: mock((fn: StoreSubscriber) => {
    storeSubscribers.push(fn);
    return () => {
      storeSubscribers = storeSubscribers.filter((s) => s !== fn);
    };
  }),
});

mock.module("@/src/features/kanban", () => ({
  useKanbanStore: mockUseKanbanStore,
}));

mock.module("@/src/features/kanban/store/kanban-store", () => ({
  useKanbanStore: mockUseKanbanStore,
}));

// Import after all mocks
import { useYjsSync } from "./use-yjs-sync";

// --- Test helpers ---

function resetMocks() {
  mockLogger.info.mockReset();
  mockLogger.warn.mockReset();
  mockLogger.error.mockReset();
  mockLogger.debug.mockReset();
  mockInitializeYjsForWorkspace.mockReset();
  mockApplyYjsToStateWithRepair.mockReset();
  mockObserveYjsChanges.mockReset();
  mockDiffEntityMaps.mockReset();
  useRefMockValues.clear();
  useCallbackResults.clear();
  useEffectCalls.length = 0;

  for (const sync of [
    mockBoardSync,
    mockColumnSync,
    mockTaskSync,
    mockBoardPositionSync,
    mockBoardConnectionSync,
    mockAreaSync,
    mockAreaPositionSync,
    mockAreaDialogSync,
    mockWorkspaceSync,
    mockBoardQuickActionsSync,
    mockBoardDialogSync,
    mockConnectionDialogSync,
    mockCreateTaskModalSync,
    mockColumnQuickActionsSync,
    mockColumnDialogSync,
    mockTaskQuickActionsSync,
    mockAreaDragOriginSync,
    mockCommentSync,
    mockChatMessageSync,
  ]) {
    sync.setInYjs.mockReset();
    sync.deleteFromYjs.mockReset();
    sync.batchSetInYjs.mockReset();
    sync.initializeYjs.mockReset();
    sync.applyFromYjs.mockReset();
  }

  mockDiffEntityMaps.mockReturnValue({
    added: [] as unknown[],
    changed: [] as unknown[],
    removed: [] as string[],
  });

  mockApplyYjsToStateWithRepair.mockReturnValue({});

  storeState = createDefaultState();
  storeSubscribers = [];
}

function triggerStoreStateChange(newState: Partial<StoreState>) {
  const prevState = storeState;
  storeState = { ...storeState, ...newState };
  for (const subscriber of storeSubscribers) {
    subscriber(storeState, prevState);
  }
}

function createTestDoc(): Y.Doc {
  return new Y.Doc();
}

const FIXED_TS = 1_700_000_000_000;
let tsCounter = 0;
const originalDateNow = Date.now;
const mockDateNow = () => {
  const val = FIXED_TS + tsCounter;
  tsCounter++;
  return val;
};

// --- Tests ---

describe("useYjsSync", () => {
  beforeEach(() => {
    resetMocks();
    tsCounter = 0;
    Date.now = mockDateNow as typeof Date.now;
  });

  afterEach(() => {
    resetMocks();
    Date.now = originalDateNow;
  });

  describe("Basic hook functionality", () => {
    it("returns YjsSyncActions interface with all required methods", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      // Verify all sync and delete methods are present
      expect(typeof result.syncBoard).toBe("function");
      expect(typeof result.deleteBoard).toBe("function");
      expect(typeof result.syncColumn).toBe("function");
      expect(typeof result.deleteColumn).toBe("function");
      expect(typeof result.syncTask).toBe("function");
      expect(typeof result.deleteTask).toBe("function");
      expect(typeof result.syncBoardPosition).toBe("function");
      expect(typeof result.deleteBoardPosition).toBe("function");
      expect(typeof result.syncBoardConnection).toBe("function");
      expect(typeof result.deleteBoardConnection).toBe("function");
      expect(typeof result.syncArea).toBe("function");
      expect(typeof result.deleteArea).toBe("function");
      expect(typeof result.syncAreaPosition).toBe("function");
      expect(typeof result.deleteAreaPosition).toBe("function");
      expect(typeof result.syncWorkspace).toBe("function");
      expect(typeof result.deleteWorkspace).toBe("function");
      expect(typeof result.syncComment).toBe("function");
      expect(typeof result.deleteComment).toBe("function");
      expect(typeof result.syncChatMessage).toBe("function");
      expect(typeof result.deleteChatMessage).toBe("function");
    });

    it("returns actions when doc is null", () => {
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(null, true, "ws-1");

      expect(typeof result.syncBoard).toBe("function");
      expect(typeof result.deleteBoard).toBe("function");
    });

    it("returns actions when not connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, false, "ws-1");

      expect(typeof result.syncBoard).toBe("function");
      expect(typeof result.deleteBoard).toBe("function");
    });

    it("returns actions when currentWorkspaceId is null", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: null });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, null);

      expect(typeof result.syncBoard).toBe("function");
      expect(typeof result.deleteBoard).toBe("function");
    });
  });

  describe("Manual sync actions", () => {
    it("syncBoard syncs to Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      const board = {
        id: "board-1",
        name: "Test Board",
        workspace_id: "ws-1",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      };

      result.syncBoard(board);

      expect(mockBoardSync.setInYjs).toHaveBeenCalledWith(doc, board);
    });

    it("deleteBoard deletes from Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      result.deleteBoard("board-1");

      expect(mockBoardSync.deleteFromYjs).toHaveBeenCalledWith(doc, "board-1");
    });

    it("does NOT sync when doc is null", () => {
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(null, true, "ws-1");

      const board = {
        id: "board-1",
        name: "Test Board",
        workspace_id: "ws-1",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      };

      result.syncBoard(board);

      expect(mockBoardSync.setInYjs).not.toHaveBeenCalled();
    });

    it("does NOT sync when not connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, false, "ws-1");

      const board = {
        id: "board-1",
        name: "Test Board",
        workspace_id: "ws-1",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      };

      result.syncBoard(board);

      expect(mockBoardSync.setInYjs).not.toHaveBeenCalled();
    });

    it("syncTask syncs to Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      const task: Task = {
        id: "task-1",
        board_id: "board-1",
        column_id: "col-1",
        title: "Test Task",
        priority: "medium",
        progress: 0,
        position: 0,
        created_by: "user-1",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        status: "todo",
      };

      result.syncTask(task);

      expect(mockTaskSync.setInYjs).toHaveBeenCalledWith(doc, task);
    });

    it("deleteTask deletes from Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      result.deleteTask("task-1");

      expect(mockTaskSync.deleteFromYjs).toHaveBeenCalledWith(doc, "task-1");
    });

    it("syncColumn syncs to Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      const column = {
        id: "col-1",
        board_id: "board-1",
        name: "Test Column",
        position: 0,
        task_ids: [],
      };

      result.syncColumn(column);

      expect(mockColumnSync.setInYjs).toHaveBeenCalledWith(doc, column);
    });

    it("deleteColumn deletes from Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      result.deleteColumn("col-1");

      expect(mockColumnSync.deleteFromYjs).toHaveBeenCalledWith(doc, "col-1");
    });

    it("syncBoardPosition syncs to Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      const position = { id: "bp-1", x: 100, y: 200, zIndex: 1 };

      result.syncBoardPosition(position);

      expect(mockBoardPositionSync.setInYjs).toHaveBeenCalledWith(
        doc,
        position
      );
    });

    it("deleteBoardPosition deletes from Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      result.deleteBoardPosition("bp-1");

      expect(mockBoardPositionSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "bp-1"
      );
    });

    it("syncArea syncs to Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      const area = {
        id: "area-1",
        name: "Test Area",
        workspace_id: "ws-1",
        color: "#fff",
        board_ids: [],
        created_at: "2024-01-01",
      };

      result.syncArea(area);

      expect(mockAreaSync.setInYjs).toHaveBeenCalledWith(doc, area);
    });

    it("deleteArea deletes from Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      result.deleteArea("area-1");

      expect(mockAreaSync.deleteFromYjs).toHaveBeenCalledWith(doc, "area-1");
    });

    it("syncComment syncs to Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      const comment = {
        id: "c-1",
        x: 100,
        y: 200,
        content: "Test",
        authorId: "user-1",
        workspaceId: "ws-1",
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      };

      result.syncComment(comment);

      expect(mockCommentSync.setInYjs).toHaveBeenCalledWith(doc, comment);
    });

    it("deleteComment deletes from Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      result.deleteComment("c-1");

      expect(mockCommentSync.deleteFromYjs).toHaveBeenCalledWith(doc, "c-1");
    });

    it("syncChatMessage syncs to Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      const message = {
        id: "cm-1",
        content: "Hello",
        authorId: "user-1",
        authorName: "User",
        workspaceId: "ws-1",
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      };

      result.syncChatMessage(message);

      expect(mockChatMessageSync.setInYjs).toHaveBeenCalledWith(doc, message);
    });

    it("deleteChatMessage deletes from Yjs when connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const result = useYjsSync(doc, true, "ws-1");

      result.deleteChatMessage("cm-1");

      expect(mockChatMessageSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "cm-1"
      );
    });
  });

  describe("Store subscription sync", () => {
    it("syncs boards to Yjs when they are added", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useYjsSync(doc, true, "ws-1");

      const board = {
        id: "board-1",
        name: "New Board",
        workspace_id: "ws-1",
      };

      mockDiffEntityMaps.mockReturnValueOnce({
        added: [board],
        changed: [],
        removed: [],
      } as DiffResult<typeof board>);

      triggerStoreStateChange({
        boards: {
          byId: { "board-1": board },
          allIds: ["board-1"],
        },
      });

      expect(mockBoardSync.setInYjs).toHaveBeenCalledWith(doc, board);
    });

    it("deletes boards from Yjs when they are removed", () => {
      const doc = createTestDoc();
      const board = {
        id: "board-1",
        name: "Board",
        workspace_id: "ws-1",
      };
      const state = createDefaultState({
        currentWorkspaceId: "ws-1",
        boards: {
          byId: { "board-1": board },
          allIds: ["board-1"],
        },
      });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useYjsSync(doc, true, "ws-1");

      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["board-1"],
      } as DiffResult<typeof board>);

      triggerStoreStateChange({
        boards: { byId: {}, allIds: [] },
      });

      expect(mockBoardSync.deleteFromYjs).toHaveBeenCalledWith(doc, "board-1");
    });

    it("syncs tasks to Yjs when they are added", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useYjsSync(doc, true, "ws-1");

      const task: Task = {
        id: "task-1",
        board_id: "board-1",
        column_id: "col-1",
        title: "New Task",
        priority: "medium",
        progress: 0,
        position: 0,
        created_by: "user-1",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        status: "todo",
      };

      mockDiffEntityMaps
        .mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        } as DiffResult<unknown>)
        .mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        } as DiffResult<unknown>)
        .mockReturnValueOnce({
          added: [task],
          changed: [],
          removed: [],
        } as DiffResult<Task>);

      triggerStoreStateChange({
        tasks: {
          byId: { "task-1": task },
          allIds: ["task-1"],
        },
      });

      expect(mockTaskSync.setInYjs).toHaveBeenCalledWith(doc, task);
    });

    it("deletes tasks from Yjs when they are removed", () => {
      const doc = createTestDoc();
      const task: Task = {
        id: "task-1",
        board_id: "board-1",
        column_id: "col-1",
        title: "Task",
        priority: "medium",
        progress: 0,
        position: 0,
        created_by: "user-1",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        status: "todo",
      };
      const state = createDefaultState({
        currentWorkspaceId: "ws-1",
        tasks: {
          byId: { "task-1": task },
          allIds: ["task-1"],
        },
      });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useYjsSync(doc, true, "ws-1");

      mockDiffEntityMaps
        .mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        } as DiffResult<unknown>)
        .mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        } as DiffResult<unknown>)
        .mockReturnValueOnce({
          added: [],
          changed: [],
          removed: ["task-1"],
        } as DiffResult<Task>);

      triggerStoreStateChange({
        tasks: { byId: {}, allIds: [] },
      });

      expect(mockTaskSync.deleteFromYjs).toHaveBeenCalledWith(doc, "task-1");
    });
  });

  describe("Workspace filtering", () => {
    it("skips syncing when state workspace does not match hook workspace", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-different" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useYjsSync(doc, true, "ws-1");

      triggerStoreStateChange({});

      expect(mockBoardSync.setInYjs).not.toHaveBeenCalled();
      expect(mockBoardSync.deleteFromYjs).not.toHaveBeenCalled();
    });
  });

  describe("Yjs observation", () => {
    it("sets up observeYjsChanges when connected", () => {
      const doc = createTestDoc();
      doc.getMap("boards").set("board-1", {
        id: "board-1",
        name: "Board",
        workspace_id: "ws-1",
      });

      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);
      mockApplyYjsToStateWithRepair.mockReturnValue(state);

      useYjsSync(doc, true, "ws-1");

      expect(mockObserveYjsChanges).toHaveBeenCalled();
    });

    it("does not set up observation when not connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useYjsSync(doc, false, "ws-1");

      expect(mockObserveYjsChanges).not.toHaveBeenCalled();
    });

    it("does not set up observation when doc is null", () => {
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useYjsSync(null, true, "ws-1");

      expect(mockObserveYjsChanges).not.toHaveBeenCalled();
    });

    it("does not set up observation when workspaceId is null", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: null });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useYjsSync(doc, true, null);

      expect(mockObserveYjsChanges).not.toHaveBeenCalled();
    });
  });

  describe("Initialization", () => {
    it("calls initializeYjsForWorkspace when boardsMap is empty", () => {
      const doc = createTestDoc();
      const localState = createDefaultState({
        currentWorkspaceId: "ws-1",
        boards: {
          byId: {
            "board-1": {
              id: "board-1",
              name: "Test Board",
              workspace_id: "ws-1",
            },
          },
          allIds: ["board-1"],
        },
      });
      storeState = localState;
      mockUseKanbanStore.getState.mockReturnValue(localState);

      useYjsSync(doc, true, "ws-1");

      expect(mockInitializeYjsForWorkspace).toHaveBeenCalledWith(
        doc,
        localState,
        "ws-1"
      );
    });

    it("calls applyYjsToStateWithRepair when boardsMap has data", () => {
      const doc = createTestDoc();
      doc.getMap("boards").set("existing-board", {
        id: "existing-board",
        name: "Existing",
        workspace_id: "ws-1",
      });

      const localState = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = localState;
      mockUseKanbanStore.getState.mockReturnValue(localState);
      mockApplyYjsToStateWithRepair.mockReturnValue(localState);

      useYjsSync(doc, true, "ws-1");

      expect(mockApplyYjsToStateWithRepair).toHaveBeenCalledWith(
        doc,
        localState,
        "ws-1"
      );
    });
  });

  describe("Re-entrancy protection", () => {
    it("does not sync to Yjs when isUpdatingFromYjsRef is true", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);
      mockApplyYjsToStateWithRepair.mockReturnValue({
        boards: { byId: {}, allIds: [] },
      });

      useYjsSync(doc, true, "ws-1");

      // Trigger a Yjs update which sets isUpdatingFromYjsRef to true
      expect(mockApplyYjsToStateWithRepair).toHaveBeenCalled();

      // The sync should not happen during Yjs updates
      expect(mockBoardSync.setInYjs).not.toHaveBeenCalled();
    });
  });
});
