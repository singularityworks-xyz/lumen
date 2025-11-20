import type { Edge, Node } from "@xyflow/react";
import { enableMapSet } from "immer";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { Board, BoardNode, Column, Task, Workspace } from "../types";
import { calculateBoardDimensions } from "../utils";

enableMapSet();

type InteractionMode = "drag" | "select";

type ViewportState = {
  x: number;
  y: number;
  zoom: number;
};

type KanbanState = {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  boards: Board[];
  nodes: Node<BoardNode["data"]>[];
  edges: Edge[];
  selectedBoardId: string | null;
  selectedBoardIds: Set<string>;
  draggedTask: Task | null;
  selectedTasks: Set<string>;
  showCommandPalette: boolean;
  showMiniMap: boolean;
  createTaskColumnId: string | null;
  interactionMode: InteractionMode;
  viewport: ViewportState;
};

type KanbanActions = {
  setCurrentWorkspace: (workspace: Workspace) => void;
  deleteWorkspace: (workspaceId: string) => void;
  resetWorkspace: (workspaceId: string) => void;
  addWorkspace: (workspace: Workspace) => void;
  addBoard: (board: Board, position: { x: number; y: number }) => void;
  removeBoard: (boardId: string) => void;
  updateBoard: (boardId: string, updates: Partial<Board>) => void;
  setSelectedBoard: (boardId: string | null) => void;
  bringBoardToFront: (boardId: string) => void;
  updateNodePosition: (
    nodeId: string,
    position: { x: number; y: number }
  ) => void;
  setNodes: (nodes: Node<BoardNode["data"]>[]) => void;
  setEdges: (edges: Edge[]) => void;
  addTask: (boardId: string, task: Task) => void;
  updateTask: (boardId: string, taskId: string, updates: Partial<Task>) => void;
  deleteTask: (boardId: string, taskId: string) => void;
  moveTask: (
    taskId: string,
    fromColumnId: string,
    toColumnId: string,
    targetBoardId: string
  ) => void;
  setDraggedTask: (task: Task | null) => void;
  addColumn: (boardId: string, column: Column) => void;
  updateColumn: (
    boardId: string,
    columnId: string,
    updates: Partial<Column>
  ) => void;
  deleteColumn: (boardId: string, columnId: string) => void;
  moveColumn: (boardId: string, columnId: string, newPosition: number) => void;
  moveColumnToBoard: (
    sourceBoardId: string,
    columnId: string,
    targetBoardId: string
  ) => void;
  setViewport: (viewport: ViewportState) => void;
  toggleTaskSelection: (taskId: string) => void;
  clearTaskSelection: () => void;
  bulkUpdateTasks: (taskIds: string[], updates: Partial<Task>) => void;
  bulkDeleteTasks: (taskIds: string[]) => void;
  setShowCommandPalette: (show: boolean) => void;
  setShowMiniMap: (show: boolean) => void;
  setCreateTaskColumnId: (columnId: string | null) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  toggleBoardSelection: (boardId: string) => void;
  clearBoardSelection: () => void;
};

function updateAffectedNodes(state: KanbanState, boards: Board[]): void {
  for (const node of state.nodes) {
    const board = boards.find((b) => b.id === node.id);
    if (board) {
      node.data.board = board;
    }
  }
}

function updateTasksInBoards(
  boards: Board[],
  taskIds: string[],
  updates: Partial<Task>
): void {
  for (const board of boards) {
    for (const column of board.columns || []) {
      for (const task of column.tasks || []) {
        if (taskIds.includes(task.id)) {
          Object.assign(task, updates, {
            updated_at: new Date().toISOString(),
          });
        }
      }
    }
  }
}

function deleteTasksFromBoards(boards: Board[], taskIds: string[]): void {
  for (const board of boards) {
    for (const column of board.columns || []) {
      if (column.tasks) {
        column.tasks = column.tasks.filter((t) => !taskIds.includes(t.id));
      }
    }
  }
}

