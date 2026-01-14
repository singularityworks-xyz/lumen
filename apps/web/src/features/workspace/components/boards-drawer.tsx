"use client";

import { useReactFlow } from "@xyflow/react";
import {
  CheckCircle2,
  Layout,
  LayoutGrid,
  Link2,
  ListTodo,
  MessageCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SwitchButtons } from "@/src/components/ui/switch-buttons";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { Board, Task } from "@/src/features/kanban/types";
import { ICON_MAP } from "@/src/features/kanban/utils/color-icon-utils";
import { cn } from "@/src/lib/utils";
import LarityOrb from "../../ai/components/animations/larity-orb";

type BoardStats = {
  board: Board;
  totalTasks: number;
  completedTasks: number;
  connections: number;
};

type BoardCardProps = {
  stats: BoardStats;
  index: number;
  onClick: () => void;
};

const BoardCard = memo(({ stats, onClick }: BoardCardProps) => {
  const { board, totalTasks, completedTasks, connections } = stats;
  const completionPercent =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const IconComponent = board.icon ? ICON_MAP[board.icon] : Layout;
  const accentColor = board.accentColor || "#6e6e6e";

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: mega ignore
    // biome-ignore lint/a11y/noStaticElementInteractions: mega ignore
    // biome-ignore lint/a11y/useKeyWithClickEvents: mega ignore
    <div
      className={cn(
        "group relative rounded-xl p-3",
        "bg-muted/40 hover:bg-muted/60",
        "border border-border/30 hover:border-border/50",
        "shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.06)]",
        "dark:shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.03)]",
        "hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(255,255,255,0.08)]",
        "dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(255,255,255,0.05)]",
        "cursor-pointer transition-all duration-200"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 pl-2">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            "shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_-1px_2px_rgba(255,255,255,0.05)]",
            "dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_-1px_2px_rgba(255,255,255,0.03)]"
          )}
          style={{
            backgroundColor: `${accentColor}15`,
          }}
        >
          {IconComponent && (
            <IconComponent className="h-5 w-5" style={{ color: accentColor }} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="truncate font-medium text-foreground text-sm">
            {board.name}
          </h4>
          {board.description && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
              {board.description}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <ListTodo className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-[10px] text-muted-foreground">
                {totalTasks} {totalTasks === 1 ? "task" : "tasks"}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-[10px] text-muted-foreground">
                {completedTasks} done
              </span>
            </div>

            {connections > 0 && (
              <div className="flex items-center gap-1">
                <Link2 className="h-3 w-3 text-muted-foreground/60" />
                <span className="text-[10px] text-muted-foreground">
                  {connections}
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          className="relative h-11 w-11 shrink-0"
          style={{
            filter:
              totalTasks > 0
                ? `drop-shadow(0 2px 4px ${accentColor}30)`
                : undefined,
          }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: `
                inset 0 2px 4px rgba(0,0,0,0.15),
                inset 0 -1px 2px rgba(255,255,255,0.1),
                0 1px 3px rgba(0,0,0,0.1)
              `,
            }}
          />
          {/** biome-ignore lint/a11y/noSvgWithoutTitle: skipy */}
          <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44">
            <circle
              className="text-muted/30 dark:text-muted/40"
              cx="22"
              cy="22"
              fill="none"
              r="18"
              stroke="currentColor"
              strokeWidth="4"
            />
            <circle
              className="text-border/50"
              cx="22"
              cy="22"
              fill="none"
              r="18"
              stroke="currentColor"
              strokeWidth="1"
            />
            <circle
              className="transition-all duration-700 ease-out"
              cx="22"
              cy="22"
              fill="none"
              r="18"
              stroke={accentColor}
              strokeDasharray={`${completionPercent * 1.13} 113`}
              strokeLinecap="round"
              strokeWidth="4"
              style={{
                opacity: totalTasks > 0 ? 1 : 0.2,
                filter:
                  totalTasks > 0
                    ? `drop-shadow(0 0 3px ${accentColor}60)`
                    : undefined,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  totalTasks > 0 ? `${accentColor}12` : "transparent",
              }}
            >
              <span
                className="font-bold text-[10px] tracking-tight"
                style={{
                  color: accentColor,
                  opacity: totalTasks > 0 ? 1 : 0.5,
                  textShadow:
                    totalTasks > 0 ? `0 1px 2px ${accentColor}20` : undefined,
                }}
              >
                {completionPercent}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

type FloatingIndicatorProps = {
  onClick: () => void;
  boardCount: number;
  isOpen: boolean;
};

const FloatingIndicator = memo(
  ({ onClick, boardCount, isOpen }: FloatingIndicatorProps) => (
    <motion.button
      animate={{
        x: isOpen ? 100 : 0,
        opacity: isOpen ? 0 : 1,
        scale: isOpen ? 0.8 : 1,
      }}
      aria-label="Open boards"
      className={cn(
        "fixed top-1/2 right-0 z-40",
        "flex flex-col items-center justify-center gap-1",
        "w-10 rounded-l-xl py-4",
        "bg-card/95 backdrop-blur-md",
        "border-2 border-border/50 border-r-0",
        "shadow-[0_4px_20px_rgba(0,0,0,0.15),-4px_0_12px_rgba(0,0,0,0.08),inset_0_3px_10px_rgba(0,0,0,0.25),inset_0_-2px_6px_rgba(255,255,255,0.08),inset_1px_0_4px_rgba(0,0,0,0.15)]",
        "dark:shadow-[0_4px_20px_rgba(0,0,0,0.6),-4px_0_12px_rgba(0,0,0,0.3),inset_0_3px_12px_rgba(255,255,255,0.12),inset_0_-3px_10px_rgba(0,0,0,0.5),inset_1px_0_6px_rgba(0,0,0,0.3)]",
        "hover:bg-card hover:shadow-[0_4px_24px_rgba(0,0,0,0.2),-6px_0_16px_rgba(0,0,0,0.12),inset_0_3px_12px_rgba(0,0,0,0.3),inset_0_-2px_8px_rgba(255,255,255,0.1),inset_1px_0_5px_rgba(0,0,0,0.18)]",
        "dark:hover:shadow-[0_4px_24px_rgba(0,0,0,0.7),-6px_0_16px_rgba(0,0,0,0.35),inset_0_3px_14px_rgba(255,255,255,0.15),inset_0_-3px_12px_rgba(0,0,0,0.55),inset_1px_0_7px_rgba(0,0,0,0.35)]",
        "group cursor-pointer transition-shadow duration-300"
      )}
      initial={{ x: 100, opacity: 0 }}
      onClick={onClick}
      style={{ marginTop: "8px" }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      type="button"
    >
      <div className="relative">
        <LayoutGrid className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
        {boardCount > 0 && (
          <motion.span
            animate={{ scale: 1 }}
            className={cn(
              "absolute -top-1.5 -right-1.5",
              "h-4 min-w-4 px-1",
              "flex items-center justify-center",
              "rounded-full bg-primary text-primary-foreground",
              "font-bold text-[9px]",
              "shadow-sm"
            )}
            initial={{ scale: 0 }}
          >
            {boardCount > 99 ? "99+" : boardCount}
          </motion.span>
        )}
      </div>
      <span className="writing-mode-vertical font-medium text-[9px] text-muted-foreground transition-colors group-hover:text-foreground">
        Boards
      </span>
    </motion.button>
  )
);

type BoardsDrawerContentProps = {
  boardStats: BoardStats[];
  onClose: () => void;
  onSwitchToComments?: () => void;
  onSwitchToAi?: () => void;
  commentCount?: number;
  onBoardClick: (boardId: string) => void;
};

const BoardsDrawerContent = memo(
  ({
    boardStats,
    onClose,
    onSwitchToComments,
    onSwitchToAi,
    commentCount = 0,
    onBoardClick,
  }: BoardsDrawerContentProps) => {
    const totalTasks = boardStats.reduce((sum, s) => sum + s.totalTasks, 0);
    const totalCompleted = boardStats.reduce(
      (sum, s) => sum + s.completedTasks,
      0
    );
    const overallPercent =
      totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    return (
      <motion.div
        animate={{ opacity: 1, x: 0, scale: 1, y: "-50%" }}
        className={cn(
          "fixed top-1/2 right-4 z-50",
          "w-[30vw] min-w-[320px] max-w-105",
          "h-[70vh] max-h-175 min-h-100",
          "flex flex-col"
        )}
        exit={{ opacity: 0, x: "100%", scale: 0.98, y: "-50%" }}
        initial={{ opacity: 0, x: "100%", scale: 0.98, y: "-50%" }}
        transition={{ type: "spring", stiffness: 350, damping: 35 }}
      >
        <div
          className={cn(
            "flex h-full w-full flex-col",
            "overflow-hidden rounded-2xl",
            "bg-card/98 backdrop-blur-xl",
            "border-2 border-border/50",
            "shadow-[0_8px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05),inset_0_2px_8px_rgba(0,0,0,0.15),inset_0_-2px_6px_rgba(255,255,255,0.05)]",
            "dark:shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05),inset_0_2px_8px_rgba(255,255,255,0.1),inset_0_-2px_6px_rgba(0,0,0,0.4)]"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between px-4 py-3",
              "border-border/50 border-b",
              "bg-linear-to-b from-muted/50 to-transparent"
            )}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  "bg-primary/10 text-primary",
                  "shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Boards
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {boardStats.length}{" "}
                  {boardStats.length === 1 ? "board" : "boards"} ·{" "}
                  {overallPercent}% complete
                </p>
              </div>
            </div>
            <button
              aria-label="Close boards"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-muted/80 active:bg-muted",
                "transition-all duration-200",
                "shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]",
                "hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]"
              )}
              onClick={onClose}
              type="button"
            >
              {/** biome-ignore lint/a11y/noSvgWithoutTitle: skipy */}
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div
            className={cn(
              "flex-1 overflow-y-auto overflow-x-hidden",
              "space-y-2.5 px-4 py-4",
              "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            )}
          >
            {boardStats.length === 0 ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex h-full flex-col items-center justify-center py-12 text-center"
                initial={{ opacity: 0, y: 10 }}
              >
                <div
                  className={cn(
                    "mb-4 h-16 w-16 rounded-2xl",
                    "flex items-center justify-center",
                    "bg-muted/50",
                    "shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_-1px_2px_rgba(255,255,255,0.05)]",
                    "dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_-1px_2px_rgba(255,255,255,0.03)]"
                  )}
                >
                  <LayoutGrid className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-muted-foreground text-sm">
                  No boards yet
                </p>
                <p className="mt-1 text-muted-foreground/60 text-xs">
                  Create a board to get started
                </p>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                {boardStats.map((stats, index) => (
                  <BoardCard
                    index={index}
                    key={stats.board.id}
                    onClick={() => onBoardClick(stats.board.id)}
                    stats={stats}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>

          <div
            className={cn(
              "pointer-events-none relative z-10 -mt-6 h-6",
              "bg-linear-to-t from-card to-transparent"
            )}
          />

          {boardStats.length > 0 && (
            <div
              className={cn(
                "border-border/30 border-t px-4 py-2.5",
                "bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{totalTasks} total tasks</span>
                <span>{totalCompleted} completed</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/50">
                <motion.div
                  animate={{ width: `${overallPercent}%` }}
                  className="h-full rounded-full bg-primary/60"
                  initial={{ width: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          <div
            className={cn(
              "h-1 w-full",
              "bg-linear-to-r from-transparent via-primary/20 to-transparent"
            )}
          />
        </div>

        <SwitchButtons
          buttons={[
            ...(onSwitchToComments
              ? [
                  {
                    id: "comments",
                    icon: (
                      <MessageCircle className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    ),
                    label: "Comments",
                    onClick: onSwitchToComments,
                    count: commentCount,
                  },
                ]
              : []),
            ...(onSwitchToAi
              ? [
                  {
                    id: "ai",
                    icon: <LarityOrb size="xs" speed={0.3} />,
                    label: "Larity",
                    onClick: onSwitchToAi,
                  },
                ]
              : []),
          ]}
        />
      </motion.div>
    );
  }
);

export type BoardsDrawerProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToComments?: () => void;
  onSwitchToAi?: () => void;
  commentCount?: number;
};

export const BoardsDrawer = memo(
  ({
    isOpen,
    onOpenChange,
    onSwitchToComments,
    onSwitchToAi,
    commentCount = 0,
  }: BoardsDrawerProps) => {
    const [mounted, setMounted] = useState(false);
    const boards = useKanbanStore((state) => state.boards);
    const columns = useKanbanStore((state) => state.columns);
    const tasks = useKanbanStore((state) => state.tasks);
    const boardConnections = useKanbanStore((state) => state.boardConnections);
    const currentWorkspaceId = useKanbanStore(
      (state) => state.currentWorkspaceId
    );
    const workspaces = useKanbanStore((state) => state.workspaces);
    const boardPositions = useKanbanStore((state) => state.boardPositions);
    const { setCenter } = useReactFlow();

    const handleBoardClick = useCallback(
      (boardId: string) => {
        const position = boardPositions.byId[boardId];
        if (position) {
          const centerX = position.x + (position.width ?? 400) / 2;
          const centerY = position.y + (position.height ?? 300) / 2;
          setCenter(centerX, centerY, { zoom: 1, duration: 800 });
          onOpenChange(false);
        }
      },
      [boardPositions, setCenter, onOpenChange]
    );

    const boardStats = useMemo((): BoardStats[] => {
      if (!currentWorkspaceId) {
        return [];
      }

      const workspace = workspaces.byId[currentWorkspaceId];
      if (!workspace) {
        return [];
      }

      const workspaceBoardIds = workspace.board_ids || [];

      return workspaceBoardIds
        .map((boardId) => {
          const board = boards.byId[boardId];
          if (!board) {
            return null;
          }

          const boardColumnIds = board.column_ids || [];
          const boardTasks: Task[] = [];

          for (const colId of boardColumnIds) {
            const column = columns.byId[colId];
            if (column) {
              for (const taskId of column.task_ids || []) {
                const task = tasks.byId[taskId];
                if (task) {
                  boardTasks.push(task);
                }
              }
            }
          }

          const completedTasks = boardTasks.filter(
            (t) => t.status === "done"
          ).length;

          const connections = boardConnections.allIds.filter((connId) => {
            const conn = boardConnections.byId[connId];
            return (
              conn &&
              (conn.source_board_id === boardId ||
                conn.target_board_id === boardId)
            );
          }).length;

          return {
            board,
            totalTasks: boardTasks.length,
            completedTasks,
            connections,
          };
        })
        .filter((s): s is BoardStats => s !== null);
    }, [
      boards,
      columns,
      tasks,
      boardConnections,
      currentWorkspaceId,
      workspaces,
    ]);

    useEffect(() => {
      setMounted(true);
    }, []);

    const handleOpen = useCallback(() => onOpenChange(true), [onOpenChange]);
    const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isOpen) {
          onOpenChange(false);
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onOpenChange]);

    if (!mounted || typeof document === "undefined") {
      return null;
    }

    return createPortal(
      <>
        <FloatingIndicator
          boardCount={boardStats.length}
          isOpen={isOpen}
          onClick={handleOpen}
        />

        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                onClick={handleClose}
                transition={{ duration: 0.2 }}
              />

              <BoardsDrawerContent
                boardStats={boardStats}
                commentCount={commentCount}
                onBoardClick={handleBoardClick}
                onClose={handleClose}
                onSwitchToAi={onSwitchToAi}
                onSwitchToComments={onSwitchToComments}
              />
            </>
          )}
        </AnimatePresence>
      </>,
      document.body
    );
  }
);

export default BoardsDrawer;
