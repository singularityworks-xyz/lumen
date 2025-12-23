"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useState } from "react";
import { KanbanCanvas } from "@/src/components/core/canvas";
import { CommandPalette } from "@/src/components/dialogs/command-palette";
import { FloatingNavbar } from "@/src/components/floating-navbar";
import { MobileNavbar } from "@/src/components/mobile-navbar";
import { RightControls } from "@/src/components/right-controls";
import { BulkActionsBar } from "@/src/features/kanban/components/bulk-actions-bar";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import { CanvasContextMenu } from "../components/core/canvas-context-menu";

export default function KanbanPage() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const unsub = useKanbanStore.persist.onFinishHydration(() => {
      setIsReady(true);
    });

    if (useKanbanStore.persist.hasHydrated()) {
      setIsReady(true);
    }

    return () => {
      unsub();
    };
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      {isReady ? (
        <>
          <ReactFlowProvider>
            <KanbanCanvas />
            <MobileNavbar position="bottom" />
          </ReactFlowProvider>
          <FloatingNavbar />
          <RightControls />
          <CanvasContextMenu />
          <CommandPalette />
          <BulkActionsBar />
        </>
      ) : null}
    </div>
  );
}
