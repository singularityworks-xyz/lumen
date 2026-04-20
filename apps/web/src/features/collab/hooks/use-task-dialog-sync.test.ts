import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import * as Y from "yjs";

const FIXED_TS = 1_700_000_000_000;
let tsCounter = 0;
const originalDateNow = Date.now;
const mockDateNow = () => FIXED_TS + tsCounter++;

// Mock entity-sync module
const mockYjsMapNames = {
  TASK_DETAIL_MODALS: "taskDetailModals",
};

mock.module("@/src/features/collab/sync/entity-sync", () => ({
  YJS_MAP_NAMES: mockYjsMapNames,
}));

// Mock taskDetailModalSync
const mockSetInYjs = mock(() => undefined);
const mockDeleteFromYjs = mock(() => undefined);

mock.module("@/src/features/collab/sync/syncs", () => ({
  taskDetailModalSync: {
    setInYjs: mockSetInYjs,
    deleteFromYjs: mockDeleteFromYjs,
  },
}));

// Store state and subscribers (must be defined before mock module declarations)
type StoreSubscriber = (state: StoreState, prevState: StoreState) => void;

interface StoreState {
  currentWorkspaceId: string | null;
  taskDetailModals: Record<string, any>;
}

let storeSubscribers: StoreSubscriber[] = [];

