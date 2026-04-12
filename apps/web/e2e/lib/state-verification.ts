import type { Page } from "@playwright/test";
import {
  captureNormalizedSnapshot,
  getStoreState,
  type NormalizedClientSnapshot,
  normalizeClientSnapshot,
} from "./normalized-state";
import {
  fetchServerState,
  type NormalizedServerSnapshot,
  normalizeServerState,
  type ServerStateResponse,
} from "./server-state";

export interface StateVerificationResult {
  boardDifferences: BoardDifference[];
  columnDifferences: ColumnDifference[];
  match: boolean;
  positionDifferences: PositionDifference[];
  summary: string;
  taskDifferences: TaskDifference[];
}

export interface BoardDifference {
  boardId: string;
  clientColumnOrder: string[];
  clientName: string;
  serverColumnOrder: string[];
  serverName: string;
}

export interface ColumnDifference {
  boardId: string;
  clientName: string;
  clientPosition: number;
  clientTaskOrder: string[];
  columnId: string;
  serverName: string;
  serverPosition: number;
  serverTaskOrder: string[];
}

export interface TaskDifference {
  clientDescription: string | null;
  clientPosition: number;
  clientTitle: string;
  columnId: string;
  serverDescription: string | null;
  serverPosition: number;
  serverTitle: string;
  taskId: string;
}

export interface PositionDifference {
  boardId: string;
  clientX: number;
  clientY: number;
  clientZIndex: number;
  serverX: number;
  serverY: number;
  serverZIndex: number;
}

export async function captureServerSnapshot(
  page: Page,
  workspaceId: string
): Promise<NormalizedServerSnapshot> {
  const serverState = await fetchServerState(page, workspaceId);
  return normalizeServerState(serverState);
}

