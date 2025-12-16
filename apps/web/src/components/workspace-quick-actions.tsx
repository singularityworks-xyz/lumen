"use client";

import {
  Building2,
  Copy,
  Edit2,
  GripHorizontal,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { PointerEvent } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/src/lib/utils";

type WorkspaceQuickActionsProps = {
  workspaceId: string;
  workspaceName: string;
  isDefaultWorkspace: boolean;
  onRename: (buttonRef: React.RefObject<HTMLButtonElement | null>) => void;
  onReset: (buttonRef: React.RefObject<HTMLButtonElement | null>) => void;
  onDuplicate: (buttonRef: React.RefObject<HTMLButtonElement | null>) => void;
  onDelete: (buttonRef: React.RefObject<HTMLButtonElement | null>) => void;
  onClose: () => void;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  getButtonRect: () => DOMRect | null;
};

const DIALOG_WIDTH = 200;

const ConnectorEdge = memo(
  ({
    buttonRect,
    endX,
    endY,
  }: {
    buttonRect: DOMRect | null;
    endX: number;
    endY: number;
  }) => {
    if (!buttonRect) {
      return null;
    }
    const startX = buttonRect.right;
    const startY = buttonRect.top + buttonRect.height / 2;
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

export const WorkspaceQuickActions = memo(
  ({
    workspaceId: _workspaceId,
    workspaceName,
    isDefaultWorkspace,
    onRename,
    onReset,
    onDuplicate,
    onDelete,
    onClose,
    position,
    onPositionChange,
    getButtonRect,
  }: WorkspaceQuickActionsProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionStartRef = useRef({ x: 0, y: 0 });
    const dialogRef = useRef<HTMLDivElement>(null);

    // Refs for each action button
    const renameButtonRef = useRef<HTMLButtonElement>(null);
    const resetButtonRef = useRef<HTMLButtonElement>(null);
    const duplicateButtonRef = useRef<HTMLButtonElement>(null);
    const deleteButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      setMounted(true);
      setButtonRect(getButtonRect());
    }, [getButtonRect]);

    useEffect(() => {
      const updateRect = () => {
        setButtonRect(getButtonRect());
      };
      window.addEventListener("resize", updateRect);
      return () => window.removeEventListener("resize", updateRect);
    }, [getButtonRect]);

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
          buttonRect={buttonRect}
          endX={dialogConnectionX}
          endY={dialogConnectionY}
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
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                <Building2 className="h-3 w-3" />
                <span className="max-w-20 truncate">{workspaceName}</span>
              </span>
            </div>
            {/* Close button - same style as kanban board */}
            <button
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              onClick={onClose}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="p-1">
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
              onClick={() => onRename(renameButtonRef)}
              ref={renameButtonRef}
              type="button"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Rename</span>
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
              onClick={() => onReset(resetButtonRef)}
              ref={resetButtonRef}
              type="button"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-accent hover:text-accent-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
              onClick={() => onDuplicate(duplicateButtonRef)}
              ref={duplicateButtonRef}
              type="button"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Duplicate</span>
            </button>

            {!isDefaultWorkspace && (
              <>
                <div className="my-0.5 h-px bg-border/50" />
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-red-600 text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-red-100 dark:text-red-400 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] dark:hover:bg-red-900/20"
                  onClick={() => onDelete(deleteButtonRef)}
                  ref={deleteButtonRef}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Workspace</span>
                </button>
              </>
            )}
          </div>
        </div>
      </>
    );

    return createPortal(dialogContent, document.body);
  }
);

WorkspaceQuickActions.displayName = "WorkspaceQuickActions";
