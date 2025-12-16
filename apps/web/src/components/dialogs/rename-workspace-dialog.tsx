/** biome-ignore-all lint/a11y/noNoninteractiveElementInteractions: Draggable dialog requires mouse interactions */
"use client";

import { Building2, GripHorizontal, X } from "lucide-react";
import type { PointerEvent } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { cn } from "@/src/lib/utils";

type RenameWorkspaceDialogProps = {
  currentName: string;
  workspaceId: string;
  onRename: (newName: string) => void;
  onClose: () => void;
  getSourceButtonRect: () => DOMRect | null;
  quickActionsPosition?: { x: number; y: number };
  position?: { x: number; y: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
  initialValue?: string;
  onInputChange?: (value: string) => void;
};

const DIALOG_WIDTH = 380;

export const RenameWorkspaceDialog = memo(
  ({
    currentName,
    onRename,
    onClose,
    getSourceButtonRect,
    quickActionsPosition: _quickActionsPosition,
    position: externalPosition,
    onPositionChange,
    initialValue,
    onInputChange,
  }: RenameWorkspaceDialogProps) => {
    const [name, setName] = useState(initialValue ?? currentName);
    const [internalPosition, setInternalPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [mounted, setMounted] = useState(false);
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
      if (!externalPosition) {
        const rect = getSourceButtonRect();
        const x = rect
          ? rect.right + 40
          : window.innerWidth / 2 - DIALOG_WIDTH / 2;
        const y = rect ? rect.top - 30 : window.innerHeight / 3;
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

    const handleNameChange = useCallback(
      (newValue: string) => {
        setName(newValue);
        if (onInputChange) {
          onInputChange(newValue);
        }
      },
      [onInputChange]
    );

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (name.trim() && name.trim() !== currentName) {
        onRename(name.trim());
      }
      onClose();
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
      [isDragging, setPosition]
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
    const dialogConnectionY = position.y + 30;
    const sourceRect = getSourceButtonRect();
    const sourceX = sourceRect ? sourceRect.right : 0;
    const sourceY = sourceRect ? sourceRect.top + sourceRect.height / 2 : 0;

    const dialogContent = (
      <>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop click to close */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Backdrop click to close */}
        <div className="fixed inset-0 z-9998 bg-black/50" onClick={onClose} />
        {/* Connector edge from source button to dialog - hidden on refresh when refs unavailable */}
        {sourceRect && (
          <ConnectorEdge
            color="primary"
            endX={dialogConnectionX}
            endY={dialogConnectionY}
            hideStartNode
            startX={sourceX}
            startY={sourceY}
          />
        )}

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
            className="flex cursor-move select-none items-center justify-between border-b bg-linear-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            onPointerCancel={handleDragEnd}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Rename Workspace</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                <Building2 className="h-3 w-3" />
                {currentName}
              </span>
              <button
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-4">
              <div className="space-y-2">
                <Label
                  className="text-muted-foreground text-xs"
                  htmlFor="workspace-name"
                >
                  Workspace Name
                </Label>
                <Input
                  autoFocus
                  className="rounded-lg border border-border/30 bg-muted/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                  id="workspace-name"
                  onChange={(e) => handleNameChange(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  placeholder="Workspace name"
                  value={name}
                />
              </div>
            </div>
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

RenameWorkspaceDialog.displayName = "RenameWorkspaceDialog";
