"use client";

import { AlertTriangle, Columns3, GripHorizontal, Kanban } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { cn } from "@/src/lib/utils";

type DeleteColumnDialogProps = {
  boardName: string;
  columnName: string;
  isShaking?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  getSourceButtonRect?: () => DOMRect | null;
  quickActionsPosition?: { x: number; y: number };
  position?: { x: number; y: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
};

const DIALOG_WIDTH = 400;

export const DeleteColumnDialog = memo(
  ({
    boardName,
    columnName,
    isShaking = false,
    onConfirm,
    onClose,
    getSourceButtonRect,
    quickActionsPosition,
    position: externalPosition,
    onPositionChange,
  }: DeleteColumnDialogProps) => {
    const [mounted, setMounted] = useState(false);
    const [internalPosition, setInternalPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionStartRef = useRef({ x: 0, y: 0 });
    const dialogRef = useRef<HTMLDivElement>(null);

    const position = externalPosition ?? internalPosition;
    const setPosition = useCallback(
      (newPos: { x: number; y: number }) => {
        if (onPositionChange) {
          onPositionChange(newPos);
        } else {
          setInternalPosition(newPos);
        }
      },
      [onPositionChange]
    );

    useEffect(() => {
      setMounted(true);
      if (!externalPosition) {
        const rect = getSourceButtonRect?.();
        const x = rect
          ? rect.right + 40
          : window.innerWidth / 2 - DIALOG_WIDTH / 2;
        const y = rect ? rect.top - 30 : window.innerHeight / 2 - 100;
        setInternalPosition({ x, y });
      }
    }, [getSourceButtonRect, externalPosition]);

    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }, [onClose]);

    const handleDragStart = useCallback(
      (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        positionStartRef.current = { ...position };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      },
      [position]
    );

    const handleDragMove = useCallback(
      (e: React.PointerEvent) => {
        if (!isDragging) {
          return;
        }
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        setPosition({
          x: positionStartRef.current.x + deltaX,
          y: positionStartRef.current.y + deltaY,
        });
      },
      [isDragging, setPosition]
    );

    const handleDragEnd = useCallback(
      (e: React.PointerEvent) => {
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
    const dialogConnectionY = position.y + 30;
    const sourceRect = getSourceButtonRect?.();

    let sourceX = 0;
    let sourceY = 0;
    let showConnector = false;

    if (sourceRect) {
      sourceX = sourceRect.right;
      sourceY = sourceRect.top + sourceRect.height / 2;
      showConnector = true;
    } else if (quickActionsPosition) {
      sourceX = quickActionsPosition.x + 200;
      sourceY = quickActionsPosition.y + 120;
      showConnector = true;
    }

    const dialogContent = (
      <>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop click to close */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Backdrop click to close */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Backdrop click to close */}
        <div className="fixed inset-0 z-9998 bg-black/50" onClick={onClose} />

        {showConnector && (
          <ConnectorEdge
            color="destructive"
            endX={dialogConnectionX}
            endY={dialogConnectionY}
            hideStartNode
            startX={sourceX}
            startY={sourceY}
          />
        )}

        <div
          className={cn(
            "fixed z-9999 overflow-hidden rounded-lg border-2 border-border/50 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]",
            isShaking && "animate-shake"
          )}
          ref={dialogRef}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: DIALOG_WIDTH,
          }}
        >
          <div
            className="flex cursor-grab select-none items-center justify-between border-b bg-linear-to-r from-destructive/10 via-destructive/5 to-transparent px-5 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] active:cursor-grabbing dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            onPointerCancel={handleDragEnd}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="font-semibold text-base">Remove Column</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                  <Kanban className="h-3 w-3" />
                  {boardName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
                  <Columns3 className="h-3 w-3" />
                  {columnName}
                </span>
              </div>
            </div>
            <GripHorizontal className="h-5 w-5 text-muted-foreground/50" />
          </div>

          <div className="p-5">
            <p className="text-card-foreground text-sm leading-relaxed">
              Are you sure you want to remove{" "}
              <span className="font-semibold">"{columnName}"</span>? All tasks
              in this column will be permanently deleted.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
            <Button
              className="h-8 rounded-md bg-card/80 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
              onClick={onClose}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="h-8 rounded-md bg-destructive/90 text-destructive-foreground text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-destructive dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              type="button"
            >
              Remove
            </Button>
          </div>
        </div>
      </>
    );

    return createPortal(dialogContent, document.body);
  }
);

DeleteColumnDialog.displayName = "DeleteColumnDialog";
