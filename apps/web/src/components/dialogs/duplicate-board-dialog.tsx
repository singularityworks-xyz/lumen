"use client";

import { Copy, Link2 } from "lucide-react";
import type { PointerEvent } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/src/lib/utils";
import { ConnectorEdge } from "../ui/connector-edge";

type DuplicateBoardDialogProps = {
  boardId: string;
  boardName: string;
  columnCount: number;
  taskCount: number;
  connectionCount: number;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  onDuplicate: (newName: string, options: { copyConnections: boolean }) => void;
  onClose: () => void;
  getSourceButtonRect: () => DOMRect | null;
  quickActionsPosition?: { x: number; y: number };
  newName?: string;
  onNewNameChange?: (value: string) => void;
  copyConnections?: boolean;
  onCopyConnectionsChange?: (value: boolean) => void;
  zIndex?: number;
};

const DIALOG_WIDTH = 320;

export const DuplicateBoardDialog = memo(
  ({
    boardName,
    columnCount,
    taskCount,
    connectionCount,
    position,
    onPositionChange,
    onDuplicate,
    onClose,
    getSourceButtonRect,
    quickActionsPosition,
    newName: externalNewName,
    onNewNameChange,
    copyConnections: externalCopyConnections,
    onCopyConnectionsChange,
    zIndex = 9999,
  }: DuplicateBoardDialogProps) => {
    const [internalNewName, setInternalNewName] = useState(
      `${boardName} (Copy)`
    );
    const [internalCopyConnections, setInternalCopyConnections] =
      useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionStartRef = useRef({ x: 0, y: 0 });

    const newName = externalNewName ?? internalNewName;
    const copyConnections = externalCopyConnections ?? internalCopyConnections;

    const setNewName = useCallback(
      (val: string) => {
        if (onNewNameChange) {
          onNewNameChange(val);
        } else {
          setInternalNewName(val);
        }
      },
      [onNewNameChange]
    );

    const setCopyConnections = useCallback(
      (val: boolean) => {
        if (onCopyConnectionsChange) {
          onCopyConnectionsChange(val);
        } else {
          setInternalCopyConnections(val);
        }
      },
      [onCopyConnectionsChange]
    );

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

    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newName.trim();
        if (!trimmedName) {
          return;
        }
        onDuplicate(trimmedName, { copyConnections });
      },
      [newName, copyConnections, onDuplicate]
    );

    const handleDragStart = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if (
          (e.target as HTMLElement).closest("button") ||
          (e.target as HTMLElement).closest("input")
        ) {
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
            className="flex cursor-move select-none items-center gap-2 border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-3 py-2"
            onPointerCancel={handleDragEnd}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <Copy className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Duplicate Board</h3>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-3 p-3">
              <div className="flex gap-4 rounded bg-muted/50 px-3 py-2 text-xs">
                <span>
                  <strong>{columnCount}</strong> columns
                </span>
                <span>
                  <strong>{taskCount}</strong> tasks
                </span>
              </div>

              <div className="space-y-1">
                <label
                  className="text-muted-foreground text-xs"
                  htmlFor="duplicate-name"
                >
                  New name
                </label>
                <input
                  autoFocus
                  className="w-full rounded-lg border border-border/30 bg-muted/80 px-3 py-1.5 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] focus:outline-none dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                  id="duplicate-name"
                  onChange={(e) => setNewName(e.target.value)}
                  type="text"
                  value={newName}
                />
              </div>

              {connectionCount > 0 && (
                <div className="space-y-2 rounded-lg border border-border/30 bg-muted/50 p-2.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center gap-2 text-xs">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      This board has <strong>{connectionCount}</strong>{" "}
                      connection{connectionCount > 1 ? "s" : ""}
                    </span>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      checked={copyConnections}
                      className="h-4 w-4 rounded border-border"
                      onChange={(e) => setCopyConnections(e.target.checked)}
                      type="checkbox"
                    />
                    <span className="text-xs">
                      Create connections to same targets for duplicate
                    </span>
                  </label>
                </div>
              )}
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
                className="flex-1 rounded-md bg-primary/90 px-3 py-1.5 font-medium text-primary-foreground text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] transition-colors hover:bg-primary dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
                type="submit"
              >
                Duplicate
              </button>
            </div>
          </form>
        </div>
      </>
    );

    return createPortal(dialogContent, document.body);
  }
);

DuplicateBoardDialog.displayName = "DuplicateBoardDialog";