export function compareServerToClient(
  serverSnapshot: NormalizedServerSnapshot,
  clientSnapshot: NormalizedClientSnapshot
): StateVerificationResult {
  const boardDifferences: BoardDifference[] = [];
  const columnDifferences: ColumnDifference[] = [];
  const taskDifferences: TaskDifference[] = [];
  const positionDifferences: PositionDifference[] = [];

  const serverBoardsMap = new Map(serverSnapshot.boards.map((b) => [b.id, b]));
  const clientBoardsMap = new Map(clientSnapshot.boards.map((b) => [b.id, b]));
  const serverColumnsMap = new Map(
    serverSnapshot.columns.map((c) => [c.id, c])
  );
  const clientColumnsMap = new Map(
    clientSnapshot.columns.map((c) => [c.id, c])
  );
  const serverTasksMap = new Map(serverSnapshot.tasks.map((t) => [t.id, t]));
  const clientTasksMap = new Map(clientSnapshot.tasks.map((t) => [t.id, t]));

  const allBoardIds = new Set([
    ...serverBoardsMap.keys(),
    ...clientBoardsMap.keys(),
  ]);

  for (const boardId of allBoardIds) {
    const serverBoard = serverBoardsMap.get(boardId);
    const clientBoard = clientBoardsMap.get(boardId);

    if (serverBoard && clientBoard) {
      if (serverBoard.name !== clientBoard.name) {
        boardDifferences.push({
          boardId,
          clientName: clientBoard.name,
          serverName: serverBoard.name,
          clientColumnOrder: clientBoard.columnOrder,
          serverColumnOrder: serverBoard.columnOrder,
        });
      }

      if (
        JSON.stringify(serverBoard.columnOrder) !==
        JSON.stringify(clientBoard.columnOrder)
      ) {
        boardDifferences.push({
          boardId,
          clientName: clientBoard.name,
          serverName: serverBoard.name,
          clientColumnOrder: clientBoard.columnOrder,
          serverColumnOrder: serverBoard.columnOrder,
        });
      }

      const serverPos = serverBoard.position;
      const clientPos = clientBoard.position;
      if (
        serverPos.x !== clientPos.x ||
        serverPos.y !== clientPos.y ||
        serverPos.zIndex !== clientPos.zIndex
      ) {
        positionDifferences.push({
          boardId,
          clientX: clientPos.x,
          serverX: serverPos.x,
          clientY: clientPos.y,
          serverY: serverPos.y,
          clientZIndex: clientPos.zIndex,
          serverZIndex: serverPos.zIndex,
        });
      }
    } else if (serverBoard && !clientBoard) {
      boardDifferences.push({
        boardId,
        clientName: "(missing)",
        serverName: serverBoard.name,
        clientColumnOrder: [],
        serverColumnOrder: serverBoard.columnOrder,
      });
    } else if (!serverBoard && clientBoard) {
      boardDifferences.push({
        boardId,
        clientName: clientBoard.name,
        serverName: "(missing)",
        clientColumnOrder: clientBoard.columnOrder,
        serverColumnOrder: [],
      });
    }
  }

  const allColumnIds = new Set([
    ...serverColumnsMap.keys(),
    ...clientColumnsMap.keys(),
  ]);

  for (const columnId of allColumnIds) {
    const serverCol = serverColumnsMap.get(columnId);
    const clientCol = clientColumnsMap.get(columnId);

    if (serverCol && clientCol) {
      const hasDiff =
        serverCol.name !== clientCol.name ||
        serverCol.position !== clientCol.position ||
        JSON.stringify(serverCol.taskOrder) !==
          JSON.stringify(clientCol.taskOrder);

      if (hasDiff) {
        columnDifferences.push({
          columnId,
          boardId: clientCol.boardId,
          clientName: clientCol.name,
          serverName: serverCol.name,
          clientPosition: clientCol.position,
          serverPosition: serverCol.position,
          clientTaskOrder: clientCol.taskOrder,
          serverTaskOrder: serverCol.taskOrder,
        });
      }
    } else if (serverCol && !clientCol) {
      columnDifferences.push({
        columnId,
        boardId: serverCol.boardId,
        clientName: "(missing)",
        serverName: serverCol.name,
        clientPosition: 0,
        serverPosition: serverCol.position,
        clientTaskOrder: [],
        serverTaskOrder: serverCol.taskOrder,
      });
    } else if (!serverCol && clientCol) {
      columnDifferences.push({
        columnId,
        boardId: clientCol.boardId,
        clientName: clientCol.name,
        serverName: "(missing)",
        clientPosition: clientCol.position,
        serverPosition: 0,
        clientTaskOrder: clientCol.taskOrder,
        serverTaskOrder: [],
      });
    }
  }

  const allTaskIds = new Set([
    ...serverTasksMap.keys(),
    ...clientTasksMap.keys(),
  ]);

  for (const taskId of allTaskIds) {
    const serverTask = serverTasksMap.get(taskId);
    const clientTask = clientTasksMap.get(taskId);

    if (serverTask && clientTask) {
      const hasDiff =
        serverTask.title !== clientTask.title ||
        serverTask.position !== clientTask.position ||
        serverTask.description !== clientTask.description;

      if (hasDiff) {
        taskDifferences.push({
          taskId,
          columnId: clientTask.columnId,
          clientTitle: clientTask.title,
          serverTitle: serverTask.title,
          clientPosition: clientTask.position,
          serverPosition: serverTask.position,
          clientDescription: clientTask.description,
          serverDescription: serverTask.description,
        });
      }
    } else if (serverTask && !clientTask) {
      taskDifferences.push({
        taskId,
        columnId: serverTask.columnId,
        clientTitle: "(missing)",
        serverTitle: serverTask.title,
        clientPosition: 0,
        serverPosition: serverTask.position,
        clientDescription: null,
        serverDescription: serverTask.description,
      });
    } else if (!serverTask && clientTask) {
      taskDifferences.push({
        taskId,
        columnId: clientTask.columnId,
        clientTitle: clientTask.title,
        serverTitle: "(missing)",
        clientPosition: clientTask.position,
        serverPosition: 0,
        clientDescription: clientTask.description,
        serverDescription: null,
      });
    }
  }

  const totalDifferences =
    boardDifferences.length +
    columnDifferences.length +
    taskDifferences.length +
    positionDifferences.length;

  const summary =
    totalDifferences === 0
      ? "Server and client states match perfectly"
      : `Found ${totalDifferences} difference(s): ${boardDifferences.length} board(s), ${columnDifferences.length} column(s), ${taskDifferences.length} task(s), ${positionDifferences.length} position(s)`;

  return {
    match: totalDifferences === 0,
    boardDifferences,
    columnDifferences,
    taskDifferences,
    positionDifferences,
    summary,
  };
}

