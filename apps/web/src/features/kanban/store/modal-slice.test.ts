import { beforeEach, describe, expect, it, mock } from "bun:test";

let nanoidCounter = 0;
mock.module("nanoid", () => ({
  nanoid: () => `seq${++nanoidCounter}`,
}));

import {
  addBoardToState,
  createFreshState,
} from "@tests/helpers/store-harness";
import { createModalSlice } from "./slices/modal-slice";
import type { KanbanStore } from "./types";

let state: KanbanStore;
let actions: ReturnType<typeof createModalSlice>;

beforeEach(() => {
  nanoidCounter = 0;
  state = createFreshState() as KanbanStore;
  const set: (fn: (s: KanbanStore) => void) => void = (fn) => fn(state);
  const get: () => KanbanStore = () => state;
  actions = createModalSlice(set, get);
  Object.assign(state, actions);
});

describe("modal-slice", () => {
  describe("openCreateTaskModal", () => {
    it("creates new modal on first call", () => {
      const { boardId, columnIds } = addBoardToState(state);
      const result = actions.openCreateTaskModal({
        columnId: columnIds[0]!,
        boardId,
        position: { x: 100, y: 200 },
      });

      expect(result.isExisting).toBe(false);
      expect(result.position).toEqual({ x: 100, y: 200 });
      expect(state.createTaskModals[result.id]).toBeDefined();
      expect(state.createTaskModals[result.id]!.boardId).toBe(boardId);
      expect(state.createTaskModals[result.id]!.columnId).toBe(columnIds[0]!);
    });

    it("reuses existing board modal instead of duplicating", () => {
      const { boardId, columnIds } = addBoardToState(state);
      const first = actions.openCreateTaskModal({
        columnId: columnIds[0]!,
        boardId,
        position: { x: 100, y: 200 },
      });

      const second = actions.openCreateTaskModal({
        columnId: columnIds[0]!,
        boardId,
        position: { x: 300, y: 400 },
      });

      expect(second.isExisting).toBe(true);
      expect(second.id).toBe(first.id);
      expect(Object.keys(state.createTaskModals)).toHaveLength(1);
    });

    it("modal auto-placement uses board geometry and stacking offsets", () => {
      const { boardId: boardId1, columnIds: colIds1 } = addBoardToState(state, {
        boardId: "board-1",
        x: 100,
        y: 100,
      });
      const { boardId: boardId2, columnIds: colIds2 } = addBoardToState(state, {
        boardId: "board-2",
        x: 100,
        y: 100,
      });

      const first = actions.openCreateTaskModal({
        columnId: colIds1[0]!,
        boardId: boardId1,
      });

      const second = actions.openCreateTaskModal({
        columnId: colIds2[0]!,
        boardId: boardId2,
      });

      const firstModal = state.createTaskModals[first.id]!;
      const secondModal = state.createTaskModals[second.id]!;
      expect(firstModal.position.x).toBeGreaterThan(firstModal.position.y);
      expect(secondModal.position.x).toBe(firstModal.position.x + 30);
      expect(secondModal.position.y).toBe(firstModal.position.y + 30);
    });

    it("creates modals with incremented zIndex", () => {
      const { boardId: b1, columnIds: c1 } = addBoardToState(state, {
        boardId: "board-1",
      });
      const { boardId: b2, columnIds: c2 } = addBoardToState(state, {
        boardId: "board-2",
      });
      const first = actions.openCreateTaskModal({
        columnId: c1[0]!,
        boardId: b1,
      });
      const second = actions.openCreateTaskModal({
        columnId: c2[0]!,
        boardId: b2,
      });

      expect(state.createTaskModals[second.id]!.zIndex).toBeGreaterThan(
        state.createTaskModals[first.id]!.zIndex
      );
    });
  });

  describe("closeCreateTaskModal", () => {
    it("removes the modal", () => {
      const { boardId, columnIds } = addBoardToState(state);
      const { id } = actions.openCreateTaskModal({
        columnId: columnIds[0]!,
        boardId,
      });

      actions.closeCreateTaskModal(id);

      expect(state.createTaskModals[id]).toBeUndefined();
    });
  });

  describe("openTaskDetailModal", () => {
    it("creates new modal", () => {
      const { boardId } = addBoardToState(state);
      const result = actions.openTaskDetailModal({
        taskId: "task-1",
        boardId,
        position: { x: 50, y: 60 },
      });

      expect(result.isExisting).toBe(false);
      expect(result.usedLastPosition).toBe(false);
      expect(result.position).toEqual({ x: 50, y: 60 });
      expect(state.taskDetailModals[result.id]).toBeDefined();
      expect(state.taskDetailModals[result.id]!.taskId).toBe("task-1");
      expect(state.taskDetailModals[result.id]!.boardId).toBe(boardId);
    });

    it("reuses existing modal for same taskId", () => {
      const { boardId } = addBoardToState(state);
      const first = actions.openTaskDetailModal({
        taskId: "task-1",
        boardId,
      });
      const second = actions.openTaskDetailModal({
        taskId: "task-1",
        boardId,
      });

      expect(second.isExisting).toBe(true);
      expect(second.usedLastPosition).toBe(true);
      expect(second.id).toBe(first.id);
      expect(Object.keys(state.taskDetailModals)).toHaveLength(1);
    });

    it("task-detail modal remembers last position per task", () => {
      const { boardId } = addBoardToState(state);
      const first = actions.openTaskDetailModal({
        taskId: "task-1",
        boardId,
        position: { x: 500, y: 600 },
      });

      actions.updateTaskDetailModalPosition(first.id, {
        x: 700,
        y: 800,
      });

      actions.closeTaskDetailModal(first.id);

      const reopened = actions.openTaskDetailModal({
        taskId: "task-1",
        boardId,
      });

      expect(state.lastTaskModalPositions["task-1"]).toEqual({
        x: 700,
        y: 800,
      });
      expect(reopened.usedLastPosition).toBe(true);
    });

    it("auto-placement uses board geometry when no last position", () => {
      const { boardId } = addBoardToState(state, { x: 200, y: 150 });

      const result = actions.openTaskDetailModal({
        taskId: "task-1",
        boardId,
      });

      const modal = state.taskDetailModals[result.id]!;
      expect(modal.position.x).toBeGreaterThan(200);
      expect(modal.position.y).toBe(150);
      expect(result.usedLastPosition).toBe(false);
    });
  });

  describe("closeTaskDetailModal", () => {
    it("removes the modal", () => {
      const { boardId } = addBoardToState(state);
      const { id } = actions.openTaskDetailModal({
        taskId: "task-1",
        boardId,
      });

      actions.closeTaskDetailModal(id);

      expect(state.taskDetailModals[id]).toBeUndefined();
    });
  });

  describe("updateModalPosition", () => {
    it("updates position", () => {
      const { boardId, columnIds } = addBoardToState(state);
      const { id } = actions.openCreateTaskModal({
        columnId: columnIds[0]!,
        boardId,
      });

      actions.updateModalPosition(id, { x: 500, y: 600 });

      expect(state.createTaskModals[id]!.position).toEqual({ x: 500, y: 600 });
    });
  });

  describe("updateModalFormData", () => {
    it("updates form fields", () => {
      const { boardId, columnIds } = addBoardToState(state);
      const { id } = actions.openCreateTaskModal({
        columnId: columnIds[0]!,
        boardId,
      });

      actions.updateModalFormData(id, {
        title: "New Title",
        priority: "high",
        progress: 50,
      });

      expect(state.createTaskModals[id]!.formData.title).toBe("New Title");
      expect(state.createTaskModals[id]!.formData.priority).toBe("high");
      expect(state.createTaskModals[id]!.formData.progress).toBe(50);
    });
  });

  describe("bringModalToFront", () => {
    it("rewrites z-index correctly", () => {
      const { boardId: b1, columnIds: c1 } = addBoardToState(state, {
        boardId: "board-1",
      });
      const { boardId: b2, columnIds: c2 } = addBoardToState(state, {
        boardId: "board-2",
      });
      const { id: id1 } = actions.openCreateTaskModal({
        columnId: c1[0]!,
        boardId: b1,
      });
      const { id: id2 } = actions.openCreateTaskModal({
        columnId: c2[0]!,
        boardId: b2,
      });
      const z1Before = state.createTaskModals[id1]!.zIndex;

      actions.bringModalToFront(id1);

      expect(state.createTaskModals[id1]!.zIndex).toBeGreaterThan(z1Before);
      expect(state.createTaskModals[id1]!.zIndex).toBeGreaterThan(
        state.createTaskModals[id2]!.zIndex
      );
    });
  });

  describe("bringTaskDetailModalToFront", () => {
    it("rewrites z-index correctly", () => {
      const { boardId } = addBoardToState(state);
      const { id: id1 } = actions.openTaskDetailModal({
        taskId: "task-1",
        boardId,
      });
      const { id: id2 } = actions.openTaskDetailModal({
        taskId: "task-2",
        boardId,
      });
      const z1Before = state.taskDetailModals[id1]!.zIndex;

      actions.bringTaskDetailModalToFront(id1);

      expect(state.taskDetailModals[id1]!.zIndex).toBeGreaterThan(z1Before);
      expect(state.taskDetailModals[id1]!.zIndex).toBeGreaterThan(
        state.taskDetailModals[id2]!.zIndex
      );
    });
  });

  describe("updateTaskDetailModalDraft", () => {
    it("updates draft fields", () => {
      const { boardId } = addBoardToState(state);
      const { id } = actions.openTaskDetailModal({
        taskId: "task-1",
        boardId,
      });

      actions.updateTaskDetailModalDraft(id, {
        draftTitle: "Updated Title",
        draftDescription: "Updated Description",
        draftPriority: "high",
        draftProgress: 75,
      });

      expect(state.taskDetailModals[id]!.draftTitle).toBe("Updated Title");
      expect(state.taskDetailModals[id]!.draftDescription).toBe(
        "Updated Description"
      );
      expect(state.taskDetailModals[id]!.draftPriority).toBe("high");
      expect(state.taskDetailModals[id]!.draftProgress).toBe(75);
    });

    it("draft updates touch only allowed fields", () => {
      const { boardId } = addBoardToState(state);
      const { id } = actions.openTaskDetailModal({
        taskId: "task-1",
        boardId,
      });

      const modalBefore = { ...state.taskDetailModals[id]! };

      actions.updateTaskDetailModalDraft(id, {
        draftTitle: "Title",
        draftDescription: "Desc",
      });

      const modalAfter = state.taskDetailModals[id]!;
      expect(modalAfter.id).toBe(modalBefore.id);
      expect(modalAfter.taskId).toBe(modalBefore.taskId);
      expect(modalAfter.boardId).toBe(modalBefore.boardId);
      expect(modalAfter.position).toEqual(modalBefore.position);
      expect(modalAfter.zIndex).toBe(modalBefore.zIndex);
      expect(modalAfter.draftTitle).toBe("Title");
      expect(modalAfter.draftDescription).toBe("Desc");
    });
  });

  describe("triggerTaskDetailModalShake", () => {
    it("sets shake flag", () => {
      const { boardId } = addBoardToState(state);
      const { id } = actions.openTaskDetailModal({
        taskId: "task-1",
        boardId,
      });

      actions.triggerTaskDetailModalShake(id);

      expect(state.shakingTaskDetailModalId).toBe(id);
    });

    it("shake flag clears after timeout", async () => {
      const { boardId } = addBoardToState(state);
      const { id } = actions.openTaskDetailModal({
        taskId: "task-1",
        boardId,
      });

      actions.triggerTaskDetailModalShake(id);
      expect(state.shakingTaskDetailModalId).toBe(id);

      await new Promise((resolve) => setTimeout(resolve, 350));

      expect(state.shakingTaskDetailModalId).toBeNull();
    });
  });
});
