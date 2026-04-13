import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { connectCollabSession } from "./lib/collab-session";
import { browser } from "k6/browser";
import * as Y from "yjs";

const wsConnectSuccess = new Rate("hybrid_ws_connect_success");
const wsUpdateLatency = new Trend("hybrid_ws_update_latency_ms");
const wsUpdatesSent = new Counter("hybrid_ws_updates_sent");
const wsUpdatesReceived = new Counter("hybrid_ws_updates_received");
const wsAwarenessSent = new Counter("hybrid_ws_awareness_sent");

const browserDragLatency = new Trend("hybrid_browser_drag_latency_ms");
const browserDragSuccess = new Rate("hybrid_browser_drag_success");
const browserConcurrentUsers = new Counter("hybrid_browser_concurrent_users");

const stateVectorMatches = new Counter("hybrid_state_vector_matches");
const stateVectorMismatches = new Counter("hybrid_state_vector_mismatches");
const documentHashMatches = new Counter("hybrid_document_hash_matches");
const documentHashMismatches = new Counter("hybrid_document_hash_mismatches");
const exactCoordinateAgreement = new Counter("hybrid_exact_coordinate_agreement");
const coordinateMismatches = new Counter("hybrid_coordinate_mismatches");
const hybridConvergencePass = new Rate("hybrid_convergence_pass");
const awarenessFanoutComplete = new Counter("hybrid_awareness_fanout_complete");
const awarenessDropped = new Counter("hybrid_awareness_dropped");
const stalePeerResidue = new Counter("hybrid_stale_peer_residue");
const roomCleanupSuccess = new Rate("hybrid_room_cleanup_success");

const PROTOCOL_VUS = 50;
const BROWSER_VUS = 3;
const DRAG_ITERATIONS = 5;
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const COORDINATE_DRIFT_THRESHOLD = 5;

let globalYjsDoc: Y.Doc | null = null;
let globalWorkspaceId: string = "";
const globalSentUpdates: Map<string, { x: number; y: number; seed: number; round: number }> = new Map();

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

