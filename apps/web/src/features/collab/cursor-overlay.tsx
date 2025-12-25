"use client";

import { AnimatePresence, motion } from "motion/react";
import { memo, useMemo } from "react";
import type { Collaborator } from "./collab-provider";

type CursorOverlayProps = {
  collaborators: Collaborator[];
  flowToScreenPosition: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
};

const CursorIcon = memo(({ color }: { color: string }) => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: skip for decorative icon
  <svg
    fill="none"
    height="24"
    style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
    viewBox="0 0 24 24"
    width="24"
  >
    <path
      d="M5.5 3.21V20.79C5.5 21.16 5.63 21.35 5.89 21.35C6.04 21.35 6.2 21.28 6.37 21.13L10.22 17.28L12.65 22.88C12.75 23.13 12.92 23.29 13.17 23.37C13.42 23.45 13.67 23.42 13.9 23.28L15.71 22.12C15.93 21.98 16.08 21.78 16.14 21.52C16.2 21.26 16.14 21.01 15.97 20.78L13.22 15.42L18.62 14.5C18.93 14.44 19.15 14.27 19.27 14C19.39 13.73 19.35 13.48 19.16 13.25L6.47 3.67C6.32 3.54 6.15 3.48 5.96 3.5C5.64 3.5 5.5 3.69 5.5 3.21Z"
      fill={color}
      stroke="white"
      strokeWidth="1"
    />
  </svg>
));

CursorIcon.displayName = "CursorIcon";

type CollaboratorCursorProps = {
  collaborator: Collaborator;
  flowToScreenPosition: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
};

const CollaboratorCursor = memo(
  ({ collaborator, flowToScreenPosition }: CollaboratorCursorProps) => {
    const { cursor, name, color } = collaborator;

    if (!cursor) {
      return null;
    }

    const screenPos = flowToScreenPosition({ x: cursor.x, y: cursor.y });
    const x = screenPos.x;
    const y = screenPos.y;

    return (
      <motion.div
        animate={{ opacity: 1, scale: 1, x, y }}
        className="pointer-events-none absolute top-0 left-0 z-9999"
        exit={{ opacity: 0, scale: 0.5 }}
        initial={{ opacity: 0, scale: 0.5 }}
        style={{ willChange: "transform" }}
        transition={{
          x: { type: "spring", stiffness: 500, damping: 50 },
          y: { type: "spring", stiffness: 500, damping: 50 },
          opacity: { duration: 0.15 },
          scale: { duration: 0.15 },
        }}
      >
        <CursorIcon color={color} />
        <div
          className="absolute top-5 left-5 whitespace-nowrap rounded-md px-2 py-1 font-medium text-white text-xs shadow-md"
          style={{
            backgroundColor: color,
            border: `2px solid ${color}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          {name}
        </div>
      </motion.div>
    );
  }
);

CollaboratorCursor.displayName = "CollaboratorCursor";

export const CursorOverlay = memo(
  ({ collaborators, flowToScreenPosition }: CursorOverlayProps) => {
    const visibleCollaborators = useMemo(
      () => collaborators.filter((c) => c.cursor !== undefined),
      [collaborators]
    );

    if (visibleCollaborators.length === 0) {
      return null;
    }

    return (
      <div
        className="pointer-events-none absolute inset-0"
        style={{ zIndex: 9999 }}
      >
        <AnimatePresence>
          {visibleCollaborators.map((collaborator) => (
            <CollaboratorCursor
              collaborator={collaborator}
              flowToScreenPosition={flowToScreenPosition}
              key={collaborator.id}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  }
);

CursorOverlay.displayName = "CursorOverlay";
