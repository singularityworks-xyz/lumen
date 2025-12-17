import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from "@xyflow/react";
import { useState } from "react";
import { useKanbanStore } from "../../features/kanban/store";

export type BoardEdgeData = {
  label?: string;
  lineStyle: "solid" | "dotted";
};

export type BoardEdge = Edge<BoardEdgeData>;

export function BoardEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<BoardEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(data?.label ?? "");

  const updateConnectionLabel = useKanbanStore(
    (state) => state.updateConnectionLabel
  );

  console.log("BoardEdge rendering:", {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    data,
    selected,
  });

  const lineStyle = data?.lineStyle ?? "solid";
  const strokeDasharray = lineStyle === "dotted" ? "5,5" : undefined;

  const strokeColor = selected ? "#3b82f6" : "#71717a";

  const handleLabelDoubleClick = () => {
    setIsEditingLabel(true);
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLabelValue(e.target.value);
  };

  const handleLabelBlur = () => {
    setIsEditingLabel(false);
    updateConnectionLabel(id, labelValue || undefined);
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setIsEditingLabel(false);
      updateConnectionLabel(id, labelValue || undefined);
    } else if (e.key === "Escape") {
      setIsEditingLabel(false);
      setLabelValue(data?.label ?? "");
    }
  };

  return (
    <>
      <BaseEdge
        id={id}
        markerEnd={markerEnd}
        path={edgePath}
        style={{
          strokeWidth: selected ? 3 : 2,
          stroke: strokeColor,
          strokeDasharray,
        }}
      />
      <EdgeLabelRenderer>
        {(data?.label || isEditingLabel) && (
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
          >
            {isEditingLabel ? (
              <input
                autoFocus
                className="rounded border border-border bg-background px-2 py-1 font-medium text-foreground text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                onBlur={handleLabelBlur}
                onChange={handleLabelChange}
                onKeyDown={handleLabelKeyDown}
                style={{ minWidth: "80px" }}
                type="text"
                value={labelValue}
              />
            ) : (
              <button
                className="cursor-pointer rounded border border-border bg-background px-2 py-1 font-medium text-foreground text-xs shadow-sm transition-colors hover:bg-accent"
                onDoubleClick={handleLabelDoubleClick}
                style={{ userSelect: "none" }}
                type="button"
              >
                {data?.label}
              </button>
            )}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
