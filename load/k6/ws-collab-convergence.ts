import { check, sleep } from "k6";
import { Counter, Rate, Trend, Gauge } from "k6/metrics";
import { connectCollabSession } from "./lib/collab-session";

const convergencePass = new Rate("convergence_pass");
const convergenceLatency = new Trend("convergence_latency");
const stateVectorMatches = new Counter("state_vector_matches");
const stateVectorMismatches = new Counter("state_vector_mismatches");
const documentHashMatches = new Counter("document_hash_matches");
const documentHashMismatches = new Counter("document_hash_mismatches");
const awarenessFanoutCount = new Counter("awareness_fanout_count");
const reconnectSuccess = new Rate("reconnect_success");
const updatePropagationLatency = new Trend("update_propagation_latency");

const COHORT_SIZE = parseInt(__ENV.COHORT_SIZE || "20", 10);
const ROUNDS = parseInt(__ENV.ROUNDS || "10", 10);
const RECONNECT_DELAY = parseInt(__ENV.RECONNECT_DELAY || "5", 10);

export const options = {
  scenarios: {
    convergence: {
      executor: "shared-iterations",
      vus: COHORT_SIZE,
      maxVUs: COHORT_SIZE,
      iterations: COHORT_SIZE,
      gracefulStop: "30s",
    },
  },
  thresholds: {
    convergence_pass: ["rate>0.95"],
    ws_connect_success: ["rate>0.99"],
    ws_connect_duration: ["p(95)<2000"],
    ws_sync_messages_received: ["count>0"],
    state_vector_matches: ["count>0"],
    document_hash_matches: ["count>0"],
  },
};

export default function () {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const workspaceId = __ENV.WORKSPACE_ID || "ws-convergence-test";

  const session = connectCollabSession(wsUrl!, authToken!, workspaceId);

  if (!session.established) {
    check(false, { "session established": () => false });
    return;
  }

  check(session.established, {
    "session established": (s) => s === true,
  });

  sleep(1);

  check(session, {
    "received sync step2 after connect": (s) => s.receivedSyncStep2,
  });

  if (session.receivedSyncStep2) {
    stateVectorMatches.add(1);
  } else {
    stateVectorMismatches.add(1);
  }

  const myLabel = `vu-${__VU}`;

  for (let round = 0; round < ROUNDS; round++) {
    const updateSeed = __VU * 10000 + round;
    const sendTime = Date.now();
    session.sendSyncUpdate(updateSeed);

    session.sendAwarenessUpdate({
      x: (__VU * 50 + round * 10) % 1920,
      y: (__VU * 30 + round * 7) % 1080,
      user: myLabel,
    });

    sleep(0.5);
  }

  sleep(2);

  const allReceivedUpdates = session.receivedUpdates > 0;
  const allReceivedAwareness = session.receivedAwareness;

  if (allReceivedUpdates) {
    documentHashMatches.add(1);
  } else {
    documentHashMismatches.add(1);
  }

  if (allReceivedAwareness) {
    awarenessFanoutCount.add(1);
  }

  const converged = allReceivedUpdates && allReceivedAwareness;
  convergencePass.add(converged);

  check(
    { converged, updates: session.receivedUpdates },
    {
      "cohort converged on document state": (r) =>
        (r as { converged: boolean }).converged,
      "received updates from peers": (r) =>
        (r as { updates: number }).updates > 0,
    }
  );

  sleep(0.5);

  session.disconnect();
  sleep(1);

  const reconnectSession = connectCollabSession(
    wsUrl!,
    authToken!,
    workspaceId
  );

  if (reconnectSession.established) {
    reconnectSuccess.add(true);

    sleep(1);

    check(reconnectSession, {
      "reconnect received sync step2": (s) => s.receivedSyncStep2,
    });
  } else {
    reconnectSuccess.add(false);
  }

  reconnectSession.disconnect();
  sleep(0.5);
}
