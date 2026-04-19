import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsersCrossBrowser } from "../helpers/commands";
import { waitForCollabSync } from "../helpers/waits";

async function openVisibleRenameDialog(page: Page): Promise<Locator> {
  const renameDialog = page
    .locator('[data-testid="board-rename-dialog"]')
    .filter({ visible: true })
    .last();
  await renameDialog.waitFor({ state: "visible", timeout: 5000 });
  return renameDialog;
}

test.describe("E2E-18: Cross-Browser Sync (Chrome ↔ Firefox)", () => {
  test.skip(
    !process.env.CROSS_BROWSER,
    "Set CROSS_BROWSER=1 to run cross-browser tests"
  );

  test("board drag on Chrome syncs pixel-precise to Firefox editor", async ({
    browser,
    playwright,
  }) => {
    const { ownerPage, editorPage } = await setupTwoUsersCrossBrowser(
      browser,
      playwright.firefox
    );

    try {
      const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
      const boardHeader = boardNode.locator('[data-testid="board-header"]');
      const boardBox = await boardNode.boundingBox();
      expect(boardBox).not.toBeNull();

      const headerBox = await boardHeader.boundingBox();
      expect(headerBox).not.toBeNull();

      const startX = headerBox?.x + headerBox?.width / 2;
      const startY = headerBox?.y + headerBox?.height / 2;
      const dragX = 200;
      const dragY = 150;

      // Drag on Chrome
      await ownerPage.mouse.move(startX, startY);
      await ownerPage.mouse.down();
      await ownerPage.mouse.move(startX + dragX, startY + dragY, {
        steps: 10,
      });
      await ownerPage.mouse.up();
      // Wait for drag to sync to Firefox
      await ownerPage.waitForLoadState("networkidle");

      // Verify Chrome position moved
      const ownerBox = await boardNode.boundingBox();
      expect(ownerBox).not.toBeNull();
      const ownerDelta =
        Math.abs(ownerBox?.x - boardBox?.x) +
        Math.abs(ownerBox?.y - boardBox?.y);
      expect(ownerDelta).toBeGreaterThan(30);

      // Verify Firefox sees the same position
      const editorBoard = editorPage
        .locator('[data-testid="board-node"]')
        .first();
      await expect
        .poll(async () => {
          const ownerCurrent = await boardNode.boundingBox();
          const editorCurrent = await editorBoard.boundingBox();

          if (!(ownerCurrent && editorCurrent)) {
            return Number.POSITIVE_INFINITY;
          }

          return Math.max(
            Math.abs(editorCurrent.x - ownerCurrent.x),
            Math.abs(editorCurrent.y - ownerCurrent.y)
          );
        })
        .toBeLessThan(15);
    } finally {
      await editorPage.close();
      await editorPage.context().browser()?.close();
      await ownerPage.close();
    }
  });

  test("task drag across columns on Chrome syncs to Firefox editor", async ({
    browser,
    playwright,
  }) => {
    const { ownerPage, editorPage } = await setupTwoUsersCrossBrowser(
      browser,
      playwright.firefox
    );

    try {
      // Create two columns on Chrome
      const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
      const addColumnTrigger = boardNode.locator(
        '[data-testid="add-column-trigger"]'
      );

      await addColumnTrigger.click();
      await ownerPage.fill('[data-testid="column-name-input"]', "XF Col A");
      await ownerPage.click('[data-testid="column-create-submit"]');
      // Wait for first column to be created
      await ownerPage
        .locator('[data-testid="kanban-column"]:has-text("XF Col A")')
        .waitFor({ state: "visible", timeout: 5000 });

      await addColumnTrigger.click();
      await ownerPage.fill('[data-testid="column-name-input"]', "XF Col B");
      await ownerPage.click('[data-testid="column-create-submit"]');
      // Wait for second column to sync to Firefox
      await waitForCollabSync(editorPage, "kanban-column", "XF Col B");

      // Verify Firefox sees both columns
      await editorPage
        .locator('[data-testid="kanban-column"]:has-text("XF Col B")')
        .waitFor({ state: "visible", timeout: 10_000 });

      // Create task in source column on Chrome
      const sourceColumn = ownerPage.locator(
        '[data-testid="kanban-column"]:has-text("XF Col A")'
      );
      await sourceColumn.locator('[data-testid="add-task-trigger"]').click();
      await ownerPage.fill(
        '[data-testid="task-title-input"]',
        "Cross-Browser Task"
      );
      await ownerPage.click('[data-testid="task-create-submit"]');
      // Wait for task to sync to Firefox
      await waitForCollabSync(editorPage, "task-card", "Cross-Browser Task");

      // Wait for Firefox to see the task
      await editorPage
        .locator('[data-testid="task-card"]:has-text("Cross-Browser Task")')
        .waitFor({ state: "visible", timeout: 10_000 });

      // Drag task from Col A to Col B on Chrome
      const taskCard = sourceColumn.locator(
        '[data-testid="task-card"]:has-text("Cross-Browser Task")'
      );
      const targetColumn = ownerPage.locator(
        '[data-testid="kanban-column"]:has-text("XF Col B")'
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
      // Wait for drag to complete and task to appear in target column on Firefox
      await waitForCollabSync(editorPage, "task-card", "Cross-Browser Task");

      // Verify Firefox shows the task in the target column
      const editorTargetColumn = editorPage.locator(
        '[data-testid="kanban-column"]:has-text("XF Col B")'
      );
      const movedTask = editorTargetColumn.locator(
        '[data-testid="task-card"]:has-text("Cross-Browser Task")'
      );
      await expect(movedTask).toBeVisible({ timeout: 10_000 });
    } finally {
      await editorPage.close();
      await editorPage.context().browser()?.close();
      await ownerPage.close();
    }
  });

  test("cursor position on Chrome appears in Firefox", async ({
    browser,
    playwright,
  }) => {
    const { ownerPage, editorPage } = await setupTwoUsersCrossBrowser(
      browser,
      playwright.firefox
    );

    try {
      // Move Chrome cursor over the board
      const editorBoard = editorPage
        .locator('[data-testid="board-node"]')
        .first();
      await editorBoard.waitFor({ state: "visible", timeout: 10_000 });

      const boardBox = await editorBoard.boundingBox();
      expect(boardBox).not.toBeNull();

      // Move Chrome cursor into the board area
      await ownerPage.mouse.move(
        boardBox?.x + boardBox?.width / 2,
        boardBox?.y + boardBox?.height / 2
      );
      // Wait for cursor to appear on Firefox
      await editorPage
        .locator('[data-testid="peer-cursor"]')
        .waitFor({ state: "visible", timeout: 5000 });

      // Verify Firefox shows a remote cursor
      const remoteCursor = editorPage.locator('[data-testid="peer-cursor"]');
      const cursorCount = await remoteCursor.count();
      expect(cursorCount).toBeGreaterThanOrEqual(1);
    } finally {
      await editorPage.close();
      await editorPage.context().browser()?.close();
      await ownerPage.close();
    }
  });

  test("Firefox editor drag syncs back to Chrome owner", async ({
    browser,
    playwright,
  }) => {
    const { ownerPage, editorPage } = await setupTwoUsersCrossBrowser(
      browser,
      playwright.firefox
    );

    try {
      const editorBoard = editorPage
        .locator('[data-testid="board-node"]')
        .first();
      const editorBox = await editorBoard.boundingBox();
      expect(editorBox).not.toBeNull();

      const editorHeader = editorBoard.locator('[data-testid="board-header"]');
      const editorHeaderBox = await editorHeader.boundingBox();
      expect(editorHeaderBox).not.toBeNull();

      const startX = editorHeaderBox?.x + editorHeaderBox?.width / 2;
      const startY = editorHeaderBox?.y + editorHeaderBox?.height / 2;
      const dragX = 150;
      const dragY = 100;

      // Drag on Firefox
      await editorPage.mouse.move(startX, startY);
      await editorPage.mouse.down();
      await editorPage.mouse.move(startX + dragX, startY + dragY, {
        steps: 10,
      });
      await editorPage.mouse.up();
      // Wait for drag to sync to Chrome
      await editorPage.waitForLoadState("networkidle");

      // Verify Firefox moved
      const editorBoxAfter = await editorBoard.boundingBox();
      expect(editorBoxAfter).not.toBeNull();
      const editorDelta =
        Math.abs(editorBoxAfter?.x - editorBox?.x) +
        Math.abs(editorBoxAfter?.y - editorBox?.y);
      expect(editorDelta).toBeGreaterThan(30);

      // Verify Chrome sees the same position
      const ownerBoard = ownerPage
        .locator('[data-testid="board-node"]')
        .first();
      await expect
        .poll(async () => {
          const ownerBox = await ownerBoard.boundingBox();
          const editorCurrent = await editorBoard.boundingBox();

          if (!(ownerBox && editorCurrent)) {
            return Number.POSITIVE_INFINITY;
          }

          return Math.max(
            Math.abs(ownerBox.x - editorCurrent.x),
            Math.abs(ownerBox.y - editorCurrent.y)
          );
        })
        .toBeLessThan(15);
    } finally {
      await editorPage.close();
      await editorPage.context().browser()?.close();
      await ownerPage.close();
    }
  });

  test("simultaneous edits converge deterministically across browsers", async ({
    browser,
    playwright,
  }) => {
    const { ownerPage, editorPage } = await setupTwoUsersCrossBrowser(
      browser,
      playwright.firefox
    );

    try {
      // Both rename simultaneously
      const ownerBoard = ownerPage
        .locator('[data-testid="board-node"]')
        .first();
      await ownerBoard
        .locator('[data-testid="board-header"]')
        .click({ button: "right" });
      const ownerRenameDialog = await openVisibleRenameDialog(ownerPage);

      const editorBoard = editorPage
        .locator('[data-testid="board-node"]')
        .first();
      await editorBoard
        .locator('[data-testid="board-header"]')
        .click({ button: "right" });
      const editorRenameDialog = await openVisibleRenameDialog(editorPage);

      const ownerInput = ownerRenameDialog.getByPlaceholder("New board name");
      await ownerInput.fill("Chrome Renamed");

      const editorInput = editorRenameDialog.getByPlaceholder("New board name");
      await editorInput.fill("Firefox Renamed");

      await ownerInput.press("Enter");
      await editorInput.press("Enter");
      // Wait for both edits to converge
      await ownerRenameDialog.waitFor({ state: "hidden", timeout: 5000 });

      // Both should converge to the same name
      const ownerName = await ownerPage
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="board-header"]')
        .textContent();
      const editorName = await editorPage
        .locator('[data-testid="board-node"]')
        .first()
        .locator('[data-testid="board-header"]')
        .textContent();

      expect(ownerName).toBe(editorName);
    } finally {
      await editorPage.close();
      await editorPage.context().browser()?.close();
      await ownerPage.close();
    }
  });
});
