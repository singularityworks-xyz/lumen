"use client";

import {
  ArrowUpRight,
  Columns,
  Edit2,
  GripHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { PointerEvent } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/src/lib/utils";

type ColumnQuickActionsProps = {
  columnId: string;
  columnName: string;
  boardName: string;
  showAddTask?: boolean;
  showMoveToBoard?: boolean;
  onAddTask?: (buttonRef: React.RefObject<HTMLButtonElement | null>) => void;
  onRename: (buttonRef: React.RefObject<HTMLButtonElement | null>) => void;
  onMoveToBoard?: (
    buttonRef: React.RefObject<HTMLButtonElement | null>
  ) => void;
  onRemove: (buttonRef: React.RefObject<HTMLButtonElement | null>) => void;
  onClose: () => void;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  getSourceRect: () => DOMRect | null;
};

const DIALOG_WIDTH = 200;

const ConnectorEdge = memo(
  ({
    sourceRect,
    endX,
    endY,
  }: {
    sourceRect: DOMRect | null;
    endX: number;
    endY: number;
  }) => {
    if (!sourceRect) {
      return null;
    }
    const startX = sourceRect.right;
    const startY = sourceRect.top + sourceRect.height / 2;
    const controlX1 = startX + 30;
    const controlX2 = endX - 30;

    return (
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0"
        height="100vh"
        style={{ zIndex: 9997 }}
        width="100vw"
      >
        <title>Connector line</title>
        <path
          className="stroke-primary"
          d={`M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`}
          fill="none"
          strokeDasharray="6 6"
          strokeLinecap="round"
          strokeOpacity="0.6"
          strokeWidth="2"
        >
          <animate
            attributeName="stroke-dashoffset"
            dur="0.6s"
            from="0"
            repeatCount="indefinite"
            to="-12"
          />
        </path>
        <circle className="fill-primary" cx={endX} cy={endY} r="5" />
      </svg>
    );
  }
);

ConnectorEdge.displayName = "ConnectorEdge";

export const ColumnQuickActions = memo(
  ({
    columnId: _columnId,
    columnName,
    boardName,
    showAddTask = false,
    showMoveToBoard = true,
    onAddTask,
    onRename,
    onMoveToBoard,
    onRemove,
    onClose,
    position,
    onPositionChange,
    getSourceRect,
  }: ColumnQuickActionsProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [sourceRect, setSourceRect] = useState<DOMRect | null>(null);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionStartRef = useRef({ x: 0, y: 0 });
    const dialogRef = useRef<HTMLDivElement>(null);

    // Refs for each action button
    const addTaskButtonRef = useRef<HTMLButtonElement>(null);
    const renameButtonRef = useRef<HTMLButtonElement>(null);
    const moveButtonRef = useRef<HTMLButtonElement>(null);
    const removeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      setMounted(true);
      setSourceRect(getSourceRect());
    }, [getSourceRect]);

    useEffect(() => {
      const updateRect = () => {
        setSourceRect(getSourceRect());
      };
      window.addEventListener("resize", updateRect);
      return () => window.removeEventListener("resize", updateRect);
    }, [getSourceRect]);

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

    // Connection point on the left edge of the dialog, vertically centered on header
    const dialogConnectionX = position.x;
    const dialogConnectionY = position.y + 24;

    const dialogContent = (
      <>
        <ConnectorEdge
          endX={dialogConnectionX}
          endY={dialogConnectionY}
          sourceRect={sourceRect}
        />

        {/* Invisible backdrop to capture clicks outside */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop for click capture */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Backdrop for click capture */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Backdrop for click capture */}
        <div
          className="fixed inset-0 z-9998"
          onClick={onClose}
          onContextMenu={(e) => {
            e.preventDefault();
            onClose();
          }}
        />

        <div
          className={cn(
            "fixed z-9999 flex flex-col overflow-hidden rounded-lg border-2 border-border/50 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]",
            "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          )}
          ref={dialogRef}
          style={{
            left: position.x,
            top: position.y,
            width: DIALOG_WIDTH,
          }}
        >
          <div
            className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            onPointerCancel={handleDragEnd}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <div className="flex items-center gap-1.5">
              <GripHorizontal className="h-3 w-3 text-muted-foreground" />
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 font-medium text-violet-600 text-xs dark:text-violet-400">
                <Columns className="h-3 w-3" />
                <span className="max-w-20 truncate">{columnName}</span>
              </span>
            </div>
            {/* Close button */}
            <button
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              onClick={onClose}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Board context badge */}
          <div className="border-b bg-muted/30 px-3 py-1.5">
            <span className="text-muted-foreground text-xs">
              Board:{" "}
              <span className="font-medium text-foreground">{boardName}</span>
            </span>
          </div>

          <div className="p-1">
            {showAddTask && onAddTask && (
              <>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                  onClick={() => onAddTask(addTaskButtonRef)}
                  ref={addTaskButtonRef}
                  type="button"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Task</span>
                </button>
                <div className="my-0.5 h-px bg-border/50" />
              </>
            )}
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
              onClick={() => onRename(renameButtonRef)}
              ref={renameButtonRef}
              type="button"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Rename</span>
            </button>
            {showMoveToBoard && onMoveToBoard && (
              <button
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                onClick={() => onMoveToBoard(moveButtonRef)}
                ref={moveButtonRef}
                type="button"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>Move to board</span>
              </button>
            )}

            <div className="my-0.5 h-px bg-border/50" />
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-red-600 text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-red-100 dark:text-red-400 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] dark:hover:bg-red-900/20"
              onClick={() => onRemove(removeButtonRef)}
              ref={removeButtonRef}
              type="button"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      </>
    );

    return createPortal(dialogContent, document.body);
  }
);

ColumnQuickActions.displayName = "ColumnQuickActions";
