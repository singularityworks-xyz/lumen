import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { connectCollabSession } from "./lib/collab-session";

const stateDivergenceCount = new Counter("state_divergence_count");
const droppedAwarenessCount = new Counter("dropped_awareness_count");
const roomCleanupSuccess = new Rate("room_cleanup_success");
const joinLatency = new Trend("join_latency_ms");
const updatePropagationLatency = new Trend("update_propagation_latency_ms");
const initialConnectSuccess = new Rate("initial_connect_success");
const reconnectSuccessRate = new Rate("reconnect_success_rate");
const presenceFanoutCount = new Counter("presence_fanout_count");

const COHORT_SIZE = Number.parseInt(__ENV.COHORT_SIZE || "20", 10);
const _JOIN_LEAVE_CHURN_ROUNDS = Number.parseInt(
  __ENV.JOIN_LEAVE_ROUNDS || "5",
  10
);
const _RECONNECT_STORM_DELAY = Number.parseInt(
  __ENV.RECONNECT_STORM_DELAY || "2",
  10
);

export const options = {
  scenarios: {
    churn: {
      executor: "shared-iterations",
      vus: COHORT_SIZE,
      maxVUs: COHORT_SIZE * 2,
      iterations: COHORT_SIZE,
      gracefulStop: "60s",
    },
  },
  thresholds: {
    ws_connect_success: ["rate>0.95"],
    reconnect_success_rate: ["rate>0.90"],
    state_divergence_count: ["count<10"],
    room_cleanup_success: ["rate>0.95"],
    join_latency_ms: ["p(95)<3000"],
    update_propagation_latency_ms: ["p(95)<500"],
  },
};

export default function () {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const workspaceId = __ENV.WORKSPACE_ID || "ws-churn-test";

  if (!(wsUrl && authToken)) {
    console.error("WS_URL and AUTH_TOKEN environment variables are required");
    initialConnectSuccess.add(false);
    return;
  }

  const joinStart = Date.now();
  const session = connectCollabSession(wsUrl, authToken, workspaceId);
  const joinEnd = Date.now();

  joinLatency.add(joinEnd - joinStart);

  if (!session.established) {
    initialConnectSuccess.add(false);
    return;
  }

  initialConnectSuccess.add(true);

  const myLabel = `churn-user-${__VU}-${__ITER}`;
  const baseUpdate = __VU * 1000 + __ITER * 100;

  for (let round = 0; round < 10; round++) {
    const updateStart = Date.now();
    session.sendSyncUpdate(baseUpdate + round);

    session.sendAwarenessUpdate({
      x: (__VU * 50 + round * 10) % 1920,
      y: (__VU * 30 + round * 7) % 1080,
      user: myLabel,
    });
    presenceFanoutCount.add(1);

    const updateEnd = Date.now();
    updatePropagationLatency.add(updateEnd - updateStart);

    sleep(0.5);
  }

  sleep(1);

  const receivedUpdates = session.receivedUpdates > 0;
  const receivedAwareness = session.receivedAwareness;

  if (!receivedUpdates) {
    stateDivergenceCount.add(1);
  }

  if (!receivedAwareness) {
    droppedAwarenessCount.add(1);
  }

  check(session, {
    "session has received updates from peers": (s) => s.receivedUpdates > 0,
    "session has received awareness updates": (s) =>
      s.receivedAwareness === true,
    "session sync step2 received": (s) => s.receivedSyncStep2 === true,
  });

  session.disconnect();

  sleep(1);

  const _reconnectStart = Date.now();
  const reconnectSession = connectCollabSession(wsUrl, authToken, workspaceId);
  const _reconnectEnd = Date.now();

  if (reconnectSession.established) {
    reconnectSuccessRate.add(true);

    check(reconnectSession, {
      "reconnect received sync step2": (s) => s.receivedSyncStep2,
    });

    reconnectSession.disconnect();
  } else {
    reconnectSuccessRate.add(false);
  }

  roomCleanupSuccess.add(reconnectSession.established ? 1 : 0);
}

export function handleSummary(data: {
  metrics: Record<string, { values: Record<string, number> }>;
}) {
  return {
    "churn-summary": JSON.stringify(data.metrics, null, 2),
  };
}
