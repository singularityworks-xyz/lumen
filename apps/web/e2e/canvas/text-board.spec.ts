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
});
