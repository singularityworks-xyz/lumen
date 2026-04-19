import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers } from "../helpers/commands";
import {
  addColumnToFirstBoardViaStore,
  addTaskViaStore,
  deleteTaskByTitleViaStore,
  getCurrentWorkspaceIdViaStore,
  getFirstBoardId,
  getTaskBoardIdById,
  getTaskIdByTitle,
  getTaskTitleById,
  removeBoardByIdViaStore,
  updateTaskTitleViaStore,
} from "../helpers/store";
import {
  assertServerClientMatch,
  verifyServerClientStateMatch,
} from "../lib/state-verification";

const WORKSPACE_ID_REGEX = /workspace\/([^/]+)/;

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }
}

test.describe("E2E-18: Conflict - Delete Task While Editing", () => {
  let ownerPage: Page;
  let editorPage: Page;

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
  });

  test.afterEach(async () => {
    await cleanupPages([ownerPage, editorPage]);
  });

  test("user A opens task for edit while user B deletes it - graceful handling", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Delete Conflict Column");
    await addTaskViaStore(
      ownerPage,
      "Delete Conflict Column",
      "Task To Be Deleted"
    );

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Task To Be Deleted")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskId = await getTaskIdByTitle(ownerPage, "Task To Be Deleted");

    await Promise.all([
      updateTaskTitleViaStore(ownerPage, taskId, "Trying to save deleted task"),
      deleteTaskByTitleViaStore(editorPage, "Task To Be Deleted"),
    ]);

    await expect
      .poll(
        async () => {
          const ownerTitle = await getTaskTitleById(ownerPage, taskId);
          const editorTitle = await getTaskTitleById(editorPage, taskId);
          if (ownerTitle !== editorTitle) {
            return false;
          }

          return (
            ownerTitle === null || ownerTitle === "Trying to save deleted task"
          );
        },
        { timeout: 10_000 }
      )
      .toBe(true);

    const workspaceIdFromUrl =
      ownerPage.url().match(WORKSPACE_ID_REGEX)?.[1] ?? null;
    const workspaceId =
      workspaceIdFromUrl ?? (await getCurrentWorkspaceIdViaStore(ownerPage));
    expect(workspaceId).toBeTruthy();

    if (workspaceId) {
      await ownerPage.waitForFunction(
        () => {
          const store = document.querySelector('[data-testid="kanban-store"]');
          return store?.getAttribute("data-sync-status") === "synced";
        },
        null,
        { timeout: 15_000 }
      );

      const verification = await verifyServerClientStateMatch(
        ownerPage,
        workspaceId
      );
      assertServerClientMatch(verification);
    } else {
      test.skip(true, "No workspace id available after conflict operation");
    }
  });

  test("user A edits task while user B deletes board containing it", async () => {
    await editorPage
      .locator('[data-testid="board-node"]')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });

    await addColumnToFirstBoardViaStore(ownerPage, "Board Delete Column");
    await addTaskViaStore(
      ownerPage,
      "Board Delete Column",
      "Board Delete Task"
    );

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Board Delete Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const firstEditorBoardId = await getFirstBoardId(editorPage);
    expect(firstEditorBoardId).toBeTruthy();
    if (!firstEditorBoardId) {
      throw new Error("No board available for board delete conflict test");
    }

    const taskId = await getTaskIdByTitle(ownerPage, "Board Delete Task");
    const taskBoardId = await getTaskBoardIdById(ownerPage, taskId);
    expect(taskBoardId).toBeTruthy();
    const boardIdToDelete = taskBoardId ?? firstEditorBoardId;
    await Promise.all([
      updateTaskTitleViaStore(
        ownerPage,
        taskId,
        "Trying to edit in deleted board"
      ),
      removeBoardByIdViaStore(editorPage, boardIdToDelete),
    ]);

    await expect
      .poll(
        async () => {
          const ownerTitle = await getTaskTitleById(ownerPage, taskId);
          const editorTitle = await getTaskTitleById(editorPage, taskId);
          return ownerTitle === editorTitle;
        },
        { timeout: 10_000 }
      )
      .toBe(true);

    const workspaceIdFromUrl =
      ownerPage.url().match(WORKSPACE_ID_REGEX)?.[1] ?? null;
    const workspaceId =
      workspaceIdFromUrl ?? (await getCurrentWorkspaceIdViaStore(ownerPage));
    expect(workspaceId).toBeTruthy();

    if (workspaceId) {
      await ownerPage.waitForFunction(
        () => {
          const store = document.querySelector('[data-testid="kanban-store"]');
          return store?.getAttribute("data-sync-status") === "synced";
        },
        null,
        { timeout: 15_000 }
      );

      const verification = await verifyServerClientStateMatch(
        ownerPage,
        workspaceId
      );
      assertServerClientMatch(verification);
    } else {
      test.skip(true, "No workspace id available after board delete conflict");
    }
  });
});
