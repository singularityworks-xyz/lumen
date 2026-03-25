import { check, sleep } from "k6";
import {
  connectCollabSession,
  sendSyncUpdate,
  disconnectSession,
} from "./lib/collab-session";

export const options = {
  scenarios: {
    ramp_up: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 50 },
        { duration: "1m", target: 100 },
        { duration: "2m", target: 100 },
        { duration: "1m", target: 50 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    ws_connect_success: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    ws_connect_duration: ["p(95)<1000"],
  },
};

function generateWorkspaceId(vuId: number): string {
  return `ws-ramp-${vuId}`;
}

function generateSyncData(index: number) {
  return {
    ops: [
      {
        type: "insert",
        path: "blocks",
        value: `block-${index}`,
      },
    ],
    clock: index,
    origin: "ramp-test",
  };
}

export default function () {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const vuId = __VU;
  const workspaceId = generateWorkspaceId(vuId);

  const session = connectCollabSession(wsUrl!, authToken!, workspaceId);

  check(session, {
    "session established": (s) => s && s.socket !== null,
  });

  for (let i = 0; i < 10; i++) {
    const sent = sendSyncUpdate(session, generateSyncData(i));
    check(sent, {
      [`sync update ${i} sent`]: (s) => s === true,
    });
    sleep(0.2);
  }

  disconnectSession(session);
  sleep(0.5);
}
