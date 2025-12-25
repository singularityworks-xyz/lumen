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

    const firstName = name.split(" ")[0] || name;

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
