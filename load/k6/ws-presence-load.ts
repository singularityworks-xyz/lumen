import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import { connectCollabSession } from "./lib/collab-session.ts";

const presenceFanoutCount = new Counter("presence_fanout_count");
const cursorMovementCount = new Counter("cursor_movement_count");
const cursorPositionDrift = new Trend("cursor_position_drift_pixels");
const collaboratorCountTrend = new Trend("collaborator_count");

const COHORT_SIZE = Number.parseInt(__ENV.COHORT_SIZE || "20", 10);
const CURSOR_ROUNDS = Number.parseInt(__ENV.CURSOR_ROUNDS || "20", 10);

export const options = {
  scenarios: {
    presence: {
      executor: "shared-iterations",
      vus: COHORT_SIZE,
      maxVUs: COHORT_SIZE,
      iterations: COHORT_SIZE,
      gracefulStop: "30s",
    },
  },
  thresholds: {
    presence_fanout_count: ["count>0"],
    cursor_movement_count: ["count>0"],
    collaborator_count: ["count>0"],
  },
};

export default function () {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const workspaceId = __ENV.WORKSPACE_ID || "ws-presence-test";

  if (!(wsUrl && authToken)) {
    console.error("WS_URL and AUTH_TOKEN environment variables are required");
    return;
  }

  const session = connectCollabSession(wsUrl, authToken, workspaceId);

  if (!session.established) {
    return;
  }

  const myLabel = `presence-user-${__VU}`;
  let lastX = 0;
  let lastY = 0;

  for (let round = 0; round < CURSOR_ROUNDS; round++) {
    const x = (__VU * 50 + round * 10) % 1920;
    const y = (__VU * 30 + round * 7) % 1080;

    session.sendAwarenessUpdate({
      x,
      y,
      user: myLabel,
    });

    presenceFanoutCount.add(1);
    cursorMovementCount.add(1);

    if (round > 0) {
      const dx = Math.abs(x - lastX);
      const dy = Math.abs(y - lastY);
      cursorPositionDrift.add(Math.sqrt(dx * dx + dy * dy));
    }

    lastX = x;
    lastY = y;

    sleep(0.3);
  }

  sleep(2);

  check(session, {
    "session received presence updates": (s) => s.receivedAwareness === true,
  });

  collaboratorCountTrend.add(session.receivedAwareness ? 1 : 0);

  session.disconnect();
}

export function handleSummary(data: {
  metrics: Record<string, { values: Record<string, number> }>;
}) {
  return {
    "presence-summary": JSON.stringify(data.metrics, null, 2),
  };
}
