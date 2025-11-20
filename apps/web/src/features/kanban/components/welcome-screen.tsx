"use client";

import { HelpCircle, LogIn, Plus } from "lucide-react";
import Image from "next/image";
import { memo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { useKanbanStore } from "../store/kanban-store";
import { HelpDialog } from "./help-dialog";

export const WelcomeScreen = memo(() => {
  const boards = useKanbanStore((state) => state.boards);
  const currentWorkspace = useKanbanStore((state) => state.currentWorkspace);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const hasBoardsInCurrentWorkspace =
    currentWorkspace == null
      ? boards.length > 0
      : boards.some(
          (board) =>
            !board.workspace_id || board.workspace_id === currentWorkspace.id
        );

  if (hasBoardsInCurrentWorkspace) {
    return null;
  }

  const handleNewBoard = () => {
    const boardId = `board-${Date.now()}`;
    const newBoard = {
      id: boardId,
      name: "New Board",
      description: "New project board",
      workspace_id: currentWorkspace?.id ?? "",
      created_by: "user1",
      created_at: new Date().toISOString(),
      columns: [
        {
          id: `col-1-${Math.random()}`,
          board_id: boardId,
          name: "To Do",
          position: 0,
          tasks: [],
        },
        {
          id: `col-2-${Math.random()}`,
          board_id: boardId,
          name: "In Progress",
          position: 1,
          tasks: [],
        },
        {
          id: `col-3-${Math.random()}`,
          board_id: boardId,
          name: "Done",
          position: 2,
          tasks: [],
        },
      ],
    };

    useKanbanStore.getState().addBoard(newBoard, {
      x: 100,
      y: 100,
    });
  };

  const handleLogin = () => {
    // TODO: Implement login
    console.log("Login clicked");
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
                <Button
                  className="h-12 gap-3 rounded-xl bg-linear-to-b from-primary to-primary/90 font-medium shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_2px_3px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
                  onClick={handleNewBoard}
                  size="lg"
                >
                  <Plus className="h-5 w-5" />
                  Create Your First Board
                </Button>

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
