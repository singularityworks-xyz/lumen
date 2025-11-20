"use client";

import { HelpCircle, MapIcon } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "../store/kanban-store";
import { HelpDialog } from "./help-dialog";

export const RightControls = memo(() => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const showMiniMap = useKanbanStore((state) => state.showMiniMap);
  const setShowMiniMap = useKanbanStore((state) => state.setShowMiniMap);

  return (
    <>
      <div className="fixed right-4 bottom-4 z-40 flex items-center gap-1 rounded-full border border-border/50 bg-card/95 px-1.5 py-1.5 shadow-xl backdrop-blur-md dark:border-white/20">
        <Button
          className={`h-7 w-7 rounded-full p-0 transition-colors ${
            showMiniMap
              ? "bg-primary/90 text-primary-foreground hover:bg-primary"
              : "text-foreground hover:bg-secondary/70"
          }`}
          onClick={() => setShowMiniMap(!showMiniMap)}
          size="sm"
          title={showMiniMap ? "Hide Map" : "Show Map"}
          variant="ghost"
        >
          <MapIcon className="h-3.5 w-3.5" />
        </Button>

        <Button
          className="h-7 w-7 rounded-full p-0 text-foreground hover:bg-secondary/70"
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
