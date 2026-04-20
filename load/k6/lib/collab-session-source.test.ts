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

  it("defines MESSAGE_SYNC and MESSAGE_AWARENESS constants", () => {
    expect(src).toContain("const MESSAGE_SYNC");
    expect(src).toContain("const MESSAGE_AWARENESS");
  });

  it("defines encodeSyncStep1 and encodeSyncUpdate functions", () => {
    expect(src).toContain("function encodeSyncStep1");
    expect(src).toContain("function encodeSyncUpdate");
  });

  it("defines CollabSession interface with required methods", () => {
    expect(src).toContain("interface CollabSession");
    expect(src).toContain("sendSyncUpdate: (updateSeed: number) => boolean");
    expect(src).toContain("sendAwarenessUpdate: (cursor:");
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
    expect(src).toContain("encodeSyncStep1");
    expect(src).toContain("socket.sendBinary");
  });

  it("sets up periodic ping at 30 second intervals", () => {
    expect(src).toContain("socket.setInterval");
    expect(src).toContain("30_000");
    expect(src).toContain("MESSAGE_SYNC");
  });

  it("tracks disconnect and error events", () => {
    expect(src).toContain('"close"');
    expect(src).toContain('"error"');
    expect(src).toContain("wsDisconnectCount.add(1)");
    expect(src).toContain("wsMessageFailures.add(1)");
  });

  it("sendSyncUpdate wraps payload in try-catch", () => {
    const idx = src.indexOf("sendSyncUpdate =");
    expect(idx).not.toBe(-1);
    const sendSyncBlock = src.slice(idx);
    expect(sendSyncBlock).toContain("try {");
    expect(sendSyncBlock).toContain("catch {");
    expect(sendSyncBlock).toContain("return true");
    expect(sendSyncBlock).toContain("return false");
  });

  it("sendSyncUpdate generates update and encodes it", () => {
    const idx = src.indexOf("sendSyncUpdate =");
    expect(idx).not.toBe(-1);
    const sendSyncBlock = src.slice(idx);
    expect(sendSyncBlock).toContain("generateFakeYjsUpdate");
    expect(sendSyncBlock).toContain("encodeSyncUpdate");
    expect(sendSyncBlock).toContain("socket.sendBinary");
  });

  it("sendAwarenessUpdate wraps payload in try-catch", () => {
    const idx = src.indexOf("sendAwarenessUpdate =");
    expect(idx).not.toBe(-1);
    const sendAwareBlock = src.slice(idx);
    expect(sendAwareBlock).toContain("try {");
    expect(sendAwareBlock).toContain("catch {");
  });

  it("disconnect closes socket", () => {
    const idx = src.indexOf("disconnect =");
    expect(idx).not.toBe(-1);
    const disconnectBlock = src.slice(idx);
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
