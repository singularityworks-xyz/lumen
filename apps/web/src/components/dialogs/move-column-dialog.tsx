"use client";

import { Columns3, GripHorizontal, Kanban, MoveRight } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ModalScaleProvider,
  ScaledSelect,
  ScaledSelectContent,
  ScaledSelectItem,
  ScaledSelectTrigger,
  ScaledSelectValue,
} from "@/src/components/scaled-dropdown";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

type TargetBoard = {
  id: string;
  name: string;
};

type MoveColumnDialogProps = {
  boardName: string;
  columnName: string;
  isShaking?: boolean;
  targetBoards: TargetBoard[];
  onConfirm: (targetBoardId: string) => void;
  onClose: () => void;
};

const DIALOG_WIDTH = 420;

export const MoveColumnDialog = memo(
  ({
    boardName,
    columnName,
    isShaking = false,
    targetBoards,
    onConfirm,
    onClose,
  }: MoveColumnDialogProps) => {
    const [mounted, setMounted] = useState(false);
    const [targetBoardId, setTargetBoardId] = useState<string>(
      targetBoards[0]?.id ?? ""
    );
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const positionStartRef = useRef({ x: 0, y: 0 });
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setMounted(true);
      setPosition({
        x: window.innerWidth / 2 - DIALOG_WIDTH / 2,
        y: window.innerHeight / 2 - 120,
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

    const handleSubmit = () => {
      if (targetBoardId) {
        onConfirm(targetBoardId);
      }
    };

    if (!mounted) {
      return null;
    }

    const dialogContent = (
      <ModalScaleProvider zIndex={9999}>
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
            className="flex cursor-grab select-none items-center justify-between border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] active:cursor-grabbing dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            onPointerCancel={handleDragEnd}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <MoveRight className="h-4 w-4 text-primary" />
                <span className="font-semibold text-base">Move Column</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                  <Kanban className="h-3 w-3" />
                  {boardName}
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
            <div className="space-y-2">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="target-board"
              >
                Target Board
              </label>
              <ScaledSelect
                onValueChange={setTargetBoardId}
                value={targetBoardId}
              >
                <ScaledSelectTrigger
                  className="w-full rounded-lg border border-border/30 bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)]"
                  id="target-board"
                >
                  <ScaledSelectValue placeholder="Select a board..." />
                </ScaledSelectTrigger>
                <ScaledSelectContent>
                  {targetBoards.map((board) => (
                    <ScaledSelectItem key={board.id} value={board.id}>
                      <Kanban className="h-3.5 w-3.5 text-primary" />
                      {board.name}
                    </ScaledSelectItem>
                  ))}
                </ScaledSelectContent>
              </ScaledSelect>
            </div>
          </div>

          {/* Footer */}
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
              className="h-8 rounded-md bg-primary/90 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
              disabled={!targetBoardId}
              onClick={handleSubmit}
              type="button"
            >
              Move
            </Button>
          </div>
        </div>
      </ModalScaleProvider>
    );

    return createPortal(dialogContent, document.body);
  }
);

MoveColumnDialog.displayName = "MoveColumnDialog";
