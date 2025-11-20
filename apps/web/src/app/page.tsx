"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { ThemeProvider } from "@/src/app/providers/theme-provider";
import { BulkActionsBar } from "@/src/features/kanban/components/bulk-actions-bar";
import { KanbanCanvas } from "@/src/features/kanban/components/canvas";
import { CanvasContextMenu } from "@/src/features/kanban/components/canvas-context-menu";
import { CommandPalette } from "@/src/features/kanban/components/command-palette";
import { FloatingNavbar } from "@/src/features/kanban/components/floating-navbar";
import { RightControls } from "@/src/features/kanban/components/right-controls";
import { useKanbanInit } from "@/src/features/kanban/hooks/use-kanban-init";

export default function KanbanPage() {
  // Initialize the store with mock data for now
  useKanbanInit();

  return (
    <ThemeProvider>
      <div className="relative h-screen w-full overflow-hidden bg-background">
        <ReactFlowProvider>
          <KanbanCanvas />
        </ReactFlowProvider>
        <FloatingNavbar />
        <RightControls />
        <CanvasContextMenu />
        <CommandPalette />
        <BulkActionsBar />
      </div>
    </ThemeProvider>
  );
}
