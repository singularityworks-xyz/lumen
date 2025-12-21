import type { KanbanStore } from "../types";

type SliceCreator = (
  set: (fn: (state: KanbanStore) => void) => void,
  get: () => KanbanStore
) => Pick<
  KanbanStore,
  | "bringDialogToFront"
  | "registerDialog"
  | "unregisterDialog"
  | "getDialogZIndex"
>;

export const Z_INDEX_BASE = {
  BOARDS: 0,
  TASK_MODALS: 1000,
  QUICK_ACTIONS: 2000,
  DIALOGS: 2000,
  // Connectors are rendered at dialogZIndex - 1
};

/**
 * Manages a unified focus stack for all dialogs and their connectors.
 * When a dialog is focused, it and its connector move to the top of the stack.
 */
export const createZIndexSlice: SliceCreator = (set, get) => ({
  bringDialogToFront: (dialogId) =>
    set((state) => {
      const currentIndex = state.dialogFocusStack.indexOf(dialogId);
      if (currentIndex !== -1) {
        state.dialogFocusStack.splice(currentIndex, 1);
      }
      state.dialogFocusStack.push(dialogId);
    }),

  registerDialog: (dialogId) =>
    set((state) => {
      if (!state.dialogFocusStack.includes(dialogId)) {
        state.dialogFocusStack.push(dialogId);
      }
    }),
  unregisterDialog: (dialogId) =>
    set((state) => {
      const index = state.dialogFocusStack.indexOf(dialogId);
      if (index !== -1) {
        state.dialogFocusStack.splice(index, 1);
      }
    }),

  /**
   * Get the z-index for a dialog based on its position in the focus stack.
   * Higher position = higher z-index = renders on top.
   */
  getDialogZIndex: (dialogId) => {
    const state = get();
    const index = state.dialogFocusStack.indexOf(dialogId);
    if (index === -1) {
      return Z_INDEX_BASE.DIALOGS;
    }
    // Each dialog gets a z-index increment based on stack position
    // Using 10 as increment to allow room for connectors (z - 1)
    return Z_INDEX_BASE.DIALOGS + (index + 1) * 10;
  },
});
