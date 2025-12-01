"use client";

import {
  Command,
  Hand,
  Moon,
  MousePointer2,
  Plus,
  Sun,
  WifiOff,
} from "lucide-react";
import { motion } from "motion/react";
import { memo } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useConnectionStatus } from "../features/kanban/hooks/use-connection-status";
import { useTheme } from "../features/kanban/hooks/use-theme";
import { useKanbanStore } from "../features/kanban/store/kanban-store";
import {
  useCurrentWorkspace,
  useShowWelcomeScreen,
} from "../features/kanban/store/selectors";

const MotionButton = motion.create(Button);

const buttonSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 17,
};

export const FloatingNavbar = memo(() => {
  const { theme, toggleTheme } = useTheme();
  const { isOffline } = useConnectionStatus();
  const setShowCommandPalette = useKanbanStore(
    (state) => state.setShowCommandPalette
  );
  const interactionMode = useKanbanStore((state) => state.interactionMode);
  const setInteractionMode = useKanbanStore(
    (state) => state.setInteractionMode
  );
  const addBoard = useKanbanStore((state) => state.addBoard);
  const currentWorkspace = useCurrentWorkspace();
  const showWelcomeScreen = useShowWelcomeScreen();

  if (showWelcomeScreen) {
    return null;
  }

  const handleNewBoard = () => {
    if (!currentWorkspace) {
      return;
    }

    addBoard(
      "New Board",
      { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      "New project board"
    );
  };

  return (
    <div className="-translate-x-1/2 fixed bottom-4 left-1/2 z-40 flex items-center gap-1 rounded-full border-2 border-border/50 bg-card/95 px-1.5 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
      <Button
        className="gap-1.5 rounded-full bg-card/50 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
        onClick={handleNewBoard}
        size="sm"
        title="New Board"
        variant="ghost"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden text-[11px] sm:inline">New</span>
      </Button>

      <Button
        className="gap-1.5 rounded-full bg-card/50 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
        onClick={() => setShowCommandPalette(true)}
        size="sm"
        title="Search (Cmd+K)"
        variant="ghost"
      >
        <Command className="h-3.5 w-3.5" />
        <span className="hidden text-[11px] sm:inline">Search</span>
      </Button>

      <div className="h-3.5 w-px bg-border/60" />

      <Button
        className={`gap-1.5 rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)] ${
          interactionMode === "select"
            ? "bg-primary/90 text-primary-foreground hover:bg-primary"
            : "bg-card/50 text-foreground hover:bg-secondary/70"
        }`}
        onClick={() =>
          setInteractionMode(interactionMode === "drag" ? "select" : "drag")
        }
        size="sm"
        title={
          interactionMode === "drag"
            ? "Switch to Select Mode (V)"
            : "Switch to Drag Mode (V)"
        }
        variant="ghost"
      >
        {interactionMode === "drag" ? (
          <Hand className="h-3.5 w-3.5" />
        ) : (
          <MousePointer2 className="h-3.5 w-3.5" />
        )}
        <span className="hidden text-[11px] sm:inline">
          {interactionMode === "drag" ? "Drag" : "Select"}
        </span>
      </Button>

      <div className="h-3.5 w-px bg-border/60" />

      {isOffline && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <WifiOff className="h-3.5 w-3.5" />
              <span className="font-medium text-[11px]">Offline</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>You're offline. Changes will sync when reconnected.</p>
          </TooltipContent>
        </Tooltip>
      )}

      <MotionButton
        className="gap-1.5 rounded-full bg-card/50 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
        onClick={toggleTheme}
        size="sm"
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        transition={buttonSpring}
        variant="ghost"
        whileTap={{ scale: 0.85 }}
      >
        {theme === "dark" ? (
          <Sun className="h-3.5 w-3.5" />
        ) : (
          <Moon className="h-3.5 w-3.5" />
        )}
      </MotionButton>
    </div>
  );
});

FloatingNavbar.displayName = "FloatingNavbar";
