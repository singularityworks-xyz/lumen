import type { TemporalState } from "zundo";
import { temporal } from "zundo";
import type { StateCreator } from "zustand";
import { create, useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  Board,
  BoardPosition,
  CanvasState,
  Column,
  DenormalizedBoard,
  DenormalizedColumn,
  EntityMap,
  InteractionMode,
  Task,
  ViewportState,
  Workspace,
} from "../types";
import {
  generateBoardId,
  generateColumnId,
  generateTaskId,
  generateWorkspaceId,
} from "./ids";
import { indexedDBStorage, STORAGE_KEY } from "./storage";

// ============================================================================
// Store State Type
// ============================================================================

type KanbanState = {
  // Normalized entities
  workspaces: EntityMap<Workspace>;
  boards: EntityMap<Board>;
  columns: EntityMap<Column>;
  tasks: EntityMap<Task>;
  boardPositions: EntityMap<BoardPosition>;

  // Current selection
  currentWorkspaceId: string | null;

  // Canvas state
  canvas: CanvasState;

  // UI state (not persisted, not in undo history)
  showCommandPalette: boolean;
  showMiniMap: boolean;
  createTaskColumnId: string | null;
  interactionMode: InteractionMode;
  selectedBoardId: string | null;
  selectedBoardIds: string[];
  selectedTaskIds: string[];
  draggedTaskId: string | null;
};

// ============================================================================
// Store Actions Type
// ============================================================================

type KanbanActions = {
  // Workspace actions
  setCurrentWorkspace: (workspaceId: string | null) => void;
  addWorkspace: (name: string, description?: string) => string;
  updateWorkspace: (
    workspaceId: string,
    updates: Partial<Pick<Workspace, "name" | "description">>
  ) => void;
  deleteWorkspace: (workspaceId: string) => void;
  resetWorkspace: (workspaceId: string) => void;

  // Board actions
  addBoard: (
    name: string,
    position: { x: number; y: number },
    description?: string
  ) => string;
  updateBoard: (
    boardId: string,
    updates: Partial<Pick<Board, "name" | "description">>
  ) => void;
  removeBoard: (boardId: string) => void;
  updateBoardPosition: (
    boardId: string,
    position: { x: number; y: number }
  ) => void;
  updateBoardDimensions: (
    boardId: string,
    dimensions: { width: number; height: number }
  ) => void;
  bringBoardToFront: (boardId: string) => void;

  // Column actions
  addColumn: (boardId: string, name: string, position?: number) => string;
  updateColumn: (
    columnId: string,
    updates: Partial<Pick<Column, "name" | "position">>
  ) => void;
  deleteColumn: (boardId: string, columnId: string) => void;
  moveColumn: (boardId: string, columnId: string, newPosition: number) => void;
  moveColumnToBoard: (
    sourceBoardId: string,
    columnId: string,
    targetBoardId: string
  ) => void;

  // Task actions
  addTask: (
    columnId: string,
    boardId: string,
    title: string,
    options?: Partial<
      Pick<Task, "description" | "priority" | "progress" | "due_date" | "tags">
    >
  ) => string;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (boardId: string, taskId: string) => void;
  moveTask: (
    taskId: string,
    fromColumnId: string,
    toColumnId: string,
    targetBoardId: string
  ) => void;
  bulkUpdateTasks: (taskIds: string[], updates: Partial<Task>) => void;
  bulkDeleteTasks: (taskIds: string[]) => void;

  // Canvas actions
  setViewport: (viewport: ViewportState) => void;
  setFocusedBoard: (boardId: string | null) => void;

  // UI actions (not in undo history)
  setShowCommandPalette: (show: boolean) => void;
  setShowMiniMap: (show: boolean) => void;
  setCreateTaskColumnId: (columnId: string | null) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setSelectedBoard: (boardId: string | null) => void;
  toggleBoardSelection: (boardId: string) => void;
  clearBoardSelection: () => void;
  toggleTaskSelection: (taskId: string) => void;
  clearTaskSelection: () => void;
  setDraggedTask: (taskId: string | null) => void;

  // Computed/Derived data helpers
  getDenormalizedBoard: (boardId: string) => DenormalizedBoard | null;
};

// ============================================================================
// Helpers
// ============================================================================

