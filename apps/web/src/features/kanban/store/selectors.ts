import { useMemo } from "react";
import { useShallow } from "zustand/shallow";
import type {
  Board,
  Column,
  DenormalizedBoard,
  DenormalizedColumn,
  Task,
  Workspace,
} from "../types";
import { useKanbanStore } from "./kanban-store";

// ============================================================================
// Workspace Selectors
// ============================================================================

/**
 * Get the current workspace
 */
export function useCurrentWorkspace(): Workspace | null {
  return useKanbanStore(
    useShallow((state) => {
      const id = state.currentWorkspaceId;
      return id ? (state.workspaces.byId[id] ?? null) : null;
    })
  );
}

/**
 * Get all workspaces as an array
 */
export function useWorkspaces(): Workspace[] {
  return useKanbanStore(
    useShallow((state) =>
      state.workspaces.allIds
        .map((id) => state.workspaces.byId[id])
        .filter((ws): ws is Workspace => ws !== undefined)
    )
  );
}

// ============================================================================
// Board Selectors
// ============================================================================

/**
 * Get a single board by ID
 */
export function useBoardById(boardId: string | null): Board | null {
  return useKanbanStore(
    useShallow((state) =>
      boardId ? (state.boards.byId[boardId] ?? null) : null
    )
  );
}

/**
 * Get all boards for the current workspace
 */
export function useBoardsForCurrentWorkspace(): Board[] {
  return useKanbanStore(
    useShallow((state) => {
      const workspaceId = state.currentWorkspaceId;
      if (!workspaceId) {
        return [];
      }

      return state.boards.allIds
        .map((id) => state.boards.byId[id])
        .filter(
          (board): board is Board =>
            board !== undefined &&
            (!board.workspace_id || board.workspace_id === workspaceId)
        );
    })
  );
}

/**
 * Get boards for a specific workspace
 */
export function useBoardsByWorkspace(workspaceId: string | null): Board[] {
  return useKanbanStore(
    useShallow((state) => {
      if (!workspaceId) {
        return [];
      }

      return state.boards.allIds
        .map((id) => state.boards.byId[id])
        .filter(
          (board): board is Board =>
            board !== undefined && board.workspace_id === workspaceId
        );
    })
  );
}

// ============================================================================
// Column Selectors
// ============================================================================

/**
 * Get a single column by ID
 */
export function useColumnById(columnId: string | null): Column | null {
  return useKanbanStore(
    useShallow((state) =>
      columnId ? (state.columns.byId[columnId] ?? null) : null
    )
  );
}

/**
 * Get all columns for a board, sorted by position
 */
export function useColumnsByBoard(boardId: string | null): Column[] {
  return useKanbanStore(
    useShallow((state) => {
      if (!boardId) {
        return [];
      }

      const board = state.boards.byId[boardId];
      if (!board) {
        return [];
      }

      return board.column_ids
        .map((id) => state.columns.byId[id])
        .filter((col): col is Column => col !== undefined)
        .sort((a, b) => a.position - b.position);
    })
  );
}

// ============================================================================
// Task Selectors
// ============================================================================

/**
 * Get a single task by ID
 */
export function useTaskById(taskId: string | null): Task | null {
  return useKanbanStore(
    useShallow((state) => (taskId ? (state.tasks.byId[taskId] ?? null) : null))
  );
}

/**
 * Get all tasks for a column, sorted by position
 */
export function useTasksByColumn(columnId: string | null): Task[] {
  return useKanbanStore(
    useShallow((state) => {
      if (!columnId) {
        return [];
      }

      const column = state.columns.byId[columnId];
      if (!column) {
        return [];
      }

      return column.task_ids
        .map((id) => state.tasks.byId[id])
        .filter((task): task is Task => task !== undefined)
        .sort((a, b) => a.position - b.position);
    })
  );
}

/**
 * Get multiple tasks by IDs
 */
export function useTasksByIds(taskIds: string[]): Task[] {
  return useKanbanStore(
    useShallow((state) =>
      taskIds
        .map((id) => state.tasks.byId[id])
        .filter((task): task is Task => task !== undefined)
    )
  );
}

// ============================================================================
// Denormalized Selectors (for components that need full nested data)
// ============================================================================

/**
 * Get a fully denormalized board with all nested columns and tasks
 * Uses primitive selectors + useMemo to avoid infinite loop from object creation
 */
