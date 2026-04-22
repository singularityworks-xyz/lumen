import { sleep } from "k6";
import encoding from "k6/encoding";
import { Counter, Rate, Trend } from "k6/metrics";
import ws from "k6/ws";

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

const CONNECT_TIMEOUT_SECONDS = 5;
const DEFAULT_SESSION_LIFETIME_SECONDS = 2;

interface FixturePayloads {
  small?: {
    syncUpdates?: Record<string, string>;
  };
}

function loadSyncUpdateFixtures(): Uint8Array[] {
  try {
    const raw = open("load/k6/fixtures/collab-payloads.json") as string;
    const parsed = JSON.parse(raw) as FixturePayloads;
    const encoded = Object.values(parsed.small?.syncUpdates ?? {});

    if (encoded.length === 0) {
      return [];
    }

    return encoded.map((entry) => new Uint8Array(encoding.b64decode(entry)));
  } catch {
    return [];
  }
}

const SYNC_UPDATE_FIXTURES = loadSyncUpdateFixtures();

declare global {
  const __ENV: {
    WS_URL?: string;
    AUTH_TOKEN?: string;
    E2E_BYPASS?: string;
    E2E_BYPASS_USER_ID?: string;
    BASE_URL?: string;
    BROWSER_VUS?: string;
    CURSOR_ROUNDS?: string;
    ITERATIONS?: string;
    JOIN_LEAVE_ROUNDS?: string;
    RECONNECT_STORM_DELAY?: string;
    SOAK_DURATION_MINUTES?: string;
    STICKINESS_ROUNDS?: string;
    WORKSPACE_ID?: string;
    AI_BASE_URL?: string;
    COHORT_SIZE?: string;
    ROUNDS?: string;
    RECONNECT_DELAY?: string;
    K6_SESSION_LIFETIME_SECONDS?: string;
  };
  const __VU: number;
  const __ITER: number;
}

class BinaryEncoder {
  private readonly parts: Uint8Array[] = [];
  private length = 0;

  writeVarUint(value: number): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Cannot encode non-integer or negative varuint");
    }
    if (value > Number.MAX_SAFE_INTEGER) {
      throw new Error(
        "Cannot encode value larger than MAX_SAFE_INTEGER as varuint"
      );
    }
    const bytes: number[] = [];
    let remaining = value;
    while (remaining > 0x7f) {
      bytes.push((remaining & 0x7f) | 0x80);
      remaining >>>= 7;
    }
    bytes.push(remaining & 0x7f);
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
}

class BinaryDecoder {
  private readonly view: DataView;
  private pos = 0;
  private readonly bytes: Uint8Array;

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
  inner.writeVarUint(1);

  const stateStr = JSON.stringify(state);
  const stateBytes = new TextEncoder().encode(stateStr);
  inner.writeVarUint8Array(stateBytes);

  encoder.writeVarUint8Array(inner.toUint8Array());
  return encoder.toUint8Array();
}

