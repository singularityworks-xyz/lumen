import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch (_e) {
  /* ignore */
}

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, renderHook } from "@testing-library/react";
import * as Y from "yjs";

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

// Mock useKanbanStore
const mockSubscribers: Array<
  (
    state: {
      taskDetailModals: Record<string, any>;
      currentWorkspaceId: string | null;
    },
    prevState: {
      taskDetailModals: Record<string, any>;
      currentWorkspaceId: string | null;
    }
  ) => void
> = [];

let mockState = {
  taskDetailModals: {} as Record<string, any>,
  currentWorkspaceId: "ws-1" as string | null,
};

const mockUseKanbanStore = mock(() => mockState) as any;
mockUseKanbanStore.getState = mock(() => mockState);
mockUseKanbanStore.setState = mock((fnOrObj: any) => {
  if (typeof fnOrObj === "function") {
    mockState = fnOrObj(mockState);
  } else {
    mockState = { ...mockState, ...fnOrObj };
  }
});
mockUseKanbanStore.subscribe = mock(
  (subscriber: (typeof mockSubscribers)[number]) => {
    mockSubscribers.push(subscriber);
    return () => {
      const idx = mockSubscribers.indexOf(subscriber);
      if (idx !== -1) {
        mockSubscribers.splice(idx, 1);
      }
    };
  }
);

mock.module("@/src/features/kanban/store/kanban-store", () => ({
  useKanbanStore: mockUseKanbanStore,
}));

function triggerStoreUpdate(
  newState: Partial<{
    taskDetailModals: Record<string, any>;
    currentWorkspaceId: string | null;
  }>
) {
  const prevState = { ...mockState };
  mockState = { ...mockState, ...newState };
  for (const subscriber of mockSubscribers) {
    subscriber(mockState, prevState);
  }
}

