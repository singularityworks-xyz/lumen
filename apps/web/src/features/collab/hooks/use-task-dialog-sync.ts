"use client";

import { useCallback, useEffect, useRef } from "react";
import type * as Y from "yjs";
import { YJS_MAP_NAMES } from "@/src/features/collab/sync/entity-sync";
import { taskDetailModalSync } from "@/src/features/collab/sync/syncs";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { TaskDetailModalState } from "@/src/features/kanban/types";

const POSITION_THROTTLE_MS = 16;

/**
 * Dedicated sync hook for task detail modals.
 * This is separate from the main entity sync because task detail modals need special handling:
 * - Modals are "owned" by whoever opens them
 * - The owner's local state is authoritative
 * - We sync TO others but don't overwrite our own modals from Yjs
 * - Position updates are throttled to prevent overwhelming the sync
 */
export function useTaskDialogSync(
  doc: Y.Doc | null,
  isConnected: boolean
): void {
  // Track modals that WE opened (local ownership)
  const localModalIdsRef = useRef<Set<string>>(new Set());

  // Track last sync time per modal for throttling
  const lastSyncTimesRef = useRef<Record<string, number>>({});

  // Prevent re-entrancy during Yjs updates
  const isApplyingFromYjsRef = useRef(false);

  // Handle incoming changes from Yjs (modals opened by OTHER users)
  const applyRemoteModals = useCallback(() => {
    if (!doc || isApplyingFromYjsRef.current) {
      return;
    }

    isApplyingFromYjsRef.current = true;

    try {
      const yjsMap = doc.getMap(YJS_MAP_NAMES.TASK_DETAIL_MODALS);
      const currentState = useKanbanStore.getState();
      const currentModals = { ...currentState.taskDetailModals };
      let hasChanges = false;

      // Add/update modals from Yjs
      yjsMap.forEach((value, key) => {
        const modal = value as TaskDetailModalState;
        if (modal?.id && modal.taskId && modal.boardId && modal.position) {
          const existingModal = currentModals[key];

          // Validate the modal has required fields and position is valid, then check if update needed
          if (
            typeof modal.position.x === "number" &&
            typeof modal.position.y === "number" &&
            !Number.isNaN(modal.position.x) &&
            !Number.isNaN(modal.position.y) &&
            (!existingModal ||
              existingModal.position.x !== modal.position.x ||
              existingModal.position.y !== modal.position.y ||
              existingModal.position.y !== modal.position.y ||
              existingModal.isEditing !== modal.isEditing ||
              hasModalChanged(existingModal, modal))
          ) {
            currentModals[key] = modal;
            hasChanges = true;
          }
        }
      });

      // Remove modals that were deleted from Yjs
      // If a modal is not in Yjs, it should be removed locally regardless of who opened it
      // This ensures that when ANY user closes a modal, it's removed for everyone
      for (const id of Object.keys(currentModals)) {
        if (!yjsMap.has(id)) {
          delete currentModals[id];
          // Also clear local ownership tracking if it was ours
          localModalIdsRef.current.delete(id);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        useKanbanStore.setState({ taskDetailModals: currentModals });
      }
    } finally {
      isApplyingFromYjsRef.current = false;
    }
  }, [doc]);

  // Subscribe to Yjs changes for task detail modals
  useEffect(() => {
    if (!(doc && isConnected)) {
      return;
    }

    const yjsMap = doc.getMap(YJS_MAP_NAMES.TASK_DETAIL_MODALS);

    const handleYjsChange = () => {
      applyRemoteModals();
    };

    yjsMap.observe(handleYjsChange);

    // Initial sync
    applyRemoteModals();

    return () => {
      yjsMap.unobserve(handleYjsChange);
    };
  }, [doc, isConnected, applyRemoteModals]);

  // Sync our local modals TO Yjs
  useEffect(() => {
    if (!(doc && isConnected)) {
      return;
    }

    const unsubscribe = useKanbanStore.subscribe((state, prevState) => {
      if (isApplyingFromYjsRef.current) {
        return;
      }

      const currentModals = state.taskDetailModals;
      // Use Zustand's prevState for accurate previous state
      const prevModals = prevState.taskDetailModals;

      const now = Date.now();

      // Find added or changed modals - sync from ANY user
      for (const id of Object.keys(currentModals)) {
        const modal = currentModals[id];
        if (!modal) {
          continue;
        }

        const wasExisting = id in prevModals;

        if (wasExisting) {
          // Existing modal - check if it changed (allow any user to sync)
          const prevModal = prevModals[id];
          if (prevModal && hasModalChanged(prevModal, modal)) {
            // Check if this is a position-only change
            const isPositionOnly = isPositionOnlyChange(prevModal, modal);

            if (isPositionOnly) {
              // Throttle position updates
              const lastSync = lastSyncTimesRef.current[id] || 0;
              if (now - lastSync >= POSITION_THROTTLE_MS) {
                lastSyncTimesRef.current[id] = now;
                if (isValidModal(modal)) {
                  taskDetailModalSync.setInYjs(doc, modal);
                }
              }
            } else {
              // Non-position changes sync immediately
              lastSyncTimesRef.current[id] = now;
              if (isValidModal(modal)) {
                taskDetailModalSync.setInYjs(doc, modal);
              }
            }
          }
        } else {
          // New modal - mark as locally owned and sync immediately
          localModalIdsRef.current.add(id);
          lastSyncTimesRef.current[id] = now;

          if (isValidModal(modal)) {
            taskDetailModalSync.setInYjs(doc, modal);
          }
        }
      }

      // Find removed modals - allow any user to close modals from Yjs
      for (const id of Object.keys(prevModals)) {
        if (!(id in currentModals)) {
          taskDetailModalSync.deleteFromYjs(doc, id);
          localModalIdsRef.current.delete(id);
          delete lastSyncTimesRef.current[id];
        }
      }
    });

    return unsubscribe;
  }, [doc, isConnected]);

  // Clean up refs on disconnect
  useEffect(() => {
    if (!isConnected) {
      localModalIdsRef.current.clear();
      lastSyncTimesRef.current = {};
    }
  }, [isConnected]);
}

// Helper: Check if a modal has valid required fields
function isValidModal(modal: TaskDetailModalState): boolean {
  return !!(
    modal.id &&
    modal.taskId &&
    modal.boardId &&
    modal.position &&
    typeof modal.position.x === "number" &&
    typeof modal.position.y === "number" &&
    !Number.isNaN(modal.position.x) &&
    !Number.isNaN(modal.position.y) &&
    typeof modal.zIndex === "number" &&
    modal.sourceTaskId
  );
}

// Helper: Check if modal state changed
function hasModalChanged(
  prev: TaskDetailModalState,
  next: TaskDetailModalState
): boolean {
  return (
    prev.position.x !== next.position.x ||
    prev.position.y !== next.position.y ||
    prev.zIndex !== next.zIndex ||
    prev.isEditing !== next.isEditing ||
    prev.taskId !== next.taskId ||
    prev.boardId !== next.boardId ||
    prev.draftTitle !== next.draftTitle ||
    prev.draftDescription !== next.draftDescription ||
    prev.draftPriority !== next.draftPriority ||
    prev.draftProgress !== next.draftProgress ||
    prev.draftDueDate !== next.draftDueDate ||
    prev.draftTags !== next.draftTags ||
    prev.draftColumnId !== next.draftColumnId ||
    JSON.stringify(prev.draftChecklists) !==
      JSON.stringify(next.draftChecklists)
  );
}

// Helper: Check if only position changed
function isPositionOnlyChange(
  prev: TaskDetailModalState,
  next: TaskDetailModalState
): boolean {
  return (
    prev.taskId === next.taskId &&
    prev.boardId === next.boardId &&
    prev.sourceTaskId === next.sourceTaskId &&
    prev.zIndex === next.zIndex &&
    prev.isEditing === next.isEditing &&
    prev.draftTitle === next.draftTitle &&
    prev.draftDescription === next.draftDescription &&
    prev.draftPriority === next.draftPriority &&
    prev.draftProgress === next.draftProgress &&
    prev.draftDueDate === next.draftDueDate &&
    prev.draftTags === next.draftTags &&
    prev.draftColumnId === next.draftColumnId &&
    JSON.stringify(prev.draftChecklists) ===
      JSON.stringify(next.draftChecklists) &&
    (prev.position.x !== next.position.x || prev.position.y !== next.position.y)
  );
}
