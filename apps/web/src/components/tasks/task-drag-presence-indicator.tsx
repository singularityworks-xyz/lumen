"use client";

import { memo } from "react";
import type { Collaborator } from "@/src/features/collab";

interface TaskDragPresenceIndicatorProps {
  collaborator: Collaborator & {
    image?: string | null;
  };
}

export const TaskDragPresenceIndicator = memo<TaskDragPresenceIndicatorProps>(
  ({ collaborator }) => (
    <div
      className="pointer-events-none absolute -inset-0.5 z-20 rounded-lg border-2"
      style={{
        borderColor: collaborator.color,
        boxShadow: `0 0 8px ${collaborator.color}50`,
      }}
    />
  )
);

TaskDragPresenceIndicator.displayName = "TaskDragPresenceIndicator";
