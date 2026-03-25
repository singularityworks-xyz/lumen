import { sleep } from "k6";
import { Counter, Gauge } from "k6/metrics";
import {
  connectCollabSession,
} from "./lib/collab-session";

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

function generateWorkspaceId(vuId: number): string {
  return `ws-soak-${vuId}`;
}

function generateSyncData(counter: number) {
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

function generateAwarenessData(vuId: number) {
  return {
    user: `soak-user-${vuId}`,
    cursor: {
      line: Math.floor(Math.random() * 100),
      col: Math.floor(Math.random() * 80),
    },
    lastSeen: Date.now(),
  };
}

export default function () {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const vuId = __VU;
  const workspaceId = generateWorkspaceId(vuId);

  const session = connectCollabSession(wsUrl!, authToken!, workspaceId);

  if (!session.established) {
    return;
  }

  connectionCounter.add(1);
  activeConnections.add(1);

  const sessionStart = Date.now();
  let updateCounter = 0;

  const iterations = Math.floor(
    (parseInt(soakDurationMinutes, 10) * 60) / 5
  );

  for (let i = 0; i < iterations; i++) {
    updateCounter++;

    session.sendSyncUpdate(generateSyncData(updateCounter));

    if (updateCounter % 3 === 0) {
      session.sendAwarenessUpdate(generateAwarenessData(vuId));
    }

    const elapsed = Date.now() - sessionStart;
    sessionDuration.add(elapsed);

    sleep(5);
  }

  session.disconnect();
  connectionCounter.add(-1);
  activeConnections.add(0);
}
