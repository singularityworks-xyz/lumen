"use client";

import { useReactFlow } from "@xyflow/react";
import { Maximize, Maximize2Icon, Minimize, Minus, Plus } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";

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
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-1 rounded-full border-2 border-border/50 bg-card/95 px-1.5 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:border-white/20 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
      <Button
        className="h-7 w-7 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
        onClick={handleZoomOut}
        size="sm"
        title="Zoom Out"
        variant="ghost"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>

      <Button
        className="h-7 w-7 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
        onClick={handleZoomIn}
        size="sm"
        title="Zoom In"
        variant="ghost"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <div className="h-4 w-px bg-border/60" />

      <Button
        className="h-7 w-7 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
        onClick={handleFitView}
        size="sm"
        title="Fit View"
        variant="ghost"
      >
        <Maximize2Icon className="h-3.5 w-3.5" />
      </Button>

      <Button
        className="h-7 w-7 rounded-full bg-card/50 p-0 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]"
        onClick={handleFullscreen}
        size="sm"
        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        variant="ghost"
      >
        {isFullscreen ? (
          <Minimize className="h-4 w-4" />
        ) : (
          <Maximize className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
});

CustomControls.displayName = "CustomControls";
