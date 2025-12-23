"use client";

import { useReactFlow } from "@xyflow/react";
import {
  Command,
  HelpCircle,
  LayoutGrid,
  MapIcon,
  Minus,
  Moon,
  Plus,
  Sun,
  WifiOff,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useState } from "react";
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
import { HelpDialog } from "./dialogs/help-dialog";

const MotionButton = motion.create(Button);

const buttonSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 17,
};

export type MobileNavbarProps = {
  position?: "top" | "bottom";
};

export const MobileNavbar = memo(
  ({ position = "bottom" }: MobileNavbarProps) => {
    const { theme, toggleTheme } = useTheme();
    const { isOffline } = useConnectionStatus();
    const { zoomIn, zoomOut } = useReactFlow();
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const setShowCommandPalette = useKanbanStore(
      (state) => state.setShowCommandPalette
    );
    const addBoard = useKanbanStore((state) => state.addBoard);
    const currentWorkspace = useCurrentWorkspace();
    const showWelcomeScreen = useShowWelcomeScreen();
    const showMiniMap = useKanbanStore((state) => state.showMiniMap);
    const setShowMiniMap = useKanbanStore((state) => state.setShowMiniMap);

    if (showWelcomeScreen) {
      return null;
    }

    const handleNewBoard = () => {
      if (!currentWorkspace) {
        return;
      }
      addBoard("New Board", undefined, "New project board");
    };

    const handleZoomIn = () => {
      zoomIn();
    };

    const handleZoomOut = () => {
      zoomOut();
    };

    const positionClasses = position === "top" ? "top-4" : "bottom-4";

    return (
      <>
        <div
          className={`fixed ${positionClasses} left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-full border-2 border-border/50 bg-card/95 px-1 py-1 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md md:hidden dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]`}
        >
          <MotionButton
            className="h-8 w-8 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
            onClick={handleZoomOut}
            size="sm"
            title="Zoom Out"
            transition={buttonSpring}
            variant="ghost"
            whileTap={{ scale: 0.85 }}
          >
            <Minus className="h-4 w-4" />
          </MotionButton>

          <MotionButton
            className="h-8 w-8 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
            onClick={handleZoomIn}
            size="sm"
            title="Zoom In"
            transition={buttonSpring}
            variant="ghost"
            whileTap={{ scale: 0.85 }}
          >
            <Plus className="h-4 w-4" />
          </MotionButton>

          <div className="h-4 w-px bg-border/60" />

          <MotionButton
            className="h-8 w-8 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
            onClick={handleNewBoard}
            size="sm"
            title="New Board"
            transition={buttonSpring}
            variant="ghost"
            whileTap={{ scale: 0.85 }}
          >
            <LayoutGrid className="h-4 w-4" />
          </MotionButton>

          <MotionButton
            className="h-8 w-8 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
            onClick={() => setShowCommandPalette(true)}
            size="sm"
            title="Search"
            transition={buttonSpring}
            variant="ghost"
            whileTap={{ scale: 0.85 }}
          >
            <Command className="h-4 w-4" />
          </MotionButton>

          <div className="h-4 w-px bg-border/60" />

          <MotionButton
            className={`h-8 w-8 rounded-full p-0 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)] ${
              showMiniMap
                ? "bg-primary/90 text-primary-foreground hover:bg-primary"
                : "bg-card/50 text-foreground hover:bg-secondary/70"
            }`}
            onClick={() => setShowMiniMap(!showMiniMap)}
            size="sm"
            title={showMiniMap ? "Hide Map" : "Show Map"}
            transition={buttonSpring}
            variant="ghost"
            whileTap={{ scale: 0.85 }}
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                initial={{ scale: 0.8, opacity: 0 }}
                key={showMiniMap ? "map-on" : "map-off"}
                transition={{ duration: 0.15 }}
              >
                <MapIcon className="h-4 w-4" />
              </motion.div>
            </AnimatePresence>
          </MotionButton>

          <MotionButton
            className="h-8 w-8 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
            onClick={() => setIsHelpOpen(true)}
            size="sm"
            title="Help"
            transition={buttonSpring}
            variant="ghost"
            whileTap={{ scale: 0.85 }}
          >
            <HelpCircle className="h-4 w-4" />
          </MotionButton>

          <div className="h-4 w-px bg-border/60" />

          <MotionButton
            className="h-8 w-8 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
            onClick={toggleTheme}
            size="sm"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            transition={buttonSpring}
            variant="ghost"
            whileTap={{ scale: 0.85 }}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </MotionButton>

          {isOffline && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                  <WifiOff className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>You're offline. Changes will sync when reconnected.</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <HelpDialog onClose={() => setIsHelpOpen(false)} open={isHelpOpen} />
      </>
    );
  }
);

MobileNavbar.displayName = "MobileNavbar";
