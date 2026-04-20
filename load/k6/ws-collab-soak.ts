import { sleep } from "k6";
import { Counter, Gauge } from "k6/metrics";
import { connectCollabSession } from "./lib/collab-session.ts";

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
    ws_sync_messages_sent: ["count>0"],
    ws_sync_messages_received: ["count>0"],
  },
};

export default function () {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const workspaceId = __ENV.WORKSPACE_ID || "ws-soak-shared";

  const session = connectCollabSession(
    wsUrl ?? "",
    authToken ?? "",
    workspaceId
  );

  if (!session.established) {
    return;
  }

  connectionCounter.add(1);
  activeConnections.add(1);

  const sessionStart = Date.now();
  let updateCounter = 0;

  const iterations = Math.floor(
    (Number.parseInt(soakDurationMinutes, 10) * 60) / 5
  );

  for (let i = 0; i < iterations; i++) {
    updateCounter++;

    session.sendSyncUpdate(__VU * 10_000 + updateCounter);

    if (updateCounter % 3 === 0) {
      session.sendAwarenessUpdate({
        x: Math.floor(Math.random() * 1920),
        y: Math.floor(Math.random() * 1080),
        user: `soak-user-${__VU}`,
      });
    }

    const elapsed = Date.now() - sessionStart;
    sessionDuration.add(elapsed);

    sleep(5);
  }

  session.disconnect();
  connectionCounter.add(-1);
  activeConnections.add(0);
}
