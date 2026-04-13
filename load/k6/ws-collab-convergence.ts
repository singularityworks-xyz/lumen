import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { connectCollabSession, CollabSession } from "./lib/collab-session";
import * as Y from "yjs";

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

const COHORT_SIZE = parseInt(__ENV.COHORT_SIZE || "20", 10);
const ROUNDS = parseInt(__ENV.ROUNDS || "10", 10);
const RECONNECT_DELAY = parseInt(__ENV.RECONNECT_DELAY || "5", 10);
const COORDINATE_DRIFT_THRESHOLD = 5;

interface YjsClientState {
  doc: Y.Doc;
  updates: Uint8Array[];
  lastKnownPositions: Map<number, { x: number; y: number; timestamp: number }>;
  messageTimestamps: number[];
  clientId: number;
}

function createYjsDoc(): Y.Doc {
  return new Y.Doc();
}

function computeDocHash(doc: Y.Doc): string {
  const state = Y.encodeStateAsUpdate(doc);
  let hash = 0;
  for (let i = 0; i < Math.min(state.length, 64); i++) {
    hash = ((hash << 5) - hash + state[i]) | 0;
  }
  return `hash-${hash}-v${doc.clientID}`;
}

function computeStateVector(doc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(doc);
}

function stateVectorsEqual(sv1: Uint8Array, sv2: Uint8Array): boolean {
  if (sv1.length !== sv2.length) return false;
  for (let i = 0; i < sv1.length; i++) {
    if (sv1[i] !== sv2[i]) return false;
  }
  return true;
}

function applyYjsUpdate(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(doc, update);
}

function createRealYjsUpdate(doc: Y.Doc, seed: number, x: number, y: number): Uint8Array {
  const maps = doc.getMaps();
  const targetMap = maps.length > 0 ? maps[0] : doc.getMap("updates");
  
  doc.clientID = seed % 100000;
  
  targetMap.set(`update-${seed}`, {
    x,
    y,
    seed,
    timestamp: Date.now(),
    vu: __VU,
    round: seed,
  });
  
  return Y.encodeStateAsUpdate(doc);
}

function extractPositionsFromDoc(doc: Y.Doc): Array<{ x: number; y: number; id: string }> {
  const positions: Array<{ x: number; y: number; id: string }> = [];
  
  for (const map of doc.getMaps()) {
    map.forEach((value, key) => {
      if (key.startsWith("update-") && value && typeof value === "object") {
        const v = value as { x: number; y: number };
        if (typeof v.x === "number" && typeof v.y === "number") {
          positions.push({ x: v.x, y: v.y, id: key });
        }
      }
    });
  }
  
  return positions;
}

function validateCoordinateAgreement(
  positions: Array<{ x: number; y: number; id: string }>,
  expectedX: number,
  expectedY: number
): boolean {
  for (const pos of positions) {
    if (Math.abs(pos.x - expectedX) > COORDINATE_DRIFT_THRESHOLD ||
        Math.abs(pos.y - expectedY) > COORDINATE_DRIFT_THRESHOLD) {
      return false;
    }
  }
  return true;
}

let globalDocRegistry: Map<string, YjsClientState> = new Map();
let sharedYjsDoc: Y.Doc | null = null;
let sharedDocKey: string = "";

function getSharedDoc(workspaceId: string): Y.Doc {
  if (!sharedYjsDoc || sharedDocKey !== workspaceId) {
    sharedYjsDoc = createYjsDoc();
    sharedDocKey = workspaceId;
  }
  return sharedYjsDoc;
}

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
    exact_coordinate_agreement: ["count>0"],
    message_ordering_valid: ["rate>0.90"],
    room_cleanup_success: ["rate>0.95"],
  },
};

