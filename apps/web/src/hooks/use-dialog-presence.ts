"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type Collaborator,
  type OpenDialog,
  useCollaboration,
} from "@/src/features/collab";

/**
 * Centralized hook for dialog presence indicators.
 * Key insight: Awareness stores which dialogs EACH USER has open.
 * To show presence on a dialog:
 * 1. Local user broadcasts their focused dialog via `registerDialogFocus()`
 * 2. Other users see this in `collaborators[x].openDialogs`
 * 3. Each dialog checks if any collaborator has it in their openDialogs
 */
export function useDialogPresence() {
  const { isCollaborating, updateOpenDialogs, collaborators, localUser } =
    useCollaboration();

  // Register that the local user is focused on a dialog.
  // Call this when a dialog opens or receives focus.
  const registerDialogFocus = useCallback(
    (dialog: OpenDialog) => {
      if (!isCollaborating) {
        return;
      }
      updateOpenDialogs([dialog]);
    },
    [isCollaborating, updateOpenDialogs]
  );

  // Clear local user's dialog focus.
  // Call this when clicking away from dialogs or when all dialogs close.
  const clearDialogFocus = useCallback(() => {
    if (!isCollaborating) {
      return;
    }
    updateOpenDialogs([]);
  }, [isCollaborating, updateOpenDialogs]);

  // Check if a specific dialog has presence from a collaborator.
  // Returns the collaborator who has this dialog focused, or undefined.
  const getDialogCollaborator = useCallback(
    (dialogId: string): Collaborator | undefined => {
      if (!isCollaborating) {
        return;
      }

      // Find any collaborator (not local user) who has this dialog in their openDialogs
      return collaborators.find((collab) => {
        // Skip if no openDialogs
        if (!collab.openDialogs || collab.openDialogs.length === 0) {
          return false;
        }
        // Check if this collaborator has the specified dialog focused
        return collab.openDialogs.some((d) => d.id === dialogId);
      });
    },
    [isCollaborating, collaborators]
  );

  // Check if a collaborator has any dialog focused for a specific target (board/column/task).
  const getTargetDialogCollaborator = useCallback(
    (targetId: string): Collaborator | undefined => {
      if (!isCollaborating) {
        return;
      }

      return collaborators.find((collab) => {
        if (!collab.openDialogs || collab.openDialogs.length === 0) {
          return false;
        }
        return collab.openDialogs.some((d) => d.targetId === targetId);
      });
    },
    [isCollaborating, collaborators]
  );

  const collaboratorsWithDialogs = useMemo(() => {
    if (!isCollaborating) {
      return [];
    }
    return collaborators.filter(
      (c) => c.openDialogs && c.openDialogs.length > 0
    );
  }, [isCollaborating, collaborators]);

  return {
    registerDialogFocus,
    clearDialogFocus,
    getDialogCollaborator,
    getTargetDialogCollaborator,
    getBoardDialogCollaborator: getTargetDialogCollaborator,
    collaboratorsWithDialogs,
    isCollaborating,
    collaborators,
    localUser,
  };
}

// Hook to use on individual dialog components.
// Automatically handles registration on mount and cleanup on unmount.
export function useDialogPresenceLifecycle(
  dialogId: string,
  dialogType: OpenDialog["type"],
  targetId: string,
  options?: {
    autoRegisterOnMount?: boolean;
    dialogData?: Record<string, unknown>;
  }
) {
  const { isCollaborating, updateOpenDialogs, collaborators } =
    useCollaboration();

  const { autoRegisterOnMount = false, dialogData } = options ?? {};

  // Track if we've registered to prevent duplicate registrations
  const hasRegisteredRef = useRef(false);

  // Get the collaborator who has this dialog focused
  const dialogCollaborator = useMemo(() => {
    if (!isCollaborating) {
      return;
    }

    return collaborators.find((collab) => {
      if (!collab.openDialogs || collab.openDialogs.length === 0) {
        return false;
      }
      return collab.openDialogs.some((d) => d.id === dialogId);
    });
  }, [isCollaborating, collaborators, dialogId]);

  // Create the dialog object
  const dialogObj = useMemo(
    (): OpenDialog => ({
      id: dialogId,
      type: dialogType,
      targetId,
      data: dialogData,
    }),
    [dialogId, dialogType, targetId, dialogData]
  );

  // Keep track of previous dialog object so we can detect identity changes
  const previousDialogRef = useRef<OpenDialog>(dialogObj);

  // Handle pointer down to claim presence
  const handleDialogPointerDown = useCallback(() => {
    if (!isCollaborating) {
      return;
    }
    updateOpenDialogs([dialogObj]);
    hasRegisteredRef.current = true;
  }, [isCollaborating, updateOpenDialogs, dialogObj]);

  // Auto-register on mount if option is enabled, and handle cleanup on unmount
  // biome-ignore lint/correctness/useExhaustiveDependencies: We only want to run this on mount/unmount
  useEffect(() => {
    if (!isCollaborating) {
      return;
    }

    if (autoRegisterOnMount && !hasRegisteredRef.current) {
      updateOpenDialogs([dialogObj]);
      hasRegisteredRef.current = true;
    }

    return () => {
      // Only clear if we were the one who registered it
      if (hasRegisteredRef.current) {
        updateOpenDialogs([]);
        hasRegisteredRef.current = false;
      }
    };
    // Crucially, we do NOT include dialogObj in dependencies here
    // We only want to run this on mount/unmount or if autoRegisterOnMount changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollaborating, autoRegisterOnMount, updateOpenDialogs]);

  // If dialogObj changes while we are registered, update our presence
  useEffect(() => {
    if (
      isCollaborating &&
      hasRegisteredRef.current &&
      (previousDialogRef.current.id !== dialogObj.id ||
        previousDialogRef.current.targetId !== dialogObj.targetId)
    ) {
      updateOpenDialogs([dialogObj]);
    }

    previousDialogRef.current = dialogObj;
  }, [isCollaborating, updateOpenDialogs, dialogObj]);

  return {
    dialogCollaborator,
    handleDialogPointerDown,
    isCollaborating,
  };
}
