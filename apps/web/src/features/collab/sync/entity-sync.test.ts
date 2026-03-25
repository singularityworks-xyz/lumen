import { describe, expect, it } from "bun:test";
import * as Y from "yjs";
import { z } from "zod";
import type { EntityMap } from "@/src/features/kanban/types";
import { createEntitySync, YJS_MAP_NAMES } from "./entity-sync";

const TestEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.number(),
});

interface TestEntity {
  id: string;
  name: string;
  value: number;
}

describe("entity-sync", () => {
  describe("applyFromYjs", () => {
    it("skips invalid Yjs entities", () => {
      const sync = createEntitySync<TestEntity>({
        entityName: "test",
        mapName: YJS_MAP_NAMES.TASKS,
        schema: TestEntitySchema,
      });

      const doc = new Y.Doc();
      const map = doc.getMap(YJS_MAP_NAMES.TASKS);

      map.set("valid-1", { id: "valid-1", name: "valid", value: 1 });
      map.set("invalid-1", { id: "invalid-1", name: 123 } as never);
      map.set("invalid-2", { id: "invalid-2" } as never);
      map.set("valid-2", { id: "valid-2", name: "also valid", value: 2 });

      const result = sync.applyFromYjs(map);

      expect(result.allIds).toEqual(["valid-1", "valid-2"]);
      expect(result.byId["valid-1"]).toEqual({
        id: "valid-1",
        name: "valid",
        value: 1,
      });
      expect(result.byId["valid-2"]).toEqual({
        id: "valid-2",
        name: "also valid",
        value: 2,
      });
      expect(result.byId["invalid-1"]).toBeUndefined();
      expect(result.byId["invalid-2"]).toBeUndefined();
    });
  });

  describe("batchSetInYjs", () => {
    it("writes expected map content", () => {
      const sync = createEntitySync<TestEntity>({
        entityName: "test",
        mapName: "testMap",
        schema: TestEntitySchema,
      });

      const doc = new Y.Doc();
      const entities: TestEntity[] = [
        { id: "batch-1", name: "first", value: 10 },
        { id: "batch-2", name: "second", value: 20 },
        { id: "batch-3", name: "third", value: 30 },
      ];

      sync.batchSetInYjs(doc, entities);

      const map = doc.getMap("testMap");
      expect(map.size).toBe(3);
      expect(map.get("batch-1")).toEqual({
        id: "batch-1",
        name: "first",
        value: 10,
      });
      expect(map.get("batch-2")).toEqual({
        id: "batch-2",
        name: "second",
        value: 20,
      });
      expect(map.get("batch-3")).toEqual({
        id: "batch-3",
        name: "third",
        value: 30,
      });
    });

    it("does nothing for empty array", () => {
      const sync = createEntitySync<TestEntity>({
        entityName: "test",
        mapName: "testMap",
        schema: TestEntitySchema,
      });

      const doc = new Y.Doc();
      sync.batchSetInYjs(doc, []);

      const map = doc.getMap("testMap");
      expect(map.size).toBe(0);
    });
  });

  describe("setInYjs", () => {
    it("writes expected map content", () => {
      const sync = createEntitySync<TestEntity>({
        entityName: "test",
        mapName: "testMap",
        schema: TestEntitySchema,
      });

      const doc = new Y.Doc();
      const entity: TestEntity = { id: "single-1", name: "single", value: 99 };

      sync.setInYjs(doc, entity);

      const map = doc.getMap("testMap");
      expect(map.size).toBe(1);
      expect(map.get("single-1")).toEqual(entity);
    });
  });

  describe("deleteFromYjs", () => {
    it("writes expected map content", () => {
      const sync = createEntitySync<TestEntity>({
        entityName: "test",
        mapName: "testMap",
        schema: TestEntitySchema,
      });

      const doc = new Y.Doc();
      const map = doc.getMap("testMap");
      map.set("to-delete", { id: "to-delete", name: "delete me", value: 1 });
      map.set("to-keep", { id: "to-keep", name: "keep me", value: 2 });

      sync.deleteFromYjs(doc, "to-delete");

      expect(map.size).toBe(1);
      expect(map.get("to-delete")).toBeUndefined();
      expect(map.get("to-keep")).toEqual({
        id: "to-keep",
        name: "keep me",
        value: 2,
      });
    });
  });

  describe("initializeYjs", () => {
    it("writes expected map content", () => {
      const sync = createEntitySync<TestEntity>({
        entityName: "test",
        mapName: "testMap",
        schema: TestEntitySchema,
      });

      const doc = new Y.Doc();
      const entityMap: EntityMap<TestEntity> = {
        byId: {
          "init-1": { id: "init-1", name: "init first", value: 1 },
          "init-2": { id: "init-2", name: "init second", value: 2 },
        },
        allIds: ["init-1", "init-2"],
      };

      sync.initializeYjs(doc, entityMap);

      const map = doc.getMap("testMap");
      expect(map.size).toBe(2);
      expect(map.get("init-1")).toEqual(entityMap.byId["init-1"]);
      expect(map.get("init-2")).toEqual(entityMap.byId["init-2"]);
    });

    it("does not overwrite non-empty maps", () => {
      const sync = createEntitySync<TestEntity>({
        entityName: "test",
        mapName: "testMap",
        schema: TestEntitySchema,
      });

      const doc = new Y.Doc();
      const map = doc.getMap("testMap");
      map.set("existing", {
        id: "existing",
        name: "already there",
        value: 999,
      });

      const entityMap: EntityMap<TestEntity> = {
        byId: { "new-1": { id: "new-1", name: "new", value: 1 } },
        allIds: ["new-1"],
      };

      sync.initializeYjs(doc, entityMap);

      expect(map.size).toBe(1);
      expect(map.get("existing")).toEqual({
        id: "existing",
        name: "already there",
        value: 999,
      });
      expect(map.get("new-1")).toBeUndefined();
    });

    it("does nothing for empty entity map", () => {
      const sync = createEntitySync<TestEntity>({
        entityName: "test",
        mapName: "testMap",
        schema: TestEntitySchema,
      });

      const doc = new Y.Doc();
      const entityMap: EntityMap<TestEntity> = { byId: {}, allIds: [] };

      sync.initializeYjs(doc, entityMap);

      const map = doc.getMap("testMap");
      expect(map.size).toBe(0);
    });
  });
});