export async function verifyServerClientStateMatch(
  page: Page,
  workspaceId: string
): Promise<StateVerificationResult> {
  const [serverSnapshot, clientSnapshot] = await Promise.all([
    captureServerSnapshot(page, workspaceId),
    captureNormalizedSnapshot(page),
  ]);

  return compareServerToClient(serverSnapshot, clientSnapshot);
}

export function getServerStateRaw(
  page: Page,
  workspaceId: string
): Promise<ServerStateResponse> {
  return fetchServerState(page, workspaceId);
}

export async function getClientStateRaw(
  page: Page
): Promise<NormalizedClientSnapshot> {
  const storeState = await getStoreState(page);
  if (!storeState) {
    return {
      boards: [],
      columns: [],
      tasks: [],
      comments: [],
      workspaceId: null,
    };
  }
  return normalizeClientSnapshot(storeState as Record<string, unknown>);
}

export function assertServerClientMatch(result: StateVerificationResult): void {
  if (!result.match) {
    const errors: string[] = [];

    for (const diff of result.boardDifferences) {
      errors.push(
        `Board "${diff.boardId}": client has "${diff.clientName}" (columns: ${diff.clientColumnOrder.join(", ")}), server has "${diff.serverName}" (columns: ${diff.serverColumnOrder.join(", ")})`
      );
    }

    for (const diff of result.columnDifferences) {
      errors.push(
        `Column "${diff.columnId}" on board "${diff.boardId}": client has "${diff.clientName}" (pos: ${diff.clientPosition}, tasks: ${diff.clientTaskOrder.join(", ")}), server has "${diff.serverName}" (pos: ${diff.serverPosition}, tasks: ${diff.serverTaskOrder.join(", ")})`
      );
    }

    for (const diff of result.taskDifferences) {
      errors.push(
        `Task "${diff.taskId}" in column "${diff.columnId}": client has "${diff.clientTitle}" (pos: ${diff.clientPosition}, desc: ${diff.clientDescription}), server has "${diff.serverTitle}" (pos: ${diff.serverPosition}, desc: ${diff.serverDescription})`
      );
    }

    for (const diff of result.positionDifferences) {
      errors.push(
        `Board "${diff.boardId}" position: client has (${diff.clientX}, ${diff.clientY}, z: ${diff.clientZIndex}), server has (${diff.serverX}, ${diff.serverY}, z: ${diff.serverZIndex})`
      );
    }

    throw new Error(
      `Server-client state mismatch:\n${errors.join("\n")}\n\n${result.summary}`
    );
  }
}

export function getStateVectorHash(page: Page): Promise<string> {
  return page.evaluate(() => {
    const storeElement = document.querySelector('[data-testid="kanban-store"]');
    if (!storeElement) {
      return "no-store";
    }
    const state = storeElement.getAttribute("data-state");
    if (!state) {
      return "no-state";
    }
    const str = JSON.stringify(JSON.parse(state));
    const len = str.length;
    let hash = 0;
    for (let i = 0; i < len; i++) {
      const char = str.charCodeAt(i);
      hash = (hash * 31 + char) % 2_147_483;
    }
    return String(hash);
  });
}
