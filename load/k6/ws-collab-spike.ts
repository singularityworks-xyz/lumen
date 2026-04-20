import { check, sleep } from "k6";
import { connectCollabSession } from "./lib/collab-session.ts";

export const options = {
  scenarios: {
    spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 50 },
        { duration: "1m", target: 50 },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    ws_connect_success: ["rate>0.99"],
    ws_connect_duration: ["p(95)<1000"],
    ws_sync_messages_sent: ["count>0"],
  },
};

export default function () {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const workspaceId = __ENV.WORKSPACE_ID || "ws-spike-shared";

  const session = connectCollabSession(
    wsUrl ?? "",
    authToken ?? "",
    workspaceId
  );

  if (!session.established) {
    return;
  }

  check(session.established, {
    "spike session established": (s) => s === true,
  });

  for (let i = 0; i < 5; i++) {
    session.sendSyncUpdate(__VU * 1000 + i);
    sleep(0.1);
  }

  sleep(0.5);

  check(session, {
    "received sync step2": (s) => s.receivedSyncStep2,
  });

  session.disconnect();
  sleep(0.5);
}
