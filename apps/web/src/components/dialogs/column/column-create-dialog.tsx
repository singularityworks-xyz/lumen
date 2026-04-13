"use client";

import { useReactFlow, useViewport } from "@xyflow/react";
import { Columns, GripHorizontal, Plus, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { Button } from "@/src/components/ui/button";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { ICON_MAP } from "@/src/features/kanban/utils/color-icon-utils";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { cn } from "@/src/lib/utils";

const WORD_SPLIT_REGEX = /\s+/;

const getInitials = (name: string): string =>
  name
    .split(WORD_SPLIT_REGEX)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

interface ColumnCreateDialogProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (columnName: string) => void;
  position?: { x: number; y: number };
  sourceElement?: HTMLElement | null;
}

const DIALOG_WIDTH = 320;

export const ColumnCreateDialog = memo(
  ({
    boardId,
    isOpen,
    onClose,
    onSubmit,
    position,
    sourceElement,
  }: ColumnCreateDialogProps) => {
    const { flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);
    const [columnName, setColumnName] = useState("");
    const [nameError, setNameError] = useState<string | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [mounted, setMounted] = useState(false);

    const board = useKanbanStore((state) => state.boards.byId[boardId]);
    const boardPosition = useKanbanStore(
      (state) => state.boardPositions.byId[boardId]
    );

    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
    const dialogId = `column-create-dialog-${boardId}`;
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
      setMounted(true);
      setPortalTarget(document.getElementById("board-connector-layer"));
    }, []);

    useEffect(() => {
      if (isOpen) {
        registerDialog(dialogId);
        // Focus input when opened
        setTimeout(() => {
          nameInputRef.current?.focus();
        }, 100);
      }
      return () => {
        if (isOpen) {
          unregisterDialog(dialogId);
        }
      };
    }, [isOpen, dialogId, registerDialog, unregisterDialog]);

    // Reset form when opened
    useEffect(() => {
      if (isOpen) {
        setColumnName("");
        setNameError(null);
      }
    }, [isOpen]);

    const isTopmost = dialogFocusStack.at(-1) === dialogId;

    const { dialogCollaborator, handleDialogPointerDown } =
      useDialogPresenceLifecycle(dialogId, "column-create", boardId);

    const connectorZIndex = useMemo(() => {
      const index = dialogFocusStack.indexOf(dialogId);
      if (index === -1) {
        return 1000;
      }
      return 1000 + (index + 1) * 10;
    }, [dialogFocusStack, dialogId]);

    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };

      if (!position) {
        return null;
      }

      const myScreenPos = flowToScreenPosition({
        x: position.x,
        y: position.y,
      });

      if (sourceElement) {
        const rect = sourceElement.getBoundingClientRect();
        return {
          start: {
            x: rect.right,
            y: rect.top + rect.height / 2,
          },
          end: { x: myScreenPos.x, y: myScreenPos.y + 24 },
        };
      }

      if (boardPosition) {
        const boardScreenPos = flowToScreenPosition({
          x: boardPosition.x,
          y: boardPosition.y + 100,
        });
        return {
          start: boardScreenPos,
          end: { x: myScreenPos.x, y: myScreenPos.y + 20 },
        };
      }

      return null;
    }, [
      position,
      sourceElement,
      boardPosition,
      flowToScreenPosition,
      vpX,
      vpY,
      vpZoom,
    ]);

    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedName = columnName.trim();
        if (!trimmedName) {
          setNameError("Column name cannot be empty");
          nameInputRef.current?.focus();
          return;
        }

        setNameError(null);
        onSubmit(trimmedName);
        onClose();
      },
      [columnName, onSubmit, onClose]
    );

    const handleCancel = useCallback(() => {
      setColumnName("");
      setNameError(null);
      onClose();
    }, [onClose]);

    const handleNameChange = useCallback((value: string) => {
      setColumnName(value);
      if (value.trim()) {
        setNameError(null);
      }
    }, []);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          handleCancel();
        }
      },
      [handleCancel]
    );

    if (!(isOpen && board)) {
      return null;
    }

    const hasAccentColor = !!board?.accentColor;
    const hasNameError = !!nameError;

    const dialogStyle = (() => {
      const x = position?.x ?? 0;
      const y = position?.y ?? 0;
      const viewportWidth =
        typeof window === "undefined" ? 1920 : window.innerWidth;
      const viewportHeight =
        typeof window === "undefined" ? 1080 : window.innerHeight;
      const DIALOG_HEIGHT = 180;

      let left = x;
      let top = y;

      if (x + DIALOG_WIDTH > viewportWidth - 20) {
        left = Math.max(20, viewportWidth - DIALOG_WIDTH - 20);
      }

      if (y + DIALOG_HEIGHT > viewportHeight - 20) {
        top = Math.max(20, viewportHeight - DIALOG_HEIGHT - 20);
      }

      return { left, top };
    })();

    return (
      <div
        className="absolute z-50 rounded-lg"
        style={{
          width: DIALOG_WIDTH,
          ...dialogStyle,
        }}
      >
        {dialogCollaborator && (
          <DialogPresenceIndicator activeCollaborator={dialogCollaborator} />
        )}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip */}
        <div
          aria-labelledby="column-create-dialog-title"
          className={cn(
            "flex flex-col overflow-hidden rounded-lg border-2 border-border/50 bg-card transition-all duration-200",
            isFocused || isTopmost
              ? "scale-[1.02] shadow-xl ring-2 ring-primary/50"
              : "shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]",
            "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          )}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsFocused(false);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          onPointerDown={() => {
            bringDialogToFront(dialogId);
            handleDialogPointerDown();
          }}
          role="dialog"
        >
          {connectorState &&
            portalTarget &&
            mounted &&
            createPortal(
              <ConnectorEdge
                color="primary"
                customColor={board?.accentColor}
                endX={connectorState.end.x}
                endY={connectorState.end.y}
                hideStartNode
                startX={connectorState.start.x}
                startY={connectorState.start.y}
                zIndex={connectorZIndex}
              />,
              portalTarget
            )}

          <div
            className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
            style={
              hasAccentColor
                ? {
                    background: `linear-gradient(to right, ${board.accentColor}15, ${board.accentColor}08, transparent)`,
                  }
                : {}
            }
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded",
                  !hasAccentColor &&
                    "bg-violet-500/20 text-violet-600 dark:text-violet-400"
                )}
                style={
                  hasAccentColor
                    ? {
                        backgroundColor: `${board.accentColor}25`,
                        color: board.accentColor,
                      }
                    : {}
                }
              >
                {(() => {
                  const IconComponent = board?.icon
                    ? ICON_MAP[board.icon]
                    : null;
                  if (IconComponent) {
                    return <IconComponent className="h-3 w-3" />;
                  }
                  return <Columns className="h-3 w-3" />;
                })()}
              </span>
              <span className="font-semibold text-xs">Create Column</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 items-center gap-1 rounded bg-primary/10 px-1.5 text-[10px] text-primary">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-primary/20 font-bold text-[9px]">
                  {getInitials(board?.name ?? "")}
                </span>
                <span className="max-w-20 truncate">{board?.name}</span>
              </span>
              <button
                aria-label="Close create column dialog"
                className="nodrag ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                data-testid="column-create-cancel"
                onClick={handleCancel}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="nodrag space-y-3 p-3">
              <div className="space-y-2">
                <Label
                  className="font-medium text-foreground text-xs"
                  htmlFor="column-name-input"
                >
                  Column Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  autoFocus
                  className={cn(
                    "h-8 rounded-md border border-border/30 bg-muted/80 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]",
                    hasNameError &&
                      "border-destructive/50 focus:border-destructive/50"
                  )}
                  data-testid="column-name-input"
                  id="column-name-input"
                  onChange={(e) => handleNameChange(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  placeholder="Enter column name..."
                  ref={nameInputRef}
                  value={columnName}
                />
                {hasNameError && (
                  <p className="text-destructive text-xs">{nameError}</p>
                )}
              </div>
            </div>

            <div className="nodrag flex gap-2 border-t bg-muted/30 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
              <Button
                className="h-7 flex-1 rounded-md bg-card/80 px-3 text-xs shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
                data-testid="column-create-cancel"
                onClick={handleCancel}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                className="h-7 flex-1 rounded-md bg-primary/90 px-3 text-xs shadow-[0_1px_3px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]"
                data-testid="column-create-submit"
                disabled={!columnName.trim()}
                type="submit"
              >
                <Plus className="mr-1 h-3 w-3" />
                Create
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }
);

ColumnCreateDialog.displayName = "ColumnCreateDialog";
