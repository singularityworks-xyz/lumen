"use client";

import {
  AlertTriangle,
  Building2,
  GripHorizontal,
  RotateCcw,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { cn } from "@/src/lib/utils";

type ResetWorkspaceDialogProps = {
  workspaceName: string;
  workspaceId: string;
  taskCount: number;
  boardCount: number;
  columnCount: number;
  onConfirm: (options: { clearBoardsAndColumns: boolean }) => void;
  onClose: () => void;
  getSourceButtonRect: () => DOMRect | null;
  quickActionsPosition?: { x: number; y: number };
  position?: { x: number; y: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
};

const DIALOG_WIDTH = 420;

export const ResetWorkspaceDialog = memo(
  ({
    workspaceName,
    taskCount,
    boardCount,
    columnCount,
    onConfirm,
    onClose,
    getSourceButtonRect,
    quickActionsPosition: _quickActionsPosition,
    position: externalPosition,
    onPositionChange,
  }: ResetWorkspaceDialogProps) => {
    const [mounted, setMounted] = useState(false);
    const [internalPosition, setInternalPosition] = useState({ x: 0, y: 0 });
    const [clearBoardsAndColumns, setClearBoardsAndColumns] = useState(false);
    const dragRef = useRef<{
      startX: number;
      startY: number;
      initialX: number;
      initialY: number;
    } | null>(null);
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
      if (!externalPosition) {
        const rect = getSourceButtonRect();
        const x = rect
          ? rect.right + 40
          : window.innerWidth / 2 - DIALOG_WIDTH / 2;
        const y = rect ? rect.top - 50 : window.innerHeight / 2 - 100;
        setInternalPosition({ x, y });
      }
      setMounted(true);
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
        e.preventDefault();
        dragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          initialX: position.x,
          initialY: position.y,
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      },
      [position]
    );

    const handleDragMove = useCallback(
      (e: React.PointerEvent) => {
        if (!dragRef.current) {
          return;
        }
        const deltaX = e.clientX - dragRef.current.startX;
        const deltaY = e.clientY - dragRef.current.startY;
        setPosition({
          x: dragRef.current.initialX + deltaX,
          y: dragRef.current.initialY + deltaY,
        });
      },
      [setPosition]
    );

    const handleDragEnd = useCallback((e: React.PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }, []);

    if (!mounted) {
      return null;
    }

    const dialogConnectionX = position.x;
    const dialogConnectionY = position.y + 40;
    const sourceRect = getSourceButtonRect();
    const sourceX = sourceRect ? sourceRect.right : 0;
    const sourceY = sourceRect ? sourceRect.top + sourceRect.height / 2 : 0;

    const dialogContent = (
      <>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop click to close */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Backdrop click to close */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Backdrop click to close */}
        <div className="fixed inset-0 z-9998 bg-black/50" onClick={onClose} />

        {sourceRect && (
          <ConnectorEdge
            color="amber"
            endX={dialogConnectionX}
            endY={dialogConnectionY}
            hideStartNode
            startX={sourceX}
            startY={sourceY}
          />
        )}

        <div
          className={cn(
            "fixed z-9999 overflow-hidden rounded-lg border-2 border-border/50 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          )}
          ref={dialogRef}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: DIALOG_WIDTH,
          }}
        >
          {/* Header with drag handle */}
          <div
            className="flex cursor-grab select-none items-center justify-between border-b bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent px-5 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] active:cursor-grabbing dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-base">Reset Workspace</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 text-xs dark:text-amber-400">
                <Building2 className="h-3 w-3" />
                {workspaceName}
              </span>
            </div>
            <GripHorizontal className="h-5 w-5 text-muted-foreground/50" />
          </div>

          <div className="p-5">
            <div className="mb-3 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="text-amber-700 text-sm dark:text-amber-400">
                <p>
                  This will delete{" "}
                  <span className="font-semibold">
                    {taskCount} task{taskCount !== 1 ? "s" : ""}
                  </span>
                  {clearBoardsAndColumns && (
                    <>
                      ,{" "}
                      <span className="font-semibold">
                        {boardCount} board{boardCount !== 1 ? "s" : ""}
                      </span>
                      , and{" "}
                      <span className="font-semibold">
                        {columnCount} column{columnCount !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}{" "}
                  from this workspace.
                </p>
              </div>
            </div>

            <p className="mb-4 text-card-foreground text-sm leading-relaxed">
              Are you sure you want to reset{" "}
              <span className="font-semibold">"{workspaceName}"</span>? This
              action cannot be undone.
            </p>

            {/** biome-ignore lint/a11y/noLabelWithoutControl: why ? */}
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3 transition-colors hover:bg-muted/50">
              <Checkbox
                checked={clearBoardsAndColumns}
                onCheckedChange={(checked) =>
                  setClearBoardsAndColumns(checked === true)
                }
              />
              <div className="flex flex-col">
                <span className="font-medium text-sm">
                  Also clear boards and columns
                </span>
                <span className="text-muted-foreground text-xs">
                  {boardCount} board{boardCount !== 1 ? "s" : ""} and{" "}
                  {columnCount} column{columnCount !== 1 ? "s" : ""} will be
                  removed
                </span>
              </div>
            </label>
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
              className="h-8 rounded-md bg-amber-500/90 text-white text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
              disabled={taskCount === 0 && !clearBoardsAndColumns}
              onClick={() => {
                onConfirm({ clearBoardsAndColumns });
                onClose();
              }}
              type="button"
            >
              Reset Workspace
            </Button>
          </div>
        </div>
      </>
    );

    return createPortal(dialogContent, document.body);
  }
);

ResetWorkspaceDialog.displayName = "ResetWorkspaceDialog";