function getNextZIndex(positions: EntityMap<BoardPosition>): number {
  let maxZIndex = 0;
  for (const id of positions.allIds) {
    const pos = positions.byId[id];
    if (pos && pos.zIndex > maxZIndex) {
      maxZIndex = pos.zIndex;
    }
  }
  return maxZIndex + 1;
}

function createDefaultWorkspace(): { workspace: Workspace; id: string } {
  const id = generateWorkspaceId();
  return {
    id,
    workspace: {
      id,
      name: "Default Workspace",
      description: "Your default workspace",
      created_at: new Date().toISOString(),
      board_ids: [],
    },
  };
}

function createInitialState(): KanbanState {
  const { workspace, id } = createDefaultWorkspace();

  return {
    // Normalized entities
    workspaces: {
      byId: { [id]: workspace },
      allIds: [id],
    },
    boards: { byId: {}, allIds: [] },
    columns: { byId: {}, allIds: [] },
    tasks: { byId: {}, allIds: [] },
    boardPositions: { byId: {}, allIds: [] },

    // Current selection
    currentWorkspaceId: id,

    // Canvas state
    canvas: {
      viewport: { x: 0, y: 0, zoom: 1 },
      focusedBoardId: null,
      lastInteractionTime: Date.now(),
    },

    // UI state
    showCommandPalette: false,
    showMiniMap: false,
    createTaskColumnId: null,
    interactionMode: "drag",
    selectedBoardId: null,
    selectedBoardIds: [],
    selectedTaskIds: [],
    draggedTaskId: null,
  };
}

// ============================================================================
// Store Creator
// ============================================================================

const storeCreator: StateCreator<
  KanbanState & KanbanActions,
  [["zustand/immer", never]],
  [],
  KanbanState & KanbanActions