function createDefaultState(overrides: Partial<StoreState> = {}): StoreState {
  return {
    taskDetailModals: {},
    currentWorkspaceId: "ws-1",
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
import { useTaskDialogSync } from "./use-task-dialog-sync";

// --- Test helpers ---

function resetMocks() {
  mockSetInYjs.mockReset();
  mockDeleteFromYjs.mockReset();
  useRefMockValues.clear();
  useCallbackResults.clear();
  useEffectCalls.length = 0;
  storeState = createDefaultState();
  storeSubscribers = [];
  mockUseKanbanStore.getState.mockReset();
  mockUseKanbanStore.getState.mockReturnValue(storeState);
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

function createValidModal(overrides: Partial<any> = {}): Record<string, any> {
  return {
    id: "modal-1",
    taskId: "task-1",
    boardId: "board-1",
    position: { x: 100, y: 100 },
    zIndex: 10,
    sourceTaskId: "task-1",
    ...overrides,
  };
}

describe("useTaskDialogSync", () => {
  beforeEach(() => {
    resetMocks();
    tsCounter = 0;
    Date.now = mockDateNow as typeof Date.now;
  });

  afterEach(() => {
    resetMocks();
    Date.now = originalDateNow;
  });

  describe("disabled when not connected", () => {
    it("should NOT set up sync when doc is null", () => {
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(null as any, true, "ws-1");

      expect(storeSubscribers).toHaveLength(0);
    });

    it("should NOT set up sync when isConnected is false", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, false, "ws-1");

      expect(storeSubscribers).toHaveLength(0);
      doc.destroy();
    });

    it("should NOT set up sync when both doc is null and isConnected is false", () => {
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(null as any, false, "ws-1");

      expect(storeSubscribers).toHaveLength(0);
    });
  });

  describe("ownership model", () => {
    it("should track locally opened modals and sync them to Yjs", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledWith(doc, modal);
      doc.destroy();
    });

    it("should mark new modals as locally owned", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      doc.destroy();
    });

    it("should not overwrite locally owned modals from Yjs", () => {
      const doc = createTestDoc();
      const yjsMap = doc.getMap("taskDetailModals");
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const remoteModal = createValidModal({
        id: "remote-modal",
        position: { x: 200, y: 200 },
      });
      yjsMap.set("remote-modal", remoteModal);

      // The hook should set up state when it receives Yjs changes
      expect(mockUseKanbanStore.setState).toHaveBeenCalled();

      doc.destroy();
    });
  });

  describe("remote close propagation", () => {
    it("should remove modal locally when removed from Yjs", () => {
      const doc = createTestDoc();
      const yjsMap = doc.getMap("taskDetailModals");

      const modal = createValidModal();
      storeState = {
        ...storeState,
        taskDetailModals: { "modal-1": modal },
      };

      yjsMap.set("modal-1", modal);

      const state = createDefaultState({
        currentWorkspaceId: "ws-1",
        taskDetailModals: { "modal-1": modal },
      });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      yjsMap.delete("modal-1");

      // Trigger the Yjs change handler
      const setStateCalls = (
        mockUseKanbanStore.setState as ReturnType<typeof mock>
      ).mock.calls;
      const lastCall = setStateCalls.at(-1);
      if (lastCall) {
        const stateUpdater = lastCall[0];
        if (typeof stateUpdater === "function") {
          const newState = stateUpdater(storeState);
          expect(newState.taskDetailModals["modal-1"]).toBeUndefined();
        }
      }

      doc.destroy();
    });

    it("should remove locally owned modal when removed from Yjs", () => {
      const doc = createTestDoc();
      const yjsMap = doc.getMap("taskDetailModals");

      const modal = createValidModal();
      storeState = {
        ...storeState,
        taskDetailModals: { "modal-1": modal },
      };

      yjsMap.set("modal-1", modal);

      const state = createDefaultState({
        currentWorkspaceId: "ws-1",
        taskDetailModals: { "modal-1": modal },
      });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      yjsMap.delete("modal-1");

      // Trigger the Yjs change handler
      const setStateCalls = (
        mockUseKanbanStore.setState as ReturnType<typeof mock>
      ).mock.calls;
      const lastCall = setStateCalls.at(-1);
      if (lastCall) {
        const stateUpdater = lastCall[0];
        if (typeof stateUpdater === "function") {
          const newState = stateUpdater(storeState);
          expect(newState.taskDetailModals["modal-1"]).toBeUndefined();
        }
      }

      doc.destroy();
    });
  });

  describe("invalid modal rejection", () => {
    it("should NOT sync modals without id", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const invalidModal = {
        taskId: "task-1",
        boardId: "board-1",
        position: { x: 100, y: 100 },
        zIndex: 10,
        sourceTaskId: "task-1",
      };

      triggerStoreStateChange({
        taskDetailModals: { "invalid-modal": invalidModal as any },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();
      doc.destroy();
    });

    it("should NOT sync modals without taskId", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const invalidModal = {
        id: "modal-1",
        boardId: "board-1",
        position: { x: 100, y: 100 },
        zIndex: 10,
        sourceTaskId: "task-1",
      };

      triggerStoreStateChange({
        taskDetailModals: { "invalid-modal": invalidModal as any },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();
      doc.destroy();
    });

    it("should NOT sync modals without boardId", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const invalidModal = {
        id: "modal-1",
        taskId: "task-1",
        position: { x: 100, y: 100 },
        zIndex: 10,
        sourceTaskId: "task-1",
      };

      triggerStoreStateChange({
        taskDetailModals: { "invalid-modal": invalidModal as any },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();
      doc.destroy();
    });

    it("should NOT sync modals without position", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const invalidModal = {
        id: "modal-1",
        taskId: "task-1",
        boardId: "board-1",
        zIndex: 10,
        sourceTaskId: "task-1",
      };

      triggerStoreStateChange({
        taskDetailModals: { "invalid-modal": invalidModal as any },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();
      doc.destroy();
    });

    it("should NOT sync modals with NaN position coordinates", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const invalidModal = createValidModal({
        position: { x: Number.NaN, y: Number.NaN },
      });

      triggerStoreStateChange({
        taskDetailModals: { "invalid-modal": invalidModal },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();
      doc.destroy();
    });

    it("should NOT sync modals without zIndex", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const invalidModal = {
        id: "modal-1",
        taskId: "task-1",
        boardId: "board-1",
        position: { x: 100, y: 100 },
        sourceTaskId: "task-1",
      };

      triggerStoreStateChange({
        taskDetailModals: { "invalid-modal": invalidModal as any },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();
      doc.destroy();
    });

    it("should NOT sync modals without sourceTaskId", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const invalidModal = {
        id: "modal-1",
        taskId: "task-1",
        boardId: "board-1",
        position: { x: 100, y: 100 },
        zIndex: 10,
      };

      triggerStoreStateChange({
        taskDetailModals: { "invalid-modal": invalidModal as any },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();
      doc.destroy();
    });
  });

  describe("position sync throttling", () => {
    it("should throttle position-only changes at 16ms", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const positionOnlyModal = {
        ...modal,
        position: { x: 150, y: 150 },
      };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": positionOnlyModal },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();
      doc.destroy();
    });

    it("should sync position changes after throttle period", () => {
      Date.now = mockDateNow;
      tsCounter = 0;

      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      tsCounter = 20;

      const positionOnlyModal = {
        ...modal,
        position: { x: 150, y: 150 },
      };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": positionOnlyModal },
      });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      Date.now = originalDateNow;
      doc.destroy();
    });
  });

  describe("z-index and draft field propagation", () => {
    it("should sync zIndex changes immediately", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, zIndex: 20 };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": updatedModal },
      });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      expect(mockSetInYjs).toHaveBeenCalledWith(doc, updatedModal);
      doc.destroy();
    });

    it("should sync isEditing changes immediately", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, isEditing: true };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": updatedModal },
      });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      doc.destroy();
    });

    it("should sync draftTitle changes immediately", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, draftTitle: "New Title" };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": updatedModal },
      });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      doc.destroy();
    });

    it("should sync draftDescription changes immediately", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = {
        ...modal,
        draftDescription: "New Description",
      };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": updatedModal },
      });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      doc.destroy();
    });

    it("should sync draftPriority changes immediately", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, draftPriority: "high" as const };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": updatedModal },
      });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      doc.destroy();
    });

    it("should sync draftProgress changes immediately", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, draftProgress: 75 };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": updatedModal },
      });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      doc.destroy();
    });

    it("should sync draftDueDate changes immediately", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, draftDueDate: "2024-12-31" };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": updatedModal },
      });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      doc.destroy();
    });

    it("should sync draftTags changes immediately", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, draftTags: "tag1,tag2" };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": updatedModal },
      });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      doc.destroy();
    });

    it("should sync draftColumnId changes immediately", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, draftColumnId: "col-2" };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": updatedModal },
      });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      doc.destroy();
    });

    it("should sync draftChecklists changes immediately", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = {
        ...modal,
        draftChecklists: [
          {
            id: "checklist-1",
            title: "Check 1",
            completed: false,
            position: 0,
            task_id: "task-1",
          },
        ],
      };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": updatedModal },
      });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      doc.destroy();
    });
  });

  describe("workspace switch cleanup", () => {
    it("should clear localModalIdsRef when workspace changes", () => {
      const doc = createTestDoc();
      const state1 = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state1;
      mockUseKanbanStore.getState.mockReturnValue(state1);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      // Reset subscribers for new workspace
      storeSubscribers = [];

      const state2 = createDefaultState({ currentWorkspaceId: "ws-2" });
      storeState = state2;
      mockUseKanbanStore.getState.mockReturnValue(state2);

      // Re-run hook with new workspace
      useTaskDialogSync(doc, true, "ws-2");

      const modal2 = createValidModal({ id: "modal-2" });
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": modal, "modal-2": modal2 },
        currentWorkspaceId: "ws-2",
      });

      expect(mockSetInYjs).toHaveBeenCalledWith(doc, modal2);
      doc.destroy();
    });

    it("should clear lastSyncTimesRef when workspace changes", () => {
      const doc = createTestDoc();
      const state1 = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state1;
      mockUseKanbanStore.getState.mockReturnValue(state1);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      // Reset subscribers for new workspace
      storeSubscribers = [];

      const state2 = createDefaultState({ currentWorkspaceId: "ws-2" });
      storeState = state2;
      mockUseKanbanStore.getState.mockReturnValue(state2);

      // Re-run hook with new workspace
      useTaskDialogSync(doc, true, "ws-2");

      const positionOnlyModal = {
        ...modal,
        position: { x: 200, y: 200 },
      };
      triggerStoreStateChange({
        taskDetailModals: { "modal-1": positionOnlyModal },
        currentWorkspaceId: "ws-2",
      });

      expect(mockSetInYjs).toHaveBeenCalled();
      doc.destroy();
    });
  });

  describe("re-entrancy prevention", () => {
    it("should not apply Yjs changes when isApplyingFromYjsRef is true", () => {
      const doc = createTestDoc();
      const yjsMap = doc.getMap("taskDetailModals");
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      yjsMap.set("modal-1", modal);

      expect(mockUseKanbanStore.setState).toHaveBeenCalled();
      doc.destroy();
    });
  });

  describe("Yjs observer setup/teardown", () => {
    it("should observe yjsMap on mount", () => {
      const doc = createTestDoc();
      const yjsMap = doc.getMap("taskDetailModals");
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      let observerCount = 0;
      const originalObserve = yjsMap.observe.bind(yjsMap);
      yjsMap.observe = mock((cb: any) => {
        observerCount++;
        return originalObserve(cb);
      });

      useTaskDialogSync(doc, true, "ws-1");

      expect(observerCount).toBe(1);
      doc.destroy();
    });

    it("should unobserve yjsMap on cleanup", () => {
      const doc = createTestDoc();
      const yjsMap = doc.getMap("taskDetailModals");
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      let unobserveCount = 0;
      const originalUnobserve = yjsMap.unobserve.bind(yjsMap);
      yjsMap.unobserve = mock((cb: any) => {
        unobserveCount++;
        return originalUnobserve(cb);
      });

      useTaskDialogSync(doc, true, "ws-1");

      // Cleanup functions are stored in useEffectCalls
      // Execute cleanup functions to test unobservation
      for (let i = useEffectCalls.length - 1; i >= 0; i--) {
        const call = useEffectCalls[i];
        const cleanup = call[0];
        if (typeof cleanup === "function") {
          (cleanup as () => void)();
        }
      }

      expect(unobserveCount).toBe(1);
      doc.destroy();
    });
  });

  describe("initial sync behavior", () => {
    it("should call applyRemoteModals on initial setup", () => {
      const doc = createTestDoc();
      const yjsMap = doc.getMap("taskDetailModals");

      const modal = createValidModal();
      yjsMap.set("modal-1", modal);

      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      expect(mockUseKanbanStore.setState).toHaveBeenCalled();
      doc.destroy();
    });
  });

  describe("modal removal sync", () => {
    it("should delete modal from Yjs when removed locally", () => {
      const doc = createTestDoc();
      const state = createDefaultState({ currentWorkspaceId: "ws-1" });
      storeState = state;
      mockUseKanbanStore.getState.mockReturnValue(state);

      useTaskDialogSync(doc, true, "ws-1");

      const modal = createValidModal();
      triggerStoreStateChange({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      triggerStoreStateChange({ taskDetailModals: {} });

      expect(mockDeleteFromYjs).toHaveBeenCalledWith(doc, "modal-1");
      doc.destroy();
    });
  });
});
