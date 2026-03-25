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
  response: ws.Response | null;
  workspaceId: string;
  token: string;
  connectStart: number;
  established: boolean;
  sendSyncUpdate: (data: SyncData) => boolean;
  sendAwarenessUpdate: (data: AwarenessData) => boolean;
  disconnect: () => void;
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
  const fullUrl = `${url}/ws/collab/${workspaceId}?token=${token}`;
  const connectStart = Date.now();

  const session: CollabSession = {
    response: null,
    workspaceId,
    token,
    connectStart,
    established: false,
    sendSyncUpdate: () => false,
    sendAwarenessUpdate: () => false,
    disconnect: () => {},
  };

  session.response = ws.connect(fullUrl, {}, function (socket) {
    const connectEnd = Date.now();
    wsConnectDuration.add(connectEnd - connectStart);

    if (session.response!.status !== 101) {
      wsConnectSuccess.add(false);
      return;
    }

    wsConnectSuccess.add(true);
    session.established = true;

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

    socket.on("close", function () {
      wsDisconnectCount.add(1);
    });

    socket.on("error", function () {
      wsMessageFailures.add(1);
    });

    session.sendSyncUpdate = (data: SyncData): boolean => {
      try {
        const payload = JSON.stringify({
          type: SYNC_MSG_TYPE,
          action: "update",
          workspaceId,
          data,
          timestamp: Date.now(),
        });
        socket.send(payload);
        return true;
      } catch {
        wsMessageFailures.add(1);
        return false;
      }
    };

    session.sendAwarenessUpdate = (data: AwarenessData): boolean => {
      try {
        const payload = JSON.stringify({
          type: AWARENESS_MSG_TYPE,
          workspaceId,
          data,
          timestamp: Date.now(),
        });
        socket.send(payload);
        return true;
      } catch {
        wsMessageFailures.add(1);
        return false;
      }
    };

    session.disconnect = () => {
      try {
        socket.send(
          JSON.stringify({
            type: "disconnect",
            workspaceId,
          })
        );
        socket.close();
      } catch {
        wsMessageFailures.add(1);
      }
    };
  });

  return session;
}
