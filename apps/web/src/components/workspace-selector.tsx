"use client";

import { Building2, Check, Plus, User, Users } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { CreateWorkspaceDialog } from "@/src/components/dialogs/create-workspace-dialog";
import { DeleteWorkspaceDialog } from "@/src/components/dialogs/delete-workspace-dialog";
import { DuplicateWorkspaceDialog } from "@/src/components/dialogs/duplicate-workspace-dialog";
import { RenameWorkspaceDialog } from "@/src/components/dialogs/rename-workspace-dialog";
import { ResetWorkspaceDialog } from "@/src/components/dialogs/reset-workspace-dialog";
import { SharedWorkspaceQuickActions } from "@/src/components/shared-workspace-quick-actions";
import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { WorkspaceQuickActions } from "@/src/components/workspace-quick-actions";
import { useAuth } from "@/src/hooks/use-auth";
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
  const updateWorkspace = useKanbanStore((state) => state.updateWorkspace);
  const deleteWorkspace = useKanbanStore((state) => state.deleteWorkspace);
  const resetWorkspace = useKanbanStore((state) => state.resetWorkspace);
  const boards = useKanbanStore((state) => state.boards);
  const columns = useKanbanStore((state) => state.columns);
  const duplicateWorkspace = useKanbanStore(
    (state) => state.duplicateWorkspace
  );

  // Persistent quick actions state from store
  const workspaceQuickActions = useKanbanStore(
    (state) => state.workspaceQuickActions
  );
  const openWorkspaceQuickActions = useKanbanStore(
    (state) => state.openWorkspaceQuickActions
  );
  const closeWorkspaceQuickActions = useKanbanStore(
    (state) => state.closeWorkspaceQuickActions
  );
  const updateWorkspaceQuickActionsPosition = useKanbanStore(
    (state) => state.updateWorkspaceQuickActionsPosition
  );

  // Persistent dialog state from store
  const workspaceDialog = useKanbanStore((state) => state.workspaceDialog);
  const openWorkspaceDialog = useKanbanStore(
    (state) => state.openWorkspaceDialog
  );
  const closeWorkspaceDialog = useKanbanStore(
    (state) => state.closeWorkspaceDialog
  );
  const updateWorkspaceDialogPosition = useKanbanStore(
    (state) => state.updateWorkspaceDialogPosition
  );
  const updateWorkspaceDialogInputValue = useKanbanStore(
    (state) => state.updateWorkspaceDialogInputValue
  );

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const actionButtonRefs = useRef<{
    rename: HTMLButtonElement | null;
    reset: HTMLButtonElement | null;
    duplicate: HTMLButtonElement | null;
    delete: HTMLButtonElement | null;
  }>({ rename: null, reset: null, duplicate: null, delete: null });

  const currentWorkspace = currentWorkspaceId
    ? workspaces.byId[currentWorkspaceId]
    : null;

  const { user } = useAuth();

  const myWorkspaces = workspaces.allIds.filter((id) => {
    const ws = workspaces.byId[id];
    // Include if owner (or no owner info yet)
    return ws && (!ws.ownerId || (user && ws.ownerId === user.id));
  });

  const sharedWithMeWorkspaces = workspaces.allIds.filter((id) => {
    const ws = workspaces.byId[id];
    // Include if valid user and owner exists but is NOT current user
    return ws && user && ws.ownerId && ws.ownerId !== user.id;
  });

  const defaultWorkspaceId = myWorkspaces[0];

  const quickActionsWorkspace = workspaceQuickActions
    ? workspaces.byId[workspaceQuickActions.workspaceId]
    : null;

  const getButtonRect = useCallback(() => {
    if (buttonRef.current) {
      return buttonRef.current.getBoundingClientRect();
    }
    return null;
  }, []);

  const getSourceButtonRect = useCallback(() => {
    if (workspaceDialog?.type) {
      const ref = actionButtonRefs.current[workspaceDialog.type];
      if (ref) {
        return ref.getBoundingClientRect();
      }
    }
    return null;
  }, [workspaceDialog?.type]);

  const handleCreateWorkspace = useCallback(
    (name: string, description?: string) => {
      const newWorkspaceId = addWorkspace(name, description);
      setCurrentWorkspace(newWorkspaceId);
    },
    [addWorkspace, setCurrentWorkspace]
  );

  const handleRenameWorkspace = useCallback(
    (newName: string) => {
      if (workspaceDialog?.workspaceId) {
        updateWorkspace(workspaceDialog.workspaceId, { name: newName });
      }
    },
    [workspaceDialog, updateWorkspace]
  );

  const handleResetWorkspace = useCallback(
    (options: { clearBoardsAndColumns: boolean }) => {
      if (workspaceDialog?.workspaceId) {
        resetWorkspace(workspaceDialog.workspaceId, options);
        closeWorkspaceQuickActions();
      }
    },
    [workspaceDialog, resetWorkspace, closeWorkspaceQuickActions]
  );

  const resetDialogCounts = useMemo(() => {
    if (!workspaceDialog?.workspaceId) {
      return { taskCount: 0, boardCount: 0, columnCount: 0 };
    }

    const workspace = workspaces.byId[workspaceDialog.workspaceId];
    if (!workspace) {
      return { taskCount: 0, boardCount: 0, columnCount: 0 };
    }

    let taskCount = 0;
    let columnCount = 0;
    const boardCount = workspace.board_ids.length;

    for (const boardId of workspace.board_ids) {
      const board = boards.byId[boardId];
      if (board) {
        columnCount += board.column_ids.length;
        for (const columnId of board.column_ids) {
          const column = columns.byId[columnId];
          if (column) {
            taskCount += column.task_ids.length;
          }
        }
      }
    }

    return { taskCount, boardCount, columnCount };
  }, [
    workspaceDialog?.workspaceId,
    workspaces.byId,
    boards.byId,
    columns.byId,
  ]);

  const handleDeleteWorkspace = useCallback(() => {
    if (workspaceDialog?.workspaceId) {
      deleteWorkspace(workspaceDialog.workspaceId);
    }
  }, [workspaceDialog, deleteWorkspace]);

  const handleDuplicateWorkspace = useCallback(
    (newName: string) => {
      if (workspaceDialog?.workspaceId) {
        const newId = duplicateWorkspace(workspaceDialog.workspaceId, newName);
        if (newId) {
          setCurrentWorkspace(newId);
        }
      }
    },
    [workspaceDialog, duplicateWorkspace, setCurrentWorkspace]
  );

  const handleWorkspaceContextMenu = useCallback(
    (e: React.MouseEvent, workspaceId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDropdownOpen(false);
      openWorkspaceQuickActions(workspaceId, { x: 220, y: 16 });
    },
    [openWorkspaceQuickActions]
  );

  const handleOpenDialog = useCallback(
    (
      type: "rename" | "reset" | "delete" | "duplicate",
      workspaceId: string,
      actionButtonRef: React.RefObject<HTMLButtonElement | null>
    ) => {
      const workspace = workspaces.byId[workspaceId];
      if (workspace && actionButtonRef.current) {
        const rect = actionButtonRef.current.getBoundingClientRect();
        actionButtonRefs.current[type] = actionButtonRef.current;
        openWorkspaceDialog({
          type,
          workspaceId,
          workspaceName: workspace.name,
          position: {
            x: rect.right + 40,
            y: rect.top - 30,
          },
        });
      }
    },
    [workspaces.byId, openWorkspaceDialog]
  );

  const handleDropdownOpenChange = useCallback(
    (open: boolean) => {
      setDropdownOpen(open);
      if (open) {
        closeWorkspaceQuickActions();
        closeWorkspaceDialog();
      }
    },
    [closeWorkspaceQuickActions, closeWorkspaceDialog]
  );

  const handleLeaveWorkspaceClick = useCallback(
    (ref: React.RefObject<HTMLButtonElement | null>) => {
      if (quickActionsWorkspace) {
        handleOpenDialog("delete", quickActionsWorkspace.id, ref);
      }
    },
    [quickActionsWorkspace, handleOpenDialog]
  );

  return (
    <>
      <div className="pointer-events-auto fixed top-4 left-4 z-50">
        <DropdownMenu
          onOpenChange={handleDropdownOpenChange}
          open={dropdownOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button
              className="h-10 gap-2 rounded-xl border-2 border-border/50 bg-card/95 px-4 font-medium shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md transition-all hover:bg-card/98 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)] dark:hover:bg-card/98"
              onContextMenu={(e) => {
                if (currentWorkspaceId) {
                  e.preventDefault();
                  setDropdownOpen(false);
                  openWorkspaceQuickActions(currentWorkspaceId, {
                    x: 220,
                    y: 16,
                  });
                }
              }}
              ref={buttonRef}
              size="sm"
              variant="ghost"
            >
              <Building2 className="h-4 w-4" />
              <span className="max-w-37.5 truncate text-sm">
                {currentWorkspace?.name || "Select Workspace"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-64 rounded-xl border-2 border-border/50 bg-card/95 p-2 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          >
            <div className="px-2 py-1.5 font-semibold text-muted-foreground text-xs">
              My Workspaces
            </div>
            {myWorkspaces.length > 0 ? (
              myWorkspaces.map((wsId) => {
                const workspace = workspaces.byId[wsId];
                if (!workspace) {
                  return null;
                }
                return (
                  <DropdownMenuItem
                    className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-accent/50 focus:bg-accent/50 dark:focus:bg-accent/30 dark:hover:bg-accent/30"
                    key={workspace.id}
                    onClick={() => setCurrentWorkspace(workspace.id)}
                    onContextMenu={(e) =>
                      handleWorkspaceContextMenu(e, workspace.id)
                    }
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-sm">
                          {workspace.name}
                        </span>
                        {workspace.isShared && (
                          <div className="flex items-center gap-1 rounded bg-zinc-500/10 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-400">
                            <Users size={2} />
                            <span className="font-medium text-[10px]">
                              SHARED
                            </span>
                          </div>
                        )}
                      </div>
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
              })
            ) : (
              <div className="px-3 py-2 text-center text-muted-foreground text-sm">
                No workspaces
              </div>
            )}

            {sharedWithMeWorkspaces.length > 0 && (
              <>
                <DropdownMenuSeparator className="my-2 bg-border/50" />
                <div className="px-2 py-1.5 font-semibold text-muted-foreground text-xs">
                  Shared with Me
                </div>
                {sharedWithMeWorkspaces.map((wsId) => {
                  const workspace = workspaces.byId[wsId];
                  if (!workspace) {
                    return null;
                  }
                  return (
                    <DropdownMenuItem
                      className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-accent/50 focus:bg-accent/50 dark:focus:bg-accent/30 dark:hover:bg-accent/30"
                      key={workspace.id}
                      onClick={() => setCurrentWorkspace(workspace.id)}
                      onContextMenu={(e) =>
                        handleWorkspaceContextMenu(e, workspace.id)
                      }
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate font-medium text-sm">
                            {workspace.name}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {workspace.ownerImage ? (
                            // biome-ignore lint/performance/noImgElement: External user avatars
                            <img
                              alt=""
                              className="h-3 w-3 rounded-full"
                              height={12}
                              src={workspace.ownerImage}
                              width={12}
                            />
                          ) : (
                            <User className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="truncate text-muted-foreground text-xs">
                            {workspace.ownerName || "Unknown Owner"}
                          </span>
                        </div>
                      </div>
                      {currentWorkspaceId === workspace.id && (
                        <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}
            <DropdownMenuSeparator className="my-2 bg-border/50" />
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 font-medium transition-colors hover:bg-accent/50 focus:bg-accent/50 dark:focus:bg-accent/30 dark:hover:bg-accent/30"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4" />
              <span>Create Workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {workspaceQuickActions &&
        quickActionsWorkspace &&
        (quickActionsWorkspace.isShared ? (
          <SharedWorkspaceQuickActions
            getButtonRect={getButtonRect}
            onClose={closeWorkspaceQuickActions}
            onLeave={handleLeaveWorkspaceClick}
            onPositionChange={updateWorkspaceQuickActionsPosition}
            ownerImage={quickActionsWorkspace.ownerImage}
            ownerName={quickActionsWorkspace.ownerName || "Unknown"}
            position={workspaceQuickActions.position}
            workspaceId={workspaceQuickActions.workspaceId}
            workspaceName={quickActionsWorkspace.name}
          />
        ) : (
          <WorkspaceQuickActions
            getButtonRect={getButtonRect}
            isDefaultWorkspace={
              workspaceQuickActions.workspaceId === defaultWorkspaceId
            }
            onClose={closeWorkspaceQuickActions}
            onDelete={(ref) =>
              handleOpenDialog("delete", workspaceQuickActions.workspaceId, ref)
            }
            onDuplicate={(ref) =>
              handleOpenDialog(
                "duplicate",
                workspaceQuickActions.workspaceId,
                ref
              )
            }
            onPositionChange={updateWorkspaceQuickActionsPosition}
            onRename={(ref) =>
              handleOpenDialog("rename", workspaceQuickActions.workspaceId, ref)
            }
            onReset={(ref) =>
              handleOpenDialog("reset", workspaceQuickActions.workspaceId, ref)
            }
            position={workspaceQuickActions.position}
            workspaceId={workspaceQuickActions.workspaceId}
            workspaceName={quickActionsWorkspace.name}
          />
        ))}

      {showCreateDialog && (
        <CreateWorkspaceDialog
          onClose={() => setShowCreateDialog(false)}
          onCreate={handleCreateWorkspace}
        />
      )}

      {workspaceDialog?.type === "rename" && (
        <RenameWorkspaceDialog
          currentName={workspaceDialog.workspaceName}
          getSourceButtonRect={getSourceButtonRect}
          initialValue={workspaceDialog.inputValue}
          onClose={closeWorkspaceDialog}
          onInputChange={updateWorkspaceDialogInputValue}
          onPositionChange={updateWorkspaceDialogPosition}
          onRename={handleRenameWorkspace}
          position={workspaceDialog.position}
          quickActionsPosition={workspaceQuickActions?.position}
          workspaceId={workspaceDialog.workspaceId}
        />
      )}

      {workspaceDialog?.type === "reset" && (
        <ResetWorkspaceDialog
          boardCount={resetDialogCounts.boardCount}
          columnCount={resetDialogCounts.columnCount}
          getSourceButtonRect={getSourceButtonRect}
          onClose={closeWorkspaceDialog}
          onConfirm={handleResetWorkspace}
          onPositionChange={updateWorkspaceDialogPosition}
          position={workspaceDialog.position}
          quickActionsPosition={workspaceQuickActions?.position}
          taskCount={resetDialogCounts.taskCount}
          workspaceId={workspaceDialog.workspaceId}
          workspaceName={workspaceDialog.workspaceName}
        />
      )}

      {workspaceDialog?.type === "delete" && (
        <DeleteWorkspaceDialog
          getSourceButtonRect={getSourceButtonRect}
          onClose={closeWorkspaceDialog}
          onConfirm={handleDeleteWorkspace}
          onPositionChange={updateWorkspaceDialogPosition}
          position={workspaceDialog.position}
          workspaceName={workspaceDialog.workspaceName}
        />
      )}

      {workspaceDialog?.type === "duplicate" && (
        <DuplicateWorkspaceDialog
          boardCount={resetDialogCounts.boardCount}
          columnCount={resetDialogCounts.columnCount}
          currentName={workspaceDialog.workspaceName}
          getSourceButtonRect={getSourceButtonRect}
          initialValue={workspaceDialog.inputValue}
          onClose={closeWorkspaceDialog}
          onDuplicate={handleDuplicateWorkspace}
          onInputChange={updateWorkspaceDialogInputValue}
          onPositionChange={updateWorkspaceDialogPosition}
          position={workspaceDialog.position}
          taskCount={resetDialogCounts.taskCount}
        />
      )}
    </>
  );
}
