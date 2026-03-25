import { check, sleep } from "k6";
import { Counter, Gauge } from "k6/metrics";
import {
  connectCollabSession,
  sendSyncUpdate,
  sendAwarenessUpdate,
  disconnectSession,
} from "./lib/collab-session.js";

const activeConnections = new Gauge("soak_active_connections");
const sessionDuration = new Gauge("soak_session_duration_ms");
const connectionCounter = new Counter("soak_connection_count");

const soakDurationMinutes = __ENV.SOAK_DURATION_MINUTES || "30";
const soakDuration = `${soakDurationMinutes}m`;

export const options = {
  scenarios: {
    soak: {
      executor: "constant-vus",
      vus: 20,
      duration: soakDuration,
    },
  },
  thresholds: {
    ws_connect_success: ["rate>0.99"],
    ws_connect_duration: ["p(95)<1000"],
  },
};

function generateWorkspaceId(vuId) {
  return `ws-soak-${vuId}`;
}

function generateSyncData(counter) {
  return {
    ops: [
      {
        type: "update",
        path: "content",
        value: `soak-payload-${counter}-${Date.now()}`,
      },
    ],
    clock: counter,
    origin: "soak-test",
  };
}

function generateAwarenessData(vuId) {
  return {
    user: `soak-user-${vuId}`,
    cursor: { line: Math.floor(Math.random() * 100), col: Math.floor(Math.random() * 80) },
    lastSeen: Date.now(),
  };
}

export default function () {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const vuId = __VU;
  const workspaceId = generateWorkspaceId(vuId);

  const session = connectCollabSession(wsUrl, authToken, workspaceId);

  const sessionStart = Date.now();

  const established = check(session, {
    "soak session established": (s) => s && s.socket !== null,
  });

  if (established) {
    connectionCounter.add(1);
    activeConnections.add(1);
  }

  let updateCounter = 0;

  const iterations = Math.floor(
    parseInt(soakDurationMinutes, 10) * 60 / 5,
  );

  for (let i = 0; i < iterations; i++) {
    updateCounter++;

    sendSyncUpdate(session, generateSyncData(updateCounter));

    if (updateCounter % 3 === 0) {
      sendAwarenessUpdate(session, generateAwarenessData(vuId));
    }

    const elapsed = Date.now() - sessionStart;
    sessionDuration.add(elapsed);

    sleep(5);
  }

  disconnectSession(session);
  connectionCounter.add(-1);
  activeConnections.add(0);
}
