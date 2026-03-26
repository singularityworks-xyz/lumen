import type { Page } from "@playwright/test";

export interface SeededWorkspaceData {
  boardIds: string[];
  taskIds: string[];
  workspaceId: string;
}

export function seedEmptyWorkspace(page: Page): Promise<SeededWorkspaceData> {
  return page.evaluate(() => {
    const {
      useKanbanStore,
    } = require("@/src/features/kanban/store/kanban-store");

    const workspaceId = useKanbanStore
      .getState()
      .addWorkspace("Visual Test Workspace", "For visual regression testing");
    useKanbanStore.getState().setCurrentWorkspace(workspaceId);

    return { workspaceId, boardIds: [], taskIds: [] };
  });
}

export function seedPopulatedWorkspace(
  page: Page
): Promise<SeededWorkspaceData> {
  return page.evaluate(() => {
    const {
      useKanbanStore,
    } = require("@/src/features/kanban/store/kanban-store");

    const workspaceId = useKanbanStore
      .getState()
      .addWorkspace("Visual Test Workspace", "For visual regression testing");
    useKanbanStore.getState().setCurrentWorkspace(workspaceId);

    const board1Id = useKanbanStore
      .getState()
      .addBoard("Sprint Board", { x: 100, y: 100 }, "Main sprint board");
    const board2Id = useKanbanStore
      .getState()
      .addBoard("Bug Tracker", { x: 600, y: 100 }, "Bug tracking board");

    const boards = useKanbanStore.getState().boards;
    const board1 = boards.byId[board1Id];
    const board2 = boards.byId[board2Id];

    const taskIds: string[] = [];

    if (board1) {
      const col1Id = board1.column_ids[0];
      const col2Id = board1.column_ids[1];

      const task1Id = useKanbanStore
        .getState()
        .addTask(col1Id, board1Id, "Implement login feature");
      const task2Id = useKanbanStore
        .getState()
        .addTask(col1Id, board1Id, "Design dashboard UI");
      const task3Id = useKanbanStore
        .getState()
        .addTask(col2Id, board1Id, "Write unit tests");

      useKanbanStore
        .getState()
        .updateTask(task1Id, { priority: "high", progress: 0 });
      useKanbanStore
        .getState()
        .updateTask(task2Id, { priority: "medium", progress: 30 });
      useKanbanStore
        .getState()
        .updateTask(task3Id, { priority: "low", progress: 60 });

      taskIds.push(task1Id, task2Id, task3Id);
    }

    if (board2) {
      const col1Id = board2.column_ids[0];

      const task4Id = useKanbanStore
        .getState()
        .addTask(col1Id, board2Id, "Fix navigation bug");
      useKanbanStore.getState().updateTask(task4Id, {
        priority: "high",
        description: "Navigation menu not working on mobile",
      });
      taskIds.push(task4Id);
    }

    return { workspaceId, boardIds: [board1Id, board2Id], taskIds };
  });
}

export function openTaskDetailModal(
  page: Page,
  taskId: string,
  boardId: string
): Promise<string> {
  return page.evaluate(
    ({ taskId, boardId }) => {
      const {
        useKanbanStore,
      } = require("@/src/features/kanban/store/kanban-store");
      const result = useKanbanStore
        .getState()
        .openTaskDetailModal({ taskId, boardId });
      return result.id;
    },
    { taskId, boardId }
  );
}

export function waitForHydration(page: Page): Promise<void> {
  return page.evaluate(() => {
    const {
      useKanbanStore,
    } = require("@/src/features/kanban/store/kanban-store");
    return new Promise<void>((resolve) => {
      if (useKanbanStore.persist.hasHydrated()) {
        resolve();
        return;
      }
      const unsub = useKanbanStore.persist.onFinishHydration(() => {
        unsub();
        resolve();
      });
    });
  });
}

export function freezeDate(page: Page): void {
  page.addInitScript(() => {
    const frozenTimestamp = new Date("2026-03-26T12:00:00Z").getTime();
    const OriginalDate = Date;
    global.Date = class extends OriginalDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(frozenTimestamp);
        } else {
          super(...(args as [number | string | Date]));
        }
      }
      static override now(): number {
        return frozenTimestamp;
      }
    } as unknown as typeof Date;
  });
}

export async function disableAnimations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent =
        "*, *::before, *::after { animation-duration: 0.001ms !important; animation-delay: 0s !important; transition-duration: 0.001ms !important; transition-delay: 0s !important; }";
      document.head.appendChild(style);
    });
  });
}

export async function setDarkMode(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: "dark" });
}

export async function openWorkspaceSelector(page: Page): Promise<void> {
  await page.click(
    'button:has-text("Select Workspace"), button:has-text("Visual Test Workspace")'
  );
}

export async function waitForCanvas(page: Page): Promise<void> {
  await page.waitForSelector(".react-flow");
}
