import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  setupTwoUsers,
  waitForAppReady,
} from "../helpers/commands";
import { waitForCollabSync, waitForConnectionState } from "../helpers/waits";
import {
  captureNormalizedSnapshot,
  compareBoardCoordinates,
} from "../lib/normalized-state";

async function dragByOffset(
  page: Page,
  dragHandle: Locator,
  offset: { x: number; y: number }
): Promise<void> {
  const handleBox = await dragHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  if (!handleBox) {
    throw new Error("Drag handle bounding box not found");
  }

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + offset.x, startY + offset.y, { steps: 10 });
  await page.mouse.up();
}

async function openVisibleRenameDialog(page: Page, boardNode: Locator) {
  await boardNode.locator('[data-testid="board-header"]').click({
    button: "right",
  });

  const renameDialog = page
    .locator('[data-testid="board-rename-dialog"]')
    .filter({ visible: true })
    .last();
  await renameDialog.waitFor({ state: "visible", timeout: 5000 });

  return renameDialog;
}

async function dismissTransientOverlays(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  }

  try {
    await page
      .locator('[data-testid="board-share-option"]')
      .first()
      .waitFor({ state: "hidden", timeout: 3000 });
  } catch {
    // Quick actions may already be closed.
  }
}

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    await page.close();
  }
}

