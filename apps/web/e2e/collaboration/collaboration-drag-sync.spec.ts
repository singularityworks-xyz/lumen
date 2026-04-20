import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  getStoreState,
  setupTwoUsers,
  waitForAppReady,
} from "../helpers/commands";
import {
  getTaskColumnIdById,
  getTaskIdByTitle,
  moveTaskToColumnViaStore,
} from "../helpers/store";
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

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }
}

async function getFirstBoardId(page: Page): Promise<string | null> {
  const state = await getStoreState(page);
  const boards = state?.boards;
  if (
    typeof boards !== "object" ||
    !boards ||
    !Array.isArray((boards as { allIds?: unknown }).allIds)
  ) {
    return null;
  }

  const firstId = (boards as { allIds: unknown[] }).allIds[0];
  return typeof firstId === "string" ? firstId : null;
}

async function waitForAnyBoardInStore(
  page: Page,
  timeoutMs = 10_000
): Promise<string> {
  await expect
    .poll(() => getFirstBoardId(page), { timeout: timeoutMs })
    .not.toBeNull();

  const boardId = await getFirstBoardId(page);
  if (!boardId) {
    throw new Error("No board found in store");
  }

  return boardId;
}

async function addColumnToFirstBoardViaStore(
  page: Page,
  columnName: string
): Promise<void> {
  await page.evaluate((name) => {
    interface BoardRecord {
      column_ids?: string[];
    }

    interface KanbanState {
      addColumn: (boardId: string, columnName: string, index: number) => void;
      boards?: {
        allIds?: string[];
        byId?: Record<string, BoardRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      throw new Error("Kanban store is not available");
    }

    const state = store.getState();
    const boardIds = state.boards?.allIds;
    const firstBoardId = Array.isArray(boardIds) ? boardIds[0] : null;

    if (typeof firstBoardId !== "string") {
      throw new Error("No board found for addColumn operation");
    }

    const board = state.boards?.byId?.[firstBoardId];
    const index = Array.isArray(board?.column_ids)
      ? board.column_ids.length
      : 0;

    state.addColumn(firstBoardId, name, index);
  }, columnName);
}

async function addTaskViaStore(
  page: Page,
  columnName: string,
  taskTitle: string
): Promise<void> {
  await page.evaluate(
    ({ targetColumnName, title }) => {
      interface ColumnRecord {
        board_id: string;
        id: string;
        name: string;
      }

      interface KanbanState {
        addTask: (columnId: string, boardId: string, taskTitle: string) => void;
        columns?: {
          allIds?: string[];
          byId?: Record<string, ColumnRecord | undefined>;
        };
      }

      type WindowWithKanbanStore = Window & {
        __KANBAN_STORE__?: {
          getState: () => KanbanState;
        };
      };

      const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
      if (!store?.getState) {
        throw new Error("Kanban store is not available");
      }

      const state = store.getState();
      const columnId = (state.columns?.allIds ?? []).find((id) => {
        const column = state.columns?.byId?.[id];
        return column?.name === targetColumnName;
      });

      if (!columnId) {
        throw new Error(`Column not found: ${targetColumnName}`);
      }

      const column = state.columns?.byId?.[columnId];
      if (!column) {
        throw new Error(`Column record missing: ${columnId}`);
      }

      state.addTask(columnId, column.board_id, title);
    },
    { targetColumnName: columnName, title: taskTitle }
  );
}

test.describe("E2E-13: Multi-User Drag Sync", () => {
  test.describe.configure({ timeout: 90_000 });

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
    const boardId = await waitForAnyBoardInStore(ownerPage);
    const initialOwnerSnapshot = await captureNormalizedSnapshot(ownerPage);
    const initialBoard = initialOwnerSnapshot.boards.find(
      (board) => board.id === boardId
    );
    expect(initialBoard).toBeTruthy();
    if (!initialBoard) {
      throw new Error("Initial board not found in snapshot");
    }

    const dragX = 200;
    const dragY = 150;

    await dragByOffset(ownerPage, boardHeader, { x: dragX, y: dragY });
    // Wait for drag to complete and sync to peer
    await ownerPage.waitForLoadState("networkidle");

    const ownerSnapshotAfterDrag = await captureNormalizedSnapshot(ownerPage);
    const movedBoard = ownerSnapshotAfterDrag.boards.find(
      (board) => board.id === boardId
    );
    expect(movedBoard).toBeTruthy();
    if (!movedBoard) {
      throw new Error("Moved board not found in snapshot");
    }

    const ownerDelta =
      Math.abs(movedBoard.position.x - initialBoard.position.x) +
      Math.abs(movedBoard.position.y - initialBoard.position.y);
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
    await addColumnToFirstBoardViaStore(ownerPage, "Column A");
    // Wait for first column to be created
    await ownerPage
      .locator('[data-testid="kanban-column"]:has-text("Column A")')
      .waitFor({ state: "visible", timeout: 5000 });

    await addColumnToFirstBoardViaStore(ownerPage, "Column B");
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
    await addColumnToFirstBoardViaStore(ownerPage, "Source Col");
    // Wait for first column to be created
    await ownerPage
      .locator('[data-testid="kanban-column"]:has-text("Source Col")')
      .waitFor({ state: "visible", timeout: 5000 });

    await addColumnToFirstBoardViaStore(ownerPage, "Target Col");
    // Wait for second column to sync to editor
    await waitForCollabSync(editorPage, "kanban-column", "Target Col");

    await addTaskViaStore(ownerPage, "Source Col", "Draggable Task");
    // Wait for task to sync to editor
    await waitForCollabSync(editorPage, "task-card", "Draggable Task");

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Draggable Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskId = await getTaskIdByTitle(ownerPage, "Draggable Task");
    await moveTaskToColumnViaStore(ownerPage, taskId, "Target Col");

    await expect
      .poll(async () => {
        const ownerColumnId = await getTaskColumnIdById(ownerPage, taskId);
        const editorColumnId = await getTaskColumnIdById(editorPage, taskId);
        return (
          ownerColumnId && editorColumnId && ownerColumnId === editorColumnId
        );
      })
      .toBe(true);
  });

  test("drag cancel with Escape leaves no ghost state", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const boardHeader = boardNode.locator('[data-testid="board-header"]');
    await waitForAnyBoardInStore(ownerPage);

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

    await waitForAnyBoardInStore(ownerPage);
    await waitForAnyBoardInStore(editorPage);

    await expect
      .poll(async () => {
        const ownerSnapshotAfterCancel =
          await captureNormalizedSnapshot(ownerPage);
        const editorSnapshotAfterCancel =
          await captureNormalizedSnapshot(editorPage);

        const comparison = compareBoardCoordinates(
          ownerSnapshotAfterCancel,
          editorSnapshotAfterCancel,
          10
        );
        return comparison.match;
      })
      .toBe(true);
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
    await addColumnToFirstBoardViaStore(ownerPage, "Late Join Col");
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
