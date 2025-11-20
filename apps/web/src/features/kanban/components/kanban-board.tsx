"use client";

import { memo } from "react";
import { useKanbanStore } from "../store/kanban-store";
import type { Board } from "../types";
import { CreateTaskModal } from "./create-task-modal";
import { KanbanColumn } from "./kanban-column";
import { TaskDetailModal } from "./task-detail-modal";

type KanbanBoardProps = {
  board: Board;
};

export const KanbanBoard = memo(({ board }: KanbanBoardProps) => {
  const selectedTask = useKanbanStore((state) => {
    const createColumnId = state.createTaskColumnId;
    if (!createColumnId) {
      return null;
    }

    for (const column of board.columns || []) {
      for (const task of column.tasks || []) {
        if (state.selectedTasks.has(task.id)) {
          return task;
        }
      }
    }
    return null;
  });

  const createColumnId = useKanbanStore((state) => state.createTaskColumnId);
  const setCreateTaskColumnId = useKanbanStore(
    (state) => state.setCreateTaskColumnId
  );

  const columns = board.columns || [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 gap-3 overflow-x-auto overflow-y-hidden pb-1">
        {columns.map((column) => (
          <KanbanColumn boardId={board.id} column={column} key={column.id} />
        ))}
      </div>

      {selectedTask && (
        <TaskDetailModal boardId={board.id} task={selectedTask} />
      )}

      {createColumnId && (
        <CreateTaskModal
          boardId={board.id}
          columnId={createColumnId}
          onClose={() => setCreateTaskColumnId(null)}
        />
      )}
    </div>
  );
});

KanbanBoard.displayName = "KanbanBoard";
