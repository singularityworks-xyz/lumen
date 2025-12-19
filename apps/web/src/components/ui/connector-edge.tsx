"use client";

import { memo } from "react";

type ConnectorEdgeProps = {
  endX: number;
  endY: number;
  color?: "primary" | "destructive" | "amber" | "emerald";
  hideStartNode?: boolean;
  lineStyle?: "dotted" | "solid";
  showArrow?: boolean;
  zIndex?: number;
} & (
  | {
      startX: number;
      startY: number;
      buttonRect?: never;
      fallbackPosition?: never;
    }
  | {
      startX?: never;
      startY?: never;
      buttonRect: DOMRect | null;
      fallbackPosition?: { x: number; y: number };
    }
);

export const ConnectorEdge = memo((props: ConnectorEdgeProps) => {
  const {
    endX,
    endY,
    color = "primary",
    hideStartNode = false,
    lineStyle = "dotted",
    showArrow = false,
    zIndex = 9996,
  } = props;

  // Compute start coordinates based on props
  let startX: number;
  let startY: number;

  if ("buttonRect" in props && props.buttonRect !== undefined) {
    if (props.buttonRect) {
      startX = props.buttonRect.right;
      startY = props.buttonRect.top + props.buttonRect.height / 2;
    } else if (props.fallbackPosition) {
      // Use fallback position when rect is null (e.g., after page refresh)
      startX = props.fallbackPosition.x + 200; // approximate button position
      startY = props.fallbackPosition.y + 20;
    } else {
      // No valid start point
      return null;
    }
  } else {
    startX = props.startX;
    startY = props.startY;
  }

  const dx = Math.abs(endX - startX);
  const controlOffset = Math.min(dx * 0.4, 60);
  const controlX1 = startX + controlOffset;
  const controlX2 = endX - controlOffset;

  const colorClass = {
    primary: "stroke-primary fill-primary",
    destructive: "stroke-red-500 fill-red-500",
    amber: "stroke-amber-500 fill-amber-500",
    emerald: "stroke-emerald-500 fill-emerald-500",
  }[color];

  const strokeColor = {
    primary: "var(--primary)",
    destructive: "#ef4444",
    amber: "#f59e0b",
    emerald: "#10b981",
  }[color];

  const markerId = `arrow-${color}`;

  return (
    <svg
      className="pointer-events-none fixed top-0 left-0"
      height="100vh"
      style={{ zIndex }}
      width="100vw"
    >
      {/* Arrow marker definition */}
      {showArrow && (
        <defs>
          <marker
            id={markerId}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
          </marker>
        </defs>
      )}
      {/* Main path - solid or dotted */}
      <path
        className={colorClass.split(" ")[0]}
        d={`M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`}
        fill="none"
        strokeDasharray={lineStyle === "dotted" ? "6 6" : undefined}
        strokeLinecap="round"
        strokeOpacity={lineStyle === "solid" ? "0.8" : "0.6"}
        strokeWidth="2"
        markerEnd={showArrow ? `url(#${markerId})` : undefined}
      >
        {lineStyle === "dotted" && (
          <animate
            attributeName="stroke-dashoffset"
            dur="0.6s"
            from="0"
            repeatCount="indefinite"
            to="-12"
          />
        )}
      </path>
      {/* Start node - conditionally hidden */}
      {!hideStartNode && (
        <circle
          className={colorClass.split(" ")[1]}
          cx={startX}
          cy={startY}
          r="5"
        />
      )}
      {/* End node - hide when arrow is shown */}
      {!showArrow && (
        <circle
          className={colorClass.split(" ")[1]}
          cx={endX}
          cy={endY}
          r="5"
        />
      )}
    </svg>
  );
});

ConnectorEdge.displayName = "ConnectorEdge";
