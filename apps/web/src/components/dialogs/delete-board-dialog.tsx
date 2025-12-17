"use client";

import { AlertTriangle, Link2, Trash2 } from "lucide-react";
import type { PointerEvent } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/src/lib/utils";
import { ConnectorEdge } from "../ui/connector-edge";

type DeleteBoardDialogProps = {
  boardId: string;
  boardName: string;
  columnCount: number;
  taskCount: number;
  connectionCount: number;
  position: { x: number; y: number };
  onConfirm: () => void;
  onClose: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
  getSourceButtonRect: () => DOMRect | null;
  quickActionsPosition?: { x: number; y: number };
  zIndex?: number;
};

const DIALOG_WIDTH = 320;

export const DeleteBoardDialog = memo(
  ({
    boardName,
    columnCount,
    taskCount,
    connectionCount,
    position,
    onConfirm,
    onClose,
    onPositionChange,
    getSourceButtonRect,
    quickActionsPosition,
    zIndex = 9999,
  }: DeleteBoardDialogProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionStartRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
      setMounted(true);
      setButtonRect(getSourceButtonRect());
    }, [getSourceButtonRect]);

    useEffect(() => {
      const updateRect = () => {
        setButtonRect(getSourceButtonRect());
      };
      window.addEventListener("resize", updateRect);
      return () => window.removeEventListener("resize", updateRect);
    }, [getSourceButtonRect]);

    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }, [onClose]);

    const handleConfirm = useCallback(() => {
      onConfirm();
    }, [onConfirm]);

    const handleDragStart = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        positionStartRef.current = { ...position };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      },
      [position]
    );

    const handleDragMove = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if (!isDragging) {
          return;
        }
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        onPositionChange({
          x: positionStartRef.current.x + dx,
          y: positionStartRef.current.y + dy,
        });
      },
      [isDragging, onPositionChange]
    );

    const handleDragEnd = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if (isDragging) {
          setIsDragging(false);
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }
      },
      [isDragging]
    );

    if (!mounted) {
      return null;
    }

    const dialogConnectionX = position.x;
    const dialogConnectionY = position.y + 24;

    const dialogContent = (
      <>
        <ConnectorEdge
          buttonRect={buttonRect}
          endX={dialogConnectionX}
          endY={dialogConnectionY}
          fallbackPosition={quickActionsPosition}
        />

        <div
          className={cn(
            "fixed flex flex-col overflow-hidden rounded-lg border-2 border-border/50 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]",
            "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          )}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
            }
          }}
          ref={dialogRef}
          style={{
            left: position.x,
            top: position.y,
            width: DIALOG_WIDTH,
            zIndex,
          }}
        >
          <div
            className="flex cursor-move select-none items-center gap-2 border-destructive/20 border-b bg-destructive/10 px-3 py-2"
            onPointerCancel={handleDragEnd}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
            <h3 className="font-semibold text-destructive text-sm">
              Delete Board
            </h3>
          </div>

          <div className="space-y-3 p-3">
            {/* Warning */}
            <div className="flex gap-2 rounded bg-destructive/10 p-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <div className="text-xs">
                <p className="font-medium text-destructive">
                  This action cannot be undone.
                </p>
                <p className="mt-1 text-muted-foreground">
                  Are you sure you want to delete{" "}
                  <strong className="text-foreground">{boardName}</strong>?
                </p>
              </div>
            </div>

            {/* What will be deleted */}
            <div className="space-y-1 text-xs">
              <p className="font-medium text-muted-foreground">
                This will permanently delete:
              </p>
              <ul className="space-y-1 pl-4">
                <li className="text-foreground">
                  • <strong>{columnCount}</strong> column
                  {columnCount !== 1 && "s"}
                </li>
                <li className="text-foreground">
                  • <strong>{taskCount}</strong> task{taskCount !== 1 && "s"}
                </li>
                {connectionCount > 0 && (
                  <li className="flex items-center gap-1 text-foreground">
                    <Link2 className="h-3 w-3" />
                    <strong>{connectionCount}</strong> connection
                    {connectionCount !== 1 && "s"}
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="flex gap-2 border-t bg-muted/95 px-3 py-2 dark:bg-secondary/95">
            <button
              className="flex-1 rounded-md bg-card/80 px-3 py-1.5 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-card dark:bg-card/50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="flex-1 rounded-md bg-destructive px-3 py-1.5 font-medium text-destructive-foreground text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors hover:bg-destructive/90 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
              onClick={handleConfirm}
              type="button"
            >
              Delete Board
            </button>
          </div>
        </div>
      </>
    );

    return createPortal(dialogContent, document.body);
  }
);

DeleteBoardDialog.displayName = "DeleteBoardDialog";
