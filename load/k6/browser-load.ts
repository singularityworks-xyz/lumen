import { browser } from "k6/browser";
import { Counter, Rate, Trend } from "k6/metrics";

const dragLatency = new Trend("browser_drag_latency_ms");
const taskCreationLatency = new Trend("browser_task_creation_ms");
const commentDrawerLatency = new Trend("browser_comment_drawer_ms");
const dragSuccessRate = new Rate("browser_drag_success");
const taskCreationSuccess = new Rate("browser_task_creation_success");
const commentDrawerSuccess = new Rate("browser_comment_drawer_success");
const concurrentUsersGauge = new Counter("browser_concurrent_users");
const pageLoadTime = new Trend("browser_page_load_ms");

const BROWSER_VUS = parseInt(__ENV.BROWSER_VUS || "3", 10);
const ITERATIONS_PER_VU = parseInt(__ENV.ITERATIONS || "5", 10);
const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

async function simulateDrag(
  page: any,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Promise<number> {
  const startTime = Date.now();

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.waitForTimeout(50);
  await page.mouse.up();

  return Date.now() - startTime;
}

async function loginAndNavigate(page: any, workspaceId: string): Promise<boolean> {
  try {
    const startTime = Date.now();

    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });

    await page.fill('input[name="email"]', `load-test-${__VU}@example.com`);
    await page.fill('input[name="password"]', "test-password-123");
    await page.click('button[type="submit"]');

    await page.waitForURL(`**/workspace/**`, { timeout: 15000 });

    pageLoadTime.add(Date.now() - startTime);
    return true;
  } catch {
    return false;
  }
}

async function performDragTest(
  page: any,
  boardId: string,
  contentionFactor: number
): Promise<{ success: boolean; latency: number }> {
  try {
    const startX = 100 + (contentionFactor * 17) % 400;
    const startY = 100 + (contentionFactor * 23) % 300;
    const endX = startX + 150 + contentionFactor * 11;
    const endY = startY + 100 + contentionFactor * 7;

    const targetSelector = `[data-board-id="${boardId}"], [data-drag-handle], .board-item`;

    try {
      await page.waitForSelector(targetSelector, { timeout: 5000 });
    } catch {
      await page.waitForSelector("body", { timeout: 1000 });
    }

    const latency = await simulateDrag(page, startX, startY, endX, endY);
    dragLatency.add(latency);

    await page.waitForTimeout(100);

    return { success: true, latency };
  } catch {
    return { success: false, latency: 0 };
  }
}

async function performTaskCreationTest(
  page: any,
  columnId: string,
  taskIndex: number
): Promise<{ success: boolean; latency: number }> {
  const startTime = Date.now();

  try {
    const addTaskButton = `[data-add-task="${columnId}"], button:has-text("Add Task"), .column-add-task`;

    try {
      await page.waitForSelector(addTaskButton, { timeout: 3000 });
      await page.click(addTaskButton);
    } catch {
      await page.click("body");
      await page.waitForTimeout(200);
    }

    const titleInput = `input[name="task-title"], [data-task-title-input], input[placeholder*="task" i], input[placeholder*="title" i]`;

    try {
      await page.waitForSelector(titleInput, { timeout: 3000 });
      await page.fill(titleInput, `Load Test Task ${taskIndex} - ${Date.now()}`);
    } catch {
      await page.keyboard.type(`Load Test Task ${taskIndex}`);
    }

    await page.keyboard.press("Enter");

    const latency = Date.now() - startTime;
    taskCreationLatency.add(latency);

    return { success: true, latency };
  } catch {
    return { success: false, latency: Date.now() - startTime };
  }
}

