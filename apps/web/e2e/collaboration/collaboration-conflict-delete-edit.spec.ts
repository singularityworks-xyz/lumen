import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  setCurrentWorkspaceFromStore,
  setupTwoUsers,
} from "../helpers/commands";
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
import { waitForConnectionState } from "../helpers/waits";
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
  test.describe.configure({ timeout: 90_000 });

  let ownerPage: Page;
  let editorPage: Page;

  async function ensureAlignedWorkspaceContext(): Promise<string | null> {
    const ownerWorkspaceId = await getCurrentWorkspaceIdViaStore(ownerPage);
    if (!ownerWorkspaceId) {
      return null;
    }

    await setCurrentWorkspaceFromStore(ownerPage, ownerWorkspaceId);
    await setCurrentWorkspaceFromStore(editorPage, ownerWorkspaceId);

    await expect
      .poll(
        async () => {
          const ownerCurrent = await getCurrentWorkspaceIdViaStore(ownerPage);
          const editorCurrent = await getCurrentWorkspaceIdViaStore(editorPage);
          return (
            ownerCurrent === ownerWorkspaceId &&
            editorCurrent === ownerWorkspaceId
          );
        },
        { timeout: 10_000 }
      )
      .toBe(true);

    return ownerWorkspaceId;
  }

  test.beforeEach(async ({ browser }) => {
    const setup = await setupTwoUsers(browser);
    ownerPage = setup.ownerPage;
    editorPage = setup.editorPage;
  });

  test.afterEach(async () => {
    await cleanupPages([ownerPage, editorPage]);
  });

  test("user A opens task for edit while user B deletes it - graceful handling", async () => {
    await waitForConnectionState(
      ownerPage,
      "sync-status-indicator",
      "connected",
      10_000
    );
    await waitForConnectionState(
      editorPage,
      "sync-status-indicator",
      "connected",
      10_000
    );
    const alignedWorkspaceId = await ensureAlignedWorkspaceContext();

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
          if (alignedWorkspaceId) {
            await setCurrentWorkspaceFromStore(ownerPage, alignedWorkspaceId);
            await setCurrentWorkspaceFromStore(editorPage, alignedWorkspaceId);
          }

          const ownerTitle = await getTaskTitleById(ownerPage, taskId);
          const editorTitle = await getTaskTitleById(editorPage, taskId);
          if (ownerTitle !== editorTitle) {
            return false;
          }

          return (
            ownerTitle === null || ownerTitle === "Trying to save deleted task"
          );
        },
        { timeout: 30_000, intervals: [250, 500, 1000] }
      )
      .toBe(true);

    const workspaceIdFromUrl =
      ownerPage.url().match(WORKSPACE_ID_REGEX)?.[1] ?? null;
    const workspaceId =
      workspaceIdFromUrl ?? (await getCurrentWorkspaceIdViaStore(ownerPage));
    expect(workspaceId).toBeTruthy();

    if (workspaceId) {
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

    const workspaceIdBefore = await getCurrentWorkspaceIdViaStore(ownerPage);

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
          if (workspaceIdBefore) {
            await setCurrentWorkspaceFromStore(ownerPage, workspaceIdBefore);
            await setCurrentWorkspaceFromStore(editorPage, workspaceIdBefore);
          }

          const ownerTitle = await getTaskTitleById(ownerPage, taskId);
          const editorTitle = await getTaskTitleById(editorPage, taskId);

          const ownerValid =
            ownerTitle === null ||
            ownerTitle === "Trying to edit in deleted board";
          const editorValid =
            editorTitle === null ||
            editorTitle === "Trying to edit in deleted board";

          return ownerValid && editorValid;
        },
        { timeout: 15_000 }
      )
      .toBe(true);
  });
});
