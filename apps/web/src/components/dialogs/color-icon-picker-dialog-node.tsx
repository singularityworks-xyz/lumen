"use client";

import {
  type Node,
  type NodeProps,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { GripHorizontal, Palette, X } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { createPortal } from "react-dom";
import { ConnectorEdge } from "@/src/components/ui/connector-edge";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";
import {
  ACCENT_COLORS,
  COLUMN_ICONS,
  incrementColorUsage,
  incrementIconUsage,
  isValidHexColor,
} from "../../features/kanban/utils/color-icon-utils";

type ColorIconPickerDialogNodeData = {
  dialogId: string;
  columnId: string;
  sourceDialogId: string;
};

type ColorIconPickerDialogNodeProps = NodeProps<
  Node<ColorIconPickerDialogNodeData>
>;

const DIALOG_WIDTH = 300;

export const ColorIconPickerDialogNodeComponent =
  memo<ColorIconPickerDialogNodeProps>(({ data, selected }) => {
    const { flowToScreenPosition } = useReactFlow();
    const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
    const [isFocused, setIsFocused] = useState(false);
    const [pickerColor, setPickerColor] = useState("#3b82f6");

    const dialogId = data.dialogId;
    const columnId = data.columnId;
    const sourceDialogId = data.sourceDialogId;

    const sourceDialog = useKanbanStore(
      (state) => state.boardDialogs[sourceDialogId]
    );
    const column = useKanbanStore((state) => state.columns.byId[columnId]);
    const closeBoardDialog = useKanbanStore((state) => state.closeBoardDialog);
    const updateColumn = useKanbanStore((state) => state.updateColumn);
    const currentWorkspaceId = useKanbanStore(
      (state) => state.currentWorkspaceId
    );
    const workspace = useKanbanStore((state) =>
      currentWorkspaceId ? state.workspaces.byId[currentWorkspaceId] : null
    );
    const updateWorkspace = useKanbanStore((state) => state.updateWorkspace);
    const dialog = useKanbanStore((state) => state.boardDialogs[dialogId]);

    const customColors = workspace?.customColors ?? [];

    const connectorState = useMemo(() => {
      const _vp = { vpX, vpY, vpZoom };
      if (!(dialog?.position && sourceDialog?.position)) {
        return null;
      }

      const myScreenPos = flowToScreenPosition({
        x: dialog.position.x,
        y: dialog.position.y,
      });
      const sourceScreenPos = flowToScreenPosition({
        x: sourceDialog.position.x + 340,
        y: sourceDialog.position.y + 60,
      });

      return {
        start: sourceScreenPos,
        end: { x: myScreenPos.x, y: myScreenPos.y + 20 },
      };
    }, [
      dialog?.position,
      sourceDialog?.position,
      flowToScreenPosition,
      vpX,
      vpY,
      vpZoom,
    ]);

    const handleClose = useCallback(() => {
      closeBoardDialog(dialogId);
    }, [dialogId, closeBoardDialog]);

    const handleColorChange = useCallback(
      (color: string) => {
        updateColumn(columnId, { accentColor: color || undefined });
        // Track usage
        if (currentWorkspaceId && color) {
          updateWorkspace(currentWorkspaceId, {
            colorUsage: incrementColorUsage(workspace?.colorUsage, color),
          });
        }
      },
      [
        columnId,
        updateColumn,
        currentWorkspaceId,
        workspace?.colorUsage,
        updateWorkspace,
      ]
    );

    const handleIconChange = useCallback(
      (icon: string) => {
        updateColumn(columnId, { icon: icon || undefined });
        // Track usage
        if (currentWorkspaceId && icon) {
          updateWorkspace(currentWorkspaceId, {
            iconUsage: incrementIconUsage(workspace?.iconUsage, icon),
          });
        }
      },
      [
        columnId,
        updateColumn,
        currentWorkspaceId,
        workspace?.iconUsage,
        updateWorkspace,
      ]
    );

    const handleAddCustomColor = useCallback(() => {
      if (isValidHexColor(pickerColor) && currentWorkspaceId) {
        if (!customColors.includes(pickerColor)) {
          updateWorkspace(currentWorkspaceId, {
            customColors: [...customColors, pickerColor],
          });
        }
        handleColorChange(pickerColor);
      }
    }, [
      pickerColor,
      currentWorkspaceId,
      customColors,
      updateWorkspace,
      handleColorChange,
    ]);

    if (!(dialog && column)) {
      return null;
    }

    return (
      // biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip
      <div
        aria-labelledby={`dialog-title-${dialogId}`}
        className={cn(
          "flex flex-col overflow-hidden rounded-lg bg-card transition-all",
          selected || isFocused
            ? "shadow-xl ring-2 ring-primary/50"
            : "shadow-lg ring-1 ring-border/50",
          "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.05)]"
        )}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsFocused(false);
          }
        }}
        onFocus={() => setIsFocused(true)}
        role="dialog"
        style={{ width: DIALOG_WIDTH }}
      >
        {connectorState &&
          createPortal(
            <ConnectorEdge
              color="primary"
              customColor={column.accentColor}
              endX={connectorState.end.x}
              endY={connectorState.end.y}
              hideStartNode
              startX={connectorState.start.x}
              startY={connectorState.start.y}
            />,
            document.body
          )}

        <div className="flex cursor-move select-none items-center justify-between border-border border-b bg-muted/95 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 text-primary">
              <Palette className="h-3 w-3" />
            </span>
            <span className="font-semibold text-xs">Style: {column.name}</span>
          </div>
          <button
            aria-label="Close"
            className="nodrag ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
            onClick={handleClose}
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
                color={column.accentColor || pickerColor}
                onChange={(color) => {
                  setPickerColor(color);
                  handleColorChange(color);
                }}
                style={{ width: "100%" }}
              />
              <div className="mt-2 flex items-center gap-2">
                <div
                  className="h-6 w-6 rounded border border-border"
                  style={{ backgroundColor: column.accentColor || pickerColor }}
                />
                <input
                  className="nodrag flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                  maxLength={7}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith("#") || val === "") {
                      setPickerColor(val || "#");
                      if (isValidHexColor(val)) {
                        handleColorChange(val);
                      }
                    }
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="#000000"
                  type="text"
                  value={column.accentColor || pickerColor}
                />
                <button
                  className="rounded bg-primary px-2 py-1 text-primary-foreground text-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
                  disabled={
                    !isValidHexColor(pickerColor) ||
                    customColors.includes(pickerColor)
                  }
                  onClick={handleAddCustomColor}
                  type="button"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <span className="mb-2 block font-medium text-[11px] text-muted-foreground">
              Preset Colors
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ACCENT_COLORS.map((color) => (
                <button
                  className={cn(
                    "h-6 w-6 rounded-full transition-all hover:scale-110",
                    color.class,
                    column.accentColor === color.value &&
                      "ring-2 ring-foreground/50 ring-offset-2 ring-offset-background"
                  )}
                  key={color.value}
                  onClick={() => handleColorChange(color.value)}
                  title={color.name}
                  type="button"
                />
              ))}
              {customColors.map((color) => (
                <button
                  className={cn(
                    "h-6 w-6 rounded-full transition-all hover:scale-110",
                    column.accentColor === color &&
                      "ring-2 ring-foreground/50 ring-offset-2 ring-offset-background"
                  )}
                  key={color}
                  onClick={() => handleColorChange(color)}
                  style={{ backgroundColor: color }}
                  title={color}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block font-medium text-[11px] text-muted-foreground">
              Icon
            </span>
            <div className="flex flex-wrap gap-1">
              {COLUMN_ICONS.map((icon) => (
                <button
                  className={cn(
                    "nodrag flex h-7 w-7 items-center justify-center rounded transition-all hover:bg-muted",
                    column.icon === icon.value &&
                      "bg-primary/20 text-primary ring-1 ring-primary/30"
                  )}
                  key={icon.value}
                  onClick={() => handleIconChange(icon.value)}
                  title={icon.name}
                  type="button"
                >
                  <icon.Icon
                    className="h-4 w-4"
                    style={
                      column.icon === icon.value && column.accentColor
                        ? { color: column.accentColor }
                        : undefined
                    }
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  });

ColorIconPickerDialogNodeComponent.displayName = "ColorIconPickerDialogNode";