> = (set, get) => ({
  ...createInitialState(),

  // ========== Workspace Actions ==========

  setCurrentWorkspace: (workspaceId) =>
    set((state) => {
      if (workspaceId === null || state.workspaces.byId[workspaceId]) {
        state.currentWorkspaceId = workspaceId;
        state.selectedBoardId = null;
        state.selectedBoardIds = [];
      }
    }),

  addWorkspace: (name, description) => {
    const id = generateWorkspaceId();
    const workspace: Workspace = {
      id,
      name,
      description,
      created_at: new Date().toISOString(),
      board_ids: [],
    };

    set((state) => {
      state.workspaces.byId[id] = workspace;
      state.workspaces.allIds.push(id);
    });

    return id;
  },

  updateWorkspace: (workspaceId, updates) =>
    set((state) => {
      const workspace = state.workspaces.byId[workspaceId];
      if (workspace) {
        Object.assign(workspace, updates);
      }
    }),

  deleteWorkspace: (workspaceId) =>
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex cascade deletion required
    set((state) => {
      // Prevent deleting the default (first) workspace
      if (state.workspaces.allIds[0] === workspaceId) {
        return;
      }

      const workspace = state.workspaces.byId[workspaceId];
      if (!workspace) {
        return;
      }

      // Remove all boards in this workspace
      for (const boardId of workspace.board_ids) {
        const board = state.boards.byId[boardId];
        if (board) {
          // Remove columns and tasks
          for (const columnId of board.column_ids) {
            const column = state.columns.byId[columnId];
            if (column) {
              // Remove tasks
              for (const taskId of column.task_ids) {
                delete state.tasks.byId[taskId];
                state.tasks.allIds = state.tasks.allIds.filter(
                  (id) => id !== taskId
                );
              }
            }
            delete state.columns.byId[columnId];
            state.columns.allIds = state.columns.allIds.filter(
              (id) => id !== columnId
            );
          }
        }
        delete state.boards.byId[boardId];
        state.boards.allIds = state.boards.allIds.filter(
          (id) => id !== boardId
        );
        delete state.boardPositions.byId[boardId];
        state.boardPositions.allIds = state.boardPositions.allIds.filter(
          (id) => id !== boardId
        );
      }

      // Remove workspace
      delete state.workspaces.byId[workspaceId];
      state.workspaces.allIds = state.workspaces.allIds.filter(
        (id) => id !== workspaceId
      );

      // Switch to default workspace if current was deleted
      if (state.currentWorkspaceId === workspaceId) {
        state.currentWorkspaceId = state.workspaces.allIds[0] ?? null;
      }
    }),

  resetWorkspace: (workspaceId) =>
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex cascade deletion required
    set((state) => {
      // Only the default workspace supports reset
      if (state.workspaces.allIds[0] !== workspaceId) {
        return;
      }

      const workspace = state.workspaces.byId[workspaceId];
      if (!workspace) {
        return;
      }

      // Remove all boards in this workspace - copy array since we're modifying while iterating
      const boardIdsToRemove = workspace.board_ids.slice();
      for (const boardId of boardIdsToRemove) {
        const board = state.boards.byId[boardId];
        if (board) {
          // Remove columns and tasks
          for (const columnId of board.column_ids) {
            const column = state.columns.byId[columnId];
            if (column) {
              // Remove tasks
              for (const taskId of column.task_ids) {
                delete state.tasks.byId[taskId];
                state.tasks.allIds = state.tasks.allIds.filter(
                  (id) => id !== taskId
                );
              }
            }
            delete state.columns.byId[columnId];
            state.columns.allIds = state.columns.allIds.filter(
              (id) => id !== columnId
            );
          }
        }
        delete state.boards.byId[boardId];
        state.boards.allIds = state.boards.allIds.filter(
          (id) => id !== boardId
        );
        delete state.boardPositions.byId[boardId];
        state.boardPositions.allIds = state.boardPositions.allIds.filter(
          (id) => id !== boardId
        );
      }

      workspace.board_ids = [];
    }),

  // ========== Board Actions ==========

  addBoard: (name, position, description) => {
    const boardId = generateBoardId();
    const now = new Date().toISOString();
    const workspaceId = get().currentWorkspaceId ?? "";

    // Create default columns
    const col1Id = generateColumnId();
    const col2Id = generateColumnId();
    const col3Id = generateColumnId();

    const board: Board = {
      id: boardId,
      name,
      description,
      workspace_id: workspaceId,
      created_by: "current-user",
      created_at: now,
      column_ids: [col1Id, col2Id, col3Id],
    };

    const columns: Column[] = [
      {
        id: col1Id,
        board_id: boardId,
        name: "To Do",
        position: 0,
        task_ids: [],
      },
      {
        id: col2Id,
        board_id: boardId,
        name: "In Progress",
        position: 1,
        task_ids: [],
      },
      {
        id: col3Id,
        board_id: boardId,
        name: "Done",
        position: 2,
        task_ids: [],
      },
    ];

    set((state) => {
      // Add board
      state.boards.byId[boardId] = board;
      state.boards.allIds.push(boardId);

      // Add columns
      for (const column of columns) {
        state.columns.byId[column.id] = column;
        state.columns.allIds.push(column.id);
      }

      // Add board position
      const boardPosition: BoardPosition = {
        id: boardId,
        x: position.x,
        y: position.y,
        zIndex: getNextZIndex(state.boardPositions),
      };
      state.boardPositions.byId[boardId] = boardPosition;
      state.boardPositions.allIds.push(boardId);

      // Add to workspace
      const workspace = state.workspaces.byId[workspaceId];
      if (workspace) {
        workspace.board_ids.push(boardId);
      }
    });

    return boardId;
  },

  updateBoard: (boardId, updates) =>
    set((state) => {
      const board = state.boards.byId[boardId];
      if (board) {
        Object.assign(board, updates);
      }
    }),

  removeBoard: (boardId) =>
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex cascade deletion required
    set((state) => {
      const board = state.boards.byId[boardId];
      if (!board) {
        return;
      }

      // Remove columns and tasks
      for (const columnId of board.column_ids) {
        const column = state.columns.byId[columnId];
        if (column) {
          // Remove tasks
          for (const taskId of column.task_ids) {
            delete state.tasks.byId[taskId];
            state.tasks.allIds = state.tasks.allIds.filter(
              (id) => id !== taskId
            );
          }
        }
        delete state.columns.byId[columnId];
        state.columns.allIds = state.columns.allIds.filter(
          (id) => id !== columnId
        );
      }

      // Remove from workspace
      const workspace = state.workspaces.byId[board.workspace_id];
      if (workspace) {
        workspace.board_ids = workspace.board_ids.filter(
          (id) => id !== boardId
        );
      }

      // Remove board
      delete state.boards.byId[boardId];
      state.boards.allIds = state.boards.allIds.filter((id) => id !== boardId);

      // Remove board position
      delete state.boardPositions.byId[boardId];
      state.boardPositions.allIds = state.boardPositions.allIds.filter(
        (id) => id !== boardId
      );

      // Clear selection if this board was selected
      if (state.selectedBoardId === boardId) {
        state.selectedBoardId = null;
      }
      state.selectedBoardIds = state.selectedBoardIds.filter(
        (id) => id !== boardId
      );
    }),

  updateBoardPosition: (boardId, position) =>
    set((state) => {
      const boardPos = state.boardPositions.byId[boardId];
      if (boardPos) {
        boardPos.x = position.x;
        boardPos.y = position.y;
      }
    }),

  updateBoardDimensions: (boardId, dimensions) =>
    set((state) => {
      const boardPos = state.boardPositions.byId[boardId];
      if (boardPos) {
        boardPos.width = dimensions.width;
        boardPos.height = dimensions.height;
      }
    }),

  bringBoardToFront: (boardId) =>
    set((state) => {
      const boardPos = state.boardPositions.byId[boardId];
      if (boardPos) {
        boardPos.zIndex = getNextZIndex(state.boardPositions);
      }
    }),

  // ========== Column Actions ==========

  addColumn: (boardId, name, position) => {
    const columnId = generateColumnId();
    const currentState = get();

    // Calculate position if not provided
    let finalPosition = position ?? 0;
    if (position === undefined) {
      const board = currentState.boards.byId[boardId];
      finalPosition = board?.column_ids.length ?? 0;
    }

    const column: Column = {
      id: columnId,
      board_id: boardId,
      name,
      position: finalPosition,
      task_ids: [],
    };

    set((state) => {
      state.columns.byId[columnId] = column;
      state.columns.allIds.push(columnId);

      // Add to board
      const board = state.boards.byId[boardId];
      if (board) {
        board.column_ids.push(columnId);
      }
    });

    return columnId;
  },

  updateColumn: (columnId, updates) =>
    set((state) => {
      const column = state.columns.byId[columnId];
      if (column) {
        Object.assign(column, updates);
      }
    }),

  deleteColumn: (boardId, columnId) =>
    set((state) => {
      const column = state.columns.byId[columnId];
      if (!column) {
        return;
      }

      // Remove all tasks in this column
      for (const taskId of column.task_ids) {
        delete state.tasks.byId[taskId];
        state.tasks.allIds = state.tasks.allIds.filter((id) => id !== taskId);
        state.selectedTaskIds = state.selectedTaskIds.filter(
          (id) => id !== taskId
        );
      }

      // Remove from board
      const board = state.boards.byId[boardId];
      if (board) {
        board.column_ids = board.column_ids.filter((id) => id !== columnId);
      }

      // Remove column
      delete state.columns.byId[columnId];
      state.columns.allIds = state.columns.allIds.filter(
        (id) => id !== columnId
      );
    }),

  moveColumn: (boardId, columnId, newPosition) =>
    set((state) => {
      const board = state.boards.byId[boardId];
      if (!board) {
        return;
      }

      const currentIndex = board.column_ids.indexOf(columnId);
      if (currentIndex === -1 || currentIndex === newPosition) {
        return;
      }

      // Remove from current position
      board.column_ids.splice(currentIndex, 1);
      // Insert at new position
      board.column_ids.splice(newPosition, 0, columnId);

      // Update all column positions
      for (const [index, colId] of board.column_ids.entries()) {
        const col = state.columns.byId[colId];
        if (col) {
          col.position = index;
        }
      }
    }),

  moveColumnToBoard: (sourceBoardId, columnId, targetBoardId) =>
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex column transfer logic
    set((state) => {
      if (sourceBoardId === targetBoardId) {
        return;
      }

      const sourceBoard = state.boards.byId[sourceBoardId];
      const targetBoard = state.boards.byId[targetBoardId];
      const column = state.columns.byId[columnId];

      if (!(sourceBoard && targetBoard && column)) {
        return;
      }

      // Remove from source board
      sourceBoard.column_ids = sourceBoard.column_ids.filter(
        (id) => id !== columnId
      );

      // Update column's board_id
      column.board_id = targetBoardId;
      column.position = targetBoard.column_ids.length;

      // Update all tasks in this column
      for (const taskId of column.task_ids) {
        const task = state.tasks.byId[taskId];
        if (task) {
          task.board_id = targetBoardId;
        }
      }

      // Add to target board
      targetBoard.column_ids.push(columnId);

      // Update source board column positions
      for (const [index, colId] of sourceBoard.column_ids.entries()) {
        const col = state.columns.byId[colId];
        if (col) {
          col.position = index;
        }
      }
    }),

  // ========== Task Actions ==========

  addTask: (columnId, boardId, title, options = {}) => {
    const taskId = generateTaskId();
    const now = new Date().toISOString();

    const task: Task = {
      id: taskId,
      board_id: boardId,
      column_id: columnId,
      title,
      description: options.description,
      priority: options.priority ?? "medium",
      progress: options.progress ?? 0,
      position: 0,
      due_date: options.due_date,
      created_by: "current-user",
      created_at: now,
      updated_at: now,
      tags: options.tags,
    };

    set((state) => {
      // Add task
      state.tasks.byId[taskId] = task;
      state.tasks.allIds.push(taskId);

      // Add to column
      const column = state.columns.byId[columnId];
      if (column) {
        task.position = column.task_ids.length;
        column.task_ids.push(taskId);
      }
    });

    return taskId;
  },

  updateTask: (taskId, updates) =>
    set((state) => {
      const task = state.tasks.byId[taskId];
      if (task) {
        Object.assign(task, {
          ...updates,
          updated_at: new Date().toISOString(),
        });
      }
    }),

  deleteTask: (_boardId, taskId) =>
    set((state) => {
      const task = state.tasks.byId[taskId];
      if (!task) {
        return;
      }

      // Remove from column
      const column = state.columns.byId[task.column_id];
      if (column) {
        column.task_ids = column.task_ids.filter((id) => id !== taskId);
      }

      // Remove task
      delete state.tasks.byId[taskId];
      state.tasks.allIds = state.tasks.allIds.filter((id) => id !== taskId);
      state.selectedTaskIds = state.selectedTaskIds.filter(
        (id) => id !== taskId
      );
    }),

  moveTask: (taskId, fromColumnId, toColumnId, targetBoardId) =>
    set((state) => {
      const task = state.tasks.byId[taskId];
      const fromColumn = state.columns.byId[fromColumnId];
      const toColumn = state.columns.byId[toColumnId];

      if (!(task && fromColumn && toColumn)) {
        return;
      }

      // Remove from source column
      fromColumn.task_ids = fromColumn.task_ids.filter((id) => id !== taskId);

      // Update task
      task.column_id = toColumnId;
      task.board_id = targetBoardId;
      task.position = toColumn.task_ids.length;
      task.updated_at = new Date().toISOString();

      // Add to target column
      toColumn.task_ids.push(taskId);
    }),

  bulkUpdateTasks: (taskIds, updates) =>
    set((state) => {
      const now = new Date().toISOString();
      for (const taskId of taskIds) {
        const task = state.tasks.byId[taskId];
        if (task) {
          Object.assign(task, {
            ...updates,
            updated_at: now,
          });
        }
      }
    }),

  bulkDeleteTasks: (taskIds) =>
    set((state) => {
      for (const taskId of taskIds) {
        const task = state.tasks.byId[taskId];
        if (task) {
          // Remove from column
          const column = state.columns.byId[task.column_id];
          if (column) {
            column.task_ids = column.task_ids.filter((id) => id !== taskId);
          }
          delete state.tasks.byId[taskId];
        }
      }
      state.tasks.allIds = state.tasks.allIds.filter(
        (id) => !taskIds.includes(id)
      );
      state.selectedTaskIds = state.selectedTaskIds.filter(
        (id) => !taskIds.includes(id)
      );
    }),

  // ========== Canvas Actions ==========

  setViewport: (viewport) =>
    set((state) => {
      state.canvas.viewport = viewport;
      state.canvas.lastInteractionTime = Date.now();
    }),

  setFocusedBoard: (boardId) =>
    set((state) => {
      state.canvas.focusedBoardId = boardId;
    }),

  // ========== UI Actions ==========

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
        state.selectedBoardIds = [];
      }
    }),

  setSelectedBoard: (boardId) =>
    set((state) => {
      state.selectedBoardId = boardId;
    }),

  toggleBoardSelection: (boardId) =>
    set((state) => {
      const index = state.selectedBoardIds.indexOf(boardId);
      if (index === -1) {
        state.selectedBoardIds.push(boardId);
      } else {
        state.selectedBoardIds.splice(index, 1);
      }
    }),

  clearBoardSelection: () =>
    set((state) => {
      state.selectedBoardIds = [];
    }),

  toggleTaskSelection: (taskId) =>
    set((state) => {
      const index = state.selectedTaskIds.indexOf(taskId);
      if (index === -1) {
        state.selectedTaskIds.push(taskId);
      } else {
        state.selectedTaskIds.splice(index, 1);
      }
    }),

  clearTaskSelection: () =>
    set((state) => {
      state.selectedTaskIds = [];
    }),

  setDraggedTask: (taskId) =>
    set((state) => {
      state.draggedTaskId = taskId;
    }),

  // ========== Derived Data Helpers ==========

  getDenormalizedBoard: (boardId) => {
    const currentState = get();
    const board = currentState.boards.byId[boardId];
    if (!board) {
      return null;
    }

    const columns: DenormalizedColumn[] = board.column_ids
      .map((colId) => {
        const column = currentState.columns.byId[colId];
        if (!column) {
          return null;
        }

        const tasks = column.task_ids
          .map((taskId) => currentState.tasks.byId[taskId])
          .filter((task): task is Task => task !== undefined)
          .sort((a, b) => a.position - b.position);

        return {
          id: column.id,
          board_id: column.board_id,
          name: column.name,
          position: column.position,
          tasks,
        };
      })
      .filter((col): col is DenormalizedColumn => col !== null)
      .sort((a, b) => a.position - b.position);

    return {
      id: board.id,
      name: board.name,
      description: board.description,
      workspace_id: board.workspace_id,
      created_by: board.created_by,
      created_at: board.created_at,
      columns,
    };
  },
});

