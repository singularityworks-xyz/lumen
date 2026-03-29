/** biome-ignore-all lint/performance/noNamespaceImport: lib0/yjs require namespace imports */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as encoding from "lib0/encoding";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";
import { YJS_MAP_NAMES } from "../index";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

interface K6Fixture {
  awarenessUpdates: Record<string, string>;
  description: string;
  label: string;
  syncStep1: string;
  syncStep2: Record<string, string>;
  syncUpdates: Record<string, string>;
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function buildSyncStep1(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

function buildSyncStep2(doc: Y.Doc, remoteStateVector: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep2(encoder, doc, remoteStateVector);
  return encoding.toUint8Array(encoder);
}

function buildSyncUpdate(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

function buildAwarenessMessage(
  awareness: awarenessProtocol.Awareness,
  clientIds: number[]
): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, clientIds)
  );
  return encoding.toUint8Array(encoder);
}

function createDoc(name: string): Y.Doc {
  const doc = new Y.Doc();

  doc.getMap(YJS_MAP_NAMES.BOARDS);
  doc.getMap(YJS_MAP_NAMES.COLUMNS);
  doc.getMap(YJS_MAP_NAMES.TASKS);
  doc.getMap(YJS_MAP_NAMES.BOARD_POSITIONS);
  doc.getMap(YJS_MAP_NAMES.BOARD_CONNECTIONS);
  doc.getMap(YJS_MAP_NAMES.AREAS);
  doc.getMap(YJS_MAP_NAMES.AREA_POSITIONS);
  doc.getMap(YJS_MAP_NAMES.WORKSPACE);
  doc.getMap(YJS_MAP_NAMES.COMMENTS);

  const boards = doc.getMap(YJS_MAP_NAMES.BOARDS);
  const columns = doc.getMap(YJS_MAP_NAMES.COLUMNS);
  const tasks = doc.getMap(YJS_MAP_NAMES.TASKS);

  for (let boardIndex = 0; boardIndex < 2; boardIndex++) {
    const boardId = `${name}-board-${boardIndex}`;
    boards.set(boardId, {
      id: boardId,
      name: `Board ${boardIndex}`,
      workspace_id: `ws-${name}`,
      column_ids: [`${boardId}-col-0`, `${boardId}-col-1`],
      created_by: "k6-user",
      created_at: "2024-01-01T00:00:00Z",
    });

    for (let columnIndex = 0; columnIndex < 2; columnIndex++) {
      const colId = `${boardId}-col-${columnIndex}`;
      columns.set(colId, {
        id: colId,
        board_id: boardId,
        name: `Column ${columnIndex}`,
        position: columnIndex,
        task_ids: [],
      });
    }

    for (let taskIndex = 0; taskIndex < 5; taskIndex++) {
      const taskId = `${boardId}-task-${taskIndex}`;
      const colIdx = taskIndex % 2;
      tasks.set(taskId, {
        id: taskId,
        board_id: boardId,
        column_id: `${boardId}-col-${colIdx}`,
        title: `Task ${taskIndex}`,
        priority: "medium",
        progress: 0,
        position: taskIndex,
        status: "todo",
        created_by: "k6-user",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      });
    }
  }

  return doc;
}

function generateFixture(
  label: string,
  description: string,
  updateCount: number
): K6Fixture {
  const doc = createDoc(label);
  const remoteDoc = createDoc(label);
  const awareness = new awarenessProtocol.Awareness(doc);
  const awareness2 = new awarenessProtocol.Awareness(remoteDoc);

  awareness.setLocalState({
    user: { name: "k6-user-1", color: "#ff0000" },
    cursor: { x: 100, y: 200 },
  });

  awareness2.setLocalState({
    user: { name: "k6-user-2", color: "#00ff00" },
    cursor: { x: 300, y: 400 },
  });

  const clientId1 = awareness.clientID;
  const clientId2 = awareness2.clientID;

  const syncStep1 = toBase64(buildSyncStep1(doc));

  const remoteStateVector = Y.encodeStateVector(remoteDoc);
  const syncStep2FromDoc = toBase64(buildSyncStep2(doc, remoteStateVector));
  const localStateVector = Y.encodeStateVector(doc);
  const syncStep2FromRemote = toBase64(
    buildSyncStep2(remoteDoc, localStateVector)
  );

  const syncUpdates: Record<string, string> = {};
  for (let i = 0; i < updateCount; i++) {
    const taskMap = doc.getMap(YJS_MAP_NAMES.TASKS);
    const taskKey = `${label}-board-0-task-${i % 5}`;
    const existing = taskMap.get(taskKey) as
      | Record<string, unknown>
      | undefined;
    if (existing) {
      taskMap.set(taskKey, {
        ...existing,
        title: `Updated Task ${i}`,
        progress: i * 10,
        updated_at: new Date().toISOString(),
      });
    }
    const update = Y.encodeStateAsUpdate(doc);
    syncUpdates[`update-${i}`] = toBase64(buildSyncUpdate(update));
  }

  const awarenessUpdate1 = toBase64(
    buildAwarenessMessage(awareness, [clientId1])
  );
  const awarenessUpdate2 = toBase64(
    buildAwarenessMessage(awareness2, [clientId2])
  );

  return {
    label,
    description,
    syncStep1,
    syncStep2: {
      fromDoc: syncStep2FromDoc,
      fromRemote: syncStep2FromRemote,
    },
    syncUpdates,
    awarenessUpdates: {
      client1: awarenessUpdate1,
      client2: awarenessUpdate2,
    },
  };
}

function main() {
  const projectRoot = resolve(import.meta.dirname, "..", "..", "..", "..");
  const outputDir = join(projectRoot, "load", "k6", "fixtures");
  mkdirSync(outputDir, { recursive: true });

  const small = generateFixture(
    "small",
    "Small workspace: 2 boards, 4 columns, 10 tasks, 3 updates",
    3
  );
  const medium = generateFixture(
    "medium",
    "Medium workspace: 2 boards, 4 columns, 10 tasks, 10 updates",
    10
  );
  const large = generateFixture(
    "large",
    "Large workspace: 2 boards, 4 columns, 10 tasks, 25 updates",
    25
  );

  const fixtures = { small, medium, large };

  const outputPath = join(outputDir, "collab-payloads.json");
  writeFileSync(outputPath, JSON.stringify(fixtures, null, 2));

  console.log(`Generated k6 collab fixtures at: ${outputPath}`);
  console.log(`  small: ${Object.keys(small.syncUpdates).length} sync updates`);
  console.log(
    `  medium: ${Object.keys(medium.syncUpdates).length} sync updates`
  );
  console.log(`  large: ${Object.keys(large.syncUpdates).length} sync updates`);

  const typeDefPath = join(outputDir, "collab-payloads.d.ts");
  const typeDef = `export interface CollabPayloads {
  small: K6Fixture;
  medium: K6Fixture;
  large: K6Fixture;
}

export interface K6Fixture {
  awarenessUpdates: Record<string, string>;
  description: string;
  label: string;
  syncStep1: string;
  syncStep2: Record<string, string>;
  syncUpdates: Record<string, string>;
}

declare const payloads: CollabPayloads;
export default payloads;
`;
  writeFileSync(typeDefPath, typeDef);
  console.log(`Generated type definitions at: ${typeDefPath}`);
}

main();
