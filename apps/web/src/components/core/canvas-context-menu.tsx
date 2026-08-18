"use client";

import { useReactFlow } from "@xyflow/react";
import { MessageCircle, Plus } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { useCollaboration } from "@/src/features/collab";
import { useKanbanStore } from "@/src/features/kanban";

interface ContextMenuProps {
  onClose: () => void;
  x: number;
  y: number;
}

const ContextMenuContent = memo(({ x, y, onClose }: ContextMenuProps) => {
  const { screenToFlowPosition } = useReactFlow();
  const { localUser, isCollaborating } = useCollaboration();
  // const setShowCommandPalette = useKanbanStore(
  //   (state) => state.setShowCommandPalette
  // );

  const handleNewBoard = useCallback(() => {
    const defaultWidth = 800;
    const defaultHeight = 400;

    useKanbanStore.getState().addBoard(
      "New Board",
      {
        x: x - defaultWidth / 2,
        y: y - defaultHeight / 2,
      },
      "New project board"
    );
    onClose();
  }, [x, y, onClose]);

  const handleAddComment = useCallback(() => {
    if (!localUser) {
      return;
    }

    const position = screenToFlowPosition({ x, y });
    useKanbanStore.getState().addComment(position, "", {
      id: localUser.id,
      name: localUser.name,
      image: localUser.image ?? undefined,
    });
    onClose();
  }, [x, y, onClose, screenToFlowPosition, localUser]);

  // const handleSearch = useCallback(() => {
  //   setShowCommandPalette(true);
  //   onClose();
  // }, [setShowCommandPalette, onClose]);

  return (
    <div
      className="fixed z-50 w-48 overflow-hidden rounded-lg border-2 border-border/50 bg-card/95 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] backdrop-blur-md dark:border-white/20 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
      style={{ top: y, left: x }}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-secondary/70 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
        onClick={handleNewBoard}
        type="button"
      >
        <Plus className="h-3.5 w-3.5" />
        New Board
      </button>
      {isCollaborating && (
        <button
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-secondary/70 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
          onClick={handleAddComment}
          type="button"
        >
          <MessageCircle className="h-3.5 w-3.5 scale-x-[-1]" />
          Add Comment
        </button>
      )}
      {/* <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-secondary/70 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
        onClick={handleSearch}
        type="button"
      >
        <Command className="h-3.5 w-3.5" />
        Search
      </button> */}
    </div>
  );
});

ContextMenuContent.displayName = "ContextMenuContent";

export const CanvasContextMenu = memo(() => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.classList.contains("react-flow__pane") ||
      target.classList.contains("react-flow__viewport")
    ) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", handleClose);
    document.addEventListener("wheel", handleClose);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", handleClose);
      document.removeEventListener("wheel", handleClose);
    };
  }, [handleContextMenu, handleClose]);

  if (!contextMenu) {
    return null;
  }

  return (
    <>
      <button
        aria-label="Close context menu"
        className="fixed inset-0 z-40"
        onClick={handleClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            handleClose();
          }
        }}
        type="button"
      />
      <ContextMenuContent
        onClose={handleClose}
        x={contextMenu.x}
        y={contextMenu.y}
      />
    </>
  );
});

CanvasContextMenu.displayName = "CanvasContextMenu";
