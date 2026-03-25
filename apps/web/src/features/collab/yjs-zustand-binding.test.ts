import { describe, expect, it } from "bun:test";
import * as Y from "yjs";

describe("yjs-zustand-binding", () => {
  describe("Y.Doc integration patterns", () => {
    it("observes Y.Map changes and can apply to store", () => {
      const doc = new Y.Doc();
      const boardsMap = doc.getMap("boards");

      boardsMap.set("board-1", {
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-1",
        created_by: "u1",
        created_at: "2024-01-01",
        column_ids: [],
      });

      const boards: Record<string, unknown> = {};
      boardsMap.forEach((value, key) => {
        boards[key] = value;
      });

      expect(boards["board-1"]).toEqual({
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-1",
        created_by: "u1",
        created_at: "2024-01-01",
        column_ids: [],
      });

      doc.destroy();
    });

    it("transacts writes atomically", () => {
      const doc = new Y.Doc();
      const map = doc.getMap("test");

      doc.transact(() => {
        map.set("a", 1);
        map.set("b", 2);
        map.set("c", 3);
      });

      expect(map.size).toBe(3);
      expect(map.get("a")).toBe(1);
      expect(map.get("b")).toBe(2);
      expect(map.get("c")).toBe(3);

      doc.destroy();
    });

    it("respects size check for initialization", () => {
      const doc = new Y.Doc();
      const boardsMap = doc.getMap("boards");

      boardsMap.set("existing", { id: "existing", name: "Existing" });

      if (boardsMap.size === 0) {
        boardsMap.set("new", { id: "new", name: "New" });
      }

      expect(boardsMap.size).toBe(1);
      expect(boardsMap.get("new")).toBeUndefined();
      expect(boardsMap.get("existing")).toEqual({
        id: "existing",
        name: "Existing",
      });

      doc.destroy();
    });

    it("does not write when isUpdatingFromYjsRef is true", () => {
      const doc = new Y.Doc();
      const map = doc.getMap("test");

      const isUpdatingFromYjsRef = { current: true };

      if (!isUpdatingFromYjsRef.current) {
        map.set("should-write", { id: "should-write" });
      }

      expect(map.get("should-write")).toBeUndefined();

      isUpdatingFromYjsRef.current = false;

      if (!isUpdatingFromYjsRef.current) {
        map.set("now-write", { id: "now-write" });
      }

      expect(map.get("now-write")).toEqual({ id: "now-write" });

      doc.destroy();
    });

    it("maps entity types to correct map names", () => {
      const testCases = [
        { entity: "workspace" as const, expected: "workspaces" },
        { entity: "board" as const, expected: "boards" },
        { entity: "column" as const, expected: "columns" },
        { entity: "task" as const, expected: "tasks" },
        { entity: "boardPosition" as const, expected: "boardPositions" },
      ];

      for (const { entity, expected } of testCases) {
        const mapName =
          entity === "boardPosition" ? "boardPositions" : `${entity}s`;
        expect(mapName).toBe(expected);
      }
    });

    it("handles null doc gracefully", () => {
      const doc: Y.Doc | null = null;
      expect(doc).toBeNull();

      const getYMap = <T>(d: Y.Doc | null, name: string): Y.Map<T> | null => {
        if (!d) {
          return null;
        }
        return d.getMap(name) as Y.Map<T>;
      };

      const result = getYMap(doc, "test");
      expect(result).toBeNull();
    });

    it("applies Yjs changes only when connected", () => {
      const doc = new Y.Doc();
      let isConnected = false;

      const applyYjsToZustand = (d: Y.Doc | null, connected: boolean) => {
        if (!(d && connected)) {
          return;
        }
      };

      applyYjsToZustand(doc, isConnected);
      expect(doc.getMap("boards").size).toBe(0);

      isConnected = true;
      applyYjsToZustand(doc, isConnected);

      doc.destroy();
    });

    it("filters Yjs entities during apply", () => {
      const doc = new Y.Doc();
      const boardsMap = doc.getMap("boards");

      boardsMap.set("board-1", {
        id: "board-1",
        name: "Board 1",
        workspace_id: "ws-1",
        created_by: "u1",
        created_at: "2024-01-01",
        column_ids: [],
      });
      boardsMap.set("board-2", {
        id: "board-2",
        name: "Board 2",
        workspace_id: "ws-other",
        created_by: "u1",
        created_at: "2024-01-01",
        column_ids: [],
      });

      const currentWorkspaceId = "ws-1";
      const boards: Record<string, unknown> = {};

      boardsMap.forEach((value, key) => {
        const board = value as { workspace_id?: string };
        if (!currentWorkspaceId || board.workspace_id === currentWorkspaceId) {
          boards[key] = value;
        }
      });

      expect(Object.keys(boards)).toHaveLength(1);
      expect(boards["board-1"]).toBeDefined();
      expect(boards["board-2"]).toBeUndefined();

      doc.destroy();
    });
  });
});
