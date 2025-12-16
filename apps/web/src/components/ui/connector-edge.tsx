"use client";

import { memo } from "react";

type ConnectorEdgeProps = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: "primary" | "destructive" | "amber" | "emerald";
  hideStartNode?: boolean;
};

export const ConnectorEdge = memo(
  ({
    startX,
    startY,
    endX,
    endY,
    color = "primary",
    hideStartNode = false,
  }: ConnectorEdgeProps) => {
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

    return (
      <svg
        className="pointer-events-none fixed top-0 left-0"
        height="100vh"
        style={{ zIndex: 9996 }}
        width="100vw"
      >
        {/* Main dotted path */}
        <path
          className={colorClass.split(" ")[0]}
          d={`M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`}
          fill="none"
          strokeDasharray="6 6"
          strokeLinecap="round"
          strokeOpacity="0.6"
          strokeWidth="2"
        >
          <animate
            attributeName="stroke-dashoffset"
            dur="0.6s"
            from="0"
            repeatCount="indefinite"
            to="-12"
          />
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
        {/* End node */}
        <circle
          className={colorClass.split(" ")[1]}
          cx={endX}
          cy={endY}
          r="5"
        />
      </svg>
    );
  }
);

ConnectorEdge.displayName = "ConnectorEdge";