function createYjsUpdate(doc: Y.Doc, seed: number, x: number, y: number, round: number): Uint8Array {
  const maps = doc.getMaps();
  const targetMap = maps.length > 0 ? maps[0] : doc.getMap("updates");
  doc.clientID = seed % 100000;
  targetMap.set(`update-${seed}`, {
    x,
    y,
    seed,
    timestamp: Date.now(),
    vu: __VU,
    round,
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

function getSharedYjsDoc(workspaceId: string): Y.Doc {
  if (!globalYjsDoc || globalWorkspaceId !== workspaceId) {
    globalYjsDoc = new Y.Doc();
    globalWorkspaceId = workspaceId;
  }
  return globalYjsDoc;
}

async function performBrowserDrag(page: any, boardId: string, contentionFactor: number): Promise<number> {
  const startX = 100 + (contentionFactor * 17) % 400;
  const startY = 100 + (contentionFactor * 23) % 300;
  const endX = startX + 150 + contentionFactor * 11;
  const endY = startY + 100 + contentionFactor * 7;

  const startTime = Date.now();

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.waitForTimeout(50);
  await page.mouse.up();

  return Date.now() - startTime;
}

async function runBrowserScenario(page: any, iteration: number): Promise<void> {
  const workspaceId = `hybrid-browser-${__VU}-${iteration}`;

  try {
    await page.goto(`${BASE_URL}/workspace/${workspaceId}`, { waitUntil: "networkidle", timeout: 30000 });
    browserConcurrentUsers.add(1);

    const boardId = `hybrid-board-${__VU}`;

    for (let round = 0; round < DRAG_ITERATIONS; round++) {
      const contentionFactor = __VU * 100 + round * 10 + iteration;

      try {
        const latency = await performBrowserDrag(page, boardId, contentionFactor);
        browserDragLatency.add(latency);
        browserDragSuccess.add(true);
      } catch {
        browserDragSuccess.add(false);
      }

      await page.waitForTimeout(200);
    }
  } catch {
    browserDragSuccess.add(false);
  }
}

export async function runProtocolVu(): Promise<void> {
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const workspaceId = __ENV.WORKSPACE_ID || "hybrid-load-test";

  if (!wsUrl || !authToken) {
    console.error("WS_URL and AUTH_TOKEN environment variables are required for protocol VUs");
    return;
  }

  const session = connectCollabSession(wsUrl, authToken, workspaceId);

  if (!session.established) {
    wsConnectSuccess.add(false);
    return;
  }

  wsConnectSuccess.add(true);

  const myLabel = `hybrid-protocol-${__VU}`;
  const baseUpdate = __VU * 10000;
  const yjsDoc = getSharedYjsDoc(workspaceId);

  const initialStateVector = computeStateVector(yjsDoc);
  let initialHash = "";

  sleep(1);

  if (session.receivedSyncStep2) {
    stateVectorMatches.add(1);
    initialHash = computeDocHash(yjsDoc);
  } else {
    stateVectorMismatches.add(1);
  }

  const expectedPositions: Array<{ x: number; y: number; seed: number; round: number }> = [];

  for (let round = 0; round < 10; round++) {
    const updateStart = Date.now();
    const seed = baseUpdate + round;
    const x = (__VU * 50 + round * 10) % 1920;
    const y = (__VU * 30 + round * 7) % 1080;

    const yjsUpdate = createYjsUpdate(yjsDoc, seed, x, y, round);
    globalSentUpdates.set(`vu-${__VU}-round-${round}`, { x, y, seed, round });
    session.sendSyncUpdate(seed);

    session.sendAwarenessUpdate({ x, y, user: myLabel });

    const updateEnd = Date.now();
    wsUpdateLatency.add(updateEnd - updateStart);
    wsUpdatesSent.add(1);
    expectedPositions.push({ x, y, seed, round });

    sleep(0.1);
  }

  sleep(2);

  if (session.receivedUpdates > 0) {
    wsUpdatesReceived.add(1);
  }

  const finalStateVector = computeStateVector(yjsDoc);
  const stateVectorEqual = stateVectorsEqual(initialStateVector, finalStateVector);

  if (stateVectorEqual && session.receivedUpdates > 0) {
    stateVectorMatches.add(1);
    documentHashMatches.add(1);
  } else {
    stateVectorMismatches.add(1);
    documentHashMismatches.add(1);
  }

  if (session.receivedAwareness) {
    awarenessFanoutComplete.add(1);
  } else {
    awarenessDropped.add(1);
  }

  const currentPositions = extractPositionsFromDoc(yjsDoc);
  let coordinatesAgreed = true;

  for (const expected of expectedPositions) {
    const found = currentPositions.find(
      (p) =>
        Math.abs(p.x - expected.x) <= COORDINATE_DRIFT_THRESHOLD &&
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

  const converged =
    session.receivedUpdates > 0 &&
    session.receivedAwareness &&
    coordinatesAgreed &&
    stateVectorEqual;
  hybridConvergencePass.add(converged);

  session.disconnect();
  sleep(1);

  const reconnectSession = connectCollabSession(wsUrl, authToken, workspaceId);

  if (reconnectSession.established) {
    sleep(1);
    if (reconnectSession.receivedSyncStep2) {
      const reconnectStateVector = computeStateVector(yjsDoc);
      const vectorMatch = stateVectorsEqual(finalStateVector, reconnectStateVector);
      if (vectorMatch) {
        stateVectorMatches.add(1);
        roomCleanupSuccess.add(true);
      } else {
        stateVectorMismatches.add(1);
        stalePeerResidue.add(1);
        roomCleanupSuccess.add(false);
      }
    }
    reconnectSession.disconnect();
  } else {
    roomCleanupSuccess.add(false);
    stalePeerResidue.add(1);
  }
}

export const options = {
  scenarios: {
    protocolLoad: {
      executor: "shared-iterations",
      vus: PROTOCOL_VUS,
      maxVUs: PROTOCOL_VUS,
      iterations: PROTOCOL_VUS,
      gracefulStop: "30s",
      exec: "runProtocolVu",
    },
    browserLoad: {
      executor: "shared-iterations",
      vus: BROWSER_VUS,
      maxVUs: BROWSER_VUS * 2,
      iterations: BROWSER_VUS * DRAG_ITERATIONS,
      gracefulStop: "30s",
      exec: "runBrowserVu",
    },
  },
  thresholds: {
    hybrid_ws_connect_success: ["rate>0.95"],
    hybrid_ws_update_latency_ms: ["p(95)<500"],
    hybrid_ws_updates_sent: ["count>0"],
    hybrid_browser_drag_latency_ms: ["p(95)<2000"],
    hybrid_browser_drag_success: ["rate>0.80"],
    hybrid_state_vector_matches: ["count>0"],
    hybrid_document_hash_matches: ["count>0"],
    hybrid_exact_coordinate_agreement: ["count>0"],
    hybrid_convergence_pass: ["rate>0.90"],
    hybrid_room_cleanup_success: ["rate>0.95"],
  },
};

export async function runBrowserVu() {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  try {
    await runBrowserScenario(page, __ITER);
  } finally {
    await page.close();
  }
}

export default async function () {
  await runProtocolVu();
}

export function handleSummary(data: {
  metrics: Record<string, { values: Record<string, number> }>;
}) {
  return {
    "hybrid-load-summary": JSON.stringify(data.metrics, null, 2),
  };
}
