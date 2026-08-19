import type { CreateTaskModalState, TaskDetailModalState } from "../../types";
import { generateId } from "../ids";
import type { KanbanStore } from "../types";

type SliceCreator = (
  set: (fn: (state: KanbanStore) => void) => void,
  get: () => KanbanStore
) => Pick<
  KanbanStore,
  | "openCreateTaskModal"
  | "closeCreateTaskModal"
  | "updateModalPosition"
  | "updateModalFormData"
  | "bringModalToFront"
  | "openTaskDetailModal"
  | "closeTaskDetailModal"
  | "updateTaskDetailModalPosition"
  | "bringTaskDetailModalToFront"
  | "triggerTaskDetailModalShake"
  | "setTaskDetailModalEditing"
  | "updateTaskDetailModalDraft"
  | "openProfileModal"
  | "closeProfileModal"
>;

export const createModalSlice: SliceCreator = (set, get) => ({
  openCreateTaskModal: ({
    columnId,
    boardId,
    position,
    sourcePosition,
    sourceRect,
    sourceType,
  }) => {
    const existingModals = Object.values(get().createTaskModals);

    const existingModalForBoard = existingModals.find(
      (m) => m.boardId === boardId
    );
    if (existingModalForBoard) {
      get().bringModalToFront(existingModalForBoard.id);
      return {
        id: existingModalForBoard.id,
        position: existingModalForBoard.position,
        isExisting: true,
      };
    }

    const modalId = generateId();

    let modalX: number;
    let modalY: number;
    if (position) {
      modalX = position.x;
      modalY = position.y;
    } else {
      const offset = existingModals.length * 30;
      const boardPosition = get().boardPositions.byId[boardId];
      const boardX = boardPosition?.x ?? 0;
      const boardY = boardPosition?.y ?? 0;
      const boardWidth = boardPosition?.width ?? 400;
      modalX = boardX + boardWidth + 20 + offset;
      modalY = boardY + offset;
    }

    const maxZIndex = existingModals.reduce(
      (max, m) => Math.max(max, m.zIndex),
      99
    );

    const modalState: CreateTaskModalState = {
      id: modalId,
      boardId,
      columnId,
      position: { x: modalX, y: modalY },
      formData: {
        title: "",
        description: "",
        priority: "medium",
        progress: 0,
        dueDate: "",
        tags: "",
      },
      sourcePosition,
      sourceRect: sourceRect
        ? {
            top: sourceRect.top,
            right: sourceRect.right,
            bottom: sourceRect.bottom,
            left: sourceRect.left,
            width: sourceRect.width,
            height: sourceRect.height,
          }
        : undefined,
      sourceType,
      zIndex: maxZIndex + 1,
    };

    set((state) => {
      state.createTaskModals[modalId] = modalState;
    });

    return {
      id: modalId,
      position: modalState.position,
      isExisting: false,
    };
  },

  closeCreateTaskModal: (modalId) =>
    set((state) => {
      delete state.createTaskModals[modalId];
    }),

  updateModalPosition: (modalId, position) =>
    set((state) => {
      const modal = state.createTaskModals[modalId];
      if (modal) {
        modal.position = position;
      }
    }),

  updateModalFormData: (modalId, formData) =>
    set((state) => {
      const modal = state.createTaskModals[modalId];
      if (modal) {
        Object.assign(modal.formData, formData);
      }
    }),

  bringModalToFront: (modalId) =>
    set((state) => {
      const modal = state.createTaskModals[modalId];
      if (modal) {
        const maxZIndex = Object.values(state.createTaskModals).reduce(
          (max, m) => Math.max(max, m.zIndex),
          99
        );
        modal.zIndex = maxZIndex + 1;
      }
    }),

  openTaskDetailModal: ({
    taskId,
    boardId,
    position,
    initialIsEditing,
    openedFromQuickActions,
  }) => {
    const existingModals = Object.values(get().taskDetailModals);

    const existingModalForTask = existingModals.find(
      (m) => m.taskId === taskId
    );
    if (existingModalForTask) {
      get().bringTaskDetailModalToFront(existingModalForTask.id);
      return {
        id: existingModalForTask.id,
        position: existingModalForTask.position,
        isExisting: true,
        usedLastPosition: true,
      };
    }

    const modalId = generateId();

    let modalX: number;
    let modalY: number;
    const lastPosition = get().lastTaskModalPositions[taskId];
    let usedLastPosition = false;

    if (position) {
      modalX = position.x;
      modalY = position.y;
    } else if (lastPosition) {
      modalX = lastPosition.x;
      modalY = lastPosition.y;
      usedLastPosition = true;
    } else {
      const MODAL_WIDTH = 450;
      const STACK_GAP = 20;
      // Stack horizontally: each additional modal shifts to the right
      const horizontalOffset =
        existingModals.length * (MODAL_WIDTH + STACK_GAP);
      const boardPosition = get().boardPositions.byId[boardId];
      const boardX = boardPosition?.x ?? 0;
      const boardY = boardPosition?.y ?? 0;
      const boardWidth = boardPosition?.width ?? 400;
      modalX = boardX + boardWidth + 20 + horizontalOffset;
      modalY = boardY;
    }

    const maxZIndex = existingModals.reduce(
      (max, m) => Math.max(max, m.zIndex),
      99
    );

    const modalState: TaskDetailModalState = {
      id: modalId,
      taskId,
      boardId,
      position: { x: modalX, y: modalY },
      zIndex: maxZIndex + 1,
      sourceTaskId: taskId,
      initialIsEditing: initialIsEditing ?? false,
      openedFromQuickActions: openedFromQuickActions ?? false,
    };

    set((state) => {
      state.taskDetailModals[modalId] = modalState;
      state.lastTaskModalPositions[taskId] = { x: modalX, y: modalY };
    });

    return {
      id: modalId,
      position: modalState.position,
      isExisting: false,
      usedLastPosition,
    };
  },

  closeTaskDetailModal: (modalId) =>
    set((state) => {
      if (state.isGuestMode) {
        return;
      }
      delete state.taskDetailModals[modalId];
    }),

  updateTaskDetailModalPosition: (modalId, position) =>
    set((state) => {
      const modal = state.taskDetailModals[modalId];
      if (modal) {
        modal.position = position;
        state.lastTaskModalPositions[modal.taskId] = position;
      }
    }),

  bringTaskDetailModalToFront: (modalId) =>
    set((state) => {
      const modal = state.taskDetailModals[modalId];
      if (modal) {
        const maxZIndex = Object.values(state.taskDetailModals).reduce(
          (max, m) => Math.max(max, m.zIndex),
          99
        );
        modal.zIndex = maxZIndex + 1;
      }
    }),

  triggerTaskDetailModalShake: (modalId) => {
    set((state) => {
      state.shakingTaskDetailModalId = modalId;
    });
    setTimeout(() => {
      set((state) => {
        if (state.shakingTaskDetailModalId === modalId) {
          state.shakingTaskDetailModalId = null;
        }
      });
    }, 300);
  },

  setTaskDetailModalEditing: (modalId, isEditing) =>
    set((state) => {
      const modal = state.taskDetailModals[modalId];
      if (modal) {
        modal.isEditing = isEditing;
      }
    }),

  updateTaskDetailModalDraft: (modalId, draftData) =>
    set((state) => {
      const modal = state.taskDetailModals[modalId];
      if (modal) {
        const allowedFields = [
          "draftTitle",
          "draftDescription",
          "draftPriority",
          "draftProgress",
          "draftDueDate",
          "draftTags",
          "draftColumnId",
          "draftChecklists",
          "draftLastUpdatedBy",
          "draftLastUpdatedAt",
        ] as const;

        for (const key of allowedFields) {
          if (draftData[key] !== undefined) {
            // @ts-expect-error - Iterate over allowed keys which matches the type
            modal[key] = draftData[key];
          }
        }
      }
    }),

  openProfileModal: () =>
    set((state) => {
      state.isProfileModalOpen = true;
    }),

  closeProfileModal: () =>
    set((state) => {
      state.isProfileModalOpen = false;
    }),
});