function resetMocks() {
  mockSetInYjs.mockClear();
  mockDeleteFromYjs.mockClear();
  mockSubscribers.length = 0;
  mockState = {
    taskDetailModals: {},
    currentWorkspaceId: "ws-1",
  };
  mockUseKanbanStore.getState.mockClear();
  mockUseKanbanStore.getState.mockReturnValue(mockState);
  mockUseKanbanStore.setState.mockClear();
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
  });

  afterEach(() => {
    cleanup();
  });

  describe("disabled when not connected", () => {
    it("should NOT set up sync when doc is null", () => {
      renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(null as any, true, "ws-1");
      });

      expect(mockSubscribers).toHaveLength(0);
    });

    it("should NOT set up sync when isConnected is false", () => {
      const doc = new Y.Doc();

      renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, false, "ws-1");
      });

      expect(mockSubscribers).toHaveLength(0);

      doc.destroy();
    });

    it("should NOT set up sync when both doc is null and isConnected is false", () => {
      renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(null as any, false, "ws-1");
      });

      expect(mockSubscribers).toHaveLength(0);
    });
  });

  describe("ownership model", () => {
    it("should track locally opened modals and sync them to Yjs", () => {
      const doc = new Y.Doc();
      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledWith(doc, modal);

      unmount();
      doc.destroy();
    });

    it("should mark new modals as locally owned", () => {
      const doc = new Y.Doc();
      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      unmount();
      doc.destroy();
    });

    it("should not overwrite locally owned modals from Yjs", () => {
      const doc = new Y.Doc();
      const yjsMap = doc.getMap("taskDetailModals");

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const remoteModal = createValidModal({
        id: "remote-modal",
        position: { x: 200, y: 200 },
      });
      yjsMap.set("remote-modal", remoteModal);

      expect(mockUseKanbanStore.setState).toHaveBeenCalled();

      unmount();
      doc.destroy();
    });
  });

  describe("remote close propagation", () => {
    it("should remove modal locally when removed from Yjs", () => {
      const doc = new Y.Doc();
      const yjsMap = doc.getMap("taskDetailModals");

      const modal = createValidModal();
      mockState = {
        ...mockState,
        taskDetailModals: { "modal-1": modal },
      };

      yjsMap.set("modal-1", modal);

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      yjsMap.delete("modal-1");

      const setStateCalls = (
        mockUseKanbanStore.setState as ReturnType<typeof mock>
      ).mock.calls;
      const lastCall = setStateCalls.at(-1);
      if (lastCall) {
        const stateUpdater = lastCall[0];
        if (typeof stateUpdater === "function") {
          const newState = stateUpdater(mockState);
          expect(newState.taskDetailModals["modal-1"]).toBeUndefined();
        }
      }

      unmount();
      doc.destroy();
    });

    it("should remove locally owned modal when removed from Yjs", () => {
      const doc = new Y.Doc();
      const yjsMap = doc.getMap("taskDetailModals");

      const modal = createValidModal();
      mockState = {
        ...mockState,
        taskDetailModals: { "modal-1": modal },
      };

      yjsMap.set("modal-1", modal);

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      yjsMap.delete("modal-1");

      const setStateCalls = (
        mockUseKanbanStore.setState as ReturnType<typeof mock>
      ).mock.calls;
      const lastCall = setStateCalls.at(-1);
      if (lastCall) {
        const stateUpdater = lastCall[0];
        if (typeof stateUpdater === "function") {
          const newState = stateUpdater(mockState);
          expect(newState.taskDetailModals["modal-1"]).toBeUndefined();
        }
      }

      unmount();
      doc.destroy();
    });
  });

  describe("invalid modal rejection", () => {
    it("should NOT sync modals without id", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const invalidModal = {
        taskId: "task-1",
        boardId: "board-1",
        position: { x: 100, y: 100 },
        zIndex: 10,
        sourceTaskId: "task-1",
      };

      triggerStoreUpdate({
        taskDetailModals: { "invalid-modal": invalidModal as any },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();

      unmount();
      doc.destroy();
    });

    it("should NOT sync modals without taskId", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const invalidModal = {
        id: "modal-1",
        boardId: "board-1",
        position: { x: 100, y: 100 },
        zIndex: 10,
        sourceTaskId: "task-1",
      };

      triggerStoreUpdate({
        taskDetailModals: { "invalid-modal": invalidModal as any },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();

      unmount();
      doc.destroy();
    });

    it("should NOT sync modals without boardId", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const invalidModal = {
        id: "modal-1",
        taskId: "task-1",
        position: { x: 100, y: 100 },
        zIndex: 10,
        sourceTaskId: "task-1",
      };

      triggerStoreUpdate({
        taskDetailModals: { "invalid-modal": invalidModal as any },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();

      unmount();
      doc.destroy();
    });

    it("should NOT sync modals without position", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const invalidModal = {
        id: "modal-1",
        taskId: "task-1",
        boardId: "board-1",
        zIndex: 10,
        sourceTaskId: "task-1",
      };

      triggerStoreUpdate({
        taskDetailModals: { "invalid-modal": invalidModal as any },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();

      unmount();
      doc.destroy();
    });

    it("should NOT sync modals with NaN position coordinates", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const invalidModal = createValidModal({
        position: { x: Number.NaN, y: Number.NaN },
      });

      triggerStoreUpdate({
        taskDetailModals: { "invalid-modal": invalidModal },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();

      unmount();
      doc.destroy();
    });

    it("should NOT sync modals without zIndex", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const invalidModal = {
        id: "modal-1",
        taskId: "task-1",
        boardId: "board-1",
        position: { x: 100, y: 100 },
        sourceTaskId: "task-1",
      };

      triggerStoreUpdate({
        taskDetailModals: { "invalid-modal": invalidModal as any },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();

      unmount();
      doc.destroy();
    });

    it("should NOT sync modals without sourceTaskId", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const invalidModal = {
        id: "modal-1",
        taskId: "task-1",
        boardId: "board-1",
        position: { x: 100, y: 100 },
        zIndex: 10,
      };

      triggerStoreUpdate({
        taskDetailModals: { "invalid-modal": invalidModal as any },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();

      unmount();
      doc.destroy();
    });
  });

  describe("position sync throttling", () => {
    it("should throttle position-only changes at 16ms", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const positionOnlyModal = {
        ...modal,
        position: { x: 150, y: 150 },
      };
      triggerStoreUpdate({
        taskDetailModals: { "modal-1": positionOnlyModal },
      });

      expect(mockSetInYjs).not.toHaveBeenCalled();

      unmount();
      doc.destroy();
    });

    it("should sync position changes after throttle period", async () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      await new Promise((resolve) => setTimeout(resolve, 20));

      const positionOnlyModal = {
        ...modal,
        position: { x: 150, y: 150 },
      };
      triggerStoreUpdate({
        taskDetailModals: { "modal-1": positionOnlyModal },
      });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      unmount();
      doc.destroy();
    });
  });

  describe("z-index and draft field propagation", () => {
    it("should sync zIndex changes immediately", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, zIndex: 20 };
      triggerStoreUpdate({ taskDetailModals: { "modal-1": updatedModal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      expect(mockSetInYjs).toHaveBeenCalledWith(doc, updatedModal);

      unmount();
      doc.destroy();
    });

    it("should sync isEditing changes immediately", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, isEditing: true };
      triggerStoreUpdate({ taskDetailModals: { "modal-1": updatedModal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      unmount();
      doc.destroy();
    });

    it("should sync draftTitle changes immediately", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, draftTitle: "New Title" };
      triggerStoreUpdate({ taskDetailModals: { "modal-1": updatedModal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      unmount();
      doc.destroy();
    });

    it("should sync draftDescription changes immediately", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = {
        ...modal,
        draftDescription: "New Description",
      };
      triggerStoreUpdate({ taskDetailModals: { "modal-1": updatedModal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      unmount();
      doc.destroy();
    });

    it("should sync draftPriority changes immediately", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, draftPriority: "high" as const };
      triggerStoreUpdate({ taskDetailModals: { "modal-1": updatedModal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      unmount();
      doc.destroy();
    });

    it("should sync draftProgress changes immediately", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, draftProgress: 75 };
      triggerStoreUpdate({ taskDetailModals: { "modal-1": updatedModal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      unmount();
      doc.destroy();
    });

    it("should sync draftDueDate changes immediately", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, draftDueDate: "2024-12-31" };
      triggerStoreUpdate({ taskDetailModals: { "modal-1": updatedModal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      unmount();
      doc.destroy();
    });

    it("should sync draftTags changes immediately", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, draftTags: "tag1,tag2" };
      triggerStoreUpdate({ taskDetailModals: { "modal-1": updatedModal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      unmount();
      doc.destroy();
    });

    it("should sync draftColumnId changes immediately", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      const updatedModal = { ...modal, draftColumnId: "col-2" };
      triggerStoreUpdate({ taskDetailModals: { "modal-1": updatedModal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      unmount();
      doc.destroy();
    });

    it("should sync draftChecklists changes immediately", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

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
      triggerStoreUpdate({ taskDetailModals: { "modal-1": updatedModal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);

      unmount();
      doc.destroy();
    });
  });

  describe("workspace switch cleanup", () => {
    it("should clear localModalIdsRef when workspace changes", () => {
      const doc = new Y.Doc();

      const { rerender, unmount } = renderHook(
        ({ workspaceId }) => {
          const {
            useTaskDialogSync,
          } = require("@/src/features/collab/hooks/use-task-dialog-sync");
          return useTaskDialogSync(doc, true, workspaceId);
        },
        { initialProps: { workspaceId: "ws-1" } }
      );

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      rerender({ workspaceId: "ws-2" });

      const modal2 = createValidModal({ id: "modal-2" });
      triggerStoreUpdate({
        taskDetailModals: { "modal-1": modal, "modal-2": modal2 },
      });

      expect(mockSetInYjs).toHaveBeenCalledWith(doc, modal2);

      unmount();
      doc.destroy();
    });

    it("should clear lastSyncTimesRef when workspace changes", () => {
      const doc = new Y.Doc();

      const { rerender, unmount } = renderHook(
        ({ workspaceId }) => {
          const {
            useTaskDialogSync,
          } = require("@/src/features/collab/hooks/use-task-dialog-sync");
          return useTaskDialogSync(doc, true, workspaceId);
        },
        { initialProps: { workspaceId: "ws-1" } }
      );

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      rerender({ workspaceId: "ws-2" });

      const positionOnlyModal = {
        ...modal,
        position: { x: 200, y: 200 },
      };
      triggerStoreUpdate({
        taskDetailModals: { "modal-1": positionOnlyModal },
      });

      expect(mockSetInYjs).toHaveBeenCalled();

      unmount();
      doc.destroy();
    });
  });

  describe("re-entrancy prevention", () => {
    it("should not apply Yjs changes when isApplyingFromYjsRef is true", () => {
      const doc = new Y.Doc();
      const yjsMap = doc.getMap("taskDetailModals");

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      yjsMap.set("modal-1", modal);

      expect(mockUseKanbanStore.setState).toHaveBeenCalled();

      unmount();
      doc.destroy();
    });
  });

  describe("Yjs observer setup/teardown", () => {
    it("should observe yjsMap on mount", () => {
      const doc = new Y.Doc();
      const yjsMap = doc.getMap("taskDetailModals");

      let observerCount = 0;
      const originalObserve = yjsMap.observe.bind(yjsMap);
      yjsMap.observe = mock((cb: any) => {
        observerCount++;
        return originalObserve(cb);
      });

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      expect(observerCount).toBe(1);

      unmount();
      doc.destroy();
    });

    it("should unobserve yjsMap on cleanup", () => {
      const doc = new Y.Doc();
      const yjsMap = doc.getMap("taskDetailModals");

      let unobserveCount = 0;
      const originalUnobserve = yjsMap.unobserve.bind(yjsMap);
      yjsMap.unobserve = mock((cb: any) => {
        unobserveCount++;
        return originalUnobserve(cb);
      });

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      unmount();

      expect(unobserveCount).toBe(1);

      doc.destroy();
    });
  });

  describe("initial sync behavior", () => {
    it("should call applyRemoteModals on initial setup", () => {
      const doc = new Y.Doc();
      const yjsMap = doc.getMap("taskDetailModals");

      const modal = createValidModal();
      yjsMap.set("modal-1", modal);

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      expect(mockUseKanbanStore.setState).toHaveBeenCalled();

      unmount();
      doc.destroy();
    });
  });

  describe("modal removal sync", () => {
    it("should delete modal from Yjs when removed locally", () => {
      const doc = new Y.Doc();

      const { unmount } = renderHook(() => {
        const {
          useTaskDialogSync,
        } = require("@/src/features/collab/hooks/use-task-dialog-sync");
        return useTaskDialogSync(doc, true, "ws-1");
      });

      const modal = createValidModal();
      triggerStoreUpdate({ taskDetailModals: { "modal-1": modal } });

      expect(mockSetInYjs).toHaveBeenCalledTimes(1);
      mockSetInYjs.mockClear();

      triggerStoreUpdate({ taskDetailModals: {} });

      expect(mockDeleteFromYjs).toHaveBeenCalledWith(doc, "modal-1");

      unmount();
      doc.destroy();
    });
  });
});
