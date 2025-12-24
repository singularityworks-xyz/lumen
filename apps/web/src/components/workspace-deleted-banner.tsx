"use client";

import { AlertTriangle, Download } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";

export function WorkspaceDeletedBanner() {
  const deletedSharedWorkspaceId = useKanbanStore(
    (state) => state.deletedSharedWorkspaceId
  );
  const workspaces = useKanbanStore((state) => state.workspaces);
  const setDeletedSharedWorkspace = useKanbanStore(
    (state) => state.setDeletedSharedWorkspace
  );
  const duplicateWorkspace = useKanbanStore(
    (state) => state.duplicateWorkspace
  );
  const deleteWorkspace = useKanbanStore((state) => state.deleteWorkspace);
  const setCurrentWorkspace = useKanbanStore(
    (state) => state.setCurrentWorkspace
  );

  const workspace = deletedSharedWorkspaceId
    ? workspaces.byId[deletedSharedWorkspaceId]
    : null;

  const handleSaveToLocal = useCallback(async () => {
    if (!(deletedSharedWorkspaceId && workspace)) {
      return;
    }

    const newId = duplicateWorkspace(deletedSharedWorkspaceId, workspace.name);

    if (newId) {
      setCurrentWorkspace(newId);
      await deleteWorkspace(deletedSharedWorkspaceId);
      setDeletedSharedWorkspace(null);
    }
  }, [
    deletedSharedWorkspaceId,
    workspace,
    duplicateWorkspace,
    setCurrentWorkspace,
    deleteWorkspace,
    setDeletedSharedWorkspace,
  ]);

  const handleDismiss = useCallback(() => {
    setDeletedSharedWorkspace(null);
  }, [setDeletedSharedWorkspace]);

  if (!workspace) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 z-50 flex w-full max-w-2xl -translate-x-1/2 transform flex-col gap-2 rounded-xl border border-red-200/50 bg-red-50/95 p-4 shadow-xl backdrop-blur-md dark:border-red-900/50 dark:bg-red-900/40">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-900/50 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 dark:text-red-100">
            Workspace Deleted by Owner
          </h3>
          <p className="mt-1 text-red-700 text-sm dark:text-red-300">
            The workspace{" "}
            <span className="font-medium">"{workspace.name}"</span> has been
            deleted by the owner. It is no longer synchronized.
          </p>
          <div className="mt-4 flex gap-3">
            <Button
              className="gap-2 bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
              onClick={handleSaveToLocal}
              size="sm"
            >
              <Download className="h-4 w-4" />
              Save as Local Workspace
            </Button>
            <Button
              className="group gap-2 border-red-200 bg-transparent text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/50"
              onClick={handleDismiss}
              size="sm"
              variant="outline"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
