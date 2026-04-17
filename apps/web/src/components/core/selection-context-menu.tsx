"use client";

import { Grid3X3 } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { useKanbanStore } from "@/src/features/kanban";

interface SelectionContextMenuProps {
  height: number;
  onClose: () => void;
  screenX: number;
  screenY: number;
  width: number;
  x: number;
  y: number;
}

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
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [areaName, setAreaName] = useState("New Area");

    const handleCreateArea = useCallback(() => {
      addArea(areaName.trim() || "New Area", { x, y }, { width, height });
      setShowCreateDialog(false);
      onClose();
    }, [addArea, areaName, x, y, width, height, onClose]);

    return (
      <>
        {showCreateDialog && (
          <>
            <button
              aria-label="Close create area dialog"
              className="fixed inset-0 z-9998 bg-black/50"
              onClick={() => setShowCreateDialog(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowCreateDialog(false);
                }
              }}
              type="button"
            />
            <div
              className="fixed z-9999 w-80 overflow-hidden rounded-lg border-2 border-border/50 bg-card"
              style={{ top: screenY, left: screenX }}
            >
              <div className="border-border/30 border-b px-3 py-2">
                <span className="font-semibold text-xs">Create Area</span>
              </div>
              <form
                className="space-y-3 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateArea();
                }}
              >
                <input
                  autoFocus
                  className="h-8 w-full rounded border border-border/40 bg-muted/50 px-2 text-sm"
                  data-testid="area-name-input"
                  onChange={(e) => setAreaName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setShowCreateDialog(false);
                    }
                  }}
                  placeholder="Area name"
                  value={areaName}
                />
                <div className="flex justify-end gap-2">
                  <button
                    className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-muted"
                    onClick={() => setShowCreateDialog(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded bg-primary px-2 py-1 text-primary-foreground text-xs"
                    data-testid="area-create-submit"
                    type="submit"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        <button
          aria-label="Close selection menu"
          className="absolute inset-0 z-40"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClose();
            }
          }}
          type="button"
        />

        <div
          className="absolute z-50 w-48 overflow-hidden rounded-lg border-2 border-border/50 bg-card/95 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:border-white/20 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          style={{ top: screenY, left: screenX }}
        >
          <div className="border-border/30 border-b px-3 py-1.5">
            <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
              Selection
            </span>
          </div>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-secondary/70 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
            data-testid="create-area-button"
            onClick={() => {
              setAreaName("New Area");
              setShowCreateDialog(true);
            }}
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
