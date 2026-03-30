import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const LIB_DIR = join(import.meta.dir);

function readSource(path: string): string {
  return readFileSync(join(LIB_DIR, path), "utf-8");
}

describe("collab-session.ts structure", () => {
  const src = readSource("collab-session.ts");

  it("exports connectCollabSession function", () => {
    expect(src).toContain("export function connectCollabSession");
  });

  it("accepts url, token, and workspaceId parameters", () => {
    expect(src).toContain("url: string");
    expect(src).toContain("token: string");
    expect(src).toContain("workspaceId: string");
  });

  it("returns CollabSession type", () => {
    expect(src).toContain(": CollabSession");
  });

  it("builds websocket URL correctly", () => {
    expect(src).toContain("/ws/collab/");
    expect(src).toContain("?token=");
  });

  it("defines SyncData interface with ops array", () => {
    expect(src).toContain("interface SyncData");
    expect(src).toContain("ops: Array<{");
    expect(src).toContain("type: string;");
    expect(src).toContain("path: string;");
    expect(src).toContain("value: string;");
    expect(src).toContain("clock: number;");
    expect(src).toContain("origin: string;");
  });

  it("defines AwarenessData interface", () => {
    expect(src).toContain("interface AwarenessData");
    expect(src).toContain("user: string;");
    expect(src).toContain("cursor: { line: number; col: number };");
    expect(src).toContain("lastSeen: number;");
  });

  it("defines CollabSession interface with required methods", () => {
    expect(src).toContain("interface CollabSession");
    expect(src).toContain("sendSyncUpdate: (data: SyncData) => boolean");
    expect(src).toContain("sendAwarenessUpdate: (data: AwarenessData) => boolean");
    expect(src).toContain("disconnect: () => void");
    expect(src).toContain("established: boolean");
  });

  it("initializes session with defaults before connection", () => {
    expect(src).toContain("established: false");
    expect(src).toContain("sendSyncUpdate: () => false");
    expect(src).toContain("sendAwarenessUpdate: () => false");
  });

  it("measures connection duration", () => {
    expect(src).toContain("connectStart");
    expect(src).toContain("connectEnd");
    expect(src).toContain("wsConnectDuration.add(connectEnd - connectStart)");
  });

  it("validates HTTP 101 status for WebSocket upgrade", () => {
    expect(src).toContain("status !== 101");
  });

  it("sends init sync message on successful connection", () => {
    expect(src).toContain('"sync"');
    expect(src).toContain('"init"');
  });

  it("sets up periodic ping at 30 second intervals", () => {
    expect(src).toContain("setInterval");
    expect(src).toContain("30000");
    expect(src).toContain('"ping"');
  });

  it("tracks disconnect and error events", () => {
    expect(src).toContain('"close"');
    expect(src).toContain('"error"');
    expect(src).toContain("wsDisconnectCount.add(1)");
    expect(src).toContain("wsMessageFailures.add(1)");
  });

  it("sendSyncUpdate wraps payload in try-catch", () => {
    const sendSyncBlock = src.slice(src.indexOf("sendSyncUpdate ="));
    expect(sendSyncBlock).toContain("try {");
    expect(sendSyncBlock).toContain("catch {");
    expect(sendSyncBlock).toContain("return true");
    expect(sendSyncBlock).toContain("return false");
  });

  it("sendSyncUpdate includes workspaceId in payload", () => {
    const sendSyncBlock = src.slice(src.indexOf("sendSyncUpdate ="));
    expect(sendSyncBlock).toContain("workspaceId");
    expect(sendSyncBlock).toContain("timestamp: Date.now()");
  });

  it("sendAwarenessUpdate wraps payload in try-catch", () => {
    const sendAwareBlock = src.slice(src.indexOf("sendAwarenessUpdate ="));
    expect(sendAwareBlock).toContain("try {");
    expect(sendAwareBlock).toContain("catch {");
  });

  it("disconnect sends disconnect message then closes socket", () => {
    const disconnectBlock = src.slice(src.indexOf("disconnect ="));
    expect(disconnectBlock).toContain('"disconnect"');
    expect(disconnectBlock).toContain("socket.close()");
  });

  it("imports k6/ws and k6/metrics", () => {
    expect(src).toContain('import ws from "k6/ws"');
    expect(src).toContain('from "k6/metrics"');
  });

  it("defines 4 custom metrics", () => {
    expect(src).toContain("ws_connect_success");
    expect(src).toContain("ws_connect_duration");
    expect(src).toContain("ws_disconnect_count");
    expect(src).toContain("ws_message_failures");
  });
});
