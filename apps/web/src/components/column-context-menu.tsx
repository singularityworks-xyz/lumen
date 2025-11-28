"use client";

import { Edit2, MoveRight, Plus, Trash2 } from "lucide-react";
import { memo, useEffect, useRef } from "react";

type ColumnContextMenuProps = {
  x: number;
  y: number;
  onRename?: () => void;
  onRemove?: () => void;
  onAddTask?: () => void;
  onMoveToBoard?: () => void;
  onClose: () => void;
};

export const ColumnContextMenu = memo(
  ({
    x,
    y,
    onRename,
    onRemove,
    onAddTask,
    onMoveToBoard,
    onClose,
  }: ColumnContextMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          menuRef.current &&
          !menuRef.current.contains(event.target as Node)
        ) {
          onClose();
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onClose();
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }, [onClose]);

    return (
      <div
        className="fade-in-0 zoom-in-95 fixed z-50 w-40 animate-in rounded-md border-2 border-border/50 bg-popover shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] duration-100 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
        ref={menuRef}
        style={{
          left: `${x}px`,
          top: `${y}px`,
        }}
      >
        <div className="p-1">
          {onAddTask && (
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
              onClick={() => {
                onAddTask();
                onClose();
              }}
              type="button"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Task</span>
            </button>
          )}

          {onRename && (
            <>
              <button
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                onClick={() => {
                  onRename();
                  onClose();
                }}
                type="button"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Rename</span>
              </button>
              <div className="my-0.5 h-px bg-border/50" />
            </>
          )}

          {onMoveToBoard && (
            <>
              <button
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                onClick={() => {
                  onMoveToBoard();
                  onClose();
                }}
                type="button"
              >
                <MoveRight className="h-3.5 w-3.5" />
                <span>Move to board</span>
              </button>
              <div className="my-0.5 h-px bg-border/50" />
            </>
          )}

          {onRemove && (
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-destructive text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/10 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
              onClick={() => {
                onRemove();
                onClose();
              }}
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Remove</span>
            </button>
          )}
        </div>
      </div>
    );
  }
);

ColumnContextMenu.displayName = "ColumnContextMenu";
