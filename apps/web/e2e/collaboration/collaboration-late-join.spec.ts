import type { Browser, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  createShareLinkForFirstBoard,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";
import { waitForCollabSync } from "../helpers/waits";
import {
  assertNoOrphans,
  captureNormalizedSnapshot,
  compareTaskOrder,
} from "../lib/normalized-state";

interface ThreeUserSetup {
  editorPage: Page;
  ownerPage: Page;
  shareLink: string;
  viewerPage: Page;
}

async function setupThreeUsers(browser: Browser): Promise<ThreeUserSetup> {
  const ownerContext = await browser.newContext();
  const editorContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const editorPage = await editorContext.newPage();
  const viewerPage = await viewerContext.newPage();

  await clearLocalStorageAndIndexedDB(ownerPage);
  await disableAnimations(ownerPage);
  await ownerPage.goto("/");
  await waitForAppReady(ownerPage);

  const createFirstBoardButton = ownerPage.locator(
    '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
  );
  if (await createFirstBoardButton.isVisible()) {
    await createFirstBoardButton.click();
    await ownerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });
  }

  await clearLocalStorageAndIndexedDB(editorPage);
  await disableAnimations(editorPage);
  await editorPage.goto("/");
  await waitForAppReady(editorPage);

  const shareLink = await createShareLinkForFirstBoard(ownerPage);
  await editorPage.goto(shareLink);
  await waitForAppReady(editorPage);

  await editorPage
    .locator('[data-testid="board-node"]')
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });

  await clearLocalStorageAndIndexedDB(viewerPage);
  await disableAnimations(viewerPage);
  await viewerPage.goto("/");
  await waitForAppReady(viewerPage);

  return { ownerPage, editorPage, viewerPage, shareLink };
}

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    await page.close();
  }
}

test.describe("E2E-21: Late Join After Conflict-Heavy Session", () => {
  let ownerPage: Page;
  let editorPage: Page;
  let viewerPage: Page;

  test.beforeEach(async ({ browser }) => {
    const setup = await setupThreeUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
    viewerPage = setup.viewerPage;
  });

  test.afterEach(async () => {
    await cleanupPages([ownerPage, editorPage, viewerPage]);
  });

  test("late joiner sees resolved state after conflicting task title edits", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill(
      '[data-testid="column-name-input"]',
      "Conflict Column"
    );
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const column = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Conflict Column")'
    );
    const addTaskTrigger = column.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Original Title");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    const taskCard = ownerPage.locator(
      '[data-testid="task-card"]:has-text("Original Title")'
    );
    await taskCard.waitFor({ state: "visible", timeout: 10_000 });

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Original Title")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Original Title")')
      .click();
    await ownerPage.waitForSelector('[data-testid="task-detail-modal"]');
    const ownerEditButton = ownerPage.locator(
      '[data-testid="task-detail-edit-button"]'
    );
    await ownerEditButton.click();
    await ownerPage.waitForSelector('[data-testid="task-detail-title-input"]');
    const ownerTitleInput = ownerPage.locator(
      '[data-testid="task-detail-title-input"]'
    );

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Original Title")')
      .click();
    await editorPage.waitForSelector('[data-testid="task-detail-modal"]');
    const editorEditButton = editorPage.locator(
      '[data-testid="task-detail-edit-button"]'
    );
    await editorEditButton.click();
    await editorPage.waitForSelector('[data-testid="task-detail-title-input"]');
    const editorTitleInput = editorPage.locator(
      '[data-testid="task-detail-title-input"]'
    );

    await ownerTitleInput.fill("Owner Final Title");
    await editorTitleInput.fill("Editor Final Title");

    await ownerPage.click('[data-testid="task-detail-save-button"]');
    await editorPage.click('[data-testid="task-detail-save-button"]');
    await ownerPage.waitForTimeout(2000);

    const ownerFinalTitle = await ownerPage
      .locator('[data-testid="task-card"]')
      .first()
      .textContent();
    const editorFinalTitle = await editorPage
      .locator('[data-testid="task-card"]')
      .first()
      .textContent();

    expect(ownerFinalTitle).toBe(editorFinalTitle);
    expect(
      ownerFinalTitle === "Owner Final Title" ||
        ownerFinalTitle === "Editor Final Title"
    ).toBeTruthy();

    await viewerPage.goto(
      `data:text/html,<script>window.location.replace("${await (await ownerPage.context().newPage()).evaluate(() => window.location.href)}")</script>`
    );

    const shareLink = await createShareLinkForFirstBoard(ownerPage);
    await viewerPage.goto(shareLink);
    await waitForAppReady(viewerPage);

    await waitForCollabSync(viewerPage, "board-node", undefined, 10_000);

    const lateJoinerTask = viewerPage
      .locator('[data-testid="task-card"]')
      .first();
    await lateJoinerTask.waitFor({ state: "visible", timeout: 10_000 });

    const viewerFinalTitle = await lateJoinerTask.textContent();
    expect(viewerFinalTitle).toBe(ownerFinalTitle);
    expect(viewerFinalTitle).toBe(editorFinalTitle);
  });

  test("late joiner sees resolved state after conflicting move and edit", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Source Column");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Target Column");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const sourceColumn = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Source Column")'
    );
    const addTaskTrigger = sourceColumn.locator(
      '[data-testid="add-task-trigger"]'
    );
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Move Edit Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Move Edit Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Move Edit Task")')
      .click();
    await ownerPage.waitForSelector('[data-testid="task-detail-modal"]');
    await ownerPage.locator('[data-testid="task-detail-edit-button"]').click();
    await ownerPage.waitForSelector('[data-testid="task-detail-title-input"]');
    await ownerPage
      .locator('[data-testid="task-detail-title-input"]')
      .fill("Owner Edited While Moving");

    const taskCard = sourceColumn.locator(
      '[data-testid="task-card"]:has-text("Move Edit Task")'
    );
    const targetColumn = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Target Column")'
    );

    const taskBox = await taskCard.boundingBox();
    const targetBox = await targetColumn.boundingBox();
    expect(taskBox).not.toBeNull();
    expect(targetBox).not.toBeNull();

    await ownerPage.mouse.move(
      taskBox?.x + taskBox?.width / 2,
      taskBox?.y + taskBox?.height / 2
    );
    await ownerPage.mouse.down();
    await ownerPage.mouse.move(
      targetBox?.x + targetBox?.width / 2,
      targetBox?.y + targetBox?.height / 2,
      { steps: 10 }
    );
    await ownerPage.mouse.up();
    await ownerPage.waitForTimeout(1500);

    await ownerPage.locator('[data-testid="task-detail-save-button"]').click();
    await ownerPage.waitForTimeout(1500);

    const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
    const editorSnapshot = await captureNormalizedSnapshot(editorPage);

    const taskOrderResult = compareTaskOrder(ownerSnapshot, editorSnapshot);
    expect(taskOrderResult.match).toBe(true);

    assertNoOrphans(ownerSnapshot);
    assertNoOrphans(editorSnapshot);

    const shareLink = await createShareLinkForFirstBoard(ownerPage);
    await viewerPage.goto(shareLink);
    await waitForAppReady(viewerPage);

    await waitForCollabSync(viewerPage, "board-node", undefined, 10_000);

    const viewerSnapshot = await captureNormalizedSnapshot(viewerPage);
    const viewerTaskOrderResult = compareTaskOrder(
      ownerSnapshot,
      viewerSnapshot
    );
    expect(viewerTaskOrderResult.match).toBe(true);

    assertNoOrphans(viewerSnapshot);
  });
});
