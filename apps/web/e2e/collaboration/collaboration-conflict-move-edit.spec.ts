import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers } from "../helpers/commands";
import {
  assertNoOrphans,
  captureNormalizedSnapshot,
  compareTaskOrder,
} from "../lib/normalized-state";

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    await page.close();
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
    await ownerPage.waitForTimeout(1500);

    await ownerPage.locator('[data-testid="task-detail-save-button"]').click();
    await ownerPage.waitForTimeout(1500);

    const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
    const editorSnapshot = await captureNormalizedSnapshot(editorPage);

    const taskOrderResult = compareTaskOrder(ownerSnapshot, editorSnapshot);
    expect(taskOrderResult.match).toBe(true);

    assertNoOrphans(ownerSnapshot);
    assertNoOrphans(editorSnapshot);
  });

  test("task metadata edit while column move completes without data loss", async () => {
    const boardNode = ownerPage.locator('[data-testid="board-node"]').first();
    const addColumnTrigger = boardNode.locator(
      '[data-testid="add-column-trigger"]'
    );
    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Meta Column A");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    await addColumnTrigger.click();
    await ownerPage.fill('[data-testid="column-name-input"]', "Meta Column B");
    await ownerPage.click('[data-testid="column-create-submit"]');
    await ownerPage.waitForTimeout(500);

    const columnA = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Meta Column A")'
    );
    const addTaskTrigger = columnA.locator('[data-testid="add-task-trigger"]');
    await addTaskTrigger.click();
    await ownerPage.fill('[data-testid="task-title-input"]', "Meta Task");
    await ownerPage.click('[data-testid="task-create-submit"]');
    await ownerPage.waitForTimeout(1000);

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Meta Task")')
      .waitFor({ state: "visible", timeout: 10_000 });

    await ownerPage
      .locator('[data-testid="task-card"]:has-text("Meta Task")')
      .click();
    await ownerPage.waitForSelector('[data-testid="task-detail-modal"]');
    await ownerPage.locator('[data-testid="task-detail-edit-button"]').click();
    await ownerPage.waitForSelector(
      '[data-testid="task-detail-description-input"]'
    );
    await ownerPage
      .locator('[data-testid="task-detail-description-input"]')
      .fill("Important description that must not be lost");

    const columnB = ownerPage.locator(
      '[data-testid="kanban-column"]:has-text("Meta Column B")'
    );

    const taskCard = columnA.locator(
      '[data-testid="task-card"]:has-text("Meta Task")'
    );
    const taskBox = await taskCard.boundingBox();
    const targetBox = await columnB.boundingBox();
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
    await ownerPage.waitForTimeout(1500);

    await ownerPage.locator('[data-testid="task-detail-modal"]').click();
    await ownerPage.waitForTimeout(500);

    const ownerSnapshot = await captureNormalizedSnapshot(ownerPage);
    const editorSnapshot = await captureNormalizedSnapshot(editorPage);

    const taskOrderResult = compareTaskOrder(ownerSnapshot, editorSnapshot);
    expect(taskOrderResult.match).toBe(true);

    assertNoOrphans(ownerSnapshot);
    assertNoOrphans(editorSnapshot);

    const movedTask = columnB.locator(
      '[data-testid="task-card"]:has-text("Meta Task")'
    );
    await movedTask.click();
    await ownerPage.waitForSelector('[data-testid="task-detail-modal"]');
    await ownerPage.locator('[data-testid="task-detail-edit-button"]').click();
    await ownerPage.waitForSelector(
      '[data-testid="task-detail-description-input"]'
    );

    const description = await ownerPage
      .locator('[data-testid="task-detail-description-input"]')
      .inputValue();
    expect(description).toContain("Important description");
  });
});
