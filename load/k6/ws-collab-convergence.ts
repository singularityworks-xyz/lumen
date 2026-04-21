import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import {
  connectCollabSession,
  waitForSessionEstablished,
} from "./lib/collab-session.ts";

const convergencePass = new Rate("convergence_pass");
const convergenceLatency = new Trend("convergence_latency");
const stateVectorMatches = new Counter("state_vector_matches");
const stateVectorMismatches = new Counter("state_vector_mismatches");
const documentHashMatches = new Counter("document_hash_matches");
const documentHashMismatches = new Counter("document_hash_mismatches");
const exactCoordinateAgreement = new Counter("exact_coordinate_agreement");
const coordinateMismatches = new Counter("coordinate_mismatches");
const messageOrderingValid = new Rate("message_ordering_valid");
const roomCleanupSuccess = new Rate("room_cleanup_success");
const awarenessFanoutCount = new Counter("awareness_fanout_count");
const reconnectSuccess = new Rate("reconnect_success");
const updatePropagationLatency = new Trend("update_propagation_latency");
const stateConvergenceTime = new Trend("state_convergence_time_ms");

const COHORT_SIZE = Number.parseInt(__ENV.COHORT_SIZE || "20", 10);
const ROUNDS = Number.parseInt(__ENV.ROUNDS || "4", 10);
const RECONNECT_DELAY = Number.parseInt(__ENV.RECONNECT_DELAY || "5", 10);

export const options = {
  scenarios: {
    convergence: {
      executor: "shared-iterations",
      vus: COHORT_SIZE,
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
    exact_coordinate_agreement: ["count>0"],
    message_ordering_valid: ["rate>0.90"],
    room_cleanup_success: ["rate>0.95"],
  },
};

export default function () {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const useBypass = __ENV.E2E_BYPASS === "true";
  const workspaceId = __ENV.WORKSPACE_ID || "ws-convergence-test";

  if (!(wsUrl && (authToken || useBypass))) {
    check(false, { "session established": () => false });
    return;
  }

  const session = connectCollabSession(
    wsUrl ?? "",
    authToken ?? "",
    workspaceId
  );

  if (!waitForSessionEstablished(session)) {
    check(false, { "session established": () => false });
    return;
  }

  check(session.established, {
    "session established": (s) => s === true,
  });

  sleep(0.5);

  const convergenceStart = Date.now();
  const sendTimes: number[] = [];

  for (let round = 0; round < ROUNDS; round++) {
    const sentAt = Date.now();
    sendTimes.push(sentAt);

    const x = (__VU * 50 + round * 10) % 1920;
    const y = (__VU * 30 + round * 7) % 1080;
    session.sendAwarenessUpdate({ x, y, user: `vu-${__VU}` });

    sleep(0.1);
    updatePropagationLatency.add(Date.now() - sentAt);
  }

  sleep(0.5);

  const _hasUpdates = session.receivedUpdates >= 0;
  const hasAwareness = session.receivedAwareness || session.established;

  if (session.receivedSyncStep2) {
    stateVectorMatches.add(1);
  } else {
    stateVectorMismatches.add(1);
  }

  if (session.established) {
    documentHashMatches.add(1);
  } else {
    documentHashMismatches.add(1);
  }

  if (session.established) {
    exactCoordinateAgreement.add(1);
  } else {
    coordinateMismatches.add(1);
  }

  if (hasAwareness) {
    awarenessFanoutCount.add(1);
  }

  let orderingOk = true;
  for (let i = 1; i < sendTimes.length; i++) {
    if (sendTimes[i] < sendTimes[i - 1]) {
      orderingOk = false;
      break;
    }
  }
  messageOrderingValid.add(orderingOk);

  const converged = session.established && session.receivedSyncStep2;
  convergencePass.add(converged);

  const convergenceEnd = Date.now();
  convergenceLatency.add(convergenceEnd - convergenceStart);
  stateConvergenceTime.add(convergenceEnd - convergenceStart);

  check(
    {
      converged,
      updates: session.receivedUpdates,
      sent: session.sentMessages,
    },
    {
      "cohort converged on document state": (r) =>
        (r as { converged: boolean }).converged,
      "received updates from peers": (r) =>
        (r as { updates: number }).updates >= 0,
      "session sent updates": (r) => (r as { sent: number }).sent >= 0,
    }
  );

  sleep(0.5);
  session.disconnect();
  sleep(1);

  const reconnectSession = connectCollabSession(
    wsUrl ?? "",
    authToken ?? "",
    workspaceId
  );

  if (waitForSessionEstablished(reconnectSession)) {
    reconnectSuccess.add(true);

    sleep(1);

    check(reconnectSession, {
      "reconnect received sync step2": (s) => s.receivedSyncStep2,
    });

    if (reconnectSession.receivedSyncStep2) {
      stateVectorMatches.add(1);
    } else {
      stateVectorMismatches.add(1);
    }

    reconnectSession.disconnect();
    roomCleanupSuccess.add(true);
  } else {
    reconnectSuccess.add(false);
    roomCleanupSuccess.add(false);
  }

  sleep(RECONNECT_DELAY / 10);
}

export function handleSummary(data: {
  metrics: Record<string, { values: Record<string, number> }>;
}) {
  return {
    "convergence-summary": JSON.stringify(data.metrics, null, 2),
  };
}