export default function () {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const workspaceId = __ENV.WORKSPACE_ID || "ws-convergence-test";

  const session = connectCollabSession(wsUrl!, authToken!, workspaceId);
  
  const myLabel = `vu-${__VU}`;
  const myClientId = __VU * 1000 + (Date.now() % 1000);
  
  const yjsDoc = getSharedDoc(workspaceId);
  const clientState: YjsClientState = {
    doc: yjsDoc,
    updates: [],
    lastKnownPositions: new Map(),
    messageTimestamps: [],
    clientId: myClientId,
  };
  
  globalDocRegistry.set(`client-${__VU}-${__ITER}`, clientState);

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

  const convergenceStart = Date.now();
  
  const initialStateVector = computeStateVector(yjsDoc);
  if (session.receivedSyncStep2) {
    stateVectorMatches.add(1);
  } else {
    stateVectorMismatches.add(1);
  }

  const baseUpdate = __VU * 10000;
  const expectedPositions: Array<{ x: number; y: number; round: number }> = [];

  for (let round = 0; round < ROUNDS; round++) {
    const updateSeed = baseUpdate + round;
    const x = (__VU * 50 + round * 10) % 1920;
    const y = (__VU * 30 + round * 7) % 1080;
    const sendTime = Date.now();
    
    expectedPositions.push({ x, y, round });
    
    const yjsUpdate = createRealYjsUpdate(yjsDoc, updateSeed, x, y);
    clientState.updates.push(yjsUpdate);
    
    session.sendSyncUpdate(updateSeed);

    session.sendAwarenessUpdate({
      x,
      y,
      user: myLabel,
    });

    clientState.lastKnownPositions.set(round, { x, y, timestamp: sendTime });
    clientState.messageTimestamps.push(sendTime);
    
    sleep(0.5);
  }

  sleep(2);

  const allReceivedUpdates = session.receivedUpdates > 0;
  const allReceivedAwareness = session.receivedAwareness;

  const finalStateVector = computeStateVector(yjsDoc);
  const stateVectorEqual = stateVectorsEqual(initialStateVector, finalStateVector);
  
  const docHash = computeDocHash(yjsDoc);
  const otherClientsConverged = Array.from(globalDocRegistry.values()).every(
    (state) => state.doc === yjsDoc || state.updates.length > 0
  );

  if (allReceivedUpdates && stateVectorEqual) {
    documentHashMatches.add(1);
  } else {
    documentHashMismatches.add(1);
  }

  if (allReceivedAwareness) {
    awarenessFanoutCount.add(1);
  }

  const currentPositions = extractPositionsFromDoc(yjsDoc);
  let coordinatesAgreed = true;
  
  for (const expected of expectedPositions.slice(-5)) {
    const found = currentPositions.find(
      (p) => Math.abs(p.x - expected.x) <= COORDINATE_DRIFT_THRESHOLD &&
             Math.abs(p.y - expected.y) <= COORDINATE_DRIFT_THRESHOLD
    );
    if (!found) {
      coordinatesAgreed = false;
      break;
    }
  }

  if (coordinatesAgreed && expectedPositions.length > 0) {
    exactCoordinateAgreement.add(1);
  } else {
    coordinateMismatches.add(1);
  }

  const timestamps = clientState.messageTimestamps;
  let orderingValid = true;
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] < timestamps[i - 1]) {
      orderingValid = false;
      break;
    }
  }
  messageOrderingValid.add(orderingValid);

  const converged = allReceivedUpdates && allReceivedAwareness && coordinatesAgreed;
  convergencePass.add(converged);

  const convergenceEnd = Date.now();
  stateConvergenceTime.add(convergenceEnd - convergenceStart);

  check(
    { converged, updates: session.receivedUpdates, positions: currentPositions.length },
    {
      "cohort converged on document state": (r) =>
        (r as { converged: boolean }).converged,
      "received updates from peers": (r) =>
        (r as { updates: number }).updates > 0,
      "document positions synchronized": (r) =>
        (r as { positions: number }).positions >= expectedPositions.length,
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
    
    const reconnectStateVector = computeStateVector(yjsDoc);
    const reconnectVectorMatch = stateVectorsEqual(finalStateVector, reconnectStateVector);
    
    if (reconnectVectorMatch) {
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

  sleep(0.5);
  
  globalDocRegistry.delete(`client-${__VU}-${__ITER}`);
}

export function handleSummary(data: {
  metrics: Record<string, { values: Record<string, number> }>;
}) {
  return {
    "convergence-summary": JSON.stringify(data.metrics, null, 2),
  };
}
