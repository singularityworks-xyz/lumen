import { check, sleep } from "k6";
import { connectCollabSession } from "./lib/collab-session";

export const options = {
  scenarios: {
    ramp_up: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 10 },
        { duration: "1m", target: 20 },
        { duration: "2m", target: 20 },
        { duration: "1m", target: 10 },
        { duration: "30s", target: 0 },
      ],
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
  const workspaceId = __ENV.WORKSPACE_ID || "ws-ramp-shared";

  const session = connectCollabSession(wsUrl!, authToken!, workspaceId);

  if (!session.established) {
    return;
  }

  check(session.established, {
    "session established": (s) => s === true,
  });

  for (let i = 0; i < 10; i++) {
    session.sendSyncUpdate(__VU * 1000 + i);

    if (i % 3 === 0) {
      session.sendAwarenessUpdate({
        x: 100 + i * 10,
        y: 200 + i * 5,
        user: `ramp-user-${__VU}`,
      });
    }

    sleep(0.2);
  }

  sleep(0.5);

  check(session, {
    "received sync step2": (s) => s.receivedSyncStep2,
    "received awareness": (s) => s.receivedAwareness,
  });

  session.disconnect();
  sleep(0.5);
}
