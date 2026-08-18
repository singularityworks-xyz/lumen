"use client";

import { useReactFlow } from "@xyflow/react";
import { Minus } from "lucide-react";
import { motion } from "motion/react";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { EyeIcon } from "./animated/icons/eye";
import { MaximizeIcon } from "./animated/icons/maximize";
import { MinimizeIcon } from "./animated/icons/minimize";
import { PlusIcon } from "./animated/icons/plus";

const MotionButton = motion.create(Button);

const buttonSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 17,
};

export const CustomControls = memo(() => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleZoomIn = () => {
    zoomIn();
  };

  const handleZoomOut = () => {
    zoomOut();
  };

  const handleFitView = () => {
    fitView({ padding: 0.2, duration: 200 });
  };

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 hidden items-center gap-1 rounded-full border-2 border-border/50 bg-card/95 px-1.5 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md md:flex dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
      <MotionButton
        className="h-7 w-7 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
        onClick={handleZoomOut}
        size="sm"
        title="Zoom Out"
        transition={buttonSpring}
        variant="ghost"
        whileTap={{ scale: 0.85 }}
      >
        <Minus className="h-3.5 w-3.5" />
      </MotionButton>

      <MotionButton
        className="h-7 w-7 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
        onClick={handleZoomIn}
        size="sm"
        title="Zoom In"
        transition={buttonSpring}
        variant="ghost"
        whileTap={{ scale: 0.85 }}
      >
        <PlusIcon size={14} />
      </MotionButton>

      <div className="h-4 w-px bg-border/60" />

      <MotionButton
        className="h-7 w-7 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
        onClick={handleFitView}
        size="sm"
        title="Fit View"
        transition={buttonSpring}
        variant="ghost"
        whileTap={{ scale: 0.85 }}
      >
        <EyeIcon size={14} />
      </MotionButton>

      <MotionButton
        className="h-7 w-7 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
        onClick={handleFullscreen}
        size="sm"
        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        transition={buttonSpring}
        variant="ghost"
        whileTap={{ scale: 0.85 }}
      >
        {isFullscreen ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
      </MotionButton>
    </div>
  );
});

CustomControls.displayName = "CustomControls";
