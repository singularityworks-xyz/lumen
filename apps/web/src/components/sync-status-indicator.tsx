"use client";

import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useCollaboration } from "@/src/features/collab";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";

type SyncState = "disconnected" | "connecting" | "syncing" | "synced" | "error";

const stateConfig: Record<
  SyncState,
  { icon: typeof Cloud; color: string; label: string }
> = {
  disconnected: {
    icon: CloudOff,
    color: "text-muted-foreground",
    label: "Not connected",
  },
  connecting: {
    icon: Loader2,
    color: "text-blue-400",
    label: "Connecting...",
  },
  syncing: {
    icon: Loader2,
    color: "text-amber-400",
    label: "Syncing...",
  },
  synced: {
    icon: Cloud,
    color: "text-emerald-400",
    label: "Synced",
  },
  error: {
    icon: CloudOff,
    color: "text-destructive",
    label: "Sync error",
  },
};

export const SyncStatusIndicator = memo(() => {
  const { connectionState, isCollaborating } = useCollaboration();
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const currentWorkspace = useKanbanStore((state) =>
    currentWorkspaceId ? state.workspaces.byId[currentWorkspaceId] : null
  );
  const shareUrl = useKanbanStore((state) =>
    currentWorkspaceId ? state.workspaceShareUrls[currentWorkspaceId] : null
  );

  const isSharedWorkspace = currentWorkspace?.isShared === true || !!shareUrl;

  if (!isSharedWorkspace) {
    return null;
  }

  let syncState: SyncState = "disconnected";
  if (connectionState === "connecting") {
    syncState = "connecting";
  } else if (connectionState === "connected") {
    syncState = isCollaborating ? "synced" : "syncing";
  } else if (connectionState === "error") {
    syncState = "error";
  }

  const config = stateConfig[syncState];
  const Icon = config.icon;
  const isAnimating = syncState === "connecting" || syncState === "syncing";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          className="flex h-8 w-8 cursor-default items-center justify-center rounded-full bg-card/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
          data-testid="sync-status-indicator"
          initial={{ opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              animate={{
                rotate: isAnimating ? 360 : 0,
              }}
              key={syncState}
              transition={{
                rotate: isAnimating
                  ? {
                      repeat: Number.POSITIVE_INFINITY,
                      duration: 1,
                      ease: "linear",
                    }
                  : { duration: 0 },
              }}
            >
              <Icon className={`h-3.5 w-3.5 ${config.color}`} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">{config.label}</p>
      </TooltipContent>
    </Tooltip>
  );
});

SyncStatusIndicator.displayName = "SyncStatusIndicator";
