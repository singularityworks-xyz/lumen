import ws from "k6/ws";
import { check } from "k6";
import { Counter, Trend, Rate } from "k6/metrics";

const wsConnectSuccess = new Rate("ws_connect_success");
const wsConnectDuration = new Trend("ws_connect_duration");
const wsDisconnectCount = new Counter("ws_disconnect_count");
const wsMessageFailures = new Counter("ws_message_failures");

const SYNC_MSG_TYPE = "sync";
const AWARENESS_MSG_TYPE = "awareness";

interface SyncData {
  ops: Array<{
    type: string;
    path: string;
    value: string;
    index?: number;
  }>;
  clock: number;
  origin: string;
}

interface AwarenessData {
  user: string;
  cursor: { line: number; col: number };
  lastSeen: number;
}

interface CollabSession {
  socket: ReturnType<typeof ws.connect> | null;
  workspaceId: string;
  token: string;
  connectStart: number;
}

declare global {
  const __ENV: {
    WS_URL?: string;
    AUTH_TOKEN?: string;
    SOAK_DURATION_MINUTES?: string;
  };
  const __VU: number;
}

export function connectCollabSession(
  url: string,
  token: string,
  workspaceId: string
): CollabSession {
  const fullUrl = `${url}/ws/collab?workspace=${workspaceId}`;
  const headers = { Authorization: `Bearer ${token}` };
  const connectStart = Date.now();
  let session: CollabSession | null = null;

  const socket = ws.connect(
    fullUrl,
    { headers },
    function (socket: ReturnType<typeof ws.connect>) {
      const connectEnd = Date.now();
      wsConnectDuration.add(connectEnd - connectStart);

      const connected = check(socket, {
        "ws connection is open": () => socket !== null,
      });
      wsConnectSuccess.add(connected);

      socket.send(
        JSON.stringify({
          type: "sync",
          action: "init",
          workspaceId,
        })
      );

      socket.setInterval(function () {
        socket.send(
          JSON.stringify({
            type: "ping",
            timestamp: Date.now(),
          })
        );
      }, 30000);

      session = { socket, workspaceId, token, connectStart };
    }
  );

  socket.addEventListener("close", function () {
    wsDisconnectCount.add(1);
  });

  socket.addEventListener("error", function () {
    wsMessageFailures.add(1);
  });

  return { socket, workspaceId, token, connectStart };
}

export function sendSyncUpdate(
  session: CollabSession,
  data: SyncData
): boolean {
  if (!session || !session.socket) {
    wsMessageFailures.add(1);
    return false;
  }

  try {
    const payload = JSON.stringify({
      type: SYNC_MSG_TYPE,
      action: "update",
      workspaceId: session.workspaceId,
      data,
      timestamp: Date.now(),
    });
    session.socket.send(payload);
    return true;
  } catch {
    wsMessageFailures.add(1);
    return false;
  }
}

export function sendAwarenessUpdate(
  session: CollabSession,
  data: AwarenessData
): boolean {
  if (!session || !session.socket) {
    wsMessageFailures.add(1);
    return false;
  }

  try {
    const payload = JSON.stringify({
      type: AWARENESS_MSG_TYPE,
      workspaceId: session.workspaceId,
      data,
      timestamp: Date.now(),
    });
    session.socket.send(payload);
    return true;
  } catch {
    wsMessageFailures.add(1);
    return false;
  }
}

export function disconnectSession(session: CollabSession): void {
  if (session && session.socket) {
    try {
      session.socket.send(
        JSON.stringify({
          type: "disconnect",
          workspaceId: session.workspaceId,
        })
      );
      session.socket.close();
    } catch {
      wsMessageFailures.add(1);
    }
  }
}
