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
    const newBoard = {
      id: `board-${Date.now()}`,
      name: "New Board",
      description: "New project board",
      created_by: "user1",
      created_at: new Date().toISOString(),
      columns: [
        {
          id: `col-1-${Math.random()}`,
          board_id: `board-${Date.now()}`,
          name: "To Do",
          position: 0,
          tasks: [],
        },
        {
          id: `col-2-${Math.random()}`,
          board_id: `board-${Date.now()}`,
          name: "In Progress",
          position: 1,
          tasks: [],
        },
        {
          id: `col-3-${Math.random()}`,
          board_id: `board-${Date.now()}`,
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
      action: () => console.log("Search"),
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
        <div className="overflow-hidden rounded border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-border border-b px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              className="border-0 bg-transparent text-sm focus-visible:ring-0"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands..."
              value={query}
            />
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setShowCommandPalette(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {filteredCommands.length > 0 ? (
              <div className="py-2">
                {filteredCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary/60"
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
            ) : (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                No commands found
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
});

CommandPalette.displayName = "CommandPalette";
