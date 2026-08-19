"use client";

import {
  // Command, // Disabled: Search functionality temporarily disabled
  ClipboardList,
  Layers,
  LayoutGrid,
  MousePointer2,
  WifiOff,
} from "lucide-react";
import { motion } from "motion/react";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
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
  const addTextBoard = useKanbanStore((state) => state.addTextBoard);
  const addArea = useKanbanStore((state) => state.addArea);
  const currentWorkspace = useCurrentWorkspace();

  const [showAreaCreateDialog, setShowAreaCreateDialog] = useState(false);
  const [areaName, setAreaName] = useState("");

  const handleNewBoard = () => {
    if (!currentWorkspace) {
      return;
    }
    addBoard("New Board", undefined, "New project board");
  };

  const handleNewTextBoard = () => {
    if (!currentWorkspace) {
      return;
    }
    addTextBoard("New Text Board", undefined, "A todo / text board");
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

    const store = useKanbanStore.getState();
    const focusedBoardId = store.canvas.focusedBoardId;
    const focusedBoardPosition = focusedBoardId
      ? store.boardPositions.byId[focusedBoardId]
      : undefined;

    const defaultWidth = 720;
    const defaultHeight = 420;

    const areaPosition = focusedBoardPosition
      ? {
          x: focusedBoardPosition.x,
          y: focusedBoardPosition.y + (focusedBoardPosition.height ?? 500) + 60,
        }
      : {
          x: store.canvas.viewport.x + window.innerWidth * 0.25,
          y: store.canvas.viewport.y + window.innerHeight * 0.2,
        };

    addArea(trimmedAreaName, areaPosition, {
      width: defaultWidth,
      height: defaultHeight,
    });
    setShowAreaCreateDialog(false);
    setAreaName("");
  };

  return (
    <>
      <Dialog
        onOpenChange={setShowAreaCreateDialog}
        open={showAreaCreateDialog}
      >
        <DialogContent
          className="gap-0 overflow-hidden border-2 border-border/50 bg-card/95 p-0 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md sm:max-w-sm dark:border-white/20 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
          showCloseButton={false}
        >
          <div className="flex items-center justify-between border-border border-b bg-muted/95 px-3.5 py-2.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 font-bold text-[10px] text-primary">
                <Layers className="h-3 w-3" />
              </span>
              <DialogTitle className="font-semibold text-foreground text-xs">
                Create Area
              </DialogTitle>
            </div>
            <button
              aria-label="Close create area dialog"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              onClick={() => setShowAreaCreateDialog(false)}
              type="button"
            >
              <span className="font-bold text-xs">✕</span>
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAreaCreateSubmit();
            }}
          >
            <div className="space-y-2 p-3.5">
              <Label
                className="block font-medium text-[11px] text-muted-foreground"
                htmlFor="navbar-area-name"
              >
                Area Name
              </Label>
              <Input
                autoFocus
                className="h-8 rounded-md border border-border/30 bg-muted/80 px-2.5 text-foreground text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),0_0_0_3px_rgba(var(--primary),0.1)] focus:outline-none dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)] dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),0_0_0_3px_rgba(var(--primary),0.2)]"
                data-testid="area-name-input"
                id="navbar-area-name"
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="Enter area name..."
                value={areaName}
              />
            </div>
            <div className="flex gap-2 border-border border-t bg-muted/30 px-3 py-2 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
              <Button
                className="h-7 flex-1 rounded-md bg-card/80 px-3 font-medium text-muted-foreground text-xs shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-card hover:text-foreground dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)] dark:hover:bg-card/70"
                onClick={() => setShowAreaCreateDialog(false)}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                className="h-7 flex-1 rounded-md bg-primary px-3 font-medium text-primary-foreground text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.2)] transition-all hover:bg-primary/90 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(255,255,255,0.3)] active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                data-testid="area-create-submit"
                type="submit"
              >
                Create Area
              </Button>
            </div>
          </form>
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
          data-testid="new-text-board-button"
          onClick={handleNewTextBoard}
          size="sm"
          title="New Text Board"
          variant="ghost"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          <span className="hidden text-[11px] sm:inline">Text</span>
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
