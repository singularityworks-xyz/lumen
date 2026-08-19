"use client";

import { Grid3X3, Layers, X } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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
    const [mounted, setMounted] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const createAreaButtonRef = useRef<HTMLButtonElement>(null);
    const areaNameInputRef = useRef<HTMLInputElement>(null);
    const createDialogTitleId = "selection-create-area-dialog-title";
    const [menuPosition, setMenuPosition] = useState({
      x: screenX,
      y: screenY,
    });
    const [dialogPosition, setDialogPosition] = useState({
      x: screenX,
      y: screenY,
    });

    const clampToViewport = useCallback(
      (xPos: number, yPos: number, widthPx: number, heightPx: number) => {
        const viewportMargin = 8;
        const maxX = window.innerWidth - widthPx - viewportMargin;
        const maxY = window.innerHeight - heightPx - viewportMargin;

        return {
          x: Math.min(
            Math.max(xPos, viewportMargin),
            Math.max(maxX, viewportMargin)
          ),
          y: Math.min(
            Math.max(yPos, viewportMargin),
            Math.max(maxY, viewportMargin)
          ),
        };
      },
      []
    );

    useEffect(() => {
      setMounted(true);
    }, []);

    useLayoutEffect(() => {
      if (!mounted) {
        return;
      }

      const menuElement = menuRef.current;
      if (!menuElement) {
        return;
      }

      const rect = menuElement.getBoundingClientRect();
      setMenuPosition(
        clampToViewport(screenX, screenY, rect.width, rect.height)
      );
    }, [mounted, screenX, screenY, clampToViewport]);

    useLayoutEffect(() => {
      if (!mounted) {
        return;
      }

      if (!showCreateDialog) {
        return;
      }

      const dialogElement = dialogRef.current;
      if (!dialogElement) {
        return;
      }

      const rect = dialogElement.getBoundingClientRect();
      setDialogPosition(
        clampToViewport(screenX, screenY, rect.width, rect.height)
      );
    }, [mounted, showCreateDialog, screenX, screenY, clampToViewport]);

    const closeCreateDialog = useCallback(() => {
      setShowCreateDialog(false);
      createAreaButtonRef.current?.focus();
    }, []);

    useEffect(() => {
      if (!mounted) {
        return;
      }

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key !== "Escape") {
          return;
        }

        if (showCreateDialog) {
          closeCreateDialog();
          return;
        }

        onClose();
      };

      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }, [mounted, onClose, showCreateDialog, closeCreateDialog]);

    useEffect(() => {
      if (!showCreateDialog) {
        return;
      }

      areaNameInputRef.current?.focus();
      areaNameInputRef.current?.select();
    }, [showCreateDialog]);

    useEffect(() => {
      if (!showCreateDialog) {
        return;
      }

      const handleDialogTabTrap = (event: KeyboardEvent) => {
        if (event.key !== "Tab") {
          return;
        }

        const dialogElement = dialogRef.current;
        if (!dialogElement) {
          return;
        }

        const focusableElements = Array.from(
          dialogElement.querySelectorAll<HTMLElement>(
            "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"
          )
        );

        if (focusableElements.length === 0) {
          return;
        }

        const firstElement = focusableElements[0];
        if (!firstElement) {
          return;
        }
        const lastElement = focusableElements.at(-1);
        if (!lastElement) {
          return;
        }
        const activeElement = document.activeElement;

        if (event.shiftKey && activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
          return;
        }

        if (!event.shiftKey && activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      };

      document.addEventListener("keydown", handleDialogTabTrap);
      return () => document.removeEventListener("keydown", handleDialogTabTrap);
    }, [showCreateDialog]);

    const handleCreateArea = useCallback(() => {
      const finalName =
        (areaNameInputRef.current?.value ?? areaName).trim() || "New Area";
      addArea(finalName, { x, y }, { width, height });
      closeCreateDialog();
      onClose();
    }, [addArea, areaName, closeCreateDialog, x, y, width, height, onClose]);

    if (!mounted || typeof document === "undefined") {
      return null;
    }

    return createPortal(
      <>
        {showCreateDialog && (
          <>
            <button
              aria-label="Close create area dialog"
              className="fixed inset-0 z-[9998]"
              onClick={closeCreateDialog}
              tabIndex={-1}
              type="button"
            />
            <div
              aria-labelledby={createDialogTitleId}
              aria-modal="true"
              className="fixed z-[9999] w-80 overflow-hidden rounded-lg border-2 border-border/50 bg-card/95 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:border-white/20 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
              ref={dialogRef}
              role="dialog"
              style={{ top: dialogPosition.y, left: dialogPosition.x }}
            >
              <div className="flex items-center justify-between border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 font-bold text-[10px] text-primary">
                    <Layers className="h-3 w-3" />
                  </span>
                  <span
                    className="font-semibold text-foreground text-xs"
                    id={createDialogTitleId}
                  >
                    Create Area
                  </span>
                </div>
                <button
                  aria-label="Close create area dialog"
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                  onClick={closeCreateDialog}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCreateArea();
                }}
              >
                <div className="space-y-2 p-3">
                  <label
                    className="block font-medium text-[11px] text-muted-foreground"
                    htmlFor="selection-area-name-input"
                  >
                    Area Name
                  </label>
                  <input
                    className="h-8 w-full rounded-md border border-border/30 bg-muted/80 px-2.5 text-foreground text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] focus:outline-none dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                    data-testid="area-name-input"
                    id="selection-area-name-input"
                    onChange={(e) => setAreaName(e.target.value)}
                    onFocus={(event) => {
                      event.currentTarget.select();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        closeCreateDialog();
                      }
                    }}
                    placeholder="Enter area name..."
                    ref={areaNameInputRef}
                    value={areaName}
                  />
                </div>
                <div className="flex gap-2 border-border border-t bg-muted/30 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
                  <button
                    className="h-7 flex-1 rounded-md bg-card/80 px-3 font-medium text-muted-foreground text-xs shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-card hover:text-foreground dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
                    onClick={closeCreateDialog}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="h-7 flex-1 rounded-md bg-primary px-3 font-medium text-primary-foreground text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.2)] transition-all hover:bg-primary/90 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(255,255,255,0.3)] active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                    data-testid="area-create-submit"
                    type="submit"
                  >
                    Create Area
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        <button
          aria-label="Close selection menu"
          className="fixed inset-0 z-40"
          onClick={onClose}
          type="button"
        />

        <div
          className="fixed z-50 w-48 overflow-hidden rounded-lg border-2 border-border/50 bg-card/95 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:border-white/20 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          ref={menuRef}
          style={{ top: menuPosition.y, left: menuPosition.x }}
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
            ref={createAreaButtonRef}
            type="button"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            Create Area
          </button>
        </div>
      </>,
      document.body
    );
  }
);

SelectionContextMenu.displayName = "SelectionContextMenu";
