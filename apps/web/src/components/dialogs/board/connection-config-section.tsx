"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Circle,
  MoreHorizontal,
  MoveRight,
} from "lucide-react";
import { memo } from "react";
import { cn } from "@/src/lib/utils";

type HandlePosition = "top" | "right" | "bottom" | "left";
type LineStyle = "solid" | "dotted";

interface ConnectionConfigSectionProps {
  compact?: boolean;
  label: string;
  lineStyle: LineStyle;
  onLabelChange: (label: string) => void;
  onLineStyleChange: (style: LineStyle) => void;
  onShowArrowChange: (show: boolean) => void;
  onSourceHandleChange: (handle: HandlePosition) => void;
  onTargetHandleChange: (handle: HandlePosition) => void;
  showArrow: boolean;
  sourceHandle: HandlePosition;
  targetHandle: HandlePosition;
}

const handlePositions: {
  value: HandlePosition;
  label: string;
  icon: typeof ArrowUp;
}[] = [
  { value: "top", label: "Top", icon: ArrowUp },
  { value: "right", label: "Right", icon: ArrowRight },
  { value: "bottom", label: "Bottom", icon: ArrowDown },
  { value: "left", label: "Left", icon: ArrowLeft },
];

export const ConnectionConfigSection = memo(
  ({
    sourceHandle,
    targetHandle,
    lineStyle,
    showArrow,
    label,
    onSourceHandleChange,
    onTargetHandleChange,
    onLineStyleChange,
    onShowArrowChange,
    onLabelChange,
    compact = false,
  }: ConnectionConfigSectionProps) => {
    const selectClass = cn(
      "h-7 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary",
      compact ? "w-16" : "w-20"
    );

    const labelClass =
      "text-muted-foreground text-[10px] font-medium uppercase tracking-wide";

    return (
      <div className={cn("space-y-3", compact && "space-y-2")}>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className={labelClass}>Source</span>
            <select
              className={selectClass}
              onChange={(e) =>
                onSourceHandleChange(e.target.value as HandlePosition)
              }
              value={sourceHandle}
            >
              {handlePositions.map((pos) => (
                <option key={pos.value} value={pos.value}>
                  {pos.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end pb-1">
            <MoveRight className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex flex-col gap-1">
            <span className={labelClass}>Target</span>
            <select
              className={selectClass}
              onChange={(e) =>
                onTargetHandleChange(e.target.value as HandlePosition)
              }
              value={targetHandle}
            >
              {handlePositions.map((pos) => (
                <option key={pos.value} value={pos.value}>
                  {pos.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mx-1 h-8 w-px bg-border/50" />

          <div className="flex flex-col gap-1">
            <span className={labelClass}>Style</span>
            <div className="flex gap-0.5">
              <button
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-l border border-border transition-colors",
                  lineStyle === "solid"
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-background text-muted-foreground hover:bg-accent"
                )}
                onClick={() => onLineStyleChange("solid")}
                title="Solid line"
                type="button"
              >
                <div className="h-0.5 w-3.5 bg-current" />
              </button>
              <button
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-r border border-border border-l-0 transition-colors",
                  lineStyle === "dotted"
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-background text-muted-foreground hover:bg-accent"
                )}
                onClick={() => onLineStyleChange("dotted")}
                title="Dotted line"
                type="button"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className={labelClass}>Arrow</span>
            <button
              className={cn(
                "flex h-7 w-14 items-center justify-center gap-1 rounded border border-border text-xs transition-colors",
                showArrow
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-background text-muted-foreground hover:bg-accent"
              )}
              onClick={() => onShowArrowChange(!showArrow)}
              title={showArrow ? "Hide arrow" : "Show arrow"}
              type="button"
            >
              {showArrow ? (
                <>
                  <ArrowRight className="h-3 w-3" />
                  <span>On</span>
                </>
              ) : (
                <>
                  <Circle className="h-2 w-2" />
                  <span>Off</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className={labelClass}>Label (optional)</span>
          <input
            className="h-7 w-full rounded border border-border bg-background px-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Enter connection label..."
            type="text"
            value={label}
          />
        </div>
      </div>
    );
  }
);

ConnectionConfigSection.displayName = "ConnectionConfigSection";
