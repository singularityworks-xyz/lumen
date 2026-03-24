"use client";

import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Collaborator } from "./collab-provider";

interface CursorOverlayProps {
  collaborators: Collaborator[];
  flowToScreenPosition: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  onNavigateToUser?: (position: { x: number; y: number }) => void;
}

const EDGE_PADDING = 60;
const VIEWPORT_MARGIN = 50;

const CursorIcon = memo(({ color }: { color: string }) => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: skip for decorative icon
  <svg
    fill="none"
    height="18"
    style={{
      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))",
      // The SVG path starts at (1,1), and we apply a -19deg rotation.
      // To keep the cursor tip at position (0,0) of the parent div:
      // 1. Set transform-origin at the SVG path tip (1px, 1px)
      // 2. Translate by -1px on both axes to move tip to origin
      // CSS transforms apply right-to-left, so translate happens after rotate
      // when written as "translate rotate", the rotate is applied first.
      // So the tip at (1,1) rotates around (1,1), staying at (1,1),
      // then translates by (-1,-1) to end up at (0,0).
      transformOrigin: "1px 1px",
      transform: "translate(-1px, -1px) rotate(-19deg)",
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

interface CollaboratorDisplayProps {
  collaborator: Collaborator;
  flowToScreenPosition: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  onNavigate?: (position: { x: number; y: number }) => void;
}

// Check if position is within viewport
function isInViewport(x: number, y: number): boolean {
  const width = typeof window === "undefined" ? 0 : window.innerWidth;
  const height = typeof window === "undefined" ? 0 : window.innerHeight;
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

// Combined component that handles both cursor and edge indicator
// This prevents the janky animations when switching between the two
const CollaboratorDisplay = memo(
  ({
    collaborator,
    flowToScreenPosition,
    onNavigate,
    containerOffset,
  }: CollaboratorDisplayProps & {
    containerOffset: { x: number; y: number };
  }) => {
    const { cursor, name, color } = collaborator;
    const lastInViewportRef = useRef(true);

    // Don't show if cursor is null (user left tab/switched apps)
    if (!cursor) {
      return null;
    }

    const screenPos = flowToScreenPosition({ x: cursor.x, y: cursor.y });

    // Adjust screen position by subtracting container offset to get local coordinates
    // This ensures cursor is correctly positioned even if container is not at (0,0) viewport
    const x = screenPos.x - containerOffset.x;
    const y = screenPos.y - containerOffset.y;
    const inViewport = isInViewport(screenPos.x, screenPos.y);

    // Use ref to track state changes and prevent rapid switching
    // This adds hysteresis to prevent flickering at the boundary
    if (inViewport !== lastInViewportRef.current) {
      lastInViewportRef.current = inViewport;
    }

    const firstName = name.split(" ")[0] || name;
    // Edge indicator uses viewport coordinates relative to window
    const edgePos = inViewport
      ? null
      : getEdgeIndicatorPosition(screenPos.x, screenPos.y);

    const handleClick = () => {
      if (onNavigate && cursor) {
        onNavigate({ x: cursor.x, y: cursor.y });
      }
    };

    return (
      <>
        <motion.div
          animate={{
            opacity: inViewport ? 1 : 0,
            scale: inViewport ? 1 : 0.5,
            x,
            y,
          }}
          className="pointer-events-none absolute top-0 left-0 z-9999"
          initial={false}
          style={{ willChange: "transform" }}
          transition={{
            x: { type: "spring", stiffness: 800, damping: 60 },
            y: { type: "spring", stiffness: 800, damping: 60 },
            opacity: { duration: 0.15 },
            scale: { duration: 0.15 },
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

        {edgePos && (
          <motion.div
            animate={{
              opacity: inViewport ? 0 : 1,
              x: edgePos.edgeX - containerOffset.x,
              y: edgePos.edgeY - containerOffset.y,
            }}
            className="pointer-events-auto absolute top-0 left-0 z-9998 flex cursor-pointer items-center gap-1"
            initial={false}
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
        )}
      </>
    );
  }
);

CollaboratorDisplay.displayName = "CollaboratorDisplay";

export const CursorOverlay = memo(
  ({
    collaborators,
    flowToScreenPosition,
    onNavigateToUser,
  }: CursorOverlayProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerOffset, setContainerOffset] = useState({ x: 0, y: 0 });

    useEffect(() => {
      const updateOffset = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setContainerOffset({ x: rect.left, y: rect.top });
        }
      };

      updateOffset();
      window.addEventListener("resize", updateOffset);
      return () => window.removeEventListener("resize", updateOffset);
    }, []);

    // Only show collaborators who have an active cursor (not null)
    // Cursor is null when user leaves tab, switches apps, or mouse leaves canvas
    // Also hide cursor for collaborators who are dragging - they have a drag overlay instead
    const activeCollaborators = useMemo(
      () =>
        collaborators.filter(
          (c) =>
            c.cursor !== undefined &&
            c.cursor !== null &&
            !c.draggingTask &&
            !c.draggingColumn
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
        ref={containerRef}
        style={{ zIndex: 9999 }}
      >
        <AnimatePresence>
          {activeCollaborators.map((collaborator) => (
            <CollaboratorDisplay
              collaborator={collaborator}
              containerOffset={containerOffset}
              flowToScreenPosition={flowToScreenPosition}
              key={collaborator.id}
              onNavigate={handleNavigate}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  }
);
CursorOverlay.displayName = "CursorOverlay";