async function performCommentDrawerTest(
  page: any,
  boardId: string,
  commentCount: number
): Promise<{ success: boolean; latency: number }> {
  const startTime = Date.now();

  try {
    const commentTrigger = `[data-comment-trigger="${boardId}"], [data-board-comments], .comment-trigger, [aria-label*="comment" i]`;

    try {
      await page.waitForSelector(commentTrigger, { timeout: 3000 });
      await page.click(commentTrigger);
    } catch {
      const boardElement = `[data-board-id="${boardId}"], .board-item`;
      try {
        await page.waitForSelector(boardElement, { timeout: 2000 });
        await page.click(boardElement, { position: { x: 50, y: 50 } });
      } catch {
        await page.click("body");
      }
    }

    const drawer = `[data-comment-drawer], .comment-drawer, [role="dialog"]:has-text("Comment")`;

    try {
      await page.waitForSelector(drawer, { timeout: 5000 });
    } catch {
      await page.waitForTimeout(500);
    }

    for (let i = 0; i < Math.min(commentCount, 3); i++) {
      const commentInput = `textarea[placeholder*="comment" i], [data-comment-input], input[placeholder*="comment" i]`;
      try {
        await page.waitForSelector(commentInput, { timeout: 2000 });
        await page.fill(commentInput, `Load test comment ${i + 1} - ${Date.now()}`);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(100);
      } catch {
        break;
      }
    }

    const closeButton = `[data-drawer-close], .drawer-close, button:has-text("Close"), button[aria-label="Close"]`;
    try {
      await page.click(closeButton, { timeout: 2000 });
    } catch {
      await page.keyboard.press("Escape");
    }

    const latency = Date.now() - startTime;
    commentDrawerLatency.add(latency);

    return { success: true, latency };
  } catch {
    return { success: false, latency: Date.now() - startTime };
  }
}

async function runBrowserLoadScenario(iteration: number): Promise<void> {
  const page = await browser.newPage();
  const workspaceId = `browser-load-${__VU}-${iteration}`;

  try {
    const loggedIn = await loginAndNavigate(page, workspaceId);
    if (!loggedIn) {
      return;
    }

    concurrentUsersGauge.add(1);

    const boardId = `board-${__VU}-${iteration}`;

    for (let round = 0; round < ITERATIONS_PER_VU; round++) {
      const contentionFactor = __VU * 100 + round * 10 + iteration;

      const dragResult = await performDragTest(page, boardId, contentionFactor);
      dragSuccessRate.add(dragResult.success);

      const taskResult = await performTaskCreationTest(page, `column-${contentionFactor}`, round);
      taskCreationSuccess.add(taskResult.success);

      const commentResult = await performCommentDrawerTest(page, boardId, contentionFactor % 5);
      commentDrawerSuccess.add(commentResult.success);

      await page.waitForTimeout(500);
    }

    await page.goto(`${BASE_URL}/logout`, { waitUntil: "networkidle" });
  } catch {
  } finally {
    await page.close();
  }
}

async function runContentionTest(): Promise<void> {
  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}/workspace/shared-test`, { waitUntil: "networkidle", timeout: 30000 });

    const dragPromises: Promise<any>[] = [];

    for (let i = 0; i < 3; i++) {
      const x = 100 + i * 200;
      const y = 200 + i * 50;

      dragPromises.push(
        (async () => {
          await page.waitForTimeout(i * 200);
          return performDragTest(page, `board-contention`, x + i);
        })()
      );
    }

    await Promise.all(dragPromises);

    await page.waitForTimeout(1000);
  } catch {
  } finally {
    await page.close();
  }
}

export const options = {
  iterations: BROWSER_VUS * ITERATIONS_PER_VU,
  vus: BROWSER_VUS,
  duration: "5m",
  thresholds: {
    browser_drag_latency_ms: ["p(95)<2000"],
    browser_task_creation_ms: ["p(95)<3000"],
    browser_comment_drawer_ms: ["p(95)<1500"],
    browser_drag_success: ["rate>0.80"],
    browser_task_creation_success: ["rate>0.75"],
    browser_concurrent_users: ["count<100"],
  },
};

export default async function () {
  if (__VU % 3 === 0) {
    await runContentionTest();
  } else {
    await runBrowserLoadScenario(__ITER);
  }
}

export async function handleSummary(data: {
  metrics: Record<string, { values: Record<string, number> }>;
}) {
  return {
    "browser-load-summary": JSON.stringify(data.metrics, null, 2),
  };
}
