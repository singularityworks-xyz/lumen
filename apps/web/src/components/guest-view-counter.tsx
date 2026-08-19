"use client";

import { Users } from "lucide-react";
import { memo } from "react";
import { useCollaboration } from "@/src/features/collab";

export const GuestViewCounter = memo(function GuestViewCounter() {
  const { collaborators } = useCollaboration();
  const viewerCount = Math.max(1, collaborators.length + 1);

  return (
    <aside
      aria-label="Live view counter"
      className="pointer-events-auto fixed top-4 right-4 z-40 select-none"
      data-testid="guest-view-counter"
    >
      <div className="flex items-center gap-2 rounded-full border-2 border-border/50 bg-card/95 px-3 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground text-xs">
          {viewerCount} {viewerCount === 1 ? "viewer" : "viewers"}
        </span>
      </div>
    </aside>
  );
});
