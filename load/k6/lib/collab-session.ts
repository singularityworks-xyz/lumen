import ws from "k6/ws";
import { Counter, Trend, Rate } from "k6/metrics";

const wsConnectSuccess = new Rate("ws_connect_success");
const wsConnectDuration = new Trend("ws_connect_duration");
const wsDisconnectCount = new Counter("ws_disconnect_count");
const wsMessageFailures = new Counter("ws_message_failures");
const wsSyncMessagesSent = new Counter("ws_sync_messages_sent");
const wsSyncMessagesReceived = new Counter("ws_sync_messages_received");
const wsAwarenessSent = new Counter("ws_awareness_sent");
const wsAwarenessReceived = new Counter("ws_awareness_received");

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

const SYNC_STEP1 = 0;
const SYNC_STEP2 = 1;
const SYNC_UPDATE = 2;

declare global {
  const __ENV: {
    WS_URL?: string;
    AUTH_TOKEN?: string;
    SOAK_DURATION_MINUTES?: string;
    WORKSPACE_ID?: string;
    AI_BASE_URL?: string;
    COHORT_SIZE?: string;
    ROUNDS?: string;
    RECONNECT_DELAY?: string;
  };
  const __VU: number;
}

class BinaryEncoder {
  private parts: Uint8Array[] = [];
  private length = 0;

  writeVarUint(value: number): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Cannot encode non-integer or negative varuint");
    }
    if (value > Number.MAX_SAFE_INTEGER) {
      throw new Error("Cannot encode value larger than MAX_SAFE_INTEGER as varuint");
    }
    const bytes: number[] = [];
    while (value > 0x7f) {
      bytes.push((value & 0x7f) | 0x80);
      value >>>= 7;
    }
    bytes.push(value & 0x7f);
    const buf = new Uint8Array(bytes);
    this.parts.push(buf);
    this.length += buf.byteLength;
  }

  writeVarUint8Array(data: Uint8Array): void {
    this.writeVarUint(data.byteLength);
    this.parts.push(data);
    this.length += data.byteLength;
  }

  toUint8Array(): Uint8Array {
    const result = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      result.set(part, offset);
      offset += part.byteLength;
    }
    return result;
  }

  getLength(): number {
    return this.length;
  }
}

class BinaryDecoder {
  private view: DataView;
  private pos = 0;
  private bytes: Uint8Array;

  constructor(data: Uint8Array) {
    this.bytes = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  readVarUint(): number {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (this.pos >= this.bytes.length) {
        throw new Error("BinaryDecoder: unexpected end of data");
      }
      if (shift >= 35) {
        throw new Error("BinaryDecoder: varUint too long/malformed");
      }
      byte = this.view.getUint8(this.pos++);
      result |= (byte & 0x7f) << shift;
      shift += 7;
    } while ((byte & 0x80) !== 0);
    return result >>> 0;
  }

  readVarUint8Array(): Uint8Array {
    const len = this.readVarUint();
    if (this.pos + len > this.bytes.length) {
      throw new Error("BinaryDecoder: not enough data for uint8array");
    }
    const result = this.bytes.slice(this.pos, this.pos + len);
    this.pos += len;
    return result;
  }

  peekVarUint(): number {
    const saved = this.pos;
    const val = this.readVarUint();
    this.pos = saved;
    return val;
  }

  hasContent(): boolean {
    return this.pos < this.bytes.length;
  }
}

function encodeStateVector(): Uint8Array {
  const encoder = new BinaryEncoder();
  encoder.writeVarUint(0);
  return encoder.toUint8Array();
}

function encodeSyncStep1(): Uint8Array {
  const encoder = new BinaryEncoder();
  encoder.writeVarUint(MESSAGE_SYNC);
  encoder.writeVarUint(SYNC_STEP1);
  const sv = encodeStateVector();
  encoder.writeVarUint8Array(sv);
  return encoder.toUint8Array();
}

function encodeSyncStep2(update: Uint8Array): Uint8Array {
  const encoder = new BinaryEncoder();
  encoder.writeVarUint(MESSAGE_SYNC);
  encoder.writeVarUint(SYNC_STEP2);
  encoder.writeVarUint8Array(update);
  return encoder.toUint8Array();
}

function encodeSyncUpdate(update: Uint8Array): Uint8Array {
  const encoder = new BinaryEncoder();
  encoder.writeVarUint(MESSAGE_SYNC);
  encoder.writeVarUint(SYNC_UPDATE);
  encoder.writeVarUint8Array(update);
  return encoder.toUint8Array();
}

function encodeAwarenessUpdate(
  clientId: number,
  state: Record<string, unknown>
): Uint8Array {
  const encoder = new BinaryEncoder();
  encoder.writeVarUint(MESSAGE_AWARENESS);

  const inner = new BinaryEncoder();
  inner.writeVarUint(1);
  inner.writeVarUint(clientId);
  const clock = 1;
  inner.writeVarUint(clock);
  const stateStr = JSON.stringify(state);
  const stateBytes = new TextEncoder().encode(stateStr);
  inner.writeVarUint8Array(stateBytes);

  const innerData = inner.toUint8Array();
  encoder.writeVarUint8Array(innerData);
  return encoder.toUint8Array();
}

