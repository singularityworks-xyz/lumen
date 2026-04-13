"use client";

import type { Node } from "@xyflow/react";
import { createContext, useContext } from "react";
import type { BoardNode } from "@/src/features/kanban/types";

interface ColumnDragContextType {
  activeColumnData: {
    columnId: string;
    sourceBoardId: string;
  } | null;
}

export const ColumnDragContext = createContext<ColumnDragContextType>({
  activeColumnData: null,
});

export const useColumnDragContext = () => useContext(ColumnDragContext);
export type KanbanNode = Node<BoardNode["data"]>;
export type AreaNode = Node<{ areaId: string; [key: string]: unknown }>;
export type TaskModalNode = Node<{ modalId: string; [key: string]: unknown }>;
export type EditBoardModalNode = Node<{
  modalId: string;
  [key: string]: unknown;
}>;
export type TaskDetailModalNode = Node<{
  modalId: string;
  [key: string]: unknown;
}>;
export type BoardQuickActionsNode = Node<{
  boardId: string;
  [key: string]: unknown;
}>;
export type TaskQuickActionsNode = Node<{
  taskId: string;
  [key: string]: unknown;
}>;
export type ColumnQuickActionsNode = Node<{
  columnId: string;
  [key: string]: unknown;
}>;
export type BoardDialogNode = Node<{
  dialogId: string;
  [key: string]: unknown;
}>;
export type ConnectionDialogNode = Node<{
  boardId: string;
  [key: string]: unknown;
}>;
export type ShareDialogNode = Node<{
  boardId: string;
  [key: string]: unknown;
}>;
export type ColumnDialogNode = Node<{
  columnId: string;
  dialogId: string;
  [key: string]: unknown;
}>;

export type CanvasNode =
  | AreaNode
  | KanbanNode
  | TaskModalNode
  | EditBoardModalNode
  | TaskDetailModalNode
  | BoardQuickActionsNode
  | TaskQuickActionsNode
  | ColumnQuickActionsNode
  | BoardDialogNode
  | ConnectionDialogNode
  | ShareDialogNode
  | ColumnDialogNode
  | Node<
      {
        comments: unknown[];
        centroid: { x: number; y: number };
        isSingle: boolean;
        [key: string]: unknown;
      },
      "commentCluster"
    >;

export function ColumnDragOverlay({
  columnName,
  taskCount,
}: {
  columnName: string;
  taskCount: number;
}) {
  return (
    <div className="flex cursor-grabbing items-center gap-3 rounded-lg border border-border/60 bg-card/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
        <svg
          className="h-4 w-4 text-primary"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <title>Column</title>
          <rect height="18" rx="2" ry="2" width="7" x="3" y="3" />
          <rect height="18" rx="2" ry="2" width="7" x="14" y="3" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="font-medium text-foreground text-sm">
          {columnName}
        </span>
        <span className="text-muted-foreground text-xs">
          {taskCount} {taskCount === 1 ? "task" : "tasks"}
        </span>
      </div>
    </div>
  );
}