export function useDenormalizedBoard(
  boardId: string | null
): DenormalizedBoard | null {
  const board = useKanbanStore(
    useShallow((state) =>
      boardId ? (state.boards.byId[boardId] ?? null) : null
    )
  );
  const columnsMap = useKanbanStore(useShallow((state) => state.columns.byId));
  const tasksMap = useKanbanStore(useShallow((state) => state.tasks.byId));

  return useMemo(() => {
    if (!board) {
      return null;
    }

    const columns: DenormalizedColumn[] = board.column_ids
      .map((colId) => {
        const column = columnsMap[colId];
        if (!column) {
          return null;
        }

        const tasks = column.task_ids
          .map((taskId) => tasksMap[taskId])
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
  }, [board, columnsMap, tasksMap]);
}

/**
 * Get all denormalized boards for the current workspace
 * Useful for the canvas view
 * Uses primitive selectors + useMemo to avoid infinite loop from object creation
 */
export function useDenormalizedBoardsForCurrentWorkspace(): DenormalizedBoard[] {
  const workspaceId = useKanbanStore((state) => state.currentWorkspaceId);
  const boardsMap = useKanbanStore(useShallow((state) => state.boards.byId));
  const boardIds = useKanbanStore(useShallow((state) => state.boards.allIds));
  const columnsMap = useKanbanStore(useShallow((state) => state.columns.byId));
  const tasksMap = useKanbanStore(useShallow((state) => state.tasks.byId));

  return useMemo(() => {
    if (!workspaceId) {
      return [];
    }

    return boardIds
      .map((boardId) => {
        const board = boardsMap[boardId];
        if (
          !board ||
          (board.workspace_id && board.workspace_id !== workspaceId)
        ) {
          return null;
        }

        const columns: DenormalizedColumn[] = board.column_ids
          .map((colId) => {
            const column = columnsMap[colId];
            if (!column) {
              return null;
            }

            const tasks = column.task_ids
              .map((taskId) => tasksMap[taskId])
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

        const result: DenormalizedBoard = {
          id: board.id,
          name: board.name,
          workspace_id: board.workspace_id,
          created_by: board.created_by,
          created_at: board.created_at,
          columns,
        };
        if (board.description) {
          result.description = board.description;
        }
        return result;
      })
      .filter((board): board is DenormalizedBoard => board !== null);
  }, [workspaceId, boardIds, boardsMap, columnsMap, tasksMap]);
}

// ============================================================================
// Canvas/Position Selectors
// ============================================================================

/**
 * Get board position by ID
 */
export function useBoardPosition(boardId: string | null) {
  return useKanbanStore(
    useShallow((state) =>
      boardId ? (state.boardPositions.byId[boardId] ?? null) : null
    )
  );
}

/**
 * Get all board positions for the current workspace
 */
export function useBoardPositionsForCurrentWorkspace() {
  return useKanbanStore(
    useShallow((state) => {
      const workspaceId = state.currentWorkspaceId;
      if (!workspaceId) {
        return [];
      }

      // Get boards in current workspace
      const boardIds = state.boards.allIds.filter((id) => {
        const board = state.boards.byId[id];
        return (
          board && (!board.workspace_id || board.workspace_id === workspaceId)
        );
      });

      // Get positions for those boards
      return boardIds
        .map((id) => state.boardPositions.byId[id])
        .filter((pos) => pos !== undefined);
    })
  );
}

// ============================================================================
// UI State Selectors
// ============================================================================

/**
 * Check if a task is selected
 */
export function useIsTaskSelected(taskId: string): boolean {
  return useKanbanStore((state) => state.selectedTaskIds.includes(taskId));
}

/**
 * Get selected tasks
 */
export function useSelectedTasks(): Task[] {
  return useKanbanStore(
    useShallow((state) =>
      state.selectedTaskIds
        .map((id) => state.tasks.byId[id])
        .filter((task): task is Task => task !== undefined)
    )
  );
}

/**
 * Check if a board is selected
 */
export function useIsBoardSelected(boardId: string): boolean {
  return useKanbanStore((state) => state.selectedBoardIds.includes(boardId));
}

/**
 * Get the dragged task
 */
export function useDraggedTask(): Task | null {
  return useKanbanStore(
    useShallow((state) =>
      state.draggedTaskId
        ? (state.tasks.byId[state.draggedTaskId] ?? null)
        : null
    )
  );
}

// ============================================================================
// Computed Selectors using hooks
// ============================================================================

/**
 * Hook to check if current workspace has any boards
 */
export function useHasBoardsInCurrentWorkspace(): boolean {
  const boards = useBoardsForCurrentWorkspace();
  return boards.length > 0;
}

/**
 * Hook to get task count for a column
 */
export function useTaskCountForColumn(columnId: string): number {
  return useKanbanStore((state) => {
    const column = state.columns.byId[columnId];
    return column?.task_ids.length ?? 0;
  });
}

/**
 * Hook to get column count for a board
 */
export function useColumnCountForBoard(boardId: string): number {
  return useKanbanStore((state) => {
    const board = state.boards.byId[boardId];
    return board?.column_ids.length ?? 0;
  });
}
