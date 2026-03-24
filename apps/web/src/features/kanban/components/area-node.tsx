"use client";

import {
  type Node,
  type NodeProps,
  NodeResizer as Resizer,
} from "@xyflow/react";
import { GripVertical, Layout, Palette, Trash2 } from "lucide-react";
import { memo, useCallback, useState } from "react";
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

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(area?.name ?? "");

  const handleDoubleClick = useCallback(() => {
    setEditName(area?.name ?? "");
    setIsEditing(true);
  }, [area?.name]);

  const handleNameSubmit = useCallback(() => {
    if (editName.trim()) {
      updateArea(areaId, { name: editName.trim() });
    }
    setIsEditing(false);
  }, [areaId, editName, updateArea]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleNameSubmit();
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
        x: areaPosition.x - 320,
        y: areaPosition.y,
      };

      openAreaDialog({
        areaId,
        areaName: area?.name ?? "Area",
        position: dialogPos,
      });
    },
    [areaId, area?.name, areaPosition, openAreaDialog]
  );

  if (!(area && areaPosition)) {
    return null;
  }

  return (
    <>
      <Resizer
        handleClassName="!w-6 !h-6 !opacity-0"
        isVisible={selected}
        lineClassName="!border-0"
        lineStyle={{
          borderWidth: 0,
          opacity: 0,
        }}
        maxHeight={MAX_HEIGHT}
        maxWidth={MAX_WIDTH}
        minHeight={MIN_HEIGHT}
        minWidth={MIN_WIDTH}
      />

      <div
        className={cn(
          "relative h-full w-full rounded-lg border-2 transition-all",
          selected
            ? "border-gray-400 ring-2 ring-gray-400/30"
            : "border-gray-300 dark:border-gray-600"
        )}
        style={{
          backgroundColor: `${area.color}15`,
          borderColor: area.color,
        }}
      >
        <div
          className="absolute top-0 left-0 flex cursor-move items-center gap-2 rounded-br-lg px-3 py-2"
          style={{
            backgroundColor: `${area.color}25`,
          }}
        >
          <GripVertical className="h-4 w-4 text-gray-500" />

          {area.icon && (
            <span
              className="flex h-5 w-5 items-center justify-center rounded"
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
              className="w-32 rounded border border-gray-300 bg-white px-2 py-0.5 font-medium text-gray-700 text-sm outline-none focus:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              onBlur={handleNameSubmit}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              value={editName}
            />
          ) : (
            // biome-ignore lint/a11y/noNoninteractiveElementInteractions:skip
            // biome-ignore lint/a11y/noStaticElementInteractions:skip
            <span
              className="cursor-text select-none font-semibold text-gray-700 text-sm dark:text-gray-300"
              onDoubleClick={handleDoubleClick}
            >
              {area.name}
            </span>
          )}

          {(area.board_ids?.length ?? 0) > 0 && (
            <span
              className="flex h-5 items-center gap-1 rounded-full px-2 font-medium text-[10px]"
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

          <button
            className="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={handleOpenProperties}
            title="Customize area"
            type="button"
          >
            <Palette className="h-3 w-3" />
          </button>

          <button
            className="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-destructive/20 hover:text-destructive"
            onClick={handleRemove}
            title="Delete area"
            type="button"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {selected && (
          <div className="pointer-events-none absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center rounded bg-gray-400/50">
            <svg
              className="h-3 w-3 text-white"
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
