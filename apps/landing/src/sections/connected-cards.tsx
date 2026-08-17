"use client";

import {
  CheckCircle2,
  Layout,
  LayoutGrid,
  Link2,
  ListTodo,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  SnakeArrowBottomLeft,
  SnakeArrowBottomRight,
  SnakeArrowTopLeft,
  SnakeArrowTopRight,
} from "../components/hero-arrows";
import { cn } from "../lib/utils";

interface MockBoard {
  accent: string;
  completed: number;
  connections: number;
  description: string;
  icon: typeof Layout;
  id: string;
  name: string;
  total: number;
}

const mockBoards: MockBoard[] = [
  {
    id: "board-1",
    name: "Core Engine & Architecture",
    description: "Spatial execution pipeline synced over Phoenix channels",
    icon: LayoutGrid,
    accent: "#71717a",
    total: 24,
    completed: 16,
    connections: 4,
  },
  {
    id: "board-2",
    name: "Multiplayer Presence",
    description: "Cursors, drag ghosting and off-screen radar",
    icon: Users,
    accent: "#15803d",
    total: 13,
    completed: 9,
    connections: 3,
  },
  {
    id: "board-3",
    name: "Offline-First Storage",
    description: "IndexedDB write queue and Yjs delta compaction",
    icon: ListTodo,
    accent: "#1d4ed8",
    total: 18,
    completed: 12,
    connections: 2,
  },
  {
    id: "board-4",
    name: "Edge Sync & Distribution",
    description: "Cloudflare Workers relays at the network edge",
    icon: Layout,
    accent: "#a16207",
    total: 9,
    completed: 7,
    connections: 1,
  },
];

interface ProgressRingProps {
  accent: string;
  percent: number;
  size?: number;
}

function ProgressRing({ accent, percent, size = 44 }: ProgressRingProps) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <svg
        aria-hidden="true"
        className="-rotate-90"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <circle
          className="text-muted/30 dark:text-muted/40"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
        />
        <circle
          className="text-border/50"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={accent}
          strokeDasharray={`${circumference * (percent / 100)} ${circumference}`}
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="font-bold text-[10px] tracking-tight"
          style={{ color: accent }}
        >
          {percent}%
        </span>
      </div>
    </div>
  );
}

interface BoardCardProps {
  board: MockBoard;
  isActive: boolean;
  onClick: () => void;
}

function BoardCard({ board, isActive, onClick }: BoardCardProps) {
  const completionPercent =
    board.total > 0 ? Math.round((board.completed / board.total) * 100) : 0;
  const IconComponent = board.icon;

  return (
    <button
      className={cn(
        "group w-full cursor-pointer rounded-xl p-3 text-left transition-all duration-200",
        "bg-muted/40 hover:bg-muted/60",
        "border",
        isActive
          ? "border-primary/60"
          : "border-border/30 hover:border-border/50",
        "shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center gap-3 pl-2">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${board.accent}15` }}
        >
          <IconComponent className="h-5 w-5" style={{ color: board.accent }} />
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
                {board.total} tasks
              </span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-[10px] text-muted-foreground">
                {board.completed} done
              </span>
            </div>
            {board.connections > 0 && (
              <div className="flex items-center gap-1">
                <Link2 className="h-3 w-3 text-muted-foreground/60" />
                <span className="text-[10px] text-muted-foreground">
                  {board.connections}
                </span>
              </div>
            )}
          </div>
        </div>

        <ProgressRing
          accent={board.accent}
          percent={completionPercent}
          size={44}
        />
      </div>
    </button>
  );
}

export function ConnectedCardsSection() {
  const [activeBoardId, setActiveBoardId] = useState("board-1");

  const totalTasks = mockBoards.reduce((sum, b) => sum + b.total, 0);
  const totalCompleted = mockBoards.reduce((sum, b) => sum + b.completed, 0);
  const overallPercent = Math.round((totalCompleted / totalTasks) * 100);

  return (
    <section
      className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      id="sidebar"
    >
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
        {/* The boards drawer card, standalone like the Larity card */}
        <div className="lg:col-span-7">
          <div className="group relative mx-auto w-full max-w-96">
            {/* Corner arrows point inward at the live drawer */}
            <SnakeArrowTopLeft className="pointer-events-none absolute -top-12 -left-12 hidden h-10 w-8 text-primary/50 sm:block" />
            <SnakeArrowTopRight className="pointer-events-none absolute -top-12 -right-12 hidden h-10 w-8 text-primary/50 sm:block" />
            <SnakeArrowBottomLeft className="pointer-events-none absolute -bottom-12 -left-12 hidden h-10 w-8 text-primary/50 sm:block" />
            <SnakeArrowBottomRight className="pointer-events-none absolute -right-12 -bottom-12 hidden h-10 w-8 text-primary/50 sm:block" />
            {/* On hover the drawer pulls out of its slot: the shell slides
                right and the board rows follow with a stagger */}
            <div className="flex h-[500px] w-full flex-col overflow-hidden rounded-2xl border-2 border-border/50 bg-card/98 shadow-[0_8px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(0,0,0,0.05),inset_0_2px_8px_rgba(0,0,0,0.15),inset_0_-2px_6px_rgba(255,255,255,0.05)] backdrop-blur-xl transition-all duration-500 ease-out group-hover:translate-x-3 group-hover:shadow-[0_16px_56px_rgba(0,0,0,0.6),0_0_0_1px_rgba(0,0,0,0.05),inset_0_2px_8px_rgba(0,0,0,0.15),inset_0_-2px_6px_rgba(255,255,255,0.05)]">
              <div className="flex items-center justify-between border-border/50 border-b bg-linear-to-b from-muted/50 to-transparent px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LayoutGrid className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">
                      Boards
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      {mockBoards.length} boards · {overallPercent}% complete
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-2.5">
                  {mockBoards.map((board, index) => (
                    <div
                      className="transition-transform duration-500 ease-out group-hover:translate-x-1.5"
                      key={board.id}
                      style={{ transitionDelay: `${index * 50}ms` }}
                    >
                      <BoardCard
                        board={board}
                        isActive={activeBoardId === board.id}
                        onClick={() => setActiveBoardId(board.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-border/30 border-t bg-muted/30 px-4 py-2.5">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{totalTasks} total tasks</span>
                  <span>{totalCompleted} completed</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all duration-500"
                    style={{ width: `${overallPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:col-span-5">
          <h2
            className="font-bold text-3xl text-foreground sm:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Drawers, selectors and rings. All live.
          </h2>
          <p className="mt-4 text-muted-foreground text-sm leading-relaxed sm:text-base">
            Every board in the workspace is one glance away. The boards drawer
            lists each one with a live completion ring, task counts and
            connection counts, exactly as the application renders it.
          </p>

          <ul className="mt-6 space-y-2.5 text-muted-foreground text-sm">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <span>
                Board cards carry live completion rings driven by real task
                data.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <span>
                Task, completed and connection counts come from the same source
                the app uses.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
              <span>
                Click any board to select it and the ring and card highlight
                update instantly.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
