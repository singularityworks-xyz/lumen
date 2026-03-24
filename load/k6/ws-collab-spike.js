import { check, sleep } from "k6";
import {
  connectCollabSession,
  sendSyncUpdate,
  disconnectSession,
} from "./lib/collab-session.js";

export const options = {
  scenarios: {
    spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 100 },
        { duration: "1m", target: 100 },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    ws_connect_success: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    ws_connect_duration: ["p(95)<1000"],
  },
};

function generateWorkspaceId(vuId) {
  return `ws-spike-${vuId}`;
}

function generateSyncData(index) {
  return {
    ops: [
      {
        type: "insert",
        path: "spike-blocks",
        index,
        value: `spike-block-${index}-${Date.now()}`,
      },
    ],
    clock: index,
    origin: "spike-test",
  };
}

export default function () {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const vuId = __VU;
  const workspaceId = generateWorkspaceId(vuId);

  const session = connectCollabSession(wsUrl, authToken, workspaceId);

  check(session, {
    "spike session established": (s) => s && s.socket !== null,
  });

  for (let i = 0; i < 5; i++) {
    sendSyncUpdate(session, generateSyncData(i));
    sleep(0.1);
  }

  disconnectSession(session);
  sleep(0.5);
}
