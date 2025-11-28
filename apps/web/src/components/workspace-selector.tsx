"use client";

import { Building2, Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { useKanbanStore } from "../features/kanban/store/kanban-store";

export function WorkspaceSelector() {
  const workspaces = useKanbanStore((state) => state.workspaces);
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const setCurrentWorkspace = useKanbanStore(
    (state) => state.setCurrentWorkspace
  );
  const addWorkspace = useKanbanStore((state) => state.addWorkspace);
  const deleteWorkspace = useKanbanStore((state) => state.deleteWorkspace);
  const resetWorkspace = useKanbanStore((state) => state.resetWorkspace);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");
  const [showDangerDialog, setShowDangerDialog] = useState(false);

  const currentWorkspace = currentWorkspaceId
    ? workspaces.byId[currentWorkspaceId]
    : null;

  const defaultWorkspaceId = workspaces.allIds[0];
  const isDefaultCurrent =
    currentWorkspaceId != null && currentWorkspaceId === defaultWorkspaceId;

  const handleCreateWorkspace = () => {
    if (!newWorkspaceName.trim()) {
      return;
    }

    const newWorkspaceId = addWorkspace(
      newWorkspaceName.trim(),
      newWorkspaceDescription.trim() || undefined
    );

    setCurrentWorkspace(newWorkspaceId);
    setShowCreateDialog(false);
    setNewWorkspaceName("");
    setNewWorkspaceDescription("");
  };

  const handleConfirmWorkspaceDanger = () => {
    if (!currentWorkspaceId) {
      setShowDangerDialog(false);
      return;
    }

    if (isDefaultCurrent) {
      resetWorkspace(currentWorkspaceId);
    } else {
      deleteWorkspace(currentWorkspaceId);
    }

    setShowDangerDialog(false);
  };

  return (
    <>
      <div className="pointer-events-auto fixed top-4 left-4 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-10 gap-2 rounded-xl border-2 border-border/50 bg-card/95 px-4 font-medium shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md transition-all hover:bg-card/98 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)] dark:hover:bg-card/98"
              size="sm"
              variant="ghost"
            >
              <Building2 className="h-4 w-4" />
              <span className="max-w-[150px] truncate text-sm">
                {currentWorkspace?.name || "Select Workspace"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-64 rounded-xl border-2 border-border/50 bg-card/95 p-2 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          >
            {workspaces.allIds.length > 0 ? (
              <>
                {workspaces.allIds.map((wsId) => {
                  const workspace = workspaces.byId[wsId];
                  if (!workspace) {
                    return null;
                  }
                  return (
                    <DropdownMenuItem
                      className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-accent/50 focus:bg-accent/50 dark:focus:bg-accent/30 dark:hover:bg-accent/30"
                      key={workspace.id}
                      onClick={() => setCurrentWorkspace(workspace.id)}
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium text-sm">
                          {workspace.name}
                        </span>
                        {workspace.description && (
                          <span className="truncate text-muted-foreground text-xs">
                            {workspace.description}
                          </span>
                        )}
                      </div>
                      {currentWorkspaceId === workspace.id && (
                        <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator className="my-2 bg-border/50" />
              </>
            ) : (
              <div className="px-3 py-2 text-center text-muted-foreground text-sm">
                No workspaces yet
              </div>
            )}
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 font-medium transition-colors hover:bg-accent/50 focus:bg-accent/50 dark:focus:bg-accent/30 dark:hover:bg-accent/30"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4" />
              <span>Create Workspace</span>
            </DropdownMenuItem>
            {currentWorkspace && (
              <>
                <DropdownMenuSeparator className="my-2 bg-border/50" />
                <div className="px-2 pb-1">
                  <Button
                    className="w-full justify-start gap-2 rounded-lg border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => setShowDangerDialog(true)}
                    size="sm"
                    variant="outline"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>
                      {isDefaultCurrent
                        ? "Reset Default Workspace"
                        : "Delete Workspace"}
                    </span>
                  </Button>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog onOpenChange={setShowCreateDialog} open={showCreateDialog}>
        <DialogContent className="rounded-2xl border-2 border-border/50 bg-card/95 shadow-[0_4px_24px_rgba(0,0,0,0.2),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md sm:max-w-[425px] dark:shadow-[0_4px_24px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
          <DialogHeader className="border-border/50 border-b pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Building2 className="h-5 w-5" />
              Create Workspace
            </DialogTitle>
            <DialogDescription>
              Create a new workspace to organize your boards and tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Name</Label>
              <Input
                autoFocus
                className="rounded-lg border-2 border-border/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] focus-visible:ring-2 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
                id="workspace-name"
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newWorkspaceName.trim()) {
                    handleCreateWorkspace();
                  }
                }}
                placeholder="e.g., Personal, Work, Team Alpha"
                value={newWorkspaceName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-description">
                Description (Optional)
              </Label>
              <Textarea
                className="min-h-20 resize-none rounded-lg border-2 border-border/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] focus-visible:ring-2 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]"
                id="workspace-description"
                onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                placeholder="Add a description for this workspace..."
                value={newWorkspaceDescription}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-border/50 border-t pt-4">
            <Button
              className="rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.08)]"
              onClick={() => {
                setShowCreateDialog(false);
                setNewWorkspaceName("");
                setNewWorkspaceDescription("");
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="rounded-lg bg-primary shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.2)] hover:bg-primary/90 dark:shadow-[0_2px_8px_rgba(0,0,0,0.6),inset_0_2px_3px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
              disabled={!newWorkspaceName.trim()}
              onClick={handleCreateWorkspace}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setShowDangerDialog} open={showDangerDialog}>
        <AlertDialogContent className="rounded-2xl border-2 border-border/50 bg-card/95 shadow-[0_4px_24px_rgba(0,0,0,0.2),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md sm:max-w-[425px] dark:shadow-[0_4px_24px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              <Trash2 className="h-5 w-5 text-destructive" />
              {isDefaultCurrent
                ? "Reset Default Workspace"
                : "Delete Workspace"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isDefaultCurrent
                ? "This will remove all boards in your default workspace, but keep the workspace itself."
                : "This will permanently delete the current workspace and all of its boards. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 border-border/50 border-t pt-4">
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-destructive text-destructive-foreground shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.2)] hover:bg-destructive/90 dark:shadow-[0_2px_8px_rgba(0,0,0,0.6),inset_0_2px_3px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
              onClick={handleConfirmWorkspaceDanger}
            >
              {isDefaultCurrent ? "Reset" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
