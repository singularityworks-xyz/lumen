import { beforeEach, describe, expect, it, mock } from "bun:test";

let nanoidCounter = 0;
mock.module("nanoid", () => ({
  nanoid: () => `seq${++nanoidCounter}`,
}));

import { createFreshState } from "@tests/helpers/store-harness";
import { createZIndexSlice } from "./slices/z-index-slice";
import type { KanbanStore } from "./types";

let state: KanbanStore;
let actions: ReturnType<typeof createZIndexSlice>;

beforeEach(() => {
  nanoidCounter = 0;
  state = createFreshState() as KanbanStore;
  const set: (fn: (s: KanbanStore) => void) => void = (fn) => fn(state);
  const get: () => KanbanStore = () => state;
  actions = createZIndexSlice(set, get);
});

describe("z-index-slice", () => {
  describe("bringDialogToFront", () => {
    it("moves dialog to top of focus stack", () => {
      state.dialogFocusStack = ["dialog-a", "dialog-b", "dialog-c"];

      actions.bringDialogToFront("dialog-b");

      expect(state.dialogFocusStack).toEqual([
        "dialog-a",
        "dialog-c",
        "dialog-b",
      ]);
    });

    it("pushes new dialog to end of stack when not present", () => {
      state.dialogFocusStack = ["dialog-a", "dialog-b"];

      actions.bringDialogToFront("dialog-c");

      expect(state.dialogFocusStack).toEqual([
        "dialog-a",
        "dialog-b",
        "dialog-c",
      ]);
    });

    it("handles empty stack", () => {
      state.dialogFocusStack = [];

      actions.bringDialogToFront("dialog-a");

      expect(state.dialogFocusStack).toEqual(["dialog-a"]);
    });
  });

  describe("getDialogZIndex", () => {
    it("returns higher z-index for dialog higher in focus stack", () => {
      state.dialogFocusStack = ["dialog-a", "dialog-b", "dialog-c"];

      const zIndexA = actions.getDialogZIndex("dialog-a");
      const zIndexC = actions.getDialogZIndex("dialog-c");

      expect(zIndexC).toBeGreaterThan(zIndexA);
    });

    it("returns base z-index for unregistered dialog", () => {
      state.dialogFocusStack = ["dialog-a"];

      const zIndex = actions.getDialogZIndex("unknown-dialog");

      expect(zIndex).toBe(2000);
    });

    it("returns incremented z-index based on stack position", () => {
      state.dialogFocusStack = ["dialog-a", "dialog-b"];

      const zIndexA = actions.getDialogZIndex("dialog-a");
      const zIndexB = actions.getDialogZIndex("dialog-b");

      expect(zIndexA).toBe(2010);
      expect(zIndexB).toBe(2020);
    });
  });
});
