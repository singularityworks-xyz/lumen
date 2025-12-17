"use client";

import { Plus, Redo2, Search, Undo2, X, Zap } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { Input } from "@/src/components/ui/input";
import {
  redo,
  undo,
  useCanRedo,
  useCanUndo,
  useKanbanStore,
} from "../../features/kanban/store/kanban-store";
import {
  useCurrentWorkspace,
  useShowWelcomeScreen,
} from "../../features/kanban/store/selectors";

type Command = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  shortcut?: string;
  disabled?: boolean;
};

const CommandButton = ({
  cmd,
  onAction,
}: {
  cmd: Command;
  onAction: () => void;
}) => {
  const Icon = cmd.icon;
  const isDisabled = cmd.disabled ?? false;

  return (
    <button
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)] ${
        isDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-secondary/60"
      }`}
      disabled={isDisabled}
      onClick={() => {
        if (!isDisabled) {
          cmd.action();
          onAction();
        }
      }}
      type="button"
    >
      <Icon
        className={`h-4 w-4 ${isDisabled ? "text-muted-foreground/50" : "text-muted-foreground"}`}
      />
      <span className={isDisabled ? "text-muted-foreground" : ""}>
        {cmd.label}
      </span>
      {cmd.shortcut && (
        <span className="ml-auto text-muted-foreground text-xs">
          {cmd.shortcut}
        </span>
      )}
    </button>
  );
};

export const CommandPalette = memo(() => {
  const showCommandPalette = useKanbanStore(
    (state) => state.showCommandPalette
  );
  const setShowCommandPalette = useKanbanStore(
    (state) => state.setShowCommandPalette
  );
  const boards = useKanbanStore((state) => state.boards);
  const columns = useKanbanStore((state) => state.columns);
  const tasks = useKanbanStore((state) => state.tasks);
  const addBoard = useKanbanStore((state) => state.addBoard);
  const currentWorkspace = useCurrentWorkspace();
  const canUndoAction = useCanUndo();
  const canRedoAction = useCanRedo();
  const showWelcomeScreen = useShowWelcomeScreen();
  const [query, setQuery] = useState("");

  const handleNewBoard = () => {
    if (!currentWorkspace) {
      return;
    }

    addBoard(
      "New Board",
      { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      "New project board"
    );
    setShowCommandPalette(false);
  };

  const handleUndo = () => {
    if (canUndoAction) {
      undo();
      setShowCommandPalette(false);
    }
  };

  const handleRedo = () => {
    if (canRedoAction) {
      redo();
      setShowCommandPalette(false);
    }
  };

  const commands: Command[] = [
    {
      id: "new-board",
      label: "New Board",
      icon: Plus,
      action: handleNewBoard,
      shortcut: "N",
    },
    {
      id: "undo",
      label: "Undo",
      icon: Undo2,
      action: handleUndo,
      shortcut: "⌘Z",
      disabled: !canUndoAction,
    },
    {
      id: "redo",
      label: "Redo",
      icon: Redo2,
      action: handleRedo,
      shortcut: "⌘⇧Z",
      disabled: !canRedoAction,
    },
    {
      id: "search",
      label: "Search Tasks",
      icon: Search,
      action: () => {
        // Focus on search when selected
      },
    },
    {
      id: "quick-action",
      label: "Quick Actions",
      icon: Zap,
      action: () => {
        // Placeholder for future quick actions
      },
    },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        if (showWelcomeScreen) {
          return;
        }
        e.preventDefault();
        setShowCommandPalette(!showCommandPalette);
      }
      if (e.key === "Escape" && showCommandPalette) {
        setShowCommandPalette(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCommandPalette, setShowCommandPalette, showWelcomeScreen]);

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const workspaceBoardIds = currentWorkspace?.board_ids ?? [];

  const searchResults = useMemo(() => {
    if (query.trim().length === 0) {
      return [];
    }

    const q = query.toLowerCase();
    const results: Array<{
      boardName: string;
      columnName: string;
      taskTitle: string;
      taskId: string;
    }> = [];

    for (const boardId of workspaceBoardIds) {
      const board = boards.byId[boardId];
      if (!board) {
        continue;
      }

      for (const columnId of board.column_ids) {
        const column = columns.byId[columnId];
        if (!column) {
          continue;
        }

        for (const taskId of column.task_ids) {
          const task = tasks.byId[taskId];
          if (!task) {
            continue;
          }

          const titleMatch = task.title.toLowerCase().includes(q);
          const descMatch = (task.description || "").toLowerCase().includes(q);
          const tagMatch = (task.tags || []).some((tag) =>
            tag.toLowerCase().includes(q)
          );

          if (titleMatch || descMatch || tagMatch) {
            results.push({
              boardName: board.name,
              columnName: column.name,
              taskTitle: task.title,
              taskId: task.id,
            });
          }
        }
      }
    }

    return results;
  }, [query, workspaceBoardIds, boards.byId, columns.byId, tasks.byId]);

  if (!showCommandPalette) {
    return null;
  }

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

      <div className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2">
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
                      {filteredCommands.map((cmd) => (
                        <CommandButton
                          cmd={cmd}
                          key={cmd.id}
                          onAction={() => setQuery("")}
                        />
                      ))}
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
