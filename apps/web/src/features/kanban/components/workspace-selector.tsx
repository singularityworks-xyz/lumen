"use client";

import { ChevronDown, Plus } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "../store/kanban-store";
import type { Workspace } from "../types";

export const WorkspaceSelector = memo(() => {
  const currentWorkspace = useKanbanStore((state) => state.currentWorkspace);
  const workspaces = useKanbanStore((state) => state.workspaces);
  const setCurrentWorkspace = useKanbanStore(
    (state) => state.setCurrentWorkspace
  );
  const addWorkspace = useKanbanStore((state) => state.addWorkspace);

  const [isOpen, setIsOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWorkspace = () => {
    if (newWorkspaceName.trim()) {
      const newWorkspace: Workspace = {
        id: `ws-${Date.now()}`,
        name: newWorkspaceName,
        created_at: new Date().toISOString(),
      };
      addWorkspace(newWorkspace);
      setCurrentWorkspace(newWorkspace);
      setNewWorkspaceName("");
      setIsCreating(false);
      setIsOpen(false);
    }
  };

  if (!currentWorkspace) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        className="gap-1.5 rounded-full border border-border/50 bg-card text-foreground hover:bg-secondary/70 dark:border-white/20"
        onClick={() => setIsOpen(!isOpen)}
        size="sm"
        title="Switch workspace"
        variant="ghost"
      >
        <span className="max-w-[100px] truncate font-medium text-[11px]">
          {currentWorkspace.name}
        </span>
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>

      {isOpen && (
        <>
          <button
            aria-label="Close workspace selector"
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setIsCreating(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
                setIsCreating(false);
              }
            }}
            type="button"
          />
          <div className="absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden rounded-lg border border-border/50 bg-card/95 shadow-xl backdrop-blur-md dark:border-white/20">
            {/* Workspace list */}
            <div className="max-h-64 overflow-y-auto">
              {workspaces.map((workspace) => (
                <button
                  className={`w-full border-border border-b px-3 py-2 text-left transition-colors last:border-b-0 ${
                    workspace.id === currentWorkspace.id
                      ? "bg-secondary/50 text-foreground"
                      : "text-foreground hover:bg-secondary/30"
                  }`}
                  key={workspace.id}
                  onClick={() => {
                    setCurrentWorkspace(workspace);
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  <div className="font-medium text-xs">{workspace.name}</div>
                  {workspace.description && (
                    <div className="truncate text-[10px] text-muted-foreground">
                      {workspace.description}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Create workspace section */}
            <div className="space-y-1.5 border-border border-t p-2">
              {isCreating ? (
                <div className="space-y-1.5">
                  <input
                    autoFocus
                    className="w-full rounded-lg border border-border bg-input px-2.5 py-1.5 text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCreateWorkspace();
                      }
                      if (e.key === "Escape") {
                        setIsCreating(false);
                      }
                    }}
                    placeholder="Workspace name..."
                    type="text"
                    value={newWorkspaceName}
                  />
                  <div className="flex gap-1.5">
                    <Button
                      className="flex-1 rounded-lg text-[10px]"
                      disabled={!newWorkspaceName.trim()}
                      onClick={handleCreateWorkspace}
                      size="sm"
                    >
                      Create
                    </Button>
                    <Button
                      className="flex-1 rounded-lg text-[10px]"
                      onClick={() => {
                        setIsCreating(false);
                        setNewWorkspaceName("");
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="w-full justify-center gap-1.5 rounded-lg"
                  onClick={() => setIsCreating(true)}
                  size="sm"
                  variant="ghost"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-[11px]">New Workspace</span>
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
});

WorkspaceSelector.displayName = "WorkspaceSelector";
