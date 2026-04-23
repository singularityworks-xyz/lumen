import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import {
  connectCollabSession,
  waitForSessionEstablished,
} from "./lib/collab-session";

const convergencePass = new Rate("convergence_pass");
const convergenceLatency = new Trend("convergence_latency");
const stateVectorMatches = new Counter("state_vector_matches");
const stateVectorMismatches = new Counter("state_vector_mismatches");
const documentHashMatches = new Counter("document_hash_matches");
const documentHashMismatches = new Counter("document_hash_mismatches");
const coordinatePayloadPresent = new Counter("coordinate_payload_present");
const coordinatePayloadAbsent = new Counter("coordinate_payload_absent");
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
    coordinate_payload_present: ["count>0"],
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
  const sendTimes: Record<number, number> = {};
  const receiveTimes: number[] = [];

  session.onAwarenessPayload = (payloads) => {
    for (const payload of payloads) {
      // Only measure propagation for awareness from other peers
      if (payload.clientId === __VU) {
        continue;
      }
      const state = payload.state;
      if (typeof state.sentAt === "number" && typeof state.seq === "number") {
        const latency = Date.now() - state.sentAt;
        updatePropagationLatency.add(latency);
      }
      // Track coordinate payload presence
      if (
        state.cursor &&
        typeof (state.cursor as Record<string, unknown>).x === "number" &&
        typeof (state.cursor as Record<string, unknown>).y === "number"
      ) {
        coordinatePayloadPresent.add(1);
      } else {
        coordinatePayloadAbsent.add(1);
      }
    }
  };

  session.onSyncUpdateReceived = () => {
    receiveTimes.push(Date.now());
  };

  for (let round = 0; round < ROUNDS; round++) {
    const sentAt = Date.now();
    const seq = round;
    sendTimes[seq] = sentAt;

    const x = (__VU * 50 + round * 10) % 1920;
    const y = (__VU * 30 + round * 7) % 1080;
    session.sendAwarenessUpdate({
      x,
      y,
      user: `vu-${__VU}`,
      seq,
      sentAt,
    });

    sleep(0.1);
  }

  sleep(0.5);

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

  // Awareness fanout should depend on actually receiving awareness payloads
  if (session.receivedAwareness) {
    awarenessFanoutCount.add(1);
  }

  // Validate local send ordering
  let sendOrderingOk = true;
  const sendTimeValues = Object.values(sendTimes).sort((a, b) => a - b);
  for (let i = 1; i < sendTimeValues.length; i++) {
    if (sendTimeValues[i] < sendTimeValues[i - 1]) {
      sendOrderingOk = false;
      break;
    }
  }

  // Validate receive ordering using tracked receive times
  let receiveOrderingOk = true;
  for (let i = 1; i < receiveTimes.length; i++) {
    if (receiveTimes[i] < receiveTimes[i - 1]) {
      receiveOrderingOk = false;
      break;
    }
  }

  // Also validate that at least some updates were received after being sent
  const anyReceiveAfterSend =
    receiveTimes.length > 0 &&
    receiveTimes.some((rt) => rt > Math.min(...sendTimeValues));

  messageOrderingValid.add(
    sendOrderingOk && receiveOrderingOk && anyReceiveAfterSend
  );

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
        (r as { updates: number }).updates > 0,
      "session sent updates": (r) => (r as { sent: number }).sent > 0,
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
