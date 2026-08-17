"use client";

import {
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Circle,
  GripVertical,
  ListTodo,
  Plus,
  Sliders,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import AnimatedGradientBackground from "../animations/animated-gradient-bg";
import { CurvedArrowDown } from "../components/hero-arrows";

interface MockTask {
  checklist: { completed: number; total: number };
  description: string;
  dueDate?: string;
  id: string;
  priority: "high" | "medium" | "low";
  progress: number;
  tags: string[];
  title: string;
}

interface MockColumn {
  accent: string;
  icon: typeof Circle;
  id: string;
  name: string;
  tasks: MockTask[];
}

const mockColumns: MockColumn[] = [
  {
    id: "col-todo",
    name: "To Do",
    icon: Circle,
    accent: "#71717a",
    tasks: [
      {
        id: "task-1",
        title: "Local SQLite & Yjs Storage Engine",
        description:
          "Persist document state locally via IndexedDB with automatic cold-boot recovery and delta compaction.",
        priority: "high",
        progress: 35,
        checklist: { completed: 1, total: 3 },
        dueDate: "Oct 28",
        tags: ["storage", "crdt"],
      },
      {
        id: "task-2",
        title: "Multi-touch Pinch & Inertial Pan",
        description:
          "High-precision trackpad and touch gesture routing on the unbounded 2D viewport.",
        priority: "medium",
        progress: 10,
        checklist: { completed: 0, total: 2 },
        dueDate: "Nov 04",
        tags: ["gestures", "ux"],
      },
    ],
  },
  {
    id: "col-progress",
    name: "In Progress",
    icon: ArrowUpRight,
    accent: "#a16207",
    tasks: [
      {
        id: "task-3",
        title: "Multiplayer Drag Presence Overlay",
        description:
          "Broadcast ephemeral drag positions across Phoenix channels so peers see cards move in real-time.",
        priority: "high",
        progress: 80,
        checklist: { completed: 3, total: 4 },
        dueDate: "Tomorrow",
        tags: ["multiplayer", "presence"],
      },
      {
        id: "task-4",
        title: "Spatial Connectors & Dynamic Bezier Paths",
        description:
          "Calculate cubic Bezier paths between board handles with collision-aware routing and custom edge labels.",
        priority: "medium",
        progress: 65,
        checklist: { completed: 2, total: 3 },
        tags: ["canvas", "graph"],
      },
    ],
  },
  {
    id: "col-done",
    name: "Done",
    icon: CheckCircle2,
    accent: "#15803d",
    tasks: [
      {
        id: "task-5",
        title: "Zero-Latency Offline-First Write Queue",
        description:
          "Instant UI mutation with optimistic local commits and deterministic conflict-free reconciliation.",
        priority: "high",
        progress: 100,
        checklist: { completed: 4, total: 4 },
        dueDate: "Completed",
        tags: ["offline", "engine"],
      },
      {
        id: "task-6",
        title: "Binary CRDT State Vector Compression",
        description:
          "Ultra-compact state diffs optimized for sub-10ms peer synchronization over WebSockets.",
        priority: "low",
        progress: 100,
        checklist: { completed: 2, total: 2 },
        dueDate: "Completed",
        tags: ["wasm", "perf"],
      },
    ],
  },
];

const priorityConfig = {
  high: "bg-red-500/15 border-red-500/30 text-red-400",
  medium: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400",
  low: "bg-blue-500/15 border-blue-500/30 text-blue-400",
} as const;

const featureRows = [
  {
    id: "local",
    label: "Local-first engine",
    title: "Works offline. Syncs when you are back.",
    desc: "Every write commits to IndexedDB in under a millisecond. Yjs CRDTs reconcile the diff when the network returns, with no lost work.",
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 text-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
      >
        <path
          d="M20 11a4 4 0 00-3.6-3.97A6 6 0 004.5 9.1 4.5 4.5 0 005 18h13a3 3 0 001-5.83L19 12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M9 15l2 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "presence",
    label: "Live presence",
    title: "See teammates move cards, not stale lists.",
    desc: "Peer cursors, off-screen radar and drag ghosting ride on Phoenix channels at 60 fps, so collaboration feels like a shared desk.",
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 text-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
      >
        <path
          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.87c.48 0 .72-.58.38-.92L5.94 2.39a.5.5 0 00-.44.82z"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "spatial",
    label: "Spatial canvas",
    title: "Boards live anywhere, connected by edges.",
    desc: "Place boards on an infinite 2D surface and draw relationship connectors between them. Zoom from galaxy view to task detail.",
    icon: (
      <svg
        aria-hidden="true"
        className="h-4 w-4 text-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
      >
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M8.5 8.5L15.5 15.5" strokeLinecap="round" />
        <path d="M4 12H2M12 4V2M20 12h2M12 20v2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const NEW_TASK_TITLES = [
  "Battery-Aware Background Sync Scheduling",
  "Keyboard Shortcut Command Palette",
  "Collision-Aware Edge Label Routing",
  "Snapshot Archive & Point-in-Time Restore",
  "Radial Menu for Board Quick Actions",
];

const NEW_TASK_DESCRIPTIONS = {
  default:
    "Scheduled background reconciliation that pauses below 20% battery and resumes on power.",
  palette:
    "Fuzzy-match command palette for board navigation, task search, and workspace switching.",
  routing:
    "Route edge labels around overlapping paths with deterministic tie-breaking.",
  snapshot:
    "Automated canvas snapshots with one-click restore to any prior state.",
  radial: "A radial quick-actions menu pinned to the pointer for power users.",
} as const;

let newTaskCounter = 0;

interface MiniTask {
  done?: boolean;
  title: string;
}

interface MiniBoardData {
  accent: string;
  className: string;
  columns: { name: string; tasks: MiniTask[] }[];
  id: string;
  name: string;
}

// A compact real kanban, rendered as a neighbor board on the spatial canvas.
// Each carries its own columns, tasks and accent, so the hover reveal reads as
// distinct boards rather than decorative duplicates.
function MiniKanban({ accent, className, columns, name }: MiniBoardData) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute z-0 hidden w-64 scale-90 flex-col overflow-hidden rounded-xl border border-border/50 bg-card/95 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-500 ease-out group-hover:scale-100 group-hover:opacity-100 sm:flex ${className}`}
    >
      <div className="flex items-center gap-2 border-border/40 border-b bg-muted/30 px-3.5 py-2.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: accent }}
        />
        <span className="truncate font-semibold text-foreground text-xs">
          {name}
        </span>
        <span className="ml-auto shrink-0 rounded bg-secondary/80 px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground">
          live
        </span>
      </div>
      <div className="flex gap-2.5 p-2.5">
        {columns.map((col) => (
          <div
            className="min-w-0 flex-1 rounded-lg bg-muted/20 p-2"
            key={col.name}
          >
            <div className="mb-2 flex items-center gap-1">
              <span
                className="h-1 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
              />
              <span className="truncate font-medium text-[10px] text-muted-foreground">
                {col.name}
              </span>
              <span className="ml-auto text-[8px] text-muted-foreground/60">
                {col.tasks.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {col.tasks.map((task) => (
                <div
                  className="rounded-md border border-border/30 bg-card/80 px-2 py-1.5"
                  key={task.title}
                >
                  <p
                    className={`truncate text-[10px] leading-tight ${task.done ? "text-muted-foreground line-through" : "text-foreground/90"}`}
                  >
                    {task.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-border/40 border-t bg-muted/20 px-3.5 py-1.5 font-mono text-[8px] text-muted-foreground">
        <span>
          {columns.reduce((sum, col) => sum + col.tasks.length, 0)} TASKS
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-emerald-400" />
          SYNCED
        </span>
      </div>
    </div>
  );
}

const miniBoards: MiniBoardData[] = [
  {
    id: "roadmap",
    name: "Product Roadmap",
    accent: "#1d4ed8",
    className:
      "-top-10 -left-12 rotate-[-3deg] translate-x-3 translate-y-3 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:rotate-[-2deg]",
    columns: [
      {
        name: "Now",
        tasks: [
          { title: "Ship WebGL viewport" },
          { title: "SQLite engine" },
          { title: "Share links" },
        ],
      },
      {
        name: "Next",
        tasks: [
          { title: "Command palette" },
          { title: "Snapshot restore" },
          { title: "Offline drafts" },
        ],
      },
    ],
  },
  {
    id: "bugs",
    name: "Bug Triage",
    accent: "#a16207",
    className:
      "-top-10 -right-12 rotate-[2.5deg] -translate-x-3 translate-y-3 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:rotate-[2deg]",
    columns: [
      {
        name: "Open",
        tasks: [
          { title: "Pinch drift" },
          { title: "Ghost cursors" },
          { title: "Connector jitter" },
        ],
      },
      {
        name: "Fixed",
        tasks: [
          { title: "Radar jitter", done: true },
          { title: "Zoom jank", done: true },
          { title: "Drag lag", done: true },
        ],
      },
    ],
  },
  {
    id: "docs",
    name: "Docs & Specs",
    accent: "#0e7490",
    className:
      "top-1/2 -left-16 -translate-y-1/2 rotate-[-2deg] translate-x-3 group-hover:translate-x-0 group-hover:rotate-[-1deg]",
    columns: [
      {
        name: "Specs",
        tasks: [
          { title: "Sync protocol" },
          { title: "CRDT design" },
          { title: "Auth flows" },
        ],
      },
      {
        name: "Notes",
        tasks: [
          { title: "ADR-042" },
          { title: "Runbooks" },
          { title: "Changelog" },
        ],
      },
    ],
  },
  {
    id: "ideas",
    name: "Ideas & Backlog",
    accent: "#7c3aed",
    className:
      "top-1/2 -right-16 -translate-y-1/2 rotate-[2deg] -translate-x-3 group-hover:translate-x-0 group-hover:rotate-[1deg]",
    columns: [
      {
        name: "Ideas",
        tasks: [
          { title: "Radial menu" },
          { title: "Voice notes" },
          { title: "Board templates" },
        ],
      },
      {
        name: "Backlog",
        tasks: [
          { title: "Mobile app" },
          { title: "Public API" },
          { title: "Webhooks" },
        ],
      },
    ],
  },
  {
    id: "design",
    name: "Design System",
    accent: "#71717a",
    className:
      "-bottom-10 -left-12 rotate-[2deg] translate-x-3 -translate-y-3 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:rotate-[1.5deg]",
    columns: [
      {
        name: "Tokens",
        tasks: [
          { title: "Engraved shadows" },
          { title: "oklch palette" },
          { title: "Type scale" },
        ],
      },
      {
        name: "Components",
        tasks: [
          { title: "Drawer motion" },
          { title: "Card density" },
          { title: "Empty states" },
        ],
      },
    ],
  },
  {
    id: "sprint",
    name: "Sprint 24",
    accent: "#15803d",
    className:
      "-bottom-10 -right-12 rotate-[-2.5deg] -translate-x-3 -translate-y-3 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:rotate-[-2deg]",
    columns: [
      {
        name: "Shipped",
        tasks: [
          { title: "CRDT compaction", done: true },
          { title: "Relay pool", done: true },
          { title: "Presence radar", done: true },
        ],
      },
      {
        name: "Blocked",
        tasks: [
          { title: "WebGL culling" },
          { title: "Keyboard insets" },
          { title: "iOS share sheet" },
        ],
      },
    ],
  },
];

export function KanbanShowcase() {
  const [completedTaskMap, setCompletedTaskMap] = useState<
    Record<string, boolean>
  >({
    "task-5": true,
    "task-6": true,
  });
  const [columns, setColumns] = useState<MockColumn[]>(mockColumns);
  // Mobile starts in compact view (no descriptions) so the board stays
  // scannable; the toggle still lets users expand cards on any screen.
  const [compactView, setCompactView] = useState(() => window.innerWidth < 640);
  const [finishedExpanded, setFinishedExpanded] = useState(true);

  const toggleTaskCompletion = (taskId: string) => {
    setCompletedTaskMap((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const addTask = (columnId: string) => {
    const title = NEW_TASK_TITLES[newTaskCounter % NEW_TASK_TITLES.length];
    newTaskCounter += 1;
    const description =
      NEW_TASK_DESCRIPTIONS[
        title.toLowerCase().includes("palette")
          ? "palette"
          : title.toLowerCase().includes("routing")
            ? "routing"
            : title.toLowerCase().includes("snapshot")
              ? "snapshot"
              : title.toLowerCase().includes("radial")
                ? "radial"
                : "default"
      ];
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId
          ? {
              ...col,
              tasks: [
                ...col.tasks,
                {
                  id: `task-new-${newTaskCounter}`,
                  title,
                  description,
                  priority: "medium",
                  progress: 0,
                  checklist: { completed: 0, total: 1 },
                  tags: ["new"],
                },
              ],
            }
          : col
      )
    );
  };

  const totalTasks = columns.reduce((acc, col) => acc + col.tasks.length, 0);
  const doneTasks = Object.values(completedTaskMap).filter(Boolean).length;
  const progressPercent = Math.round((doneTasks / totalTasks) * 100);

  const openTasks = useMemo(
    () =>
      columns
        .filter((col) => col.id !== "col-done")
        .flatMap((col) => col.tasks),
    [columns]
  );

  const isTaskDone = (taskId: string) => !!completedTaskMap[taskId];

  return (
    <section className="relative w-full" id="canvas">
      {/* The hero's animated gradient, mirrored: the color bloom sits at
          the top of the section instead of the bottom. No page-load
          entrance animation here. */}{" "}
      <div aria-hidden="true" className="absolute inset-0">
        <AnimatedGradientBackground
          animateIn={false}
          Breathing={true}
          containerStyle={{ transform: "scaleY(-1)" }}
        />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="group relative">
          {/* Hover shrinks the active board and reveals the neighbor boards
            around it, each carrying its own columns and tasks */}
          {miniBoards.map((board) => (
            <MiniKanban {...board} key={board.id} />
          ))}
          <div className="relative z-10 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_32px_rgba(0,0,0,0.45)] transition-transform duration-500 ease-out sm:group-hover:scale-[0.92]">
            {/* Board header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-border/60 border-b bg-muted/30 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-foreground text-sm sm:text-base">
                      Core Engine & Architecture
                    </h3>
                    <span className="hidden rounded bg-secondary/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
                      v2.4-active
                    </span>
                  </div>
                  <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                    Spatial execution pipeline synced over Phoenix Yjs channels
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>
                    {doneTasks}/{totalTasks} ({progressPercent}%)
                  </span>
                </div>

                <button
                  className="hidden cursor-pointer items-center gap-1 rounded-lg border border-border/50 bg-card/60 px-2.5 py-1 text-muted-foreground text-xs transition-colors hover:border-border hover:bg-card hover:text-foreground sm:flex"
                  onClick={() => addTask("col-todo")}
                  type="button"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Task</span>
                </button>

                <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-card/40 p-0.5 text-muted-foreground">
                  <button
                    aria-label={
                      compactView ? "Show full cards" : "Compact cards"
                    }
                    className="cursor-pointer rounded p-1 transition-colors hover:bg-secondary/60 hover:text-foreground"
                    onClick={() => setCompactView((compact) => !compact)}
                    type="button"
                  >
                    <Sliders className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Columns: a swipeable row on mobile, a 3-column grid on desktop */}
            <div className="relative">
              <div className="flex gap-3 overflow-x-auto p-4 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:p-6">
                {columns.map((col) => {
                  const ColIcon = col.icon;
                  return (
                    <div
                      className="flex w-72 shrink-0 flex-col rounded-xl border border-border/50 bg-muted/20 p-2.5 md:w-auto"
                      key={col.id}
                    >
                      <div className="mb-2.5 flex items-center justify-between rounded-lg bg-muted/80 px-2.5 py-2 dark:bg-secondary/90">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                            style={{ backgroundColor: `${col.accent}25` }}
                          >
                            <ColIcon
                              className="h-3 w-3"
                              style={{ color: col.accent }}
                            />
                          </span>
                          <div className="min-w-0">
                            <h4 className="truncate font-semibold text-card-foreground text-xs">
                              {col.name}
                            </h4>
                            <p className="line-clamp-1 hidden text-[10px] text-foreground sm:block">
                              {`This is ${col.name} column`}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            aria-label={`Add task to ${col.name}`}
                            className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            onClick={() => addTask(col.id)}
                            type="button"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <span className="rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {col.tasks.length}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 space-y-2">
                        {col.tasks.map((task) => {
                          const isCompleted = isTaskDone(task.id);
                          return (
                            <div
                              className={`group relative rounded-lg border p-2.5 transition-all ${
                                isCompleted
                                  ? "border-border/40 bg-muted/20 opacity-75"
                                  : "border-border/50 bg-card shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_2px_8px_rgba(0,0,0,0.25)] hover:border-border/80"
                              }`}
                              key={task.id}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <h5
                                  className={`font-medium text-card-foreground text-xs leading-snug ${
                                    isCompleted
                                      ? "text-muted-foreground line-through"
                                      : ""
                                  }`}
                                >
                                  {task.title}
                                </h5>

                                <button
                                  aria-label={
                                    isCompleted
                                      ? "Mark incomplete"
                                      : "Mark complete"
                                  }
                                  className={`shrink-0 cursor-pointer rounded-md p-1 transition-all ${
                                    isCompleted
                                      ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  }`}
                                  onClick={() => toggleTaskCompletion(task.id)}
                                  type="button"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {!compactView && (
                                <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                                  {task.description}
                                </p>
                              )}

                              {task.progress > 0 && (
                                <div className="mt-2.5 space-y-1">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-muted-foreground/80">
                                      Progress
                                    </span>
                                    <span className="font-medium text-foreground/80">
                                      {task.progress}%
                                    </span>
                                  </div>
                                  <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                                    <div
                                      className="h-full bg-primary/80 transition-all duration-300"
                                      style={{ width: `${task.progress}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-border/20 border-t pt-2 text-[10px]">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`rounded border px-1.5 py-0.5 font-medium ${
                                      priorityConfig[task.priority]
                                    }`}
                                  >
                                    {task.priority}
                                  </span>
                                  {task.checklist.total > 0 && (
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <CheckSquare className="h-3 w-3" />
                                      <span>
                                        {task.checklist.completed}/
                                        {task.checklist.total}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {task.dueDate && (
                                  <div
                                    className={`flex items-center gap-1 ${
                                      task.dueDate === "Tomorrow"
                                        ? "text-amber-400"
                                        : task.dueDate === "Completed"
                                          ? "text-emerald-400"
                                          : "text-muted-foreground"
                                    }`}
                                  >
                                    <Calendar className="h-3 w-3" />
                                    <span>{task.dueDate}</span>
                                  </div>
                                )}
                              </div>

                              {task.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {task.tags.map((tag) => (
                                    <span
                                      className="rounded bg-secondary/50 px-1.5 py-0.5 text-[9px] text-muted-foreground"
                                      key={tag}
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {col.id === "col-done" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1 pt-1">
                              <button
                                aria-label={
                                  finishedExpanded
                                    ? "Hide finished"
                                    : "Show finished"
                                }
                                className="flex cursor-pointer items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                                onClick={() =>
                                  setFinishedExpanded((expanded) => !expanded)
                                }
                                type="button"
                              >
                                {finishedExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                              </button>
                              <span className="flex items-center gap-1 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                                <Check className="h-2.5 w-2.5" />
                                <span>Finished</span>
                                <span className="text-muted-foreground/70">
                                  {col.tasks.length}
                                </span>
                              </span>
                              <span className="text-muted-foreground/30">
                                |
                              </span>
                              <span className="flex items-center gap-1 font-medium text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                                <Trash2 className="h-2.5 w-2.5" />
                                <span>Trash</span>
                                <span className="text-muted-foreground/70">
                                  0
                                </span>
                              </span>
                              <div className="relative ml-2 flex-1">
                                <div className="h-px w-full bg-border/40" />
                              </div>
                            </div>

                            {finishedExpanded ? (
                              <div className="rounded-lg border border-border/30 bg-muted/10 p-2.5 text-center">
                                <p className="text-[10px] text-muted-foreground/50 italic">
                                  Empty finished
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-border/30 bg-muted/10 p-2.5 text-center">
                                <p className="text-[10px] text-muted-foreground/50 italic">
                                  {col.tasks.length} completed, hidden
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Right-edge fade hints that more columns are swipeable */}
              <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 bg-linear-to-l from-[#0A0A0A]/70 to-transparent md:hidden" />
            </div>

            {/* Board footer */}
            <div className="flex items-center justify-between border-border/40 border-t bg-muted/20 px-4 py-2 text-muted-foreground">
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <ListTodo className="h-3 w-3" />
                <span>
                  {totalTasks} TASKS · {progressPercent}% COMPLETE
                </span>
                <span className="flex items-center gap-0.5 text-muted-foreground/60 md:hidden">
                  SWIPE
                  <ChevronRight className="h-3 w-3" />
                </span>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <span>{openTasks.length} OPEN</span>
                <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary">
                  <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <CurvedArrowDown className="h-14 w-7 text-primary/50" />
        </div>

        <div className="mx-auto mt-10 max-w-3xl text-center">
          <h2
            className="font-bold text-3xl text-foreground sm:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            A real board, rendered like the real app.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-foreground/80 text-sm leading-relaxed sm:text-base">
            This is the actual kanban component from the application: muted
            column headers, engraved task cards, priority rules, progress
            telemetry, checklists and due dates. No mockup, no placeholder.
          </p>
        </div>

        {/* Feature rows, styled as quiet data rows */}
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
          {featureRows.map((row) => (
            <div
              className="relative flex flex-col rounded-2xl border border-border/30 bg-linear-to-br from-background via-background to-muted p-5 shadow-[0_0_24px_rgba(255,255,255,0.05),inset_0_2px_10px_rgba(255,255,255,0.08),inset_0_-2px_10px_rgba(0,0,0,0.35)]"
              key={row.id}
            >
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-30" />
              <div className="relative">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60">
                    {row.icon}
                  </div>
                  <span className="font-medium text-muted-foreground text-xs">
                    {row.label}
                  </span>
                </div>
                <h3
                  className="mb-2 font-semibold text-foreground text-xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {row.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {row.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
