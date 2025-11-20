import type { Edge, Node } from "@xyflow/react";
import { enableMapSet } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Board, BoardNode, Column, Task, Workspace } from "../types";

// Enable Immer's MapSet plugin for Set support
enableMapSet();

type InteractionMode = "drag" | "select";

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
};

type KanbanActions = {
  setCurrentWorkspace: (workspace: Workspace) => void;
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
    boardId: string
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
  initializeWithMockData: (workspaces: Workspace[], boards: Board[]) => void;
};

// Helper function to update all affected nodes after board changes
function updateAffectedNodes(state: KanbanState, boards: Board[]): void {
  for (const node of state.nodes) {
    const board = boards.find((b) => b.id === node.id);
    if (board) {
      node.data.board = board;
    }
  }
}

// Helper function to update tasks in bulk
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

// Helper function to delete tasks from boards
function deleteTasksFromBoards(boards: Board[], taskIds: string[]): void {
  for (const board of boards) {
    for (const column of board.columns || []) {
      if (column.tasks) {
        column.tasks = column.tasks.filter((t) => !taskIds.includes(t.id));
      }
    }
  }
}

export const useKanbanStore = create<KanbanState & KanbanActions>()(
  immer((set, _get) => ({
    workspaces: [],
    currentWorkspace: null,
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
    interactionMode: "drag" as InteractionMode,

    setCurrentWorkspace: (workspace) =>
      set((state) => {
        state.currentWorkspace = workspace;
        state.selectedBoardId = null;
      }),

    addWorkspace: (workspace) =>
      set((state) => {
        state.workspaces.push(workspace);
      }),

    addBoard: (board, position) =>
      set((state) => {
        state.boards.push(board);

        // Calculate initial z-index based on existing nodes
        let maxZIndex = 0;
        for (const node of state.nodes) {
          const currentZ = node.style?.zIndex || 0;
          if (typeof currentZ === "number" && currentZ > maxZIndex) {
            maxZIndex = currentZ;
          }
        }

        const newNode: Node<BoardNode["data"]> = {
          id: board.id,
          type: "board",
          position,
          data: {
            board,
            isSelected: false,
          },
          width: 1400,
          height: 800,
          style: {
            width: 1400,
            height: 800,
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

    moveTask: (taskId, fromColumnId, toColumnId, boardId) =>
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO: refactor later
      set((state) => {
        const board = state.boards.find((b) => b.id === boardId);
        if (board?.columns) {
          const fromColumn = board.columns.find((c) => c.id === fromColumnId);
          const toColumn = board.columns.find((c) => c.id === toColumnId);

          if (fromColumn && toColumn && fromColumn.tasks) {
            const taskIndex = fromColumn.tasks.findIndex(
              (t) => t.id === taskId
            );
            if (taskIndex !== -1) {
              const [task] = fromColumn.tasks.splice(taskIndex, 1);
              if (task) {
                task.column_id = toColumnId;
                task.updated_at = new Date().toISOString();

                if (!toColumn.tasks) {
                  toColumn.tasks = [];
                }
                toColumn.tasks.push(task);

                const node = state.nodes.find((n) => n.id === boardId);
                if (node) {
                  node.data.board = board;
                }
              }
            }
          }
        }
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
          const columnIndex = board.columns.findIndex((c) => c.id === columnId);
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
          const columnIndex = board.columns.findIndex((c) => c.id === columnId);
          if (columnIndex !== -1) {
            // Remove the column from its current position
            const [column] = board.columns.splice(columnIndex, 1);
            if (column) {
              // Insert it at the new position
              board.columns.splice(newPosition, 0, column);

              // Update position values for all columns
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

    initializeWithMockData: (workspaces, boards) =>
      set((state) => {
        state.workspaces = workspaces;
        state.currentWorkspace = workspaces[0] || null;
        state.boards = boards;

        state.nodes = boards.map((board, index) => ({
          id: board.id,
          type: "board",
          position: { x: 20 + index * 1450, y: 20 },
          data: {
            board,
            isSelected: false,
          },
          width: 1400,
          height: 800,
          style: {
            width: 1400,
            height: 800,
            zIndex: index + 1,
          },
        }));
      }),
  }))
);
