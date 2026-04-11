import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { connectCollabSession } from "./lib/collab-session";
import { browser } from "k6/browser";

const wsConnectSuccess = new Rate("hybrid_ws_connect_success");
const wsUpdateLatency = new Trend("hybrid_ws_update_latency_ms");
const wsUpdatesSent = new Counter("hybrid_ws_updates_sent");
const wsUpdatesReceived = new Counter("hybrid_ws_updates_received");
const wsAwarenessSent = new Counter("hybrid_ws_awareness_sent");

const browserDragLatency = new Trend("hybrid_browser_drag_latency_ms");
const browserDragSuccess = new Rate("hybrid_browser_drag_success");
const browserConcurrentUsers = new Counter("hybrid_browser_concurrent_users");

const PROTOCOL_VUS = 50;
const BROWSER_VUS = 3;
const DRAG_ITERATIONS = 5;
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

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

async function runProtocolVu(wsUrl: string, authToken: string, workspaceId: string): Promise<void> {
  const session = connectCollabSession(wsUrl, authToken, workspaceId);

  if (!session.established) {
    wsConnectSuccess.add(false);
    return;
  }

  wsConnectSuccess.add(true);

  const myLabel = `hybrid-protocol-${__VU}`;
  const baseUpdate = __VU * 10000;

  for (let round = 0; round < 10; round++) {
    const updateStart = Date.now();
    session.sendSyncUpdate(baseUpdate + round);

    session.sendAwarenessUpdate({
      x: (__VU * 50 + round * 10) % 1920,
      y: (__VU * 30 + round * 7) % 1080,
      user: myLabel,
    });

    const updateEnd = Date.now();
    wsUpdateLatency.add(updateEnd - updateStart);
    wsUpdatesSent.add(1);

    sleep(0.1);
  }

  sleep(1);

  if (session.receivedUpdates > 0) {
    wsUpdatesReceived.add(1);
  }

  session.disconnect();
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
  const wsUrl = __ENV.WS_URL;
  const authToken = __ENV.AUTH_TOKEN;
  const workspaceId = __ENV.WORKSPACE_ID || "hybrid-load-test";

  if (!wsUrl || !authToken) {
    console.error("WS_URL and AUTH_TOKEN environment variables are required for protocol VUs");
    return;
  }

  await runProtocolVu(wsUrl, authToken, workspaceId);
}

export function handleSummary(data: {
  metrics: Record<string, { values: Record<string, number> }>;
}) {
  return {
    "hybrid-load-summary": JSON.stringify(data.metrics, null, 2),
  };
}
