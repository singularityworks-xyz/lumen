"use client";

import { createLogger } from "@lumen/logger";
import { useReactFlow } from "@xyflow/react";
import { HelpCircle, LogIn, Plus } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "../../features/kanban/store/kanban-store";
import { HelpDialog } from "./help-dialog";

const logger = createLogger({ name: "[client] welcome" });

export const WelcomeScreen = memo(() => {
  const boards = useKanbanStore((state) => state.boards);
  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const workspaces = useKanbanStore((state) => state.workspaces);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { fitView, setCenter } = useReactFlow();

  const hasBoardsInCurrentWorkspace = currentWorkspaceId
    ? (workspaces.byId[currentWorkspaceId]?.board_ids.length ?? 0) > 0
    : boards.allIds.length > 0;

  if (hasBoardsInCurrentWorkspace) {
    return null;
  }

  const handleNewBoard = () => {
    const boardId = useKanbanStore
      .getState()
      .addBoard("New Board", { x: 100, y: 100 }, "New project board");

    // Focus on the newly created board after a short delay for the node to render
    setTimeout(() => {
      const boardPosition =
        useKanbanStore.getState().boardPositions.byId[boardId];
      if (boardPosition) {
        // Center viewport on the new board with animation
        setCenter(
          boardPosition.x + (boardPosition.width ?? 400) / 2,
          boardPosition.y + (boardPosition.height ?? 300) / 2,
          { zoom: 1, duration: 300 }
        );
      } else {
        // Fallback to fitView if position not found
        fitView({ padding: 0.3, duration: 300 });
      }
    }, 100);
  };

  const handleLogin = () => {
    // TODO: Implement login
    logger.debug("Login clicked");
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
        <div className="pointer-events-auto relative">
          <div className="relative rounded-3xl bg-linear-to-br from-background via-background to-muted p-12 shadow-[inset_0_2px_20px_rgba(0,0,0,0.3),inset_0_-2px_20px_rgba(255,255,255,0.05)] dark:shadow-[inset_0_3px_20px_rgba(255,255,255,0.12),inset_0_-3px_20px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />

            <div className="relative space-y-8">
              <div className="text-center">
                <div className="mb-4 flex items-center justify-center">
                  <div className="relative h-16 w-16">
                    <Image
                      alt="Lumen Logo"
                      className="object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] dark:hidden"
                      fill
                      priority
                      src="/lumen.svg"
                    />
                    <Image
                      alt="Lumen Logo"
                      className="hidden object-contain drop-shadow-[0_2px_8px_rgba(255,255,255,0.2)] dark:block"
                      fill
                      priority
                      src="/lumen_white.svg"
                    />
                  </div>
                </div>
                <h1 className="bg-linear-to-b from-foreground/90 to-foreground/60 bg-clip-text font-bold text-5xl text-transparent">
                  Lumen
                </h1>
                <p className="mt-2 text-muted-foreground/60 text-xs">
                  by{" "}
                  <span className="font-semibold text-foreground/80">
                    Singularity Works
                  </span>
                </p>
                <p className="mt-3 text-muted-foreground text-sm">
                  Your infinite canvas for project management
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    className="h-12 w-full gap-3 rounded-xl bg-linear-to-b from-primary to-primary/90 font-medium shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
                    onClick={handleNewBoard}
                    size="lg"
                  >
                    <Plus className="h-5 w-5" />
                    Create Your First Board
                  </Button>
                </motion.div>

                <Button
                  className="h-12 gap-2 rounded-xl border-2 border-border/50 bg-card/50 shadow-[0_2px_8px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
                  onClick={() => setIsHelpOpen(true)}
                  variant="outline"
                >
                  <HelpCircle className="h-4 w-4" />
                  View Keyboard Shortcuts
                </Button>

                <Button
                  className="h-12 gap-2 rounded-xl border-2 border-border/50 bg-card/50 shadow-[0_2px_8px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
                  disabled
                  onClick={handleLogin}
                  variant="outline"
                >
                  <LogIn className="h-4 w-4" />
                  Login to Sync
                </Button>
              </div>

              <div className="pt-4 text-center">
                <p className="text-[11px] text-muted-foreground/70">
                  Press{" "}
                  <kbd className="rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
                    ⌘
                  </kbd>{" "}
                  <kbd className="rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
                    K
                  </kbd>{" "}
                  to open command palette
                </p>
              </div>
            </div>
          </div>

          <div className="-z-10 pointer-events-none absolute inset-0 rounded-3xl bg-linear-to-br from-primary/20 via-transparent to-primary/10 opacity-30 blur-2xl" />
        </div>
      </div>

      <HelpDialog onClose={() => setIsHelpOpen(false)} open={isHelpOpen} />
    </>
  );
});

WelcomeScreen.displayName = "WelcomeScreen";
