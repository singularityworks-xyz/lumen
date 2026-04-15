"use client";

import {
  // Command, // Disabled: Search functionality temporarily disabled
  LayoutGrid,
  MousePointer2,
  WifiOff,
} from "lucide-react";
import { motion } from "motion/react";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { UserButton } from "../features/auth/components";
import { useConnectionStatus } from "../features/kanban/hooks/use-connection-status";
import { useTheme } from "../features/kanban/hooks/use-theme";
import { useKanbanStore } from "../features/kanban/store/kanban-store";
import { useCurrentWorkspace } from "../features/kanban/store/selectors";
import { HandIcon } from "./animated/icons/hand";
import { MoonIcon } from "./animated/icons/moon";
import { PlusIcon } from "./animated/icons/plus";
import { SunIcon } from "./animated/icons/sun";
import { SyncStatusIndicator } from "./sync-status-indicator";

const MotionButton = motion.create(Button);

const buttonSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 17,
};

export const FloatingNavbar = memo(() => {
  const { theme, toggleTheme } = useTheme();
  const { isOffline } = useConnectionStatus();
  // Disabled: Search functionality temporarily disabled
  // const setShowCommandPalette = useKanbanStore(
  //   (state) => state.setShowCommandPalette
  // );
  const interactionMode = useKanbanStore((state) => state.interactionMode);
  const setInteractionMode = useKanbanStore(
    (state) => state.setInteractionMode
  );
  const addBoard = useKanbanStore((state) => state.addBoard);
  const addArea = useKanbanStore((state) => state.addArea);
  const currentWorkspace = useCurrentWorkspace();

  const [showBoardCreateDialog, setShowBoardCreateDialog] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [showAreaCreateDialog, setShowAreaCreateDialog] = useState(false);
  const [areaName, setAreaName] = useState("");

  const handleNewBoard = () => {
    if (!currentWorkspace) {
      return;
    }
    setBoardName("");
    setBoardDescription("");
    setShowBoardCreateDialog(true);
  };

  const handleBoardCreateSubmit = () => {
    if (!currentWorkspace) {
      return;
    }
    if (!boardName.trim()) {
      return;
    }
    addBoard(boardName.trim(), undefined, boardDescription.trim() || undefined);
    setShowBoardCreateDialog(false);
    setBoardName("");
    setBoardDescription("");
  };

  const handleNewArea = () => {
    setAreaName("");
    setShowAreaCreateDialog(true);
  };

  const handleAreaCreateSubmit = () => {
    const trimmedAreaName = areaName.trim();
    if (!trimmedAreaName) {
      return;
    }

    addArea(trimmedAreaName, { x: 120, y: 120 }, { width: 720, height: 420 });
    setShowAreaCreateDialog(false);
    setAreaName("");
  };

  return (
    <>
      <Dialog
        onOpenChange={setShowBoardCreateDialog}
        open={showBoardCreateDialog}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Board</DialogTitle>
            <DialogDescription>
              Add a new board to your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="board-name">Board Name</Label>
              <Input
                autoFocus
                data-testid="board-name-input"
                id="board-name"
                onChange={(e) => setBoardName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleBoardCreateSubmit();
                  }
                }}
                placeholder="Enter board name"
                value={boardName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="board-description">Description</Label>
              <Textarea
                data-testid="board-description-input"
                id="board-description"
                onChange={(e) => setBoardDescription(e.target.value)}
                placeholder="Enter board description (optional)"
                value={boardDescription}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              data-testid="board-create-cancel"
              onClick={() => setShowBoardCreateDialog(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              data-testid="board-create-submit"
              onClick={handleBoardCreateSubmit}
              type="button"
            >
              Create Board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={setShowAreaCreateDialog}
        open={showAreaCreateDialog}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Area</DialogTitle>
            <DialogDescription>
              Group related boards together on your canvas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="area-name">Area Name</Label>
            <Input
              autoFocus
              data-testid="area-name-input"
              id="area-name"
              onChange={(e) => setAreaName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAreaCreateSubmit();
                }
              }}
              placeholder="Enter area name"
              value={areaName}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowAreaCreateDialog(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              data-testid="area-create-submit"
              onClick={handleAreaCreateSubmit}
              type="button"
            >
              Create Area
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-4 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-1 rounded-full border-2 border-border/50 bg-card/95 px-1.5 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md md:flex dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
        <Button
          className="gap-1.5 rounded-full bg-card/50 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
          data-testid="new-board-button"
          onClick={handleNewBoard}
          size="sm"
          title="New Board"
          variant="ghost"
        >
          <PlusIcon size={14} />
          <span className="hidden text-[11px] sm:inline">New</span>
        </Button>

        <Button
          className="gap-1.5 rounded-full bg-card/50 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
          data-testid="create-area-button"
          onClick={handleNewArea}
          size="sm"
          title="Create Area"
          variant="ghost"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span className="hidden text-[11px] sm:inline">Area</span>
        </Button>

        {/* Disabled: Search functionality temporarily disabled
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
      */}

        <Button
          className={`gap-1.5 rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)] ${
            interactionMode === "select"
              ? "bg-primary/90 text-primary-foreground hover:bg-primary"
              : "bg-card/50 text-foreground hover:bg-secondary/70"
          }`}
          data-testid="task-select-mode-toggle"
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
            <HandIcon size={14} />
          ) : (
            <MousePointer2 className="h-3.5 w-3.5" />
          )}
          <span className="hidden text-[11px] sm:inline">
            {interactionMode === "drag" ? "Drag" : "Select"}
          </span>
        </Button>

        <div className="h-3.5 w-px bg-border/60" />

        <SyncStatusIndicator />
        <UserButton size="sm" />

        {isOffline && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                data-testid="offline-indicator"
              >
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
          {theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
        </MotionButton>
      </div>
    </>
  );
});

FloatingNavbar.displayName = "FloatingNavbar";