function decodeServerMessage(
  data: Uint8Array
): { type: number; syncType?: number; raw: Uint8Array } | null {
  try {
    const decoder = new BinaryDecoder(data);
    const msgType = decoder.readVarUint();
    if (msgType === MESSAGE_SYNC) {
      const syncType = decoder.hasContent() ? decoder.readVarUint() : -1;
      return { type: MESSAGE_SYNC, syncType, raw: data };
    }
    if (msgType === MESSAGE_AWARENESS) {
      return { type: MESSAGE_AWARENESS, raw: data };
    }
    return { type: msgType, raw: data };
  } catch {
    return null;
  }
}

function generateFakeYjsUpdate(seed: number): Uint8Array {
  const encoder = new BinaryEncoder();
  encoder.writeVarUint(1);
  encoder.writeVarUint(seed);
  encoder.writeVarUint(1);
  const payload = new TextEncoder().encode(`update-${seed}-${Date.now()}`);
  encoder.writeVarUint8Array(payload);
  return encoder.toUint8Array();
}

export interface CollabSession {
  response: ws.Response | null;
  workspaceId: string;
  token: string;
  connectStart: number;
  established: boolean;
  receivedSyncStep2: boolean;
  receivedAwareness: boolean;
  receivedUpdates: number;
  sentMessages: number;
  lastMessageTime: number;
  sendSyncUpdate: (updateSeed: number) => boolean;
  sendAwarenessUpdate: (cursor: {
    x: number;
    y: number;
    user: string;
  }) => boolean;
  disconnect: () => void;
}

export interface CollabMetrics {
  totalConnections: number;
  totalSyncMessages: number;
  totalAwarenessMessages: number;
  averageLatency: number;
}

export function connectCollabSession(
  url: string,
  token: string,
  workspaceId: string
): CollabSession {
  const fullUrl = `${url}/ws/collab/${workspaceId}?token=${token}`;
  const connectStart = Date.now();

  const session: CollabSession = {
    response: null,
    workspaceId,
    token,
    connectStart,
    established: false,
    receivedSyncStep2: false,
    receivedAwareness: false,
    receivedUpdates: 0,
    sentMessages: 0,
    lastMessageTime: Date.now(),
    sendSyncUpdate: () => false,
    sendAwarenessUpdate: () => false,
    disconnect: () => {},
  };

  const resp = ws.connect(fullUrl, {}, function (socket) {
    const connectEnd = Date.now();
    wsConnectDuration.add(connectEnd - connectStart);

    if (resp.status !== 101) {
      wsConnectSuccess.add(false);
      return;
    }

    wsConnectSuccess.add(true);
    session.established = true;

    const syncStep1 = encodeSyncStep1();
    socket.sendBinary(syncStep1.buffer);
    wsSyncMessagesSent.add(1);

    socket.setInterval(function () {
      const pingEncoder = new BinaryEncoder();
      pingEncoder.writeVarUint(MESSAGE_SYNC);
      pingEncoder.writeVarUint(0);
      const pingData = pingEncoder.toUint8Array();
      socket.sendBinary(pingData.buffer);
    }, 30000);

    socket.on("binaryMessage", function (data: ArrayBuffer) {
      const msg = decodeServerMessage(new Uint8Array(data));
      if (!msg) {
        return;
      }

      if (msg.type === MESSAGE_SYNC) {
        wsSyncMessagesReceived.add(1);
        if (msg.syncType === SYNC_STEP2) {
          session.receivedSyncStep2 = true;
        } else if (msg.syncType === SYNC_UPDATE) {
          session.receivedUpdates++;
        }
      } else if (msg.type === MESSAGE_AWARENESS) {
        wsAwarenessReceived.add(1);
        session.receivedAwareness = true;
      }
    });

    socket.on("close", function () {
      wsDisconnectCount.add(1);
    });

    socket.on("error", function () {
      wsMessageFailures.add(1);
    });

    session.sendSyncUpdate = (updateSeed: number): boolean => {
      try {
        const update = generateFakeYjsUpdate(updateSeed);
        const msg = encodeSyncUpdate(update);
        socket.sendBinary(msg.buffer);
        wsSyncMessagesSent.add(1);
        session.sentMessages++;
        session.lastMessageTime = Date.now();
        return true;
      } catch {
        wsMessageFailures.add(1);
        return false;
      }
    };

    session.sendAwarenessUpdate = (cursor: {
      x: number;
      y: number;
      user: string;
    }): boolean => {
      try {
        const state = {
          user: { name: cursor.user, color: `hsl(${__VU * 37}, 70%, 50%)` },
          cursor: { x: cursor.x, y: cursor.y },
        };
        const msg = encodeAwarenessUpdate(__VU, state);
        socket.sendBinary(msg.buffer);
        wsAwarenessSent.add(1);
        session.sentMessages++;
        session.lastMessageTime = Date.now();
        return true;
      } catch {
        wsMessageFailures.add(1);
        return false;
      }
    };

    session.disconnect = () => {
      try {
        socket.close();
      } catch {
        wsMessageFailures.add(1);
      }
    };
  });

  return session;
}