function getRemovedBoardIds(boards: Board[], workspaceId: string): Set<string> {
  return new Set(
    boards
      .filter((board) => board.workspace_id === workspaceId)
      .map((board) => board.id)
  );
}

function removeBoardsAndNodes(
  state: KanbanState,
  removedBoardIds: Set<string>
): void {
  state.boards = state.boards.filter((board) => !removedBoardIds.has(board.id));
  state.nodes = state.nodes.filter((node) => !removedBoardIds.has(node.id));
  state.edges = state.edges.filter(
    (edge) =>
      !(removedBoardIds.has(edge.source) || removedBoardIds.has(edge.target))
  );
}

function cleanupSelectedBoards(
  state: KanbanState,
  removedBoardIds: Set<string>
): void {
  if (state.selectedBoardId && removedBoardIds.has(state.selectedBoardId)) {
    state.selectedBoardId = null;
  }

  for (const boardId of Array.from(state.selectedBoardIds)) {
    if (removedBoardIds.has(boardId)) {
      state.selectedBoardIds.delete(boardId);
    }
  }
}

const defaultWorkspace: Workspace = {
  id: crypto.randomUUID(),
  name: "Default Workspace",
  description: "Your default workspace",
  created_at: new Date().toISOString(),
};

function createInitialState(): KanbanState {
  return {
    workspaces: [defaultWorkspace],
    currentWorkspace: defaultWorkspace,
    boards: [],
    nodes: [],
    edges: [],
    selectedBoardId: null,
    selectedBoardIds: new Set(),
    draggedTask: null,
    selectedTasks: new Set(),
    showCommandPalette: false,
    showMiniMap: false,
    createTaskColumnId: null,
    interactionMode: "drag",
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
  };
}

