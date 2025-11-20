"use client";

import { Plus, Search, X, Zap } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { Input } from "@/src/components/ui/input";
import { useKanbanStore } from "../store/kanban-store";

export const CommandPalette = memo(() => {
  const showCommandPalette = useKanbanStore(
    (state) => state.showCommandPalette
  );
  const setShowCommandPalette = useKanbanStore(
    (state) => state.setShowCommandPalette
  );
  const boards = useKanbanStore((state) => state.boards);
  const currentWorkspace = useKanbanStore((state) => state.currentWorkspace);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette(!showCommandPalette);
      }
      if (e.key === "Escape" && showCommandPalette) {
        setShowCommandPalette(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCommandPalette, setShowCommandPalette]);

  if (!showCommandPalette) {
    return null;
  }

  const handleNewBoard = () => {
    const boardId = `board-${Date.now()}`;
    const newBoard = {
      id: boardId,
      name: "New Board",
      description: "New project board",
      workspace_id: currentWorkspace?.id ?? "",
      created_by: "user1",
      created_at: new Date().toISOString(),
      columns: [
        {
          id: `col-1-${Math.random()}`,
          board_id: boardId,
          name: "To Do",
          position: 0,
          tasks: [],
        },
        {
          id: `col-2-${Math.random()}`,
          board_id: boardId,
          name: "In Progress",
          position: 1,
          tasks: [],
        },
        {
          id: `col-3-${Math.random()}`,
          board_id: boardId,
          name: "Done",
          position: 2,
          tasks: [],
        },
      ],
    };

    useKanbanStore.getState().addBoard(newBoard, {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
    });
    setShowCommandPalette(false);
  };

  const commands = [
    {
      id: "new-board",
      label: "New Board",
      icon: Plus,
      action: handleNewBoard,
    },
    {
      id: "search",
      label: "Search Tasks",
      icon: Search,
      action: () => {
        // TODO: Implement task search functionality
      },
    },
    {
      id: "quick-action",
      label: "Quick Actions",
      icon: Zap,
      action: () => console.log("Quick Actions"),
    },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const workspaceBoards = currentWorkspace
    ? boards.filter(
        (board) =>
          !board.workspace_id || board.workspace_id === currentWorkspace.id
      )
    : boards;

  const searchResults =
    query.trim().length === 0
      ? []
      : workspaceBoards.flatMap((board) =>
          (board.columns || []).flatMap((column) =>
            (column.tasks || [])
              .filter((task) => {
                const q = query.toLowerCase();
                return (
                  task.title.toLowerCase().includes(q) ||
                  (task.description || "").toLowerCase().includes(q) ||
                  (task.tags || []).some((tag) => tag.toLowerCase().includes(q))
                );
              })
              .map((task) => ({
                boardName: board.name,
                columnName: column.name,
                taskTitle: task.title,
                taskId: task.id,
              }))
          )
        );

  return (
    <>
      <button
        aria-label="Close command palette"
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => setShowCommandPalette(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setShowCommandPalette(false);
          }
        }}
        type="button"
      />

      <div className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 w-full max-w-md">
        <div className="overflow-hidden rounded-lg border-2 border-border/50 bg-card shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2 border-border border-b px-4 py-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              className="border-0 bg-transparent text-sm focus-visible:ring-0"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands..."
              value={query}
            />
            <button
              className="rounded-full bg-card/50 p-1 text-muted-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:text-foreground dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
              onClick={() => setShowCommandPalette(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {(() => {
              if (query.trim().length === 0) {
                if (filteredCommands.length > 0) {
                  return (
                    <div className="py-2">
                      {filteredCommands.map((cmd) => {
                        const Icon = cmd.icon;
                        return (
                          <button
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-secondary/60 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
                            key={cmd.id}
                            onClick={() => {
                              cmd.action?.();
                              setQuery("");
                            }}
                            type="button"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span>{cmd.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                }
                return (
                  <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No commands found
                  </div>
                );
              }
              if (searchResults.length > 0) {
                return (
                  <div className="py-2">
                    {searchResults.map((result) => (
                      <div
                        className="flex flex-col gap-0.5 px-4 py-2 text-sm"
                        key={result.taskId}
                      >
                        <div className="font-medium text-card-foreground">
                          {result.taskTitle}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {result.boardName} • {result.columnName}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No tasks match "{query}"
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
});

CommandPalette.displayName = "CommandPalette";
