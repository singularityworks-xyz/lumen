"use client";

import { HelpCircle, MapIcon } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "../features/kanban/store/kanban-store";
import { useShowWelcomeScreen } from "../features/kanban/store/selectors";
import { HelpDialog } from "./dialogs/help-dialog";

export const RightControls = memo(() => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const showMiniMap = useKanbanStore((state) => state.showMiniMap);
  const setShowMiniMap = useKanbanStore((state) => state.setShowMiniMap);
  const showWelcomeScreen = useShowWelcomeScreen();

  if (showWelcomeScreen) {
    return null;
  }

  return (
    <>
      <div className="fixed right-4 bottom-4 z-40 flex items-center gap-1 rounded-full border-2 border-border/50 bg-card/95 px-1.5 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:border-white/20 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
        <Button
          className={`h-7 w-7 rounded-full p-0 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)] ${
            showMiniMap
              ? "bg-primary/90 text-primary-foreground hover:bg-primary"
              : "bg-card/50 text-foreground hover:bg-secondary/70"
          }`}
          onClick={() => setShowMiniMap(!showMiniMap)}
          size="sm"
          title={showMiniMap ? "Hide Map" : "Show Map"}
          variant="ghost"
        >
          <MapIcon className="h-3.5 w-3.5" />
        </Button>

        <Button
          className="h-7 w-7 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
          onClick={() => setIsHelpOpen(true)}
          size="sm"
          title="Help"
          variant="ghost"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </div>

      <HelpDialog onClose={() => setIsHelpOpen(false)} open={isHelpOpen} />
    </>
  );
});

RightControls.displayName = "RightControls";
