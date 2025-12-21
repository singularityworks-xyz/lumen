"use client";

import { Grid3X3 } from "lucide-react";
import { memo, useCallback } from "react";
import { useKanbanStore } from "@/src/features/kanban";

type SelectionContextMenuProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  screenX: number;
  screenY: number;
  onClose: () => void;
};

export const SelectionContextMenu = memo(
  ({
    x,
    y,
    width,
    height,
    screenX,
    screenY,
    onClose,
  }: SelectionContextMenuProps) => {
    const addArea = useKanbanStore((state) => state.addArea);

    const handleCreateArea = useCallback(() => {
      addArea("New Area", { x, y }, { width, height });
      onClose();
    }, [addArea, x, y, width, height, onClose]);

    return (
      <>
        <button
          aria-label="Close selection menu"
          className="fixed inset-0 z-40"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClose();
            }
          }}
          type="button"
        />

        <div
          className="fixed z-50 w-48 overflow-hidden rounded-lg border-2 border-border/50 bg-card/95 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:border-white/20 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          style={{ top: screenY, left: screenX }}
        >
          <div className="border-border/30 border-b px-3 py-1.5">
            <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
              Selection
            </span>
          </div>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-secondary/70 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
            onClick={handleCreateArea}
            type="button"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            Create Area
          </button>
        </div>
      </>
    );
  }
);

SelectionContextMenu.displayName = "SelectionContextMenu";
