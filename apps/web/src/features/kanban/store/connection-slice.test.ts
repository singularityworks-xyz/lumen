import { beforeEach, describe, expect, it, mock } from "bun:test";

let nanoidCounter = 0;
mock.module("nanoid", () => ({
  nanoid: () => `seq${++nanoidCounter}`,
}));

import {
  addBoardToState,
  createFreshState,
} from "@tests/helpers/store-harness";
import { createConnectionSlice } from "./slices/connection-slice";
import type { KanbanStore } from "./types";

let state: KanbanStore;
let actions: ReturnType<typeof createConnectionSlice>;

beforeEach(() => {
  nanoidCounter = 0;
  state = createFreshState() as KanbanStore;
  const set: (fn: (s: KanbanStore) => void) => void = (fn) => fn(state);
  const get: () => KanbanStore = () => state;
  actions = createConnectionSlice(set, get);
});

describe("connection-slice", () => {
  describe("addConnection", () => {
    it("rejects self-loops and returns null", () => {
      const { boardId } = addBoardToState(state);

      const result = actions.addConnection(boardId, boardId);

      expect(result).toBeNull();
      expect(state.boardConnections.allIds).toHaveLength(0);
    });

    it("rejects duplicate source-target pairs and returns null", () => {
      const { boardId: source } = addBoardToState(state);
      const { boardId: target } = addBoardToState(state);

      const first = actions.addConnection(source, target);
      const second = actions.addConnection(source, target);

      expect(first).not.toBeNull();
      expect(second).toBeNull();
      expect(state.boardConnections.allIds).toHaveLength(1);
    });

    it("creates connection with valid source and target", () => {
      const { boardId: source } = addBoardToState(state);
      const { boardId: target } = addBoardToState(state);

      const connId = actions.addConnection(source, target, {
        label: "depends on",
        lineStyle: "dotted",
        sourceHandle: "right",
        targetHandle: "left",
        showArrow: false,
      });

      expect(connId).toBe("conn_seq2");
      expect(state.boardConnections.allIds).toContain(connId!);

      const conn = state.boardConnections.byId[connId!]!;
      expect(conn).toBeDefined();
      expect(conn.source_board_id).toBe(source);
      expect(conn.target_board_id).toBe(target);
      expect(conn.label).toBe("depends on");
      expect(conn.lineStyle).toBe("dotted");
      expect(conn.sourceHandle).toBe("right");
      expect(conn.targetHandle).toBe("left");
      expect(conn.showArrow).toBe(false);
    });

    it("uses default handle and style when none provided", () => {
      const { boardId: source } = addBoardToState(state);
      const { boardId: target } = addBoardToState(state);

      const connId = actions.addConnection(source, target);

      const conn = state.boardConnections.byId[connId!]!;
      expect(conn.lineStyle).toBe("solid");
      expect(conn.sourceHandle).toBe("bottom");
      expect(conn.targetHandle).toBe("top");
      expect(conn.showArrow).toBe(true);
      expect(conn.label).toBeUndefined();
    });
  });

  describe("removeConnection", () => {
    it("removes only the target connection from store", () => {
      const { boardId: source } = addBoardToState(state);
      const { boardId: target1 } = addBoardToState(state);
      const { boardId: target2 } = addBoardToState(state);

      const conn1 = actions.addConnection(source, target1);
      const conn2 = actions.addConnection(source, target2);

      actions.removeConnection(conn1 ?? "");

      expect(state.boardConnections.byId[conn1!]).toBeUndefined();
      expect(state.boardConnections.allIds).not.toContain(conn1);
      expect(state.boardConnections.byId[conn2!]).toBeDefined();
      expect(state.boardConnections.allIds).toContain(conn2!);
    });

    it("does nothing when connection does not exist", () => {
      actions.removeConnection("nonexistent");

      expect(state.boardConnections.allIds).toHaveLength(0);
    });
  });

  describe("updateConnection", () => {
    it("modifies specific fields on an existing connection", () => {
      const { boardId: source } = addBoardToState(state);
      const { boardId: target } = addBoardToState(state);

      const connId = actions.addConnection(source, target);

      actions.updateConnection(connId ?? "", {
        label: "blocks",
        sourceHandle: "left",
        showArrow: false,
      });

      const conn = state.boardConnections.byId[connId!]!;
      expect(conn.label).toBe("blocks");
      expect(conn.sourceHandle).toBe("left");
      expect(conn.showArrow).toBe(false);
      expect(conn.lineStyle).toBe("solid");
    });

    it("does nothing when connection does not exist", () => {
      actions.updateConnection("nonexistent", { label: "test" });

      expect(state.boardConnections.allIds).toHaveLength(0);
    });
  });

  describe("toggleConnectionLineStyle", () => {
    it("flips between solid and dotted", () => {
      const { boardId: source } = addBoardToState(state);
      const { boardId: target } = addBoardToState(state);

      const connId = actions.addConnection(source, target);
      expect(state.boardConnections.byId[connId!]!.lineStyle).toBe("solid");

      actions.toggleConnectionLineStyle(connId ?? "");
      expect(state.boardConnections.byId[connId!]!.lineStyle).toBe("dotted");

      actions.toggleConnectionLineStyle(connId ?? "");
      expect(state.boardConnections.byId[connId!]!.lineStyle).toBe("solid");
    });

    it("does nothing when connection does not exist", () => {
      actions.toggleConnectionLineStyle("nonexistent");

      expect(state.boardConnections.allIds).toHaveLength(0);
    });
  });

  describe("getConnectionsByBoardId", () => {
    it("returns inbound and outbound connections", () => {
      const { boardId: boardA } = addBoardToState(state);
      const { boardId: boardB } = addBoardToState(state);
      const { boardId: boardC } = addBoardToState(state);

      actions.addConnection(boardA, boardB);
      actions.addConnection(boardC, boardA);

      const conns = actions.getConnectionsByBoardId(boardA);

      expect(conns).toHaveLength(2);
      const sources = conns.map((c) => c.source_board_id);
      const targets = conns.map((c) => c.target_board_id);
      expect(sources).toContain(boardA);
      expect(targets).toContain(boardA);
    });

    it("returns empty array when no connections exist for board", () => {
      const { boardId } = addBoardToState(state);

      const conns = actions.getConnectionsByBoardId(boardId);

      expect(conns).toHaveLength(0);
    });
  });
});
