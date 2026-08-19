"use client";

import type { Node, NodeProps } from "@xyflow/react";
import { GripHorizontal, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { DialogPresenceIndicator } from "@/src/components/dialogs/dialog-presence-indicator";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import {
  ACCENT_COLORS,
  COLUMN_ICONS,
} from "@/src/features/kanban/utils/color-icon-utils";
import { useDialogPresenceLifecycle } from "@/src/hooks/use-dialog-presence";
import { useImperativeConnector } from "@/src/hooks/use-imperative-connector";
import { cn } from "@/src/lib/utils";

export interface AreaPropertiesDialogNodeData {
  dialogId: string;
  [key: string]: unknown;
}

type AreaPropertiesDialogNodeProps = NodeProps<
  Node<AreaPropertiesDialogNodeData>
>;

const DIALOG_WIDTH = 300;

export const AreaPropertiesDialogNodeComponent =
  memo<AreaPropertiesDialogNodeProps>(({ data, selected }) => {
    const dialogId = data.dialogId;
    const [pickerColor, setPickerColor] = useState("#9ca3af");
    const [isFocused, setIsFocused] = useState(false);

    const areaDialog = useKanbanStore((state) => state.areaDialogs[dialogId]);
    const closeAreaDialog = useKanbanStore((state) => state.closeAreaDialog);
    const updateArea = useKanbanStore((state) => state.updateArea);
    const area = useKanbanStore((state) =>
      areaDialog ? state.areas.byId[areaDialog.areaId] : null
    );

    const registerDialog = useKanbanStore((state) => state.registerDialog);
    const unregisterDialog = useKanbanStore((state) => state.unregisterDialog);
    const bringDialogToFront = useKanbanStore(
      (state) => state.bringDialogToFront
    );
    const dialogFocusStack = useKanbanStore((state) => state.dialogFocusStack);
    const zIndexDialogId = `area-properties-dialog-${dialogId}`;

    useEffect(() => {
      registerDialog(zIndexDialogId);
      return () => unregisterDialog(zIndexDialogId);
    }, [zIndexDialogId, registerDialog, unregisterDialog]);

    const { dialogCollaborator, handleDialogPointerDown } =
      useDialogPresenceLifecycle(
        dialogId,
        "area-dialog",
        areaDialog?.areaId ?? ""
      );

    const connectorZIndex = useMemo(() => {
      const index = dialogFocusStack.indexOf(zIndexDialogId);
      if (index === -1) {
        return 1000;
      }
      return 1000 + (index + 1) * 10;
    }, [dialogFocusStack, zIndexDialogId]);

    useImperativeConnector({
      customColor: area?.color,
      endOffsetY: 20,
      hideStartNode: true,
      sourceSelector: `.react-flow__node[data-id="${areaDialog?.areaId}"] .area-drag-handle`,
      targetNodeId: `area-dialog-${dialogId}`,
      zIndex: connectorZIndex,
    });

    const handleClose = useCallback(() => {
      closeAreaDialog(dialogId);
    }, [closeAreaDialog, dialogId]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Escape closes only the frontmost dialog — a lower dialog must not
        // close while another dialog is stacked on top of it
        if (e.key === "Escape" && dialogFocusStack.at(-1) === zIndexDialogId) {
          handleClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [dialogFocusStack, zIndexDialogId, handleClose]);

    const handleColorChange = useCallback(
      (color: string) => {
        if (areaDialog?.areaId) {
          updateArea(areaDialog.areaId, { color });
        }
      },
      [areaDialog?.areaId, updateArea]
    );

    const handleIconChange = useCallback(
      (icon: string) => {
        if (areaDialog?.areaId) {
          updateArea(areaDialog.areaId, { icon: icon || undefined });
        }
      },
      [areaDialog?.areaId, updateArea]
    );

    const handlePointerDown = useCallback(() => {
      bringDialogToFront(zIndexDialogId);
      handleDialogPointerDown();
    }, [bringDialogToFront, handleDialogPointerDown, zIndexDialogId]);

    if (!(areaDialog && area)) {
      return null;
    }

    const currentColor = area.color || "#9ca3af";
    const currentIcon = area.icon;

    return (
      <div
        className="relative"
        onPointerDown={handlePointerDown}
        style={{ width: DIALOG_WIDTH }}
      >
        {dialogCollaborator && (
          <DialogPresenceIndicator activeCollaborator={dialogCollaborator} />
        )}

        {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip */}
        <div
          aria-labelledby="area-dialog-title"
          className={cn(
            "flex flex-col rounded-lg bg-card transition-all",
            selected || isFocused
              ? "shadow-[0_0_0_2px_var(--primary),0_8px_24px_rgba(0,0,0,0.25)]"
              : "border-2 border-border/50 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          )}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsFocused(false);
            }
          }}
          onFocus={() => setIsFocused(true)}
          role="dialog"
        >
          {/* Header */}
          <div className="area-dialog-drag-handle flex cursor-move select-none items-center justify-between border-border border-b bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-4 w-4 text-muted-foreground" />
              <span
                className="font-medium text-foreground text-xs"
                id="area-dialog-title"
              >
                Area Properties
              </span>
            </div>
            <button
              aria-label="Close area properties dialog"
              className="nodrag flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={handleClose}
              onPointerDown={(e) => e.stopPropagation()}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="nodrag p-3">
            <div className="mb-4">
              <span className="mb-2 block font-medium text-[11px] text-muted-foreground">
                Accent Color
              </span>
              <div className="rounded-lg border border-border/30 bg-muted/50 p-2">
                <HexColorPicker
                  color={currentColor || pickerColor}
                  onChange={(color) => {
                    setPickerColor(color);
                    handleColorChange(color);
                  }}
                  style={{ width: "100%" }}
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      aria-label={`Select ${color.name}`}
                      className={cn(
                        "h-5 w-5 rounded-full border-2 transition-all hover:scale-110",
                        color.class,
                        currentColor === color.value
                          ? "border-foreground"
                          : "border-transparent"
                      )}
                      key={color.value || color.name}
                      onClick={() => handleColorChange(color.value)}
                      title={color.name}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <span className="mb-2 block font-medium text-[11px] text-muted-foreground">
                Icon
              </span>
              <div className="flex flex-wrap gap-1 rounded-lg border border-border/30 bg-muted/50 p-2">
                <button
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded transition-all hover:bg-secondary",
                    !currentIcon && "bg-secondary ring-1 ring-primary"
                  )}
                  onClick={() => handleIconChange("")}
                  title="No icon"
                  type="button"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                {COLUMN_ICONS.map((iconData) => {
                  const Icon = iconData.Icon;
                  return (
                    <button
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded transition-all hover:bg-secondary",
                        currentIcon === iconData.value &&
                          "bg-secondary ring-1 ring-primary"
                      )}
                      key={iconData.value}
                      onClick={() => handleIconChange(iconData.value)}
                      title={iconData.name}
                      type="button"
                    >
                      <Icon className="h-3.5 w-3.5 text-foreground" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  });

AreaPropertiesDialogNodeComponent.displayName = "AreaPropertiesDialogNode";