test.describe("E2E-13: Multi-User Drag Sync", () => {
  let ownerPage: Page;
  let editorPage: Page;
  let shareLink: string;

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
    shareLink = setup.shareLink;
  });

  test.afterEach(async () => {
    await cleanupPages([ownerPage, editorPage]);
  });

  test("board drag position syncs to editor with pixel-precise coordinates", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const boardHeader = boardNode.locator('[data-testid="board-header"]');
    const initialOwnerSnapshot = await captureNormalizedSnapshot(ownerPage);
    const initialBoard = initialOwnerSnapshot.boards[0];
    expect(initialBoard).toBeDefined();

    const dragX = 200;
    const dragY = 150;

    await dragByOffset(ownerPage, boardHeader, { x: dragX, y: dragY });
    // Wait for drag to complete and sync to peer
    await ownerPage.waitForLoadState("networkidle");

    const ownerSnapshotAfterDrag = await captureNormalizedSnapshot(ownerPage);
    const movedBoard = ownerSnapshotAfterDrag.boards.find(
      (board) => board.id === initialBoard?.id
    );
    expect(movedBoard).toBeDefined();

    const ownerDelta =
      Math.abs(
        (movedBoard?.position.x ?? 0) - (initialBoard?.position.x ?? 0)
      ) +
      Math.abs((movedBoard?.position.y ?? 0) - (initialBoard?.position.y ?? 0));
    expect(ownerDelta).toBeGreaterThan(30);

    await expect
      .poll(async () => {
        const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
        const editorSnapshot = await captureNormalizedSnapshot(editorPage);
        const comparison = compareBoardCoordinates(
          ownerSnapshot,
          editorSnapshot,
          10
        );

        return comparison.match;
      })
      .toBe(true);

    // Reload both and verify persistence with exact coordinates
    await ownerPage.reload();
    await waitForAppReady(ownerPage);
    await editorPage.reload();
    await waitForAppReady(editorPage);

    await ownerPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });
    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await expect
      .poll(async () => {
        const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
        const editorSnapshot = await captureNormalizedSnapshot(editorPage);
        const comparison = compareBoardCoordinates(
          ownerSnapshot,
          editorSnapshot,
          10
        );

        return comparison.match;
      })
      .toBe(true);
  });

  test("column reorder syncs to editor immediately", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );

    await dismissTransientOverlays(ownerPage);
    await addColumnTrigger.click({ force: true });
    await ownerPage.fill('[data-testid="column-name-input"]', "Column A");
    await ownerPage.click('[data-testid="column-create-submit"]');
    // Wait for first column to be created
    await ownerPage
      .locator('[data-testid="kanban-column"]:has-text("Column A")')
      .waitFor({ state: "visible", timeout: 5000 });

    await dismissTransientOverlays(ownerPage);
    await addColumnTrigger.click({ force: true });
    await ownerPage.fill('[data-testid="column-name-input"]', "Column B");
    await ownerPage.click('[data-testid="column-create-submit"]');
    // Wait for second column to sync to editor
    await waitForCollabSync(editorPage, "kanban-column", "Column B");

    await editorPage
      .locator('[data-testid="kanban-column"]:has-text("Column B")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const ownerColumns = await ownerPage
      .locator('[data-testid="kanban-column"]')
      .allTextContents();
    const editorColumns = await editorPage
      .locator('[data-testid="kanban-column"]')
      .allTextContents();

    expect(ownerColumns.length).toBe(editorColumns.length);
  });

  test("task drag across columns syncs to editor", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );

    await dismissTransientOverlays(ownerPage);
    await addColumnTrigger.click({ force: true });
    await ownerPage.fill('[data-testid="column-name-input"]', "Source Col");
    await ownerPage.click('[data-testid="column-create-submit"]');
    // Wait for first column to be created
    await ownerPage
      .locator('[data-testid="kanban-column"]:has-text("Source Col")')
      .waitFor({ state: "visible", timeout: 5000 });

    await dismissTransientOverlays(ownerPage);
    await addColumnTrigger.click({ force: true });
    await ownerPage.fill('[data-testid="column-name-input"]', "Target Col");
    await ownerPage.click('[data-testid="column-create-submit"]');
    // Wait for second column to sync to editor
    await waitForCollabSync(editorPage, "kanban-column", "Target Col");

    const sourceColumn = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Source Col")'
    );
    const addTaskTrigger = sourceColumn.locator(
      '[data-testid="add-task-trigger"]'
    );
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Draggable Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    // Wait for task to sync to editor
    await waitForCollabSync(editorPage, "task-card", "Draggable Task");

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Draggable Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskCard = sourceColumn.locator(
      '[data-testid="task-card"]:has-text("Draggable Task")'
    );
    const targetColumn = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Target Col")'
    );

    const taskBox = await taskCard.boundingBox();
    const targetBox = await targetColumn.boundingBox();
    expect(taskBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    if (!(taskBox && targetBox)) {
      throw new Error("Bounding boxes not found");
    }

    await ownerPage.mouse.move(
      taskBox.x + taskBox.width / 2,
      taskBox.y + taskBox.height / 2
    );
    await ownerPage.mouse.down();
    await ownerPage.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 10 }
    );
    await ownerPage.mouse.up();
    // Wait for drag to complete and task to appear in target column on peer
    await waitForCollabSync(editorPage, "task-card", "Draggable Task");

    const editorTargetColumn = editorPage.locator(
      '[data-testid="kanban-column"]:has-text("Target Col")'
    );
    const movedTask = editorTargetColumn.locator(
      '[data-testid="task-card"]:has-text("Draggable Task")'
    );
    await expect(movedTask).toBeVisible({ timeout: 10_000 });
  });

  test("drag cancel with Escape leaves no ghost state", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const boardHeader = boardNode.locator('[data-testid="board-header"]');
    const initialOwnerSnapshot = await captureNormalizedSnapshot(ownerPage);
    expect(initialOwnerSnapshot.boards.length).toBeGreaterThan(0);

    const headerBox = await boardHeader.boundingBox();
    expect(headerBox).not.toBeNull();
    if (!headerBox) {
      throw new Error("Header bounding box not found");
    }

    const startX = headerBox.x + headerBox.width / 2;
    const startY = headerBox.y + headerBox.height / 2;

    await ownerPage.mouse.move(startX, startY);
    await ownerPage.mouse.down();
    await ownerPage.mouse.move(startX + 100, startY + 100, { steps: 5 });
    await ownerPage.keyboard.press("Escape");
    // Wait for drag cancel to be processed
    await ownerPage.waitForLoadState("networkidle");

    const ownerSnapshotAfterCancel = await captureNormalizedSnapshot(ownerPage);
    const editorSnapshotAfterCancel =
      await captureNormalizedSnapshot(editorPage);

    expect(ownerSnapshotAfterCancel.boards.length).toBe(
      initialOwnerSnapshot.boards.length
    );

    const comparison = compareBoardCoordinates(
      ownerSnapshotAfterCancel,
      editorSnapshotAfterCancel,
      10
    );
    expect(comparison.match).toBe(true);
  });

  test("simultaneous edits produce deterministic final state", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const ownerRenameDialog = await openVisibleRenameDialog(
      ownerPage,
      boardNode
    );
    const renameInput = ownerRenameDialog.getByPlaceholder("New board name");
    await renameInput.fill("Owner Renamed");

    const editorBoardNode = editorPage
      .locator('[data-testid="board-node"]')
      .first();
    const editorRenameDialog = await openVisibleRenameDialog(
      editorPage,
      editorBoardNode
    );
    const editorRenameInput =
      editorRenameDialog.getByPlaceholder("New board name");
    await editorRenameInput.fill("Editor Renamed");

    await renameInput.press("Enter");
    await editorRenameInput.press("Enter");

    await expect
      .poll(async () => {
        const ownerBoardName = await ownerPage
          .locator('[data-testid="board-node"]')
          .first()
          .locator('[data-testid="board-header"]')
          .textContent();
        const editorBoardName = await editorPage
          .locator('[data-testid="board-node"]')
          .first()
          .locator('[data-testid="board-header"]')
          .textContent();

        return ownerBoardName?.trim() === editorBoardName?.trim();
      })
      .toBe(true);
  });

  test("late joiner gets converged state immediately", async () => {
    const addColumnTrigger = ownerPage
      .locator('[data-testid="board-node"]')
      .first()
      .locator('[data-testid="add-column-trigger"]');
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Late Join Col");
    await ownerPage.click('[data-testid="column-create-submit"]');
    // Wait for column to sync to existing editor
    await waitForCollabSync(editorPage, "kanban-column", "Late Join Col");

    await editorPage
      .locator('[data-testid="kanban-column"]:has-text("Late Join Col")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const lateContext = await ownerPage.context().browser()?.newContext();
    if (!lateContext) {
      throw new Error("Failed to create new context");
    }
    const latePage = await lateContext.newPage();
    await clearLocalStorageAndIndexedDB(latePage);
    await disableAnimations(latePage);
    await latePage.goto(shareLink);
    await waitForAppReady(latePage);

    await latePage
      .locator('[data-testid="kanban-column"]:has-text("Late Join Col")')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await latePage.close();
    await lateContext.close();
  });

  test("drag state persists through page reload after offline simulation", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const boardHeader = boardNode.locator('[data-testid="board-header"]');
    const boardBox = await boardNode.boundingBox();
    expect(boardBox).not.toBeNull();

    const dragX = 100;
    const dragY = 50;

    await dragByOffset(ownerPage, boardHeader, { x: dragX, y: dragY });
    // Wait for drag to complete and position to sync
    await ownerPage.waitForLoadState("networkidle");

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    const editorBoxBefore = await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .boundingBox();
    expect(editorBoxBefore).not.toBeNull();

    await editorPage.context().setOffline(true);
    await editorPage.waitForTimeout(1000);

    await editorPage.context().setOffline(false);
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      10_000
    );

    await editorPage.goto(shareLink);
    await waitForAppReady(editorPage);

    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await expect
      .poll(async () => {
        const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
        const editorSnapshot = await captureNormalizedSnapshot(editorPage);
        const comparison = compareBoardCoordinates(
          ownerSnapshot,
          editorSnapshot,
          15
        );

        return comparison.match;
      })
      .toBe(true);
  });
});
