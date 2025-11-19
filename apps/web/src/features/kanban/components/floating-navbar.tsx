"use client";

import { Command, LogOut, Menu, Moon, Plus, Settings, Sun } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useTheme } from "../hooks/use-theme";
import { useKanbanStore } from "../store/kanban-store";
import { HelpDialog } from "./help-dialog";
import { WorkspaceSelector } from "./workspace-selector";

export const FloatingNavbar = memo(() => {
  const [showMenu, setShowMenu] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const setShowCommandPalette = useKanbanStore(
    (state) => state.setShowCommandPalette
  );
  const currentWorkspace = useKanbanStore((state) => state.currentWorkspace);

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
  };

  return (
    <div className="-translate-x-1/2 fixed bottom-6 left-1/2 z-40 flex items-center gap-2 rounded-lg border border-white/40 bg-card/90 px-2 py-2 shadow-lg backdrop-blur-md">
      {currentWorkspace && <WorkspaceSelector />}

      <Button
        className="gap-2 rounded-full text-foreground hover:bg-secondary/60"
        onClick={handleNewBoard}
        size="sm"
        title="New Board"
        variant="ghost"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden text-xs sm:inline">New</span>
      </Button>

      <Button
        className="gap-2 rounded-full text-foreground hover:bg-secondary/60"
        onClick={() => setShowCommandPalette(true)}
        size="sm"
        title="Search (Cmd+K)"
        variant="ghost"
      >
        <Command className="h-4 w-4" />
        <span className="hidden text-xs sm:inline">Cmd K</span>
      </Button>

      <div className="h-4 w-px bg-border" />

      <Button
        className="gap-2 rounded-full text-foreground hover:bg-secondary/60"
        onClick={toggleTheme}
        size="sm"
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        variant="ghost"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </Button>

      <HelpDialog />

      <Button
        className="gap-2 rounded-full text-foreground hover:bg-secondary/60"
        onClick={() => setShowMenu(!showMenu)}
        size="sm"
        title="More"
        variant="ghost"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {showMenu && (
        <div className="absolute right-0 bottom-full mb-2 w-48 overflow-hidden rounded border border-white/40 bg-card shadow-lg">
          <Button
            className="w-full justify-start gap-2 text-foreground hover:bg-secondary/60"
            size="sm"
            variant="ghost"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          <Button
            className="w-full justify-start gap-2 text-foreground hover:bg-secondary/60"
            size="sm"
            variant="ghost"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      )}
    </div>
  );
});

FloatingNavbar.displayName = "FloatingNavbar";
