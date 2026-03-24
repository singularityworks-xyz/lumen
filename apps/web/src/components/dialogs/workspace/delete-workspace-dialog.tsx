"use client";

import {
  AlertTriangle,
  Building2,
  GripHorizontal,
  Loader2,
  Trash2,
} from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { cn } from "@/src/lib/utils";

interface DeleteWorkspaceDialogProps {
  getSourceButtonRect: () => DOMRect | null;
  onClose: () => void;

  onConfirm: () => Promise<boolean>;
  onPositionChange?: (position: { x: number; y: number }) => void;

  position?: { x: number; y: number };
  workspaceName: string;
}

const DIALOG_WIDTH = 420;

export const DeleteWorkspaceDialog = memo(
  ({
    workspaceName,
    onConfirm,
    onClose,
    getSourceButtonRect,
    position: externalPosition,
    onPositionChange,
  }: DeleteWorkspaceDialogProps) => {
    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [internalPosition, setInternalPosition] = useState({ x: 0, y: 0 });
    const isMountedRef = useRef(false);
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
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
      };
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
        {/* Connector edge from source button to dialog - hidden on refresh when refs unavailable */}
        {sourceRect && (
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
            "fixed z-9999 overflow-hidden rounded-lg border-2 border-border/50 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          )}
          ref={dialogRef}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: DIALOG_WIDTH,
          }}
        >
          <div
            className="flex cursor-grab select-none items-center justify-between border-b bg-linear-to-r from-red-500/10 via-red-500/5 to-transparent px-5 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] active:cursor-grabbing dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
          >
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-base text-red-600 dark:text-red-400">
                Delete Workspace
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-600 text-xs dark:text-red-400">
                <Building2 className="h-3 w-3" />
                {workspaceName}
              </span>
            </div>
            <GripHorizontal className="h-5 w-5 text-muted-foreground/50" />
          </div>

          <div className="p-5">
            <div className="mb-3 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-red-600 text-sm dark:text-red-400">
                This action is permanent and cannot be undone. All boards,
                columns, and tasks in this workspace will be permanently
                deleted.
              </p>
            </div>
            <p className="text-card-foreground text-sm leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-semibold">"{workspaceName}"</span>?
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
            <Button
              className="h-8 rounded-md bg-card/80 text-xs shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
              disabled={isLoading}
              onClick={onClose}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="h-8 rounded-md bg-red-500 text-white text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-red-600 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
              disabled={isLoading}
              onClick={async () => {
                setIsLoading(true);
                try {
                  const success = await onConfirm();
                  if (success) {
                    onClose();
                  }
                } finally {
                  if (isMountedRef.current) {
                    setIsLoading(false);
                  }
                }
              }}
              type="button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Workspace"
              )}
            </Button>
          </div>
        </div>
      </>
    );

    return createPortal(dialogContent, document.body);
  }
);

DeleteWorkspaceDialog.displayName = "DeleteWorkspaceDialog";