function decodeServerMessage(
  data: Uint8Array
): { type: number; syncType?: number } | null {
  try {
    const decoder = new BinaryDecoder(data);
    const msgType = decoder.readVarUint();

    if (msgType === MESSAGE_SYNC) {
      const syncType = decoder.hasContent() ? decoder.readVarUint() : -1;
      return { type: MESSAGE_SYNC, syncType };
    }

    if (msgType === MESSAGE_AWARENESS) {
      return { type: MESSAGE_AWARENESS };
    }

    return { type: msgType };
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

function extractSocketErrorMessage(event: unknown): string | null {
  if (!(typeof event === "object" && event !== null)) {
    return null;
  }

  if (!("error" in event)) {
    return null;
  }

  const errorValue = (event as { error: unknown }).error;

  if (typeof errorValue === "function") {
    try {
      const value = errorValue();
      return typeof value === "string" ? value : null;
    } catch {
      return null;
    }
  }

  if (typeof errorValue === "string") {
    return errorValue;
  }

  return null;
}

export interface CollabSession {
  connectStart: number;
  disconnect: () => void;
  established: boolean;
  lastMessageTime: number;
  receivedAwareness: boolean;
  receivedSyncStep2: boolean;
  receivedUpdates: number;
  response: ws.Response | null;
  sendAwarenessUpdate: (cursor: {
    x: number;
    y: number;
    user: string;
  }) => boolean;
  sendSyncUpdate: (updateSeed: number) => boolean;
  sentMessages: number;
  token: string;
  workspaceId: string;
}

interface InternalCollabSession extends CollabSession {
  __connectMetricsRecorded: boolean;
}

export interface CollabMetrics {
  averageLatency: number;
  totalAwarenessMessages: number;
  totalConnections: number;
  totalSyncMessages: number;
}

export function connectCollabSession(
  url: string,
  token: string,
  workspaceId: string
): CollabSession {
  const fullUrl = token
    ? `${url}/ws/collab/${workspaceId}?token=${token}`
    : `${url}/ws/collab/${workspaceId}`;

  const wsConnectOptions: { headers?: Record<string, string> } = {};
  if (__ENV.E2E_BYPASS === "true") {
    wsConnectOptions.headers = {
      "x-e2e-bypass": "true",
      "x-e2e-user-id": __ENV.E2E_BYPASS_USER_ID || "e2e-load-user",
    };
  }

  const connectStart = Date.now();
  const sessionLifetimeSeconds = Number.parseInt(
    __ENV.K6_SESSION_LIFETIME_SECONDS || `${DEFAULT_SESSION_LIFETIME_SECONDS}`,
    10
  );

  const session: InternalCollabSession = {
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
    __connectMetricsRecorded: false,
    sendSyncUpdate: () => false,
    sendAwarenessUpdate: () => false,
    disconnect: () => {
      // No-op for unestablished session
    },
  };

  const resp = ws.connect(fullUrl, wsConnectOptions, (socket) => {
    session.established = true;
    let isSocketOpen = true;

    if (!session.__connectMetricsRecorded) {
      const connectEnd = Date.now();
      wsConnectDuration.add(connectEnd - connectStart);
      wsConnectSuccess.add(true);
      session.__connectMetricsRecorded = true;
    }

    const syncStep1 = encodeSyncStep1();
    socket.sendBinary(syncStep1.buffer);
    wsSyncMessagesSent.add(1);

    socket.setInterval(() => {
      try {
        socket.ping();
      } catch {
        wsMessageFailures.add(1);
      }
    }, 30_000);

    if (sessionLifetimeSeconds > 0) {
      socket.setTimeout(() => {
        try {
          socket.close();
        } catch {
          wsMessageFailures.add(1);
        }
      }, sessionLifetimeSeconds * 1000);
    }

    socket.on("binaryMessage", (data: ArrayBuffer) => {
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

    socket.on("close", () => {
      isSocketOpen = false;
      wsDisconnectCount.add(1);
    });

    socket.on("error", (event: unknown) => {
      const errorMessage = extractSocketErrorMessage(event);
      if (errorMessage === "websocket: close sent") {
        return;
      }
      wsMessageFailures.add(1);
    });

    session.sendSyncUpdate = (updateSeed: number): boolean => {
      if (!isSocketOpen) {
        return false;
      }

      try {
        const generatedUpdate = generateFakeYjsUpdate(updateSeed);
        const fixtureUpdate =
          SYNC_UPDATE_FIXTURES.length > 0
            ? SYNC_UPDATE_FIXTURES[
                Math.abs(updateSeed) % SYNC_UPDATE_FIXTURES.length
              ]
            : null;
        const update = fixtureUpdate ?? generatedUpdate;
        const msg = encodeSyncUpdate(update);
        socket.sendBinary(msg.buffer);
        wsSyncMessagesSent.add(1);
        session.sentMessages++;
        session.lastMessageTime = Date.now();
        return true;
      } catch {
        if (isSocketOpen) {
          wsMessageFailures.add(1);
        }
        return false;
      }
    };

    session.sendAwarenessUpdate = (cursor: {
      x: number;
      y: number;
      user: string;
    }): boolean => {
      if (!isSocketOpen) {
        return false;
      }

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
        if (isSocketOpen) {
          wsMessageFailures.add(1);
        }
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

  session.response = resp;

  if (resp.status !== 101 && !session.__connectMetricsRecorded) {
    const connectEnd = Date.now();
    wsConnectDuration.add(connectEnd - connectStart);
    wsConnectSuccess.add(false);
    session.__connectMetricsRecorded = true;
  }

  return session;
}

export function waitForSessionEstablished(
  session: CollabSession,
  timeoutSeconds = CONNECT_TIMEOUT_SECONDS
): boolean {
  const internalSession = session as InternalCollabSession;
  const connectDeadline = Date.now() + timeoutSeconds * 1000;

  while (!session.established && Date.now() < connectDeadline) {
    sleep(0.05);
  }

  if (session.established) {
    return true;
  }

  if (!internalSession.__connectMetricsRecorded) {
    wsConnectDuration.add(Date.now() - session.connectStart);
    wsConnectSuccess.add(false);
    internalSession.__connectMetricsRecorded = true;
  }

  session.disconnect();
  return false;
}