export const useKanbanStore = create<KanbanState & KanbanActions>()(
  persist(
    immer((set, _get) => ({
      ...createInitialState(),

      setCurrentWorkspace: (workspace) =>
        set((state) => {
          state.currentWorkspace = workspace;
          state.selectedBoardId = null;
        }),

      deleteWorkspace: (workspaceId) =>
        set((state) => {
          if (state.workspaces.length === 0) {
            return;
          }

          const defaultWorkspaceId = state.workspaces[0]?.id;
          if (workspaceId === defaultWorkspaceId) {
            // The default workspace cannot be deleted
            return;
          }

          const removedBoardIds = getRemovedBoardIds(state.boards, workspaceId);

          state.workspaces = state.workspaces.filter(
            (workspace) => workspace.id !== workspaceId
          );

          removeBoardsAndNodes(state, removedBoardIds);
          cleanupSelectedBoards(state, removedBoardIds);

          if (state.currentWorkspace?.id === workspaceId) {
            const fallbackWorkspace = state.workspaces[0] ?? null;
            state.currentWorkspace = fallbackWorkspace;
          }
        }),

      resetWorkspace: (workspaceId) =>
        set((state) => {
          if (state.workspaces.length === 0) {
            return;
          }

          const defaultWorkspaceId = state.workspaces[0]?.id;
          if (workspaceId !== defaultWorkspaceId) {
            // Only the default workspace supports "reset" semantics
            return;
          }

          const removedBoardIds = getRemovedBoardIds(state.boards, workspaceId);

          removeBoardsAndNodes(state, removedBoardIds);
          cleanupSelectedBoards(state, removedBoardIds);
        }),

      addWorkspace: (workspace) =>
        set((state) => {
          state.workspaces.push(workspace);
        }),

      addBoard: (board, position) =>
        set((state) => {
          const workspaceId = state.currentWorkspace?.id;
          const boardWithWorkspace: Board = {
            ...board,
            workspace_id: workspaceId ?? board.workspace_id,
          };

          state.boards.push(boardWithWorkspace);

          let maxZIndex = 0;
          for (const node of state.nodes) {
            const currentZ = node.style?.zIndex || 0;
            if (typeof currentZ === "number" && currentZ > maxZIndex) {
              maxZIndex = currentZ;
            }
          }

          // Calculate proper dimensions based on board content
          const dimensions = calculateBoardDimensions(boardWithWorkspace);

          const newNode: Node<BoardNode["data"]> = {
            id: boardWithWorkspace.id,
            type: "board",
            position,
            data: {
              board: boardWithWorkspace,
              isSelected: false,
            },
            width: dimensions.width,
            height: dimensions.height,
            style: {
              width: dimensions.width,
              height: dimensions.height,
              zIndex: maxZIndex + 1,
            },
          };

          state.nodes.push(newNode);
        }),

      removeBoard: (boardId) =>
        set((state) => {
          state.boards = state.boards.filter((b) => b.id !== boardId);
          state.nodes = state.nodes.filter((n) => n.id !== boardId);

          if (state.selectedBoardId === boardId) {
            state.selectedBoardId = null;
          }
        }),

      updateBoard: (boardId, updates) =>
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: refactor later
        set((state) => {
          const boardIndex = state.boards.findIndex((b) => b.id === boardId);
          if (boardIndex !== -1) {
            const board = state.boards[boardIndex];
            if (board) {
              state.boards[boardIndex] = {
                ...board,
                ...updates,
              };

              const nodeIndex = state.nodes.findIndex((n) => n.id === boardId);
              if (nodeIndex !== -1) {
                const node = state.nodes[nodeIndex];
                const updatedBoard = state.boards[boardIndex];
                if (node && updatedBoard) {
                  node.data.board = updatedBoard;
                }
              }
            }
          }
        }),

      setSelectedBoard: (boardId) =>
        set((state) => {
          state.selectedBoardId = boardId;

          for (const node of state.nodes) {
            node.data.isSelected = node.id === boardId;
          }
        }),

      bringBoardToFront: (boardId) =>
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: fl
        set((state) => {
          let maxZIndex = 0;
          for (const node of state.nodes) {
            const currentZ = node.style?.zIndex || 0;
            if (typeof currentZ === "number" && currentZ > maxZIndex) {
              maxZIndex = currentZ;
            }
          }

          const node = state.nodes.find((n) => n.id === boardId);
          if (node) {
            if (!node.style) {
              node.style = {};
            }
            node.style.zIndex = maxZIndex + 1;
          }
        }),

      updateNodePosition: (nodeId, position) =>
        set((state) => {
          const nodeIndex = state.nodes.findIndex((n) => n.id === nodeId);
          if (nodeIndex !== -1) {
            const node = state.nodes[nodeIndex];
            if (node) {
              node.position = position;
            }
          }
        }),

      setNodes: (nodes) =>
        set((state) => {
          state.nodes = nodes;
        }),

      setEdges: (edges) =>
        set((state) => {
          state.edges = edges;
        }),

      addTask: (boardId, task) =>
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: refactor later
        set((state) => {
          const board = state.boards.find((b) => b.id === boardId);
          if (board?.columns) {
            const column = board.columns.find((c) => c.id === task.column_id);
            if (column) {
              if (!column.tasks) {
                column.tasks = [];
              }
              column.tasks.push(task);
              const node = state.nodes.find((n) => n.id === boardId);
              if (node) {
                node.data.board = board;
              }
            }
          }
        }),

      updateTask: (boardId, taskId, updates) =>
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: refactor later
        set((state) => {
          const board = state.boards.find((b) => b.id === boardId);
          if (board?.columns) {
            for (const column of board.columns) {
              const taskIndex = column.tasks?.findIndex((t) => t.id === taskId);
              if (taskIndex !== undefined && taskIndex !== -1 && column.tasks) {
                const task = column.tasks[taskIndex];
                if (task) {
                  column.tasks[taskIndex] = {
                    ...task,
                    ...updates,
                    updated_at: new Date().toISOString(),
                  };

                  const node = state.nodes.find((n) => n.id === boardId);
                  if (node) {
                    node.data.board = board;
                  }
                  break;
                }
              }
            }
          }
        }),

      deleteTask: (boardId, taskId) =>
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: refactor later
        set((state) => {
          const board = state.boards.find((b) => b.id === boardId);
          if (board?.columns) {
            for (const column of board.columns) {
              if (column.tasks) {
                column.tasks = column.tasks.filter((t) => t.id !== taskId);
              }
            }

            const node = state.nodes.find((n) => n.id === boardId);
            if (node) {
              node.data.board = board;
            }
          }

          state.selectedTasks.delete(taskId);
        }),

      moveTask: (taskId, fromColumnId, toColumnId, targetBoardId) =>
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: refactor later
        set((state) => {
          let sourceBoard: Board | undefined;
          let sourceColumnIndex = -1;
          let sourceTaskIndex = -1;

          for (const board of state.boards) {
            if (!board.columns) {
              continue;
            }
            const columnIndex = board.columns.findIndex(
              (c) => c.id === fromColumnId
            );
            if (columnIndex === -1) {
              continue;
            }
            const column = board.columns[columnIndex];
            if (!column) {
              continue;
            }
            const tasks = column.tasks || [];
            const taskIndex = tasks.findIndex((t) => t.id === taskId);
            if (taskIndex !== -1) {
              sourceBoard = board;
              sourceColumnIndex = columnIndex;
              sourceTaskIndex = taskIndex;
              break;
            }
          }

          if (
            !sourceBoard ||
            sourceColumnIndex === -1 ||
            sourceTaskIndex === -1
          ) {
            return;
          }

          const targetBoard =
            state.boards.find((b) => b.id === targetBoardId) ?? sourceBoard;
          if (!targetBoard.columns) {
            return;
          }

          const sourceColumn = sourceBoard.columns?.[sourceColumnIndex];
          const targetColumn = targetBoard.columns.find(
            (c) => c.id === toColumnId
          );
          if (!(sourceColumn && targetColumn && sourceColumn.tasks)) {
            return;
          }

          const [task] = sourceColumn.tasks.splice(sourceTaskIndex, 1);
          if (!task) {
            return;
          }

          task.board_id = targetBoard.id;
          task.column_id = toColumnId;
          task.updated_at = new Date().toISOString();

          if (!targetColumn.tasks) {
            targetColumn.tasks = [];
          }
          task.position = targetColumn.tasks.length;
          targetColumn.tasks.push(task);

          updateAffectedNodes(state, state.boards);
        }),

      setDraggedTask: (task) =>
        set((state) => {
          state.draggedTask = task;
        }),

      addColumn: (boardId, column) =>
        set((state) => {
          const board = state.boards.find((b) => b.id === boardId);
          if (board) {
            if (!board.columns) {
              board.columns = [];
            }
            board.columns.push(column);

            const node = state.nodes.find((n) => n.id === boardId);
            if (node) {
              node.data.board = board;
            }
          }
        }),

      updateColumn: (boardId, columnId, updates) =>
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: refactor later
        set((state) => {
          const board = state.boards.find((b) => b.id === boardId);
          if (board?.columns) {
            const columnIndex = board.columns.findIndex(
              (c) => c.id === columnId
            );
            if (columnIndex !== -1) {
              const column = board.columns[columnIndex];
              if (column) {
                board.columns[columnIndex] = {
                  ...column,
                  ...updates,
                };

                const node = state.nodes.find((n) => n.id === boardId);
                if (node) {
                  node.data.board = board;
                }
              }
            }
          }
        }),

      deleteColumn: (boardId, columnId) =>
        set((state) => {
          const board = state.boards.find((b) => b.id === boardId);
          if (board?.columns) {
            board.columns = board.columns.filter((c) => c.id !== columnId);

            const node = state.nodes.find((n) => n.id === boardId);
            if (node) {
              node.data.board = board;
            }
          }
        }),

      moveColumn: (boardId, columnId, newPosition) =>
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: refactor later
        set((state) => {
          const board = state.boards.find((b) => b.id === boardId);
          if (board?.columns) {
            const columnIndex = board.columns.findIndex(
              (c) => c.id === columnId
            );
            if (columnIndex !== -1) {
              const [column] = board.columns.splice(columnIndex, 1);
              if (column) {
                board.columns.splice(newPosition, 0, column);

                for (let i = 0; i < board.columns.length; i++) {
                  const col = board.columns[i];
                  if (col) {
                    col.position = i;
                  }
                }

                const node = state.nodes.find((n) => n.id === boardId);
                if (node) {
                  node.data.board = board;
                }
              }
            }
          }
        }),

      moveColumnToBoard: (sourceBoardId, columnId, targetBoardId) =>
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: refactor later
        set((state) => {
          if (sourceBoardId === targetBoardId) {
            return;
          }

          const sourceBoard = state.boards.find((b) => b.id === sourceBoardId);
          const targetBoard = state.boards.find((b) => b.id === targetBoardId);
          if (!(sourceBoard?.columns && targetBoard)) {
            return;
          }

          const columnIndex = sourceBoard.columns.findIndex(
            (c) => c.id === columnId
          );
          if (columnIndex === -1) {
            return;
          }

          const [column] = sourceBoard.columns.splice(columnIndex, 1);
          if (!column) {
            return;
          }

          column.board_id = targetBoard.id;
          if (column.tasks) {
            for (const task of column.tasks) {
              task.board_id = targetBoard.id;
            }
          }

          if (!targetBoard.columns) {
            targetBoard.columns = [];
          }
          column.position = targetBoard.columns.length;
          targetBoard.columns.push(column);

          updateAffectedNodes(state, state.boards);
        }),

      setViewport: (viewport) =>
        set((state) => {
          state.viewport = viewport;
        }),

      toggleTaskSelection: (taskId) =>
        set((state) => {
          if (state.selectedTasks.has(taskId)) {
            state.selectedTasks.delete(taskId);
          } else {
            state.selectedTasks.add(taskId);
          }
        }),

      clearTaskSelection: () =>
        set((state) => {
          state.selectedTasks.clear();
        }),

      bulkUpdateTasks: (taskIds, updates) =>
        set((state) => {
          updateTasksInBoards(state.boards, taskIds, updates);
          updateAffectedNodes(state, state.boards);
        }),

      bulkDeleteTasks: (taskIds) =>
        set((state) => {
          deleteTasksFromBoards(state.boards, taskIds);
          updateAffectedNodes(state, state.boards);

          for (const id of taskIds) {
            state.selectedTasks.delete(id);
          }
        }),

      setShowCommandPalette: (show) =>
        set((state) => {
          state.showCommandPalette = show;
        }),

      setShowMiniMap: (show) =>
        set((state) => {
          state.showMiniMap = show;
        }),

      setCreateTaskColumnId: (columnId) =>
        set((state) => {
          state.createTaskColumnId = columnId;
        }),

      setInteractionMode: (mode) =>
        set((state) => {
          state.interactionMode = mode;
          if (mode === "drag") {
            state.selectedBoardIds.clear();
          }
        }),

      toggleBoardSelection: (boardId) =>
        set((state) => {
          if (state.selectedBoardIds.has(boardId)) {
            state.selectedBoardIds.delete(boardId);
          } else {
            state.selectedBoardIds.add(boardId);
          }
        }),

      clearBoardSelection: () =>
        set((state) => {
          state.selectedBoardIds.clear();
        }),
    })),
    {
      name: "lumen-kanban-store-v1",
      partialize: (state) => ({
        workspaces: state.workspaces,
        currentWorkspace: state.currentWorkspace,
        boards: state.boards,
        nodes: state.nodes,
        edges: state.edges,
        viewport: state.viewport,
      }),
    }
  )
);
