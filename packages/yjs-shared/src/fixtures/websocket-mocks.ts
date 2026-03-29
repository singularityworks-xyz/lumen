/** biome-ignore-all lint/performance/noNamespaceImport: lib0 requires namespace import */
import { type Mock, mock } from "bun:test";
import * as encoding from "lib0/encoding";
import {
  MESSAGE_AWARENESS,
  MESSAGE_SYNC,
  MESSAGE_WORKSPACE_DELETED,
} from "../index";

export interface MockWebSocket {
  close: Mock<() => void>;
  sent: Uint8Array[];
  ws: {
    close: Mock<() => void>;
    send: (data: Uint8Array) => void;
  };
}

export function createMockWebSocket(): MockWebSocket {
  const sent: Uint8Array[] = [];
  return {
    ws: {
      send: (data: Uint8Array) => {
        sent.push(data);
      },
      close: mock(),
    },
    sent,
    close: mock(),
  };
}

export interface MockUser {
  color: string;
  email: string;
  id: string;
  name: string;
  role: "ADMIN" | "EDITOR" | "OWNER" | "VIEWER";
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-mock-1",
    role: "EDITOR",
    name: "Mock User",
    email: "mock@test.com",
    color: "#ef4444",
    ...overrides,
  };
}

export function buildSyncMessage(syncType: number): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  encoding.writeVarUint(encoder, syncType);
  return encoding.toUint8Array(encoder);
}

export function buildAwarenessMessage(payload?: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(encoder, payload ?? new Uint8Array([1, 2, 3]));
  return encoding.toUint8Array(encoder);
}

export function buildWorkspaceDeletedMessage(): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_WORKSPACE_DELETED);
  return encoding.toUint8Array(encoder);
}

export interface MockRoomConnection {
  connectionId: string;
  mockWs: MockWebSocket;
  user: MockUser;
  workspaceId: string;
}

export function createMockConnection(
  overrides: Partial<MockRoomConnection> = {}
): MockRoomConnection {
  const id =
    overrides.connectionId ??
    `conn-mock-${Math.random().toString(36).slice(2, 8)}`;
  return {
    connectionId: id,
    user: createMockUser(),
    mockWs: createMockWebSocket(),
    workspaceId: "ws-mock-1",
    ...overrides,
  };
}

export function collectMessages(mockWs: MockWebSocket): {
  awareness: Uint8Array[];
  deleted: Uint8Array[];
  sync: Uint8Array[];
} {
  const sync: Uint8Array[] = [];
  const awareness: Uint8Array[] = [];
  const deleted: Uint8Array[] = [];

  for (const msg of mockWs.sent) {
    if (msg.byteLength === 0) {
      continue;
    }
    const type = msg[0];
    if (type === MESSAGE_SYNC) {
      sync.push(msg);
    } else if (type === MESSAGE_AWARENESS) {
      awareness.push(msg);
    } else if (type === MESSAGE_WORKSPACE_DELETED) {
      deleted.push(msg);
    }
  }

  return { sync, awareness, deleted };
}
