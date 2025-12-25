"use client";

import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useMemo } from "react";
import type { Collaborator } from "./collab-provider";

type CursorOverlayProps = {
  collaborators: Collaborator[];
  flowToScreenPosition: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  onNavigateToUser?: (position: { x: number; y: number }) => void;
};

const EDGE_PADDING = 60;
const VIEWPORT_MARGIN = 20;

const CursorIcon = memo(({ color }: { color: string }) => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: skip for decorative icon
  <svg
    fill="none"
    height="18"
    style={{
      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))",
      transform: "rotate(-19deg)",
    }}
    viewBox="0 0 14 18"
    width="14"
  >
    <path
      d="M1 1L1 16L5.5 11.5L12 11.5L1 1Z"
      fill={color}
      stroke="white"
      strokeLinejoin="round"
      strokeWidth="1"
    />
  </svg>
));

CursorIcon.displayName = "CursorIcon";

// Arrow icon for edge indicators
const DirectionArrow = memo(
  ({ color, rotation }: { color: string; rotation: number }) => (
    // biome-ignore lint/a11y/noSvgWithoutTitle: skip for decorative icon
    <svg
      fill="none"
      height="12"
      style={{
        transform: `rotate(${rotation}deg)`,
      }}
      viewBox="0 0 12 12"
      width="12"
    >
      <path
        d="M6 2L10 6L6 10M10 6H2"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
);

DirectionArrow.displayName = "DirectionArrow";

type CollaboratorCursorProps = {
  collaborator: Collaborator;
  flowToScreenPosition: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
};

// Check if position is within viewport
function isInViewport(x: number, y: number): boolean {
  const width = typeof window !== "undefined" ? window.innerWidth : 0;
  const height = typeof window !== "undefined" ? window.innerHeight : 0;
  return (
    x >= -VIEWPORT_MARGIN &&
    x <= width + VIEWPORT_MARGIN &&
    y >= -VIEWPORT_MARGIN &&
    y <= height + VIEWPORT_MARGIN
  );
}

// Calculate edge indicator position and rotation
function getEdgeIndicatorPosition(
  x: number,
  y: number
): { edgeX: number; edgeY: number; rotation: number } | null {
  if (typeof window === "undefined") {
    return null;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  // Calculate angle from center of screen to cursor
  const centerX = width / 2;
  const centerY = height / 2;
  const angle = Math.atan2(y - centerY, x - centerX);

  // Calculate intersection with screen edges
  let edgeX: number;
  let edgeY: number;

  // Determine which edge to show the indicator on
  const aspectRatio = width / height;
  const normalizedAngle = Math.abs(
    Math.atan2(Math.sin(angle), Math.cos(angle))
  );

  if (normalizedAngle < Math.atan(aspectRatio)) {
    // Right edge
    if (x > width) {
      edgeX = width - EDGE_PADDING;
      edgeY = Math.max(
        EDGE_PADDING,
        Math.min(
          height - EDGE_PADDING,
          centerY + (x > centerX ? (edgeX - centerX) * Math.tan(angle) : 0)
        )
      );
    } else {
      // Left edge
      edgeX = EDGE_PADDING;
      edgeY = Math.max(
        EDGE_PADDING,
        Math.min(
          height - EDGE_PADDING,
          centerY - (centerX - edgeX) * Math.tan(angle)
        )
      );
    }
  } else if (y < 0) {
    // Top edge
    edgeY = EDGE_PADDING;
    edgeX = Math.max(
      EDGE_PADDING,
      Math.min(
        width - EDGE_PADDING,
        centerX + (centerY - edgeY) / Math.tan(angle)
      )
    );
  } else {
    // Bottom edge
    edgeY = height - EDGE_PADDING;
    edgeX = Math.max(
      EDGE_PADDING,
      Math.min(
        width - EDGE_PADDING,
        centerX + (edgeY - centerY) / Math.tan(angle)
      )
    );
  }

  // Clamp to screen bounds with padding
  edgeX = Math.max(EDGE_PADDING, Math.min(width - EDGE_PADDING, edgeX));
  edgeY = Math.max(EDGE_PADDING, Math.min(height - EDGE_PADDING, edgeY));

  // Calculate rotation (arrow pointing towards cursor)
  const rotation = (angle * 180) / Math.PI;

  return { edgeX, edgeY, rotation };
}

// Edge indicator component for off-screen cursors
const EdgeIndicator = memo(
  ({
    collaborator,
    flowToScreenPosition,
    onNavigate,
  }: {
    collaborator: Collaborator;
    flowToScreenPosition: (pos: { x: number; y: number }) => {
      x: number;
      y: number;
    };
    onNavigate?: (position: { x: number; y: number }) => void;
  }) => {
    const { cursor, name, color } = collaborator;

    // Don't show if cursor is null (user left tab/switched apps)
    if (!cursor) {
      return null;
    }

    const screenPos = flowToScreenPosition({ x: cursor.x, y: cursor.y });
    const firstName = name.split(" ")[0] || name;

    // If cursor is in viewport, don't show edge indicator
    if (isInViewport(screenPos.x, screenPos.y)) {
      return null;
    }

    const edgePos = getEdgeIndicatorPosition(screenPos.x, screenPos.y);
    if (!edgePos) {
      return null;
    }

    const handleClick = () => {
      if (onNavigate && cursor) {
        onNavigate({ x: cursor.x, y: cursor.y });
      }
    };

    return (
      <motion.div
        animate={{
          opacity: 1,
          x: edgePos.edgeX,
          y: edgePos.edgeY,
        }}
        className="pointer-events-auto absolute top-0 left-0 z-9998 flex cursor-pointer items-center gap-1"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={handleClick}
        style={{ willChange: "transform" }}
        transition={{
          x: { type: "spring", stiffness: 800, damping: 60 },
          y: { type: "spring", stiffness: 800, damping: 60 },
          opacity: { duration: 0.15 },
        }}
      >
        <div
          className="flex items-center gap-1.5 rounded-full px-2 py-1 shadow-lg transition-transform hover:scale-105"
          style={{
            backgroundColor: color,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          <DirectionArrow color="white" rotation={edgePos.rotation} />
          <span className="font-medium text-[10px] text-white">
            {firstName}
          </span>
        </div>
      </motion.div>
    );
  }
);

EdgeIndicator.displayName = "EdgeIndicator";

const CollaboratorCursor = memo(
  ({ collaborator, flowToScreenPosition }: CollaboratorCursorProps) => {
    const { cursor, name, color } = collaborator;

    // Don't show if cursor is null (user left tab/switched apps)
    if (!cursor) {
      return null;
    }

    const screenPos = flowToScreenPosition({ x: cursor.x, y: cursor.y });
    const x = screenPos.x;
    const y = screenPos.y;

    // Don't render cursor if it's outside viewport (edge indicator handles this)
    if (!isInViewport(x, y)) {
      return null;
    }

    const firstName = name.split(" ")[0] || name;

    return (
      <motion.div
        animate={{ opacity: 1, scale: 1, x, y }}
        className="pointer-events-none absolute top-0 left-0 z-9999"
        exit={{ opacity: 0, scale: 0.5 }}
        initial={{ opacity: 0, scale: 0.5 }}
        style={{ willChange: "transform" }}
        transition={{
          x: { type: "spring", stiffness: 800, damping: 60 },
          y: { type: "spring", stiffness: 800, damping: 60 },
          opacity: { duration: 0.1 },
          scale: { duration: 0.1 },
        }}
      >
        <CursorIcon color={color} />
        <div
          className="absolute top-4 left-2.5 whitespace-nowrap rounded-full px-2 py-0.5 font-medium text-[10px] text-white"
          style={{
            backgroundColor: color,
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          }}
        >
          {firstName}
        </div>
      </motion.div>
    );
  }
);

CollaboratorCursor.displayName = "CollaboratorCursor";

export const CursorOverlay = memo(
  ({
    collaborators,
    flowToScreenPosition,
    onNavigateToUser,
  }: CursorOverlayProps) => {
    // Only show collaborators who have an active cursor (not null)
    // Cursor is null when user leaves tab, switches apps, or mouse leaves canvas
    const activeCollaborators = useMemo(
      () =>
        collaborators.filter(
          (c) => c.cursor !== undefined && c.cursor !== null
        ),
      [collaborators]
    );

    const handleNavigate = useCallback(
      (position: { x: number; y: number }) => {
        if (onNavigateToUser) {
          onNavigateToUser(position);
        }
      },
      [onNavigateToUser]
    );

    if (activeCollaborators.length === 0) {
      return null;
    }

    return (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ zIndex: 9999 }}
      >
        <AnimatePresence>
          {activeCollaborators.map((collaborator) => (
            <CollaboratorCursor
              collaborator={collaborator}
              flowToScreenPosition={flowToScreenPosition}
              key={collaborator.id}
            />
          ))}
          {activeCollaborators.map((collaborator) => (
            <EdgeIndicator
              collaborator={collaborator}
              flowToScreenPosition={flowToScreenPosition}
              key={`edge-${collaborator.id}`}
              onNavigate={handleNavigate}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  }
);

CursorOverlay.displayName = "CursorOverlay";
