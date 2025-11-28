"use client";

import { Plus } from "lucide-react";
import { memo, useState } from "react";
import { useKanbanStore } from "../store/kanban-store";

type AddColumnPlaceholderProps = {
  boardId: string;
};

export const AddColumnPlaceholder = memo(
  ({ boardId }: AddColumnPlaceholderProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const addColumn = useKanbanStore((state) => state.addColumn);

    const handleClick = () => {
      const state = useKanbanStore.getState();
      const board = state.boards.byId[boardId];
      const columnCount = board?.column_ids.length ?? 0;

      addColumn(boardId, "New Column", columnCount);
    };

    return (
      <button
        className="group relative flex min-w-[285px] shrink-0 flex-col items-center justify-center gap-4 rounded-lg border-2 border-border/60 border-dashed bg-transparent p-8 transition-all duration-300 hover:border-primary/70 hover:bg-primary/5 hover:shadow-lg active:scale-[0.98]"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        type="button"
      >
        <div className="absolute inset-0 rounded-lg bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="relative flex flex-col items-center gap-3">
          <div
            className={`rounded-full bg-primary/10 p-3 transition-all duration-300 ${
              isHovered ? "scale-110 bg-primary/20" : "scale-100"
            }`}
          >
            <Plus
              className={`h-6 w-6 text-primary transition-all duration-300 ${
                isHovered ? "rotate-90" : "rotate-0"
              }`}
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-semibold text-foreground/80 text-sm transition-colors duration-300 group-hover:text-primary">
              Add Column
            </span>
            <span className="text-muted-foreground text-xs opacity-60 transition-opacity duration-300 group-hover:opacity-100">
              Click to create
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute top-2 left-2 h-1.5 w-1.5 rounded-full bg-border/40 transition-colors duration-300 group-hover:bg-primary/50" />
        <div className="pointer-events-none absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-border/40 transition-colors duration-300 group-hover:bg-primary/50" />
        <div className="pointer-events-none absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full bg-border/40 transition-colors duration-300 group-hover:bg-primary/50" />
        <div className="pointer-events-none absolute right-2 bottom-2 h-1.5 w-1.5 rounded-full bg-border/40 transition-colors duration-300 group-hover:bg-primary/50" />
      </button>
    );
  }
);

AddColumnPlaceholder.displayName = "AddColumnPlaceholder";
