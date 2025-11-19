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
        className="gap-2 rounded-full border border-border bg-card text-foreground hover:bg-secondary/60"
        onClick={() => setIsOpen(!isOpen)}
        size="sm"
        title="Switch workspace"
        variant="ghost"
      >
        <span className="max-w-[120px] truncate font-medium text-xs">
          {currentWorkspace.name}
        </span>
        <ChevronDown className="h-4 w-4" />
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
          <div className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded border border-border bg-card shadow-lg">
            {/* Workspace list */}
            <div className="max-h-64 overflow-y-auto">
              {workspaces.map((workspace) => (
                <button
                  className={`w-full border-border border-b px-4 py-3 text-left transition-colors last:border-b-0 ${
                    workspace.id === currentWorkspace.id
                      ? "bg-secondary/50 text-foreground"
                      : "text-foreground hover:bg-secondary/20"
                  }`}
                  key={workspace.id}
                  onClick={() => {
                    setCurrentWorkspace(workspace);
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  <div className="font-medium text-sm">{workspace.name}</div>
                  {workspace.description && (
                    <div className="truncate text-muted-foreground text-xs">
                      {workspace.description}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Create workspace section */}
            <div className="space-y-2 border-border border-t p-3">
              {isCreating ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 rounded-lg text-xs"
                      disabled={!newWorkspaceName.trim()}
                      onClick={handleCreateWorkspace}
                      size="sm"
                    >
                      Create
                    </Button>
                    <Button
                      className="flex-1 rounded-lg text-xs"
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
                  className="w-full justify-center gap-2 rounded-lg"
                  onClick={() => setIsCreating(true)}
                  size="sm"
                  variant="ghost"
                >
                  <Plus className="h-4 w-4" />
                  New Workspace
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
