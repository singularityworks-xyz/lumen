import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  /* ignore */
}

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";
import * as Y from "yjs";

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
const mockObserveYjsChanges = mock((_d?: unknown, _cb?: () => void) => () => {
  /* no-op */
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
const mockDiffEntityMaps = mock<
  () => {
    added: unknown[];
    changed: unknown[];
    removed: string[];
  }
>(() => ({
  added: [] as unknown[],
  changed: [] as unknown[],
  removed: [] as string[],
}));

mock.module("@/src/features/collab/utils/deep-equals", () => ({
  diffEntityMaps: mockDiffEntityMaps,
}));

// Store state and subscribers
type StoreSubscriber = (state: StoreState, prevState: StoreState) => void;

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
let storeState: StoreState = createDefaultState();

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

const mockUseKanbanStore = Object.assign(() => storeState, {
  getState: mock(() => storeState),
  setState: mock((updater: unknown) => {
    if (typeof updater === "function") {
      storeState = updater(storeState);
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

// --- Now import the module under test ---

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
    added: [],
    changed: [],
    removed: [],
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
const _originalDateNow = Date.now;
const mockDateNow = () => {
  const val = FIXED_TS + tsCounter;
  tsCounter++;
  return val;
};

function _advanceMockTime(ms: number) {
  tsCounter += ms;
}

// --- Tests ---

describe("useYjsSync", () => {
  beforeEach(() => {
    resetMocks();
    tsCounter = 0;
  });

  afterEach(() => {
    resetMocks();
  });

  describe("Initial server-empty push vs server-has-data pull", () => {
    it("calls initializeYjsForWorkspace when boardsMap is empty and local state has boards", () => {
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

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      expect(mockInitializeYjsForWorkspace).toHaveBeenCalledWith(
        doc,
        localState,
        "ws-1"
      );
      expect(mockApplyYjsToStateWithRepair).not.toHaveBeenCalled();
    });

    it("calls applyYjsToStateWithRepair when boardsMap has data", () => {
      const doc = createTestDoc();
      doc.getMap("boards").set("existing-board", {
        id: "existing-board",
        name: "Existing",
        workspace_id: "ws-1",
      });

      const localState = createDefaultState({
        currentWorkspaceId: "ws-1",
      });
      storeState = localState;
      mockUseKanbanStore.getState.mockReturnValue(localState);
      mockApplyYjsToStateWithRepair.mockReturnValue(localState);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      expect(mockApplyYjsToStateWithRepair).toHaveBeenCalledWith(
        doc,
        localState,
        "ws-1"
      );
      expect(mockInitializeYjsForWorkspace).not.toHaveBeenCalled();
    });

    it("does not push when boardsMap is empty but local state has no boards for current workspace", () => {
      const doc = createTestDoc();
      const localState = createDefaultState({
        currentWorkspaceId: "ws-1",
        boards: {
          byId: {
            "board-other": {
              id: "board-other",
              name: "Other Board",
              workspace_id: "ws-other",
            },
          },
          allIds: ["board-other"],
        },
      });
      storeState = localState;
      mockUseKanbanStore.getState.mockReturnValue(localState);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      expect(mockInitializeYjsForWorkspace).not.toHaveBeenCalled();
      expect(mockApplyYjsToStateWithRepair).not.toHaveBeenCalled();
    });
  });

  describe("Workspace guard behavior", () => {
    it("does not sync when currentWorkspaceId is null", () => {
      const doc = createTestDoc();

      renderHook(() => useYjsSync(doc, true, null));

      expect(mockInitializeYjsForWorkspace).not.toHaveBeenCalled();
      expect(mockApplyYjsToStateWithRepair).not.toHaveBeenCalled();
      expect(mockObserveYjsChanges).not.toHaveBeenCalled();
    });

    it("does not sync when not connected", () => {
      const doc = createTestDoc();

      renderHook(() => useYjsSync(doc, false, "ws-1"));

      expect(mockInitializeYjsForWorkspace).not.toHaveBeenCalled();
      expect(mockApplyYjsToStateWithRepair).not.toHaveBeenCalled();
      expect(mockObserveYjsChanges).not.toHaveBeenCalled();
    });

    it("does not sync when doc is null", () => {
      renderHook(() => useYjsSync(null, true, "ws-1"));

      expect(mockInitializeYjsForWorkspace).not.toHaveBeenCalled();
      expect(mockApplyYjsToStateWithRepair).not.toHaveBeenCalled();
      expect(mockObserveYjsChanges).not.toHaveBeenCalled();
    });
  });

  describe("Delete propagation for every synced entity type", () => {
    it("calls deleteFromYjs for boards when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      mockDiffEntityMaps
        .mockReturnValueOnce({ added: [], changed: [], removed: [] })
        .mockReturnValueOnce({ added: [], changed: [], removed: ["board-1"] });

      triggerStoreStateChange({});

      expect(mockBoardSync.deleteFromYjs).toHaveBeenCalledWith(doc, "board-1");
    });

    it("calls deleteFromYjs for columns when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      mockDiffEntityMaps
        .mockReturnValueOnce({ added: [], changed: [], removed: [] })
        .mockReturnValueOnce({ added: [], changed: [], removed: [] })
        .mockReturnValueOnce({ added: [], changed: [], removed: ["col-1"] });

      triggerStoreStateChange({});

      expect(mockColumnSync.deleteFromYjs).toHaveBeenCalledWith(doc, "col-1");
    });

    it("calls deleteFromYjs for tasks when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      mockDiffEntityMaps
        .mockReturnValueOnce({ added: [], changed: [], removed: [] })
        .mockReturnValueOnce({ added: [], changed: [], removed: [] })
        .mockReturnValueOnce({ added: [], changed: [], removed: [] })
        .mockReturnValueOnce({ added: [], changed: [], removed: ["task-1"] });

      triggerStoreStateChange({});

      expect(mockTaskSync.deleteFromYjs).toHaveBeenCalledWith(doc, "task-1");
    });

    it("calls deleteFromYjs for boardPositions when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 4; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["bp-1"],
      });

      triggerStoreStateChange({});

      expect(mockBoardPositionSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "bp-1"
      );
    });

    it("calls deleteFromYjs for boardConnections when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 5; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["bc-1"],
      });

      triggerStoreStateChange({});

      expect(mockBoardConnectionSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "bc-1"
      );
    });

    it("calls deleteFromYjs for areas when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 6; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["area-1"],
      });

      triggerStoreStateChange({});

      expect(mockAreaSync.deleteFromYjs).toHaveBeenCalledWith(doc, "area-1");
    });

    it("calls deleteFromYjs for areaPositions when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 7; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["ap-1"],
      });

      triggerStoreStateChange({});

      expect(mockAreaPositionSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "ap-1"
      );
    });

    it("calls deleteFromYjs for comments when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 8; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["comment-1"],
      });

      triggerStoreStateChange({});

      expect(mockCommentSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "comment-1"
      );
    });

    it("calls deleteFromYjs for areaDialogs when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 9; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["ad-1"],
      });

      triggerStoreStateChange({});

      expect(mockAreaDialogSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "ad-1"
      );
    });

    it("calls deleteFromYjs for boardQuickActions when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 10; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["bqa-1"],
      });

      triggerStoreStateChange({});

      expect(mockBoardQuickActionsSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "bqa-1"
      );
    });

    it("calls deleteFromYjs for boardDialogs when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 11; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["bd-1"],
      });

      triggerStoreStateChange({});

      expect(mockBoardDialogSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "bd-1"
      );
    });

    it("calls deleteFromYjs for connectionDialogs when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 12; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["cd-1"],
      });

      triggerStoreStateChange({});

      expect(mockConnectionDialogSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "cd-1"
      );
    });

    it("calls deleteFromYjs for createTaskModals when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 13; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["ctm-1"],
      });

      triggerStoreStateChange({});

      expect(mockCreateTaskModalSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "ctm-1"
      );
    });

    it("calls deleteFromYjs for columnQuickActions when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 14; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["cqa-1"],
      });

      triggerStoreStateChange({});

      expect(mockColumnQuickActionsSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "cqa-1"
      );
    });

    it("calls deleteFromYjs for columnDialogs when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 15; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["cdlg-1"],
      });

      triggerStoreStateChange({});

      expect(mockColumnDialogSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "cdlg-1"
      );
    });

    it("calls deleteFromYjs for taskQuickActions when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 16; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["tqa-1"],
      });

      triggerStoreStateChange({});

      expect(mockTaskQuickActionsSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "tqa-1"
      );
    });

    it("calls deleteFromYjs for areaDragOrigins when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 17; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["ado-1"],
      });

      triggerStoreStateChange({});

      expect(mockAreaDragOriginSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "ado-1"
      );
    });

    it("calls deleteFromYjs for chatMessages when removed from Zustand", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 18; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["cm-1"],
      });

      triggerStoreStateChange({});

      expect(mockChatMessageSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "cm-1"
      );
    });
  });

  describe("Throttled position sync", () => {
    it("throttles areaPosition updates at 14ms", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 7; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }

      const areaPos = { id: "ap-1", x: 100, y: 200, zIndex: 1 };
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [areaPos],
        removed: [],
      });

      triggerStoreStateChange({});

      expect(mockAreaPositionSync.setInYjs).toHaveBeenCalledTimes(1);

      mockAreaPositionSync.setInYjs.mockReset();

      for (let i = 0; i < 7; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [areaPos],
        removed: [],
      });

      triggerStoreStateChange({});

      expect(mockAreaPositionSync.setInYjs).not.toHaveBeenCalled();
    });

    it.skip("throttles comment position-only updates at 14ms", () => {
      Date.now = mockDateNow as typeof Date.now;
      tsCounter = 0;

      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 8; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }

      const comment = {
        id: "c-1",
        x: 100,
        y: 200,
        content: "Hello",
        authorId: "user-1",
        workspaceId: "ws-1",
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      };
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [comment],
        removed: [],
      });

      triggerStoreStateChange({});

      expect(mockCommentSync.batchSetInYjs).toHaveBeenCalledTimes(1);

      mockCommentSync.batchSetInYjs.mockReset();

      for (let i = 0; i < 8; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [comment],
        removed: [],
      });

      triggerStoreStateChange({});

      expect(mockCommentSync.batchSetInYjs).not.toHaveBeenCalled();
    });
  });

  describe("Sync skipping during workspace switch", () => {
    it("skips syncing when state.currentWorkspaceId !== currentWorkspaceId", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-different" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      triggerStoreStateChange({});

      expect(mockBoardSync.setInYjs).not.toHaveBeenCalled();
      expect(mockBoardSync.deleteFromYjs).not.toHaveBeenCalled();
    });
  });

  describe("Local-only board preservation rules", () => {
    it("preserves boards from other workspaces when applying Yjs changes", () => {
      const doc = createTestDoc();
      doc.getMap("boards").set("board-synced", {
        id: "board-synced",
        name: "Synced Board",
        workspace_id: "ws-1",
      });

      const localBoard = {
        id: "board-local",
        name: "Local Board",
        workspace_id: "ws-other",
      };

      const state = createDefaultState({
        currentWorkspaceId: "ws-1",
        boards: {
          byId: { "board-local": localBoard },
          allIds: ["board-local"],
        },
      });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      mockApplyYjsToStateWithRepair.mockReturnValue({
        boards: {
          byId: { "board-synced": { id: "board-synced" } },
          allIds: ["board-synced"],
        },
      });

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      expect(mockApplyYjsToStateWithRepair).toHaveBeenCalledWith(
        doc,
        state,
        "ws-1"
      );
    });
  });

  describe("Manual sync actions", () => {
    it("syncBoard syncs when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      const board = {
        id: "board-1",
        name: "Test Board",
        workspace_id: "ws-1",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      };

      result.current.syncBoard(board);

      expect(mockBoardSync.setInYjs).toHaveBeenCalledWith(doc, board);
    });

    it("syncBoard does not sync when doc is null", () => {
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(null, true, "ws-1"));

      const board = {
        id: "board-1",
        name: "Test Board",
        workspace_id: "ws-1",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      };

      result.current.syncBoard(board);

      expect(mockBoardSync.setInYjs).not.toHaveBeenCalled();
    });

    it("syncBoard does not sync when not connected", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, false, "ws-1"));

      const board = {
        id: "board-1",
        name: "Test Board",
        workspace_id: "ws-1",
        created_by: "user-1",
        created_at: "2024-01-01",
        column_ids: [],
      };

      result.current.syncBoard(board);

      expect(mockBoardSync.setInYjs).not.toHaveBeenCalled();
    });

    it("deleteBoard deletes when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      result.current.deleteBoard("board-1");

      expect(mockBoardSync.deleteFromYjs).toHaveBeenCalledWith(doc, "board-1");
    });

    it("syncTask syncs when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      const task = {
        id: "task-1",
        board_id: "board-1",
        column_id: "col-1",
        title: "Test Task",
        priority: "medium" as const,
        progress: 0,
        position: 0,
        created_by: "user-1",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
        status: "todo" as const,
      };

      result.current.syncTask(task);

      expect(mockTaskSync.setInYjs).toHaveBeenCalledWith(doc, task);
    });

    it("deleteTask deletes when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      result.current.deleteTask("task-1");

      expect(mockTaskSync.deleteFromYjs).toHaveBeenCalledWith(doc, "task-1");
    });

    it("syncColumn syncs when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      const column = {
        id: "col-1",
        board_id: "board-1",
        name: "Test Column",
        position: 0,
        task_ids: [],
      };

      result.current.syncColumn(column);

      expect(mockColumnSync.setInYjs).toHaveBeenCalledWith(doc, column);
    });

    it("deleteColumn deletes when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      result.current.deleteColumn("col-1");

      expect(mockColumnSync.deleteFromYjs).toHaveBeenCalledWith(doc, "col-1");
    });

    it("syncBoardPosition syncs when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      const position = { id: "bp-1", x: 100, y: 200, zIndex: 1 };

      result.current.syncBoardPosition(position);

      expect(mockBoardPositionSync.setInYjs).toHaveBeenCalledWith(
        doc,
        position
      );
    });

    it("deleteBoardPosition deletes when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      result.current.deleteBoardPosition("bp-1");

      expect(mockBoardPositionSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "bp-1"
      );
    });

    it("syncBoardConnection syncs when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      const connection = {
        id: "bc-1",
        source_board_id: "board-1",
        target_board_id: "board-2",
        created_at: "2024-01-01",
        lineStyle: "solid" as const,
        showArrow: false,
        sourceHandle: "right" as const,
        targetHandle: "left" as const,
      };

      result.current.syncBoardConnection(connection);

      expect(mockBoardConnectionSync.setInYjs).toHaveBeenCalledWith(
        doc,
        connection
      );
    });

    it("deleteBoardConnection deletes when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      result.current.deleteBoardConnection("bc-1");

      expect(mockBoardConnectionSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "bc-1"
      );
    });

    it("syncArea syncs when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      const area = {
        id: "area-1",
        name: "Test Area",
        workspace_id: "ws-1",
        color: "#fff",
        board_ids: [],
        created_at: "2024-01-01",
      };

      result.current.syncArea(area);

      expect(mockAreaSync.setInYjs).toHaveBeenCalledWith(doc, area);
    });

    it("deleteArea deletes when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      result.current.deleteArea("area-1");

      expect(mockAreaSync.deleteFromYjs).toHaveBeenCalledWith(doc, "area-1");
    });

    it("syncAreaPosition syncs when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      const position = {
        id: "ap-1",
        x: 100,
        y: 200,
        zIndex: 1,
        height: 50,
        width: 100,
      };

      result.current.syncAreaPosition(position);

      expect(mockAreaPositionSync.setInYjs).toHaveBeenCalledWith(doc, position);
    });

    it("deleteAreaPosition deletes when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      result.current.deleteAreaPosition("ap-1");

      expect(mockAreaPositionSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "ap-1"
      );
    });

    it("syncWorkspace syncs when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      const workspace = {
        id: "ws-1",
        name: "Test Workspace",
        created_at: "2024-01-01",
        board_ids: [],
      };

      result.current.syncWorkspace(workspace);

      expect(mockWorkspaceSync.setInYjs).toHaveBeenCalledWith(doc, workspace);
    });

    it("deleteWorkspace deletes when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      result.current.deleteWorkspace("ws-1");

      expect(mockWorkspaceSync.deleteFromYjs).toHaveBeenCalledWith(doc, "ws-1");
    });

    it("syncComment syncs when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

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

      result.current.syncComment(comment);

      expect(mockCommentSync.setInYjs).toHaveBeenCalledWith(doc, comment);
    });

    it("deleteComment deletes when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      result.current.deleteComment("c-1");

      expect(mockCommentSync.deleteFromYjs).toHaveBeenCalledWith(doc, "c-1");
    });

    it("syncChatMessage syncs when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      const message = {
        id: "cm-1",
        content: "Hello",
        authorId: "user-1",
        authorName: "User",
        workspaceId: "ws-1",
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      };

      result.current.syncChatMessage(message);

      expect(mockChatMessageSync.setInYjs).toHaveBeenCalledWith(doc, message);
    });

    it("deleteChatMessage deletes when doc && isConnected && !isUpdatingFromYjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      result.current.deleteChatMessage("cm-1");

      expect(mockChatMessageSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "cm-1"
      );
    });
  });

  describe("Re-entrancy prevention", () => {
    it.skip("does not sync to Yjs when isUpdatingFromYjsRef is true", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      mockApplyYjsToStateWithRepair.mockImplementation(() => state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      expect(mockApplyYjsToStateWithRepair).toHaveBeenCalled();

      triggerStoreStateChange({});

      expect(mockBoardSync.setInYjs).not.toHaveBeenCalled();
    });

    it("applyYjsChanges returns early when isUpdatingFromYjsRef is true", () => {
      const doc = createTestDoc();
      doc.getMap("boards").set("board-1", {
        id: "board-1",
        name: "Board",
        workspace_id: "ws-1",
      });

      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      expect(mockApplyYjsToStateWithRepair).toHaveBeenCalledTimes(1);
    });
  });

  describe("Comment position-only throttling", () => {
    it("throttles comment position-only updates but syncs content changes immediately", () => {
      const doc = createTestDoc();
      const state = createDefaultState({
        currentWorkspaceId: "ws-1",
        comments: {
          byId: {
            "c-1": {
              id: "c-1",
              x: 100,
              y: 200,
              content: "Original",
              authorId: "user-1",
              workspaceId: "ws-1",
              createdAt: "2024-01-01",
              updatedAt: "2024-01-01",
            },
          },
          allIds: ["c-1"],
        },
      });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 8; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }

      const commentPositionChange = {
        id: "c-1",
        x: 150,
        y: 250,
        content: "Original",
        authorId: "user-1",
        workspaceId: "ws-1",
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      };
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [commentPositionChange],
        removed: [],
      });

      triggerStoreStateChange({});

      expect(mockCommentSync.batchSetInYjs).toHaveBeenCalledTimes(1);

      mockCommentSync.batchSetInYjs.mockReset();

      for (let i = 0; i < 8; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      const commentPositionChange2 = {
        id: "c-1",
        x: 200,
        y: 300,
        content: "Original",
        authorId: "user-1",
        workspaceId: "ws-1",
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      };
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [commentPositionChange2],
        removed: [],
      });

      triggerStoreStateChange({});

      expect(mockCommentSync.batchSetInYjs).not.toHaveBeenCalled();
    });

    it("syncs comment content changes immediately without throttling", () => {
      const doc = createTestDoc();
      const state = createDefaultState({
        currentWorkspaceId: "ws-1",
        comments: {
          byId: {
            "c-1": {
              id: "c-1",
              x: 100,
              y: 200,
              content: "Original",
              authorId: "user-1",
              workspaceId: "ws-1",
              createdAt: "2024-01-01",
              updatedAt: "2024-01-01",
            },
          },
          allIds: ["c-1"],
        },
      });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 8; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }

      const commentContentChange = {
        id: "c-1",
        x: 100,
        y: 200,
        content: "Updated content",
        authorId: "user-1",
        workspaceId: "ws-1",
        createdAt: "2024-01-01",
        updatedAt: "2024-01-02",
      };
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [commentContentChange],
        removed: [],
      });

      triggerStoreStateChange({});

      expect(mockCommentSync.batchSetInYjs).toHaveBeenCalledTimes(1);
    });
  });

  describe("Area drag origin final position sync", () => {
    it("force syncs final area position when area drag origin is removed", () => {
      const doc = createTestDoc();
      const areaPos = { id: "area-1", x: 300, y: 400, zIndex: 1 };
      const state = createDefaultState({
        currentWorkspaceId: "ws-1",
        areaPositions: {
          byId: { "area-1": areaPos },
          allIds: ["area-1"],
        },
      });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      for (let i = 0; i < 17; i++) {
        mockDiffEntityMaps.mockReturnValueOnce({
          added: [],
          changed: [],
          removed: [],
        });
      }
      mockDiffEntityMaps.mockReturnValueOnce({
        added: [],
        changed: [],
        removed: ["area-1"],
      });

      triggerStoreStateChange({});

      expect(mockAreaDragOriginSync.deleteFromYjs).toHaveBeenCalledWith(
        doc,
        "area-1"
      );

      expect(mockAreaPositionSync.setInYjs).toHaveBeenCalledWith(doc, areaPos);
    });
  });

  describe("Returned actions interface", () => {
    it("returns all expected sync and delete actions", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      expect(result.current).toHaveProperty("syncBoard");
      expect(result.current).toHaveProperty("deleteBoard");
      expect(result.current).toHaveProperty("syncColumn");
      expect(result.current).toHaveProperty("deleteColumn");
      expect(result.current).toHaveProperty("syncTask");
      expect(result.current).toHaveProperty("deleteTask");
      expect(result.current).toHaveProperty("syncBoardPosition");
      expect(result.current).toHaveProperty("deleteBoardPosition");
      expect(result.current).toHaveProperty("syncBoardConnection");
      expect(result.current).toHaveProperty("deleteBoardConnection");
      expect(result.current).toHaveProperty("syncArea");
      expect(result.current).toHaveProperty("deleteArea");
      expect(result.current).toHaveProperty("syncAreaPosition");
      expect(result.current).toHaveProperty("deleteAreaPosition");
      expect(result.current).toHaveProperty("syncWorkspace");
      expect(result.current).toHaveProperty("deleteWorkspace");
      expect(result.current).toHaveProperty("syncComment");
      expect(result.current).toHaveProperty("deleteComment");
      expect(result.current).toHaveProperty("syncChatMessage");
      expect(result.current).toHaveProperty("deleteChatMessage");
    });

    it("returns functions for all actions", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { result } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      expect(typeof result.current.syncBoard).toBe("function");
      expect(typeof result.current.deleteBoard).toBe("function");
      expect(typeof result.current.syncColumn).toBe("function");
      expect(typeof result.current.deleteColumn).toBe("function");
      expect(typeof result.current.syncTask).toBe("function");
      expect(typeof result.current.deleteTask).toBe("function");
      expect(typeof result.current.syncBoardPosition).toBe("function");
      expect(typeof result.current.deleteBoardPosition).toBe("function");
      expect(typeof result.current.syncBoardConnection).toBe("function");
      expect(typeof result.current.deleteBoardConnection).toBe("function");
      expect(typeof result.current.syncArea).toBe("function");
      expect(typeof result.current.deleteArea).toBe("function");
      expect(typeof result.current.syncAreaPosition).toBe("function");
      expect(typeof result.current.deleteAreaPosition).toBe("function");
      expect(typeof result.current.syncWorkspace).toBe("function");
      expect(typeof result.current.deleteWorkspace).toBe("function");
      expect(typeof result.current.syncComment).toBe("function");
      expect(typeof result.current.deleteComment).toBe("function");
      expect(typeof result.current.syncChatMessage).toBe("function");
      expect(typeof result.current.deleteChatMessage).toBe("function");
    });
  });

  describe("Yjs change observation", () => {
    it("registers observeYjsChanges when connected with valid workspace", () => {
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

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      expect(mockObserveYjsChanges).toHaveBeenCalled();
    });

    it("cleans up observer on unmount", () => {
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

      const mockUnobserve = mock();
      mockObserveYjsChanges.mockReturnValue(mockUnobserve);

      const { unmount } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      unmount();

      expect(mockUnobserve).toHaveBeenCalled();
    });

    it("applies Yjs changes when observe callback fires", () => {
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

      let observeCallback: (() => void) | undefined;
      mockObserveYjsChanges.mockImplementation(
        (_d?: unknown, _cb?: () => void) => {
          observeCallback = _cb;
          return () => {
            /* no-op */
          };
        }
      );

      renderHook(() => useYjsSync(doc, true, "ws-1"));

      observeCallback?.();

      expect(mockApplyYjsToStateWithRepair).toHaveBeenCalledTimes(2);
    });
  });

  describe("Cleanup and unmount", () => {
    it("unsubscribes from store on unmount", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      const { unmount } = renderHook(() => useYjsSync(doc, true, "ws-1"));

      const subscriberCountBefore = storeSubscribers.length;
      expect(subscriberCountBefore).toBeGreaterThan(0);

      unmount();

      expect(storeSubscribers.length).toBe(subscriberCountBefore - 1);
    });
  });
});
