/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: Draggable dialog requires mouse interactions */
"use client";

import { Columns, GripHorizontal, X } from "lucide-react";
import type { PointerEvent } from "react";
import { memo, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { cn } from "@/src/lib/utils";

type RenameColumnDialogProps = {
  currentName: string;
  boardName: string;
  columnName: string;
  isShaking?: boolean;
  onRename: (newName: string) => void;
  onClose: () => void;
};

const DIALOG_WIDTH = 380;

export const RenameColumnDialog = memo(
  ({
    currentName,
    boardName,
    columnName,
    isShaking = false,
    onRename,
    onClose,
  }: RenameColumnDialogProps) => {
    const [name, setName] = useState(currentName);
    const [position, setPosition] = useState(() => ({
      x: window.innerWidth / 2 - DIALOG_WIDTH / 2,
      y: window.innerHeight / 3,
    }));
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionStartRef = useRef({ x: 0, y: 0 });
    const dialogRef = useRef<HTMLDivElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (name.trim()) {
        onRename(name.trim());
        onClose();
      }
    };

    const handleDragStart = useCallback(
      (e: PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest("button, input")) {
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
        setPosition({
          x: positionStartRef.current.x + dx,
          y: positionStartRef.current.y + dy,
        });
      },
      [isDragging]
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

    const dialogContent = (
      <>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop click to close */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Backdrop click to close */}
        <div className="fixed inset-0 z-9998 bg-black/50" onClick={onClose} />

        {/* Dialog */}
        <div
          className={cn(
            "fixed z-9999 flex flex-col overflow-hidden rounded-lg border-2 border-border/50 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]",
            "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]",
            isShaking && "animate-shake"
          )}
          ref={dialogRef}
          style={{
            left: position.x,
            top: position.y,
            width: DIALOG_WIDTH,
          }}
        >
          {/* Header */}
          <div
            className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            onPointerCancel={handleDragEnd}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Rename Column</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className="bg-primary/10 px-2 py-0.5 text-primary text-xs"
                variant="secondary"
              >
                {boardName}
              </Badge>
              <Badge
                className="bg-violet-500/20 px-2 py-0.5 text-violet-600 text-xs dark:text-violet-400"
                variant="secondary"
              >
                <Columns className="mr-1 h-3 w-3" />
                {columnName}
              </Badge>
              <button
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="p-4">
              <div className="space-y-2">
                <Label
                  className="text-muted-foreground text-xs"
                  htmlFor="column-name"
                >
                  Column Name
                </Label>
                <Input
                  autoFocus
                  className="rounded-lg border border-border/30 bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                  id="column-name"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  placeholder="Column name"
                  value={name}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t bg-muted/30 px-4 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
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
                disabled={!name.trim()}
                type="submit"
              >
                Rename
              </Button>
            </div>
          </form>
        </div>
      </>
    );

    return createPortal(dialogContent, document.body);
  }
);

RenameColumnDialog.displayName = "RenameColumnDialog";
