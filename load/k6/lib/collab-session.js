import ws from "k6/ws";
import { check } from "k6";
import { Counter, Trend, Rate } from "k6/metrics";

const wsConnectSuccess = new Rate("ws_connect_success");
const wsConnectDuration = new Trend("ws_connect_duration");
const wsDisconnectCount = new Counter("ws_disconnect_count");
const wsMessageFailures = new Counter("ws_message_failures");

const SYNC_MSG_TYPE = "sync";
const AWARENESS_MSG_TYPE = "awareness";

export function connectCollabSession(url, token, workspaceId) {
  const fullUrl = `${url}/ws/collab?workspace=${workspaceId}`;
  const headers = { Authorization: `Bearer ${token}` };
  const connectStart = Date.now();
  let session = null;

  const socket = ws.connect(
    fullUrl,
    { headers },
    function (socket) {
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
        }),
      );

      socket.setInterval(function () {
        socket.send(
          JSON.stringify({
            type: "ping",
            timestamp: Date.now(),
          }),
        );
      }, 30000);

      session = { socket, workspaceId, token, connectStart };
    },
  );

  socket.addEventListener("close", function () {
    wsDisconnectCount.add(1);
  });

  socket.addEventListener("error", function () {
    wsMessageFailures.add(1);
  });

  return { socket, workspaceId, token, connectStart };
}

export function sendSyncUpdate(session, data) {
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

export function sendAwarenessUpdate(session, data) {
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

export function disconnectSession(session) {
  if (session && session.socket) {
    try {
      session.socket.send(
        JSON.stringify({
          type: "disconnect",
          workspaceId: session.workspaceId,
        }),
      );
      session.socket.close();
    } catch {
      wsMessageFailures.add(1);
    }
  }
}
