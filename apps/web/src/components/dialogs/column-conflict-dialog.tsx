"use client";

import { AlertTriangle, Columns3, GripHorizontal, Kanban } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { cn } from "@/src/lib/utils";

type ColumnConflictDialogProps = {
  boardName: string;
  columnName: string;
  isShaking?: boolean;
  targetBoardName: string;
  onRenameAndMove: (newName: string) => void;
  onReplaceExisting: () => void;
  onClose: () => void;
};

const DIALOG_WIDTH = 440;

export const ColumnConflictDialog = memo(
  ({
    boardName,
    columnName,
    isShaking = false,
    targetBoardName,
    onRenameAndMove,
    onReplaceExisting,
    onClose,
  }: ColumnConflictDialogProps) => {
    const [mounted, setMounted] = useState(false);
    const [renameValue, setRenameValue] = useState(columnName);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionStartRef = useRef({ x: 0, y: 0 });
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setMounted(true);
      setPosition({
        x: window.innerWidth / 2 - DIALOG_WIDTH / 2,
        y: window.innerHeight / 2 - 140,
      });
    }, []);

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
        if ((e.target as HTMLElement).closest("button, input")) {
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
      [isDragging]
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

    const handleRenameAndMove = () => {
      const newName = renameValue.trim() || columnName;
      onRenameAndMove(newName);
    };

    if (!mounted) {
      return null;
    }

    const dialogContent = (
      <>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop click to close */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Backdrop click to close */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Backdrop click to close */}
        <div className="fixed inset-0 z-9998 bg-black/50" onClick={onClose} />
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
          {/* Header with drag handle */}
          <div
            className="flex cursor-grab select-none items-center justify-between border-b bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent px-5 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] active:cursor-grabbing dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            onPointerCancel={handleDragEnd}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-base">
                  Column Name Conflict
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                  <Kanban className="h-3 w-3" />
                  {boardName}
                </span>
                <span className="text-muted-foreground text-xs">→</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 text-xs dark:text-emerald-400">
                  <Kanban className="h-3 w-3" />
                  {targetBoardName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 font-medium text-violet-600 text-xs dark:text-violet-400">
                  <Columns3 className="h-3 w-3" />
                  {columnName}
                </span>
              </div>
            </div>
            <GripHorizontal className="h-5 w-5 text-muted-foreground/50" />
          </div>

          {/* Content */}
          <div className="p-5">
            <p className="mb-4 text-card-foreground text-sm leading-relaxed">
              A column named{" "}
              <span className="font-semibold">"{columnName}"</span> already
              exists in <span className="font-semibold">{targetBoardName}</span>
              . You can rename this column or replace the existing one.
            </p>
            <div className="space-y-2">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="column-new-name"
              >
                New Name
              </label>
              <Input
                className="rounded-lg border border-border/30 bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                id="column-new-name"
                onChange={(e) => setRenameValue(e.target.value)}
                value={renameValue}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/30 px-5 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
            <Button
              className="h-8 rounded-md bg-card/80 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
              onClick={onClose}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="h-8 rounded-md bg-primary/90 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
              onClick={handleRenameAndMove}
              type="button"
            >
              Rename & Move
            </Button>
            <Button
              className="h-8 rounded-md bg-destructive/90 text-destructive-foreground text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-destructive dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
              onClick={onReplaceExisting}
              type="button"
            >
              Replace Existing
            </Button>
          </div>
        </div>
      </>
    );

    return createPortal(dialogContent, document.body);
  }
);

ColumnConflictDialog.displayName = "ColumnConflictDialog";
