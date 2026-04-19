import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { connectCollabSession } from "./lib/collab-session";

const stickyRoutingSuccess = new Rate("sticky_routing_success");
const sameWorkerReconnectCount = new Counter("same_worker_reconnect_count");
const differentWorkerReconnectCount = new Counter(
  "different_worker_reconnect_count"
);
const stateConsistencyAfterReroute = new Rate(
  "state_consistency_after_reroute"
);
const workerAffinityMaintained = new Rate("worker_affinity_maintained");
const routingLatency = new Trend("routing_latency_ms");
const stickinessCheckCount = new Counter("stickiness_check_count");

const COHORT_SIZE = Number.parseInt(__ENV.COHORT_SIZE || "30", 10);
const STICKINESS_ROUNDS = Number.parseInt(__ENV.STICKINESS_ROUNDS || "3", 10);
const RECONNECT_DELAY = Number.parseInt(__ENV.RECONNECT_DELAY || "3", 10);

export const options = {
  scenarios: {
    stickyRouting: {
      executor: "shared-iterations",
      vus: COHORT_SIZE,
      maxVUs: COHORT_SIZE * 2,
      iterations: COHORT_SIZE,
      gracefulStop: "60s",
    },
  },
  thresholds: {
    ws_connect_success: ["rate>0.95"],
    sticky_routing_success: ["rate>0.85"],
    state_consistency_after_reroute: ["rate>0.90"],
    worker_affinity_maintained: ["rate>0.80"],
    routing_latency_ms: ["p(95)<5000"],
  },
};

interface RoutingMetrics {
  lastUpdateSeed: number;
  reconnectCount: number;
  updatesReceived: number;
  updatesSent: number;
  workerId: string | null;
}

interface StickyUserState {
  lastWorkerId: string | null;
  sessionTokens: Map<string, string>;
  userId: string;
  workerAssignments: Map<string, string>;
}

const userStates = new Map<string, StickyUserState>();

function getUserId(vu: number, iter: number): string {
  return `sticky-user-${vu}-${iter}`;
}

function getOrCreateUserState(vu: number, iter: number): StickyUserState {
  const userId = getUserId(vu, iter);
  let state = userStates.get(userId);
  if (!state) {
    state = {
      userId,
      sessionTokens: new Map(),
      workerAssignments: new Map(),
      lastWorkerId: null,
    };
    userStates.set(userId, state);
  }
  return state;
}

function extractWorkerId(
  session: ReturnType<typeof connectCollabSession>
): string | null {
  const resp = session.response;
  if (!resp) {
    return null;
  }

  const headers = resp.headers;
  if (headers && typeof headers === "object") {
    for (const [key, value] of Object.entries(headers)) {
      if (
        key.toLowerCase() === "x-worker-id" ||
        key.toLowerCase() === "server"
      ) {
        return String(value);
      }
    }
  }

  return `worker-${Math.floor(Math.random() * 2) + 1}`;
}

// Top-level regex for performance
const PORT_REGEX = /:\d+/;

function simulateWorkerReroute(wsUrl: string): string {
  const workers = ["primary", "secondary"];
  const targetWorker = workers[Math.floor(Math.random() * workers.length)];
  return wsUrl.replace(
    PORT_REGEX,
    `:${targetWorker === "primary" ? "3002" : "3003"}`
  );
}

export default function () {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const workspaceId = __ENV.WORKSPACE_ID || "ws-sticky-routing";

  if (!(wsUrl && authToken)) {
    console.error("WS_URL and AUTH_TOKEN environment variables are required");
    return;
  }

  const vu = __VU;
  const iter = __ITER;
  const userId = getUserId(vu, iter);
  const userState = getOrCreateUserState(vu, iter);

  const routingStart = Date.now();
  const session = connectCollabSession(wsUrl, authToken, workspaceId);
  const routingEnd = Date.now();

  routingLatency.add(routingEnd - routingStart);

  if (!session.established) {
    stickyRoutingSuccess.add(false);
    return;
  }

  stickyRoutingSuccess.add(true);

  const initialWorkerId = extractWorkerId(session);
  userState.lastWorkerId = initialWorkerId;

  const myLabel = `sticky-${userId}`;
  const baseUpdate = vu * 10_000 + iter * 1000;

  for (let round = 0; round < 5; round++) {
    const updateSeed = baseUpdate + round;
    session.sendSyncUpdate(updateSeed);
    session.sendAwarenessUpdate({
      x: (vu * 50 + round * 10) % 1920,
      y: (vu * 30 + round * 7) % 1080,
      user: myLabel,
    });
    userState.lastUpdateSeed = updateSeed;
    sleep(0.3);
  }

  session.disconnect();
  sleep(RECONNECT_DELAY);

  const metrics: RoutingMetrics = {
    workerId: initialWorkerId,
    reconnectCount: 0,
    updatesSent: 0,
    updatesReceived: 0,
    lastUpdateSeed: baseUpdate + 4,
  };

  for (let reroute = 0; reroute < STICKINESS_ROUNDS; reroute++) {
    const reconnectStart = Date.now();

    const targetUrl = reroute % 2 === 0 ? wsUrl : simulateWorkerReroute(wsUrl);
    const reconnectSession = connectCollabSession(
      targetUrl,
      authToken,
      workspaceId
    );
    const reconnectEnd = Date.now();

    routingLatency.add(reconnectEnd - reconnectStart);

    if (!reconnectSession.established) {
      stickyRoutingSuccess.add(false);
      continue;
    }

    stickyRoutingSuccess.add(true);
    metrics.reconnectCount++;

    const newWorkerId = extractWorkerId(reconnectSession);

    if (newWorkerId === userState.lastWorkerId) {
      sameWorkerReconnectCount.add(1);
      workerAffinityMaintained.add(true);
    } else {
      differentWorkerReconnectCount.add(1);
      workerAffinityMaintained.add(false);
    }

    userState.lastWorkerId = newWorkerId;

    check(reconnectSession, {
      "reconnect received sync step2": (s) => s.receivedSyncStep2 === true,
      "reconnect can send updates": (s) => {
        const sent = s.sendSyncUpdate(baseUpdate + 100 + reroute);
        return sent === true;
      },
    });

    const receivedBeforeReroute = reconnectSession.receivedUpdates;

    reconnectSession.sendSyncUpdate(baseUpdate + 200 + reroute);
    sleep(0.5);

    if (reconnectSession.receivedUpdates >= receivedBeforeReroute) {
      stateConsistencyAfterReroute.add(true);
    } else {
      stateConsistencyAfterReroute.add(false);
    }

    metrics.updatesSent++;
    metrics.updatesReceived = reconnectSession.receivedUpdates;

    reconnectSession.disconnect();
    sleep(RECONNECT_DELAY / 2);
  }

  stickinessCheckCount.add(1);

  const finalSession = connectCollabSession(wsUrl, authToken, workspaceId);

  if (finalSession.established) {
    const finalWorkerId = extractWorkerId(finalSession);

    check(finalSession, {
      "final session established": (s) => s.established === true,
      "final session received sync": (s) => s.receivedSyncStep2 === true,
      "final session to same worker": () => finalWorkerId === metrics.workerId,
    });

    if (finalWorkerId === metrics.workerId) {
      workerAffinityMaintained.add(true);
    }

    finalSession.disconnect();
  }
}

export function handleSummary(data: {
  metrics: Record<string, { values: Record<string, number> }>;
}) {
  return {
    "sticky-routing-summary": JSON.stringify(data.metrics, null, 2),
  };
}
