import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { setupTwoUsers } from "../helpers/commands";
import {
  assertServerClientMatch,
  verifyServerClientStateMatch,
} from "../lib/state-verification";

const WORKSPACE_ID_REGEX = /workspace\/([^/]+)/;

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

function getTaskIdByTitle(page: Page, title: string): Promise<string> {
  return page.evaluate((taskTitle) => {
    interface TaskRecord {
      id: string;
      title: string;
    }

    interface KanbanState {
      tasks?: {
        allIds?: string[];
        byId?: Record<string, TaskRecord | undefined>;
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
    const taskId = (state.tasks?.allIds ?? []).find((id) => {
      const task = state.tasks?.byId?.[id];
      return task?.title === taskTitle;
    });

    if (!taskId) {
      throw new Error(`Task not found: ${taskTitle}`);
    }

    return taskId;
  }, title);
}

async function updateTaskTitleViaStore(
  page: Page,
  taskId: string,
  title: string
): Promise<void> {
  await page.evaluate(
    ({ id, nextTitle }) => {
      interface KanbanState {
        updateTask: (taskId: string, updates: { title: string }) => void;
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
      state.updateTask(id, { title: nextTitle });
    },
    { id: taskId, nextTitle: title }
  );
}

function getTaskTitleById(page: Page, taskId: string): Promise<string | null> {
  return page.evaluate((id) => {
    interface TaskRecord {
      title: string;
    }

    interface KanbanState {
      tasks?: {
        byId?: Record<string, TaskRecord | undefined>;
      };
    }

    type WindowWithKanbanStore = Window & {
      __KANBAN_STORE__?: {
        getState: () => KanbanState;
      };
    };

    const store = (window as WindowWithKanbanStore).__KANBAN_STORE__;
    if (!store?.getState) {
      return null;
    }

    const state = store.getState();
    return state.tasks?.byId?.[id]?.title ?? null;
  }, taskId);
}

async function ensureWorkspaceSyncedAndVerified(
  page: Page,
  workspaceId: string
): Promise<void> {
  await page.waitForFunction(
    () => {
      const store = document.querySelector('[data-testid="kanban-store"]');
      return store?.getAttribute("data-sync-status") === "synced";
    },
    null,
    { timeout: 15_000 }
  );

  const verification = await verifyServerClientStateMatch(page, workspaceId);
  assertServerClientMatch(verification);
}

async function cleanupPages(pages: Page[]) {
  for (const page of pages) {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }
}

test.describe("E2E-16: Conflict - Simultaneous Task Title Edits", () => {
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

  test("two users editing same task title simultaneously produces deterministic final state", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Conflict Column");
    await ownerPage.waitForSelector(
      '[data-testid="kanban-column"]:has-text("Conflict Column")'
    );

    await addTaskViaStore(ownerPage, "Conflict Column", "Original Title");
    await ownerPage.waitForSelector(
      '[data-testid="task-card"]:has-text("Original Title")'
    );

    const taskCard = ownerPage.locator(
      '[data-testid="task-card"]:has-text("Original Title")'
    );
    await taskCard.waitFor({ state: "visible", timeout: 10_000 });

    await editorPage
      .locator('[data-testid="task-card"]:has-text("Original Title")')
      .waitFor({ state: "visible", timeout: 10_000 });

    const taskId = await getTaskIdByTitle(ownerPage, "Original Title");

    await Promise.all([
      updateTaskTitleViaStore(ownerPage, taskId, "Owner Title Edit"),
      updateTaskTitleViaStore(editorPage, taskId, "Editor Title Edit"),
    ]);

    await expect
      .poll(async () => {
        const ownerFinalTitle = await ownerPage
          .locator('[data-testid="task-card"]')
          .first()
          .textContent();
        const editorFinalTitle = await editorPage
          .locator('[data-testid="task-card"]')
          .first()
          .textContent();
        return ownerFinalTitle?.trim() === editorFinalTitle?.trim();
      })
      .toBe(true);

    const ownerFinalTitle = await getTaskTitleById(ownerPage, taskId);
    const editorFinalTitle = await getTaskTitleById(editorPage, taskId);

    expect(ownerFinalTitle).toBe(editorFinalTitle);
    expect(ownerFinalTitle).not.toBeNull();
    expect(ownerFinalTitle).not.toBe("Original Title");

    const workspaceIdMatch = ownerPage.url().match(WORKSPACE_ID_REGEX);
    const workspaceId = workspaceIdMatch ? workspaceIdMatch[1] : null;

    if (workspaceId) {
      await ensureWorkspaceSyncedAndVerified(ownerPage, workspaceId);
    }
  });

  test("rapid successive edits converge to single value", async () => {
    await addColumnToFirstBoardViaStore(ownerPage, "Rapid Column");
    await ownerPage.waitForSelector(
      '[data-testid="kanban-column"]:has-text("Rapid Column")'
    );

    await addTaskViaStore(ownerPage, "Rapid Column", "Rapid Task");
    await ownerPage.waitForSelector(
      '[data-testid="task-card"]:has-text("Rapid Task")'
    );

    const taskId = await getTaskIdByTitle(ownerPage, "Rapid Task");

    for (let i = 0; i < 5; i++) {
      await updateTaskTitleViaStore(ownerPage, taskId, `Rapid Edit ${i}`);
    }

    await expect
      .poll(async () => {
        const ownerFinalTitle = await ownerPage
          .locator('[data-testid="task-card"]')
          .first()
          .textContent();
        const editorFinalTitle = await editorPage
          .locator('[data-testid="task-card"]')
          .first()
          .textContent();
        return ownerFinalTitle?.trim() === editorFinalTitle?.trim();
      })
      .toBe(true);

    const finalTitle = await getTaskTitleById(ownerPage, taskId);
    expect(finalTitle).toContain("Rapid Edit");

    const workspaceIdMatch = ownerPage.url().match(WORKSPACE_ID_REGEX);
    const workspaceId = workspaceIdMatch ? workspaceIdMatch[1] : null;

    if (workspaceId) {
      await ensureWorkspaceSyncedAndVerified(ownerPage, workspaceId);
    }
  });
});
