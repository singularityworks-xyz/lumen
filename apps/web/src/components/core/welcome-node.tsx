"use client";

import { useReactFlow } from "@xyflow/react";
import { ClipboardList, HelpCircle, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { memo, useState } from "react";
import { HelpDialog } from "@/src/components/dialogs/help-dialog";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";

export const WELCOME_NODE_ID = "welcome-card";
// Parked clear of the default board spawn area (100..300) so boards created
// from the palette, context menu or AI never land underneath it.
export const WELCOME_NODE_POSITION = { x: 500, y: 300 };
// The card is ~448px wide (max-w-md); spawn the first board right beside it.
const FIRST_BOARD_POSITION = {
  x: WELCOME_NODE_POSITION.x + 520,
  y: WELCOME_NODE_POSITION.y,
};

export const WelcomeNode = memo(() => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { fitView, setCenter } = useReactFlow();

  const handleNewBoard = () => {
    const state = useKanbanStore.getState();
    const hasBoards = state.currentWorkspaceId
      ? (state.workspaces.byId[state.currentWorkspaceId]?.board_ids.length ??
          0) > 0
      : state.boards.allIds.length > 0;
    // First board lands beside the card; later boards cascade below the last
    // focused board like every other creation path.
    const position = hasBoards ? undefined : FIRST_BOARD_POSITION;

    const boardId = state.addBoard("New Board", position, "New project board");

    // For the first board keep the viewport on the card so the board appears
    // right beside it; later boards jump the view to their cascade position.
    if (hasBoards) {
      setTimeout(() => {
        const boardPosition =
          useKanbanStore.getState().boardPositions.byId[boardId];
        if (boardPosition) {
          setCenter(
            boardPosition.x + (boardPosition.width ?? 400) / 2,
            boardPosition.y + (boardPosition.height ?? 300) / 2,
            { zoom: 1, duration: 300 }
          );
        } else {
          fitView({ padding: 0.3, duration: 300 });
        }
      }, 100);
    }
  };

  const handleNewTextBoard = () => {
    const state = useKanbanStore.getState();
    const hasBoards = state.currentWorkspaceId
      ? (state.workspaces.byId[state.currentWorkspaceId]?.board_ids.length ??
          0) > 0 ||
        (state.workspaces.byId[state.currentWorkspaceId]?.text_board_ids
          ?.length ?? 0) > 0
      : state.boards.allIds.length > 0 || state.textBoards.allIds.length > 0;
    const position = hasBoards ? undefined : FIRST_BOARD_POSITION;

    const textBoardId = state.addTextBoard(
      "New Text Board",
      position,
      "A todo / text board"
    );

    if (hasBoards) {
      setTimeout(() => {
        const boardPosition =
          useKanbanStore.getState().textBoardPositions.byId[textBoardId];
        if (boardPosition) {
          setCenter(
            boardPosition.x + (boardPosition.width ?? 300) / 2,
            boardPosition.y + (boardPosition.height ?? 300) / 2,
            { zoom: 1, duration: 300 }
          );
        } else {
          fitView({ padding: 0.3, duration: 300 });
        }
      }, 100);
    }
  };

  const handleDismiss = () => {
    useKanbanStore.getState().dismissWelcome();
  };

  return (
    <>
      <div
        className="relative w-full max-w-sm sm:max-w-md"
        data-testid="welcome-screen"
      >
        <div className="pointer-events-none absolute -inset-4 -z-10 rounded-2xl bg-linear-to-br from-primary/20 via-transparent to-primary/10 opacity-30 blur-2xl sm:rounded-3xl" />
        <div className="relative rounded-2xl bg-linear-to-br from-background via-background to-muted p-6 shadow-[inset_0_2px_20px_rgba(0,0,0,0.3),inset_0_-2px_20px_rgba(255,255,255,0.05)] sm:rounded-3xl sm:p-12 dark:shadow-[inset_0_3px_20px_rgba(255,255,255,0.12),inset_0_-3px_20px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-50 sm:rounded-3xl" />
          <button
            aria-label="Dismiss welcome card"
            className="nodrag absolute top-3 right-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
            data-testid="welcome-dismiss-button"
            onClick={handleDismiss}
            title="Dismiss"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative space-y-6 sm:space-y-8">
            <div className="text-center">
              <div className="mb-3 flex items-center justify-center sm:mb-4">
                <div className="relative h-12 w-12 sm:h-16 sm:w-16">
                  <div className="absolute inset-0 rounded-full bg-black/30 blur-xl dark:bg-white/40" />
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
              <h1 className="bg-linear-to-b from-foreground/90 to-foreground/60 bg-clip-text font-bold text-3xl text-transparent sm:text-5xl">
                Lumen
              </h1>
              <p className="mt-1.5 text-[10px] text-muted-foreground/60 sm:mt-2 sm:text-xs">
                by{" "}
                <span className="font-semibold text-foreground/80">
                  Singularity Works
                </span>
              </p>
              <p className="mt-2 text-muted-foreground text-xs sm:mt-3 sm:text-sm">
                Your infinite canvas for project management
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:gap-3">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  className="nodrag h-10 w-full gap-2 rounded-lg bg-linear-to-b from-primary to-primary/90 font-medium text-sm shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] sm:h-12 sm:gap-3 sm:rounded-xl sm:text-base dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
                  onClick={handleNewBoard}
                  size="lg"
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                  Create Your First Board
                </Button>
              </motion.div>

              <Button
                className="nodrag h-10 gap-2 rounded-lg border-2 border-border/50 bg-card/50 text-sm shadow-[0_2px_8px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm sm:h-12 sm:rounded-xl sm:text-base dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
                onClick={handleNewTextBoard}
                variant="outline"
              >
                <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5" />
                Create a Text Board
              </Button>

              <Button
                className="nodrag h-10 gap-2 rounded-lg border-2 border-border/50 bg-card/50 text-sm shadow-[0_2px_8px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-sm sm:h-12 sm:rounded-xl sm:text-base dark:shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.1),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
                onClick={() => setIsHelpOpen(true)}
                variant="outline"
              >
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">
                  View Keyboard Shortcuts
                </span>
                <span className="sm:hidden">Help & Shortcuts</span>
              </Button>
            </div>

            <div className="hidden pt-4 text-center sm:block">
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
      </div>

      <HelpDialog onClose={() => setIsHelpOpen(false)} open={isHelpOpen} />
    </>
  );
});

WelcomeNode.displayName = "WelcomeNode";
