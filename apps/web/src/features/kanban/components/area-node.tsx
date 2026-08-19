"use client";

import {
  type Node,
  type NodeProps,
  NodeResizer as Resizer,
} from "@xyflow/react";
import { Edit2, GripVertical, Layout, Palette, Trash2 } from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../store/kanban-store";
import { ICON_MAP } from "../utils/color-icon-utils";

export interface AreaNodeData {
  areaId: string;
  [key: string]: unknown;
}

type AreaNodeProps = NodeProps<Node<AreaNodeData>>;

const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;
const MAX_WIDTH = 3000;
const MAX_HEIGHT = 3000;

export const AreaNodeComponent = memo<AreaNodeProps>(({ data, selected }) => {
  const areaId = data.areaId;
  const area = useKanbanStore((state) => state.areas.byId[areaId]);
  const areaPosition = useKanbanStore(
    (state) => state.areaPositions.byId[areaId]
  );
  const updateArea = useKanbanStore((state) => state.updateArea);
  const removeArea = useKanbanStore((state) => state.removeArea);
  const openAreaDialog = useKanbanStore((state) => state.openAreaDialog);
  const updateAreaPosition = useKanbanStore(
    (state) => state.updateAreaPosition
  );
  const updateAreaDimensions = useKanbanStore(
    (state) => state.updateAreaDimensions
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(area?.name ?? "");

  // Draft size/position during an active resize gesture (committed on end)
  const resizeDraft = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const handleStartRename = useCallback(() => {
    setEditName(area?.name ?? "");
    setIsEditing(true);
  }, [area?.name]);

  const handleNameSubmit = useCallback(
    (customName?: string) => {
      const finalName = (customName ?? editName).trim();
      if (finalName) {
        updateArea(areaId, { name: finalName });
      }
      setIsEditing(false);
    },
    [areaId, editName, updateArea]
  );

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleNameSubmit(e.currentTarget.value);
      } else if (e.key === "Escape") {
        setEditName(area?.name ?? "");
        setIsEditing(false);
      }
    },
    [area?.name, handleNameSubmit]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      removeArea(areaId);
    },
    [areaId, removeArea]
  );

  const handleOpenProperties = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!areaPosition) {
        return;
      }
      const dialogPos = {
        x: areaPosition.x + 20,
        y: areaPosition.y + 40,
      };

      openAreaDialog({
        areaId,
        areaName: area?.name ?? "Area",
        position: dialogPos,
      });
    },
    [areaId, area?.name, areaPosition, openAreaDialog]
  );

  // Intermediate resize events only track the draft — NodeResizer renders
  // the live visuals itself. The shared store is updated once, with rounded
  // dimensions, when the resize gesture ends.
  const handleResize = useCallback(
    (
      _event: unknown,
      params: { x: number; y: number; width: number; height: number }
    ) => {
      resizeDraft.current = params;
    },
    []
  );

  const handleResizeEnd = useCallback(
    (
      _event: unknown,
      params: { x: number; y: number; width: number; height: number }
    ) => {
      resizeDraft.current = null;
      updateAreaDimensions(areaId, {
        width: Math.round(params.width),
        height: Math.round(params.height),
      });
      if (params.x !== areaPosition?.x || params.y !== areaPosition?.y) {
        updateAreaPosition(areaId, {
          x: Math.round(params.x),
          y: Math.round(params.y),
        });
      }
    },
    [
      areaId,
      areaPosition?.x,
      areaPosition?.y,
      updateAreaDimensions,
      updateAreaPosition,
    ]
  );

  if (!(area && areaPosition)) {
    return null;
  }

  return (
    <>
      <Resizer
        handleClassName="w-3! h-3! border-2! border-background! bg-primary! rounded-xs! shadow-md"
        isVisible={Boolean(selected)}
        lineClassName="border-primary/40!"
        maxHeight={MAX_HEIGHT}
        maxWidth={MAX_WIDTH}
        minHeight={MIN_HEIGHT}
        minWidth={MIN_WIDTH}
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
      />

      <div
        className={cn(
          "nodrag relative h-full w-full rounded-lg border-2 transition-all",
          selected
            ? "border-gray-400 ring-2 ring-gray-400/30"
            : "border-gray-300 dark:border-gray-600"
        )}
        data-testid="area-node"
        style={{
          backgroundColor: `${area.color}15`,
          borderColor: area.color,
        }}
      >
        <div
          className="area-drag-handle absolute top-0 left-0 flex cursor-move select-none items-center gap-1.5 rounded-br-lg px-2.5 py-1.5"
          data-testid="area-header"
          style={{
            backgroundColor: `${area.color}25`,
          }}
        >
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />

          {area.icon && (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
              style={{
                backgroundColor: `${area.color}30`,
                color: area.color,
              }}
            >
              {(() => {
                const Icon = ICON_MAP[area.icon];
                return Icon ? <Icon className="h-3 w-3" /> : null;
              })()}
            </span>
          )}

          {isEditing ? (
            <input
              autoFocus
              className="nodrag w-32 rounded border border-border bg-background px-2 py-0.5 font-medium text-foreground text-sm outline-none focus:ring-1 focus:ring-primary"
              data-testid="area-name-input"
              onBlur={() => handleNameSubmit()}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                handleNameKeyDown(e);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              value={editName}
            />
          ) : (
            // biome-ignore lint/a11y/noNoninteractiveElementInteractions: double click to rename
            // biome-ignore lint/a11y/noStaticElementInteractions: double click to rename
            <span
              className="cursor-text font-semibold text-foreground text-sm"
              data-testid="area-name"
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleStartRename();
              }}
            >
              {area.name}
            </span>
          )}

          {(area.board_ids?.length ?? 0) > 0 && (
            <span
              className="flex h-5 items-center gap-1 rounded-full px-2 font-medium text-[10px]"
              data-testid="area-board-count"
              style={{
                backgroundColor: `${area.color}40`,
                color: area.color,
              }}
              title={`${area.board_ids.length} board${area.board_ids.length === 1 ? "" : "s"} attached`}
            >
              <Layout className="h-3 w-3" />
              {area.board_ids.length}
            </span>
          )}

          <div className="flex items-center gap-0.5">
            <button
              className="nodrag flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10"
              data-testid="area-rename-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleStartRename();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Rename area"
              type="button"
            >
              <Edit2 className="h-3 w-3" />
            </button>

            <button
              className="nodrag flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10"
              data-testid="area-customize-btn"
              onClick={handleOpenProperties}
              onPointerDown={(e) => e.stopPropagation()}
              title="Customize area"
              type="button"
            >
              <Palette className="h-3 w-3" />
            </button>

            <button
              className="nodrag flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
              data-testid="area-delete-btn"
              onClick={handleRemove}
              onPointerDown={(e) => e.stopPropagation()}
              title="Delete area"
              type="button"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {selected && (
          <div className="pointer-events-none absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center rounded bg-primary/40">
            <svg
              className="h-3 w-3 text-primary-foreground"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <title>Resize handle</title>
              <path d="M21 15v6h-6M3 9V3h6M21 3l-7 7M3 21l7-7" />
            </svg>
          </div>
        )}
      </div>
    </>
  );
});

AreaNodeComponent.displayName = "AreaNode";
