import { createLogger } from "@lumen/logger";
import type * as Y from "yjs";
import type { z } from "zod";
import { validateEntity } from "@/src/features/collab/validation/schema";
import type { EntityMap } from "@/src/features/kanban/types";

const logger = createLogger({ name: "collab:entity-sync" });

// Generic entity synchronization helper.
// Provides type-safe bidirectional sync between Y.Map and EntityMap.
export type EntitySyncOptions<T extends { id: string }> = {
  mapName: string;
  schema: z.ZodType<T>;
  entityName: string;
};

export type EntitySync<T extends { id: string }> = {
  // Apply Y.Map data to EntityMap (Yjs -> Zustand)
  applyFromYjs: (yMap: Y.Map<unknown>) => EntityMap<T>;
  // Set a single entity in Y.Map (Zustand -> Yjs)
  setInYjs: (doc: Y.Doc, entity: T) => void;
  // Delete an entity from Y.Map (Zustand -> Yjs)
  deleteFromYjs: (doc: Y.Doc, id: string) => void;
  // Batch set multiple entities (Zustand -> Yjs)
  batchSetInYjs: (doc: Y.Doc, entities: T[]) => void;
  // Initialize Y.Map from EntityMap if empty
  initializeYjs: (doc: Y.Doc, entityMap: EntityMap<T>) => void;
};

export function createEntitySync<T extends { id: string }>(
  options: EntitySyncOptions<T>
): EntitySync<T> {
  const { mapName, schema, entityName } = options;

  return {
    applyFromYjs(yMap: Y.Map<unknown>): EntityMap<T> {
      const byId: Record<string, T> = {};
      let validCount = 0;
      let invalidCount = 0;

      yMap.forEach((value, key) => {
        const result = validateEntity(schema, value);
        if (result.success) {
          byId[key] = result.data;
          validCount += 1;
        } else {
          invalidCount += 1;
          logger.warn(`Invalid ${entityName} from Yjs`, {
            id: key,
            errors: result.error.issues.map((i) => i.message).join(", "),
          });
        }
      });

      if (invalidCount > 0) {
        logger.warn(`Skipped invalid ${entityName}s during sync`, {
          valid: validCount,
          invalid: invalidCount,
        });
      }

      return {
        byId,
        allIds: Object.keys(byId),
      };
    },

    setInYjs(doc: Y.Doc, entity: T): void {
      const map = doc.getMap(mapName);
      doc.transact(() => {
        map.set(entity.id, entity as unknown);
      });
    },

    deleteFromYjs(doc: Y.Doc, id: string): void {
      const map = doc.getMap(mapName);
      doc.transact(() => {
        map.delete(id);
      });
    },

    batchSetInYjs(doc: Y.Doc, entities: T[]): void {
      if (entities.length === 0) {
        return;
      }

      const map = doc.getMap(mapName);
      doc.transact(() => {
        for (const entity of entities) {
          map.set(entity.id, entity as unknown);
        }
      });
    },

    initializeYjs(doc: Y.Doc, entityMap: EntityMap<T>): void {
      const map = doc.getMap(mapName);
      if (map.size > 0) {
        // Y.Map already has data, don't overwrite
        return;
      }

      const entities = Object.values(entityMap.byId);
      if (entities.length === 0) {
        return;
      }

      doc.transact(() => {
        for (const entity of entities) {
          map.set(entity.id, entity as unknown);
        }
      });

      logger.info(
        `Initialized Yjs ${mapName} with ${entities.length} ${entityName}s`
      );
    },
  };
}

export const YJS_MAP_NAMES = {
  WORKSPACE: "workspace",
  BOARDS: "boards",
  COLUMNS: "columns",
  TASKS: "tasks",
  BOARD_POSITIONS: "boardPositions",
  BOARD_CONNECTIONS: "boardConnections",
  AREAS: "areas",
  AREA_POSITIONS: "areaPositions",
  AREA_DIALOGS: "areaDialogs",
  CANVAS: "canvas",
  BOARD_QUICK_ACTIONS: "boardQuickActions",
  BOARD_DIALOGS: "boardDialogs",
  CONNECTION_DIALOGS: "connectionDialogs",
  CREATE_TASK_MODALS: "createTaskModals",
  COLUMN_QUICK_ACTIONS: "columnQuickActions",
  COLUMN_DIALOGS: "columnDialogs",
  TASK_QUICK_ACTIONS: "taskQuickActions",
  TASK_DETAIL_MODALS: "taskDetailModals",
  AREA_DRAG_ORIGINS: "areaDragOrigins",
} as const;

export type YjsMapName = (typeof YJS_MAP_NAMES)[keyof typeof YJS_MAP_NAMES];