// ============================================================================
// Create Store with Middleware
// ============================================================================

// Fields to exclude from persistence
const uiStateFields: (keyof KanbanState)[] = [
  "showCommandPalette",
  "showMiniMap",
  "createTaskColumnId",
  "interactionMode",
  "selectedBoardId",
  "selectedBoardIds",
  "selectedTaskIds",
  "draggedTaskId",
];

// Fields to exclude from undo/redo history
const temporalExcludeFields: (keyof KanbanState)[] = [
  ...uiStateFields,
  "canvas", // Canvas viewport changes shouldn't be undoable
];

export const useKanbanStore = create<KanbanState & KanbanActions>()(
  persist(
    temporal(immer(storeCreator), {
      limit: 200,
      partialize: (state) => {
        // Only track data state changes in history, not UI state
        const tracked: Partial<KanbanState> = {};
        for (const key of Object.keys(state) as (keyof KanbanState)[]) {
          if (!temporalExcludeFields.includes(key)) {
            // @ts-expect-error - Dynamic assignment
            tracked[key] = state[key];
          }
        }
        return tracked;
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => {
        // Only persist data state, not UI state
        const persisted: Partial<KanbanState> = {
          workspaces: state.workspaces,
          boards: state.boards,
          columns: state.columns,
          tasks: state.tasks,
          boardPositions: state.boardPositions,
          currentWorkspaceId: state.currentWorkspaceId,
          canvas: state.canvas,
        };
        return persisted;
      },
    }
  )
);

// ============================================================================
// Temporal Store Helpers
// ============================================================================

/**
 * Hook to access temporal store state reactively
 * Use this to subscribe to pastStates/futureStates changes in React components
 */
export const useTemporalStore = <T>(
  selector: (state: TemporalState<Partial<KanbanState>>) => T
): T => useStore(useKanbanStore.temporal, selector);

/**
 * Hook to check if undo is available (reactive)
 */
export const useCanUndo = (): boolean =>
  useTemporalStore((state) => state.pastStates.length > 0);

/**
 * Hook to check if redo is available (reactive)
 */
export const useCanRedo = (): boolean =>
  useTemporalStore((state) => state.futureStates.length > 0);

/**
 * Undo the last action (imperative)
 */
export const undo = (): void => useKanbanStore.temporal.getState().undo();

/**
 * Redo the last undone action (imperative)
 */
export const redo = (): void => useKanbanStore.temporal.getState().redo();

/**
 * Check if undo is available (non-reactive, for imperative use)
 */
export const canUndo = (): boolean =>
  useKanbanStore.temporal.getState().pastStates.length > 0;

/**
 * Check if redo is available (non-reactive, for imperative use)
 */
export const canRedo = (): boolean =>
  useKanbanStore.temporal.getState().futureStates.length > 0;

/**
 * Clear undo/redo history
 */
export const clearHistory = (): void =>
  useKanbanStore.temporal.getState().clear();

// ============================================================================
// Type Exports
// ============================================================================

export type { KanbanState, KanbanActions };
