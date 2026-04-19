import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers } from "../helpers/commands";
import {
  addColumnToFirstBoardViaStore,
  addTaskViaStore,
  getTaskDescriptionById,
  getTaskIdByTitle,
  moveTaskToColumnViaStore,
  updateTaskDescriptionViaStore,
  updateTaskTitleViaStore,
} from "../helpers/store";
import {
  assertNoOrphans,
  captureNormalizedSnapshot,
  compareTaskOrder,
} from "../lib/normalized-state";

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }
}

test.describe("E2E-17: Conflict - Move Task While Editing", () => {
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

  test("user A edits task while user B moves it - no corruption", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Source Column");
    await addColumnToFirstBoardViaStore(ownerPage, "Target Column");
    await addTaskViaStore(ownerPage, "Source Column", "Move Edit Task");

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Move Edit Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskId = await getTaskIdByTitle(ownerPage, "Move Edit Task");
    await Promise.all([
      updateTaskTitleViaStore(ownerPage, taskId, "Owner Edited While Moving"),
      moveTaskToColumnViaStore(editorPage, taskId, "Target Column"),
    ]);

    await expect
      .poll(async () => {
        const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
        const editorSnapshot = await captureNormalizedSnapshot(editorPage);
        return compareTaskOrder(ownerSnapshot, editorSnapshot).match;
      })
      .toBe(true);

    const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
    const editorSnapshot = await captureNormalizedSnapshot(editorPage);

    const taskOrderResult = compareTaskOrder(ownerSnapshot, editorSnapshot);
    expect(taskOrderResult.match).toBe(true);

    assertNoOrphans(ownerSnapshot);
    assertNoOrphans(editorSnapshot);
  });

  test("task metadata edit while column move completes without data loss", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Meta Column A");
    await addColumnToFirstBoardViaStore(ownerPage, "Meta Column B");
    await addTaskViaStore(ownerPage, "Meta Column A", "Meta Task");

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Meta Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskId = await getTaskIdByTitle(ownerPage, "Meta Task");
    await Promise.all([
      updateTaskDescriptionViaStore(
        ownerPage,
        taskId,
        "Important description that must not be lost"
      ),
      moveTaskToColumnViaStore(editorPage, taskId, "Meta Column B"),
    ]);

    await expect
      .poll(async () => {
        const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
        const editorSnapshot = await captureNormalizedSnapshot(editorPage);
        return compareTaskOrder(ownerSnapshot, editorSnapshot).match;
      })
      .toBe(true);

    const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
    const editorSnapshot = await captureNormalizedSnapshot(editorPage);

    const taskOrderResult = compareTaskOrder(ownerSnapshot, editorSnapshot);
    expect(taskOrderResult.match).toBe(true);

    assertNoOrphans(ownerSnapshot);
    assertNoOrphans(editorSnapshot);

    const description = await getTaskDescriptionById(ownerPage, taskId);
    expect(description).toContain("Important description");
  });
});
