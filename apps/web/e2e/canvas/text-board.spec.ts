import { expect, test } from "@playwright/test";
import {
  clearLocalStorageAndIndexedDB,
  disableAnimations,
  waitForAppReady,
} from "../helpers/commands";

// E2E for the todo / text board type: TipTap editor, add-task, rename,
// connection handles, and persistence across reloads.
test.describe("E2E: Text Board (Todo / Text)", () => {
  test.beforeEach(async ({ page }) => {
    await clearLocalStorageAndIndexedDB(page);
    await disableAnimations(page);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("creates a text board from the welcome screen and edits content", async ({
    page,
  }) => {
    const createTextBoardButton = page.locator(
      '[data-testid="welcome-screen"] button:has-text("Create a Text Board")'
    );
    await expect(createTextBoardButton).toBeVisible();
    await createTextBoardButton.click();
    await page.waitForTimeout(600);

    const textBoardNode = page.locator('[data-testid="text-board-node"]');
    await expect(textBoardNode).toBeVisible();

    // Editor is present and editable
    const editor = textBoardNode.locator('[data-testid="text-board-editor"]');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type("Ship the launch");

    // Content is persisted into the store as TipTap JSON
    await page.waitForTimeout(600);
    const contentState = await page.evaluate(() => {
      const store = (
        window as unknown as {
          __KANBAN_STORE__?: {
            getState: () => {
              textBoards: {
                allIds: string[];
                byId: Record<
                  string,
                  { content?: string; name: string; id: string }
                >;
              };
            };
          };
        }
      ).__KANBAN_STORE__;
      const state = store?.getState();
      const id = state?.textBoards.allIds[0];
      const board = id ? state?.textBoards.byId[id] : undefined;
      return board ? { id, name: board.name, content: board.content } : null;
    });
    expect(contentState).not.toBeNull();
    expect(contentState?.content).toContain("doc");
    expect(contentState?.content).toContain("Ship the launch");
  });

  test("add task button appends a todo item to the editor", async ({
    page,
  }) => {
    const createTextBoardButton = page.locator(
      '[data-testid="welcome-screen"] button:has-text("Create a Text Board")'
    );
    await createTextBoardButton.click();
    await page.waitForTimeout(600);

    const textBoardNode = page.locator('[data-testid="text-board-node"]');
    await expect(textBoardNode).toBeVisible();

    await textBoardNode.locator('[data-testid="text-board-add-task"]').click();
    await page.waitForTimeout(300);

    const contentState = await page.evaluate(() => {
      const store = (
        window as unknown as {
          __KANBAN_STORE__?: {
            getState: () => {
              textBoards: {
                byId: Record<string, { content?: string }>;
              };
            };
          };
        }
      ).__KANBAN_STORE__;
      return store?.getState().textBoards.byId[
        Object.keys(store.getState().textBoards.byId)[0] ?? ""
      ]?.content;
    });
    expect(contentState).toContain("taskList");
    expect(contentState).toContain("taskItem");
  });

  test("rename, delete, and position persistence after reload", async ({
    page,
  }) => {
    const createTextBoardButton = page.locator(
      '[data-testid="welcome-screen"] button:has-text("Create a Text Board")'
    );
    await createTextBoardButton.click();
    await page.waitForTimeout(600);

    const textBoardNode = page.locator('[data-testid="text-board-node"]');
    await expect(textBoardNode).toBeVisible();

    // Rename via the pencil button
    await textBoardNode.locator('button[title="Rename text board"]').click();
    const nameInput = page.locator('[data-testid="text-board-name-input"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Launch Checklist");
    await page.keyboard.press("Enter");
    await expect(
      textBoardNode.locator("h3", { hasText: "Launch Checklist" })
    ).toBeVisible();

    // Reload: board, name, and editor survive (IndexedDB persistence)
    await page.waitForTimeout(600);
    await page.reload();
    await waitForAppReady(page);
    await page.waitForTimeout(1000);

    const textBoardNodeAfterReload = page.locator(
      '[data-testid="text-board-node"]'
    );
    await expect(textBoardNodeAfterReload).toBeVisible();
    await expect(
      textBoardNodeAfterReload.locator("h3", {
        hasText: "Launch Checklist",
      })
    ).toBeVisible();
    await expect(
      textBoardNodeAfterReload.locator('[data-testid="text-board-editor"]')
    ).toBeVisible();

    // Delete the text board
    await textBoardNodeAfterReload
      .locator('[data-testid="text-board-delete"]')
      .click();
    await page
      .locator('[data-testid="text-board-confirm-delete"]')
      .waitFor({ timeout: 3000 });
    await page.locator('[data-testid="text-board-confirm-delete"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="text-board-node"]')).toHaveCount(
      0
    );
  });

  test("right-click opens quick actions and the rename (properties) dialog", async ({
    page,
  }) => {
    const createTextBoardButton = page.locator(
      '[data-testid="welcome-screen"] button:has-text("Create a Text Board")'
    );
    await createTextBoardButton.click();
    await page.waitForTimeout(600);

    const textBoardNode = page.locator('[data-testid="text-board-node"]');
    await expect(textBoardNode).toBeVisible();

    // Right-click the header like a kanban board
    await textBoardNode
      .locator('[data-testid="text-board-header"]')
      .dispatchEvent("contextmenu", { button: 2 });
    await page.waitForTimeout(300);

    // Quick actions menu opens
    const renameOption = page.locator(
      '[data-testid="text-board-rename-option"]'
    );
    await expect(renameOption).toBeVisible();

    // Rename dialog opens alongside (kanban parity)
    const renameDialog = page.locator(
      '[data-testid="text-board-rename-dialog"]'
    );
    await expect(renameDialog).toBeVisible();

    // Right-click again: no duplicate dialog is created, the existing one
    // is reused instead
    await textBoardNode
      .locator('[data-testid="text-board-header"]')
      .dispatchEvent("contextmenu", { button: 2 });
    await page.waitForTimeout(300);
    await expect(
      page.locator('[data-testid="text-board-rename-dialog"]')
    ).toHaveCount(1);

    await renameDialog.locator("input").fill("Right Click Renamed");
    await renameDialog.getByRole("button", { name: "Rename" }).click();
    await expect(
      textBoardNode.locator("h3", { hasText: "Right Click Renamed" })
    ).toBeVisible();
  });

  test("creates a connection from a text board to a kanban board", async ({
    page,
  }) => {
    // Create a kanban board first
    const createBoardButton = page.locator(
      '[data-testid="welcome-screen"] button:has-text("Create Your First Board")'
    );
    await createBoardButton.click();
    await page.waitForTimeout(400);

    // Then a text board via the navbar (stays in view after the viewport moves)
    await page.locator('[data-testid="new-text-board-button"]').click();
    await page.waitForTimeout(600);

    const textBoardNode = page.locator('[data-testid="text-board-node"]');
    await expect(textBoardNode).toBeVisible();

    // Open the text board quick actions and pick Connections
    await textBoardNode
      .locator('[data-testid="text-board-header"]')
      .dispatchEvent("contextmenu", { button: 2 });
    await page.waitForTimeout(300);
    await page.locator('[data-testid="text-board-connections-option"]').click();
    await page.waitForTimeout(300);

    // Connection dialog opens with the kanban board listed as a target
    const connectionDialog = page.locator(
      '.react-flow__node[data-id^="connection-dialog-"]'
    );
    await expect(connectionDialog).toBeVisible();
    await expect(
      connectionDialog.getByText("New Board", { exact: true })
    ).toBeVisible();

    // Select the kanban board and create the connection
    await connectionDialog.getByText("New Board", { exact: true }).click();
    await page.locator('[data-testid="connection-style-save"]').click();
    await page.waitForTimeout(400);

    // Connection is recorded in the store
    const connectionState = await page.evaluate(() => {
      const store = (
        window as unknown as {
          __KANBAN_STORE__?: {
            getState: () => {
              boardConnections: {
                allIds: string[];
                byId: Record<
                  string,
                  { source_board_id: string; target_board_id: string }
                >;
              };
              textBoards: { allIds: string[] };
              boards: { allIds: string[] };
            };
          };
        }
      ).__KANBAN_STORE__;
      const state = store?.getState();
      const textBoardId = state?.textBoards.allIds[0];
      const boardId = state?.boards.allIds[0];
      const conn = state?.boardConnections.allIds
        .map((id) => state.boardConnections.byId[id])
        .find((c) => c?.source_board_id === textBoardId);
      return conn
        ? {
            source: conn.source_board_id,
            target: conn.target_board_id,
            expectedSource: textBoardId,
            expectedTarget: boardId,
          }
        : null;
    });
    expect(connectionState).not.toBeNull();
    expect(connectionState?.source).toBe(connectionState?.expectedSource);
    expect(connectionState?.target).toBe(connectionState?.expectedTarget);
  });
});
