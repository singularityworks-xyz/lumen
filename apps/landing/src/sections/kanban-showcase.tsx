"use client";

import {
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  Circle,
  GripVertical,
  Move,
  Plus,
  Sliders,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

interface MockTask {
  checklist: { completed: number; total: number };
  collaborator?: {
    action: string;
    avatar: string;
    color: string;
    name: string;
  };
  description: string;
  dueDate?: string;
  id: string;
  priority: "high" | "medium" | "low";
  progress: number;
  tags: string[];
  title: string;
}

const mockColumns: {
  accent: string;
  icon: typeof Circle;
  id: string;
  name: string;
  tasks: MockTask[];
}[] = [
  {
    id: "col-todo",
    name: "To Do",
    icon: Circle,
    accent: "#64748b",
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
          "High-precision trackpad and touch gesture routing on the unbounded 2D WebGL viewport.",
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
    accent: "#f59e0b",
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
        collaborator: {
          name: "Sarah (Product)",
          color: "#10b981",
          avatar: "S",
          action: "Dragging across columns",
        },
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
    accent: "#10b981",
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
  high: {
    bg: "bg-red-500/15 border-red-500/30 text-red-400",
    label: "High",
  },
  medium: {
    bg: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400",
    label: "Medium",
  },
  low: {
    bg: "bg-blue-500/15 border-blue-500/30 text-blue-400",
    label: "Low",
  },
};

const annotations = [
  {
    id: "spatial",
    title: "Spatial Positioning",
    desc: "Boards float freely on an unbounded 2D canvas with arbitrary coordinate placement.",
    target: "header",
    tag: "01 / Canvas Node",
  },
  {
    id: "telemetry",
    title: "Progress Telemetry",
    desc: "Live completion roll-up auto-calculated across all column tasks with animated progress.",
    target: "progress-pill",
    tag: "02 / Analytics",
  },
  {
    id: "metadata",
    title: "Deep Task Metas",
    desc: "Full checklists, sub-tasks, progress bars, priority levels, tags, and due dates on every card.",
    target: "card",
    tag: "03 / Rich Cards",
  },
  {
    id: "presence",
    title: "Live Drag Presence",
    desc: "See teammates moving and editing cards in real-time with color-coded peer indicators.",
    target: "presence",
    tag: "04 / Multiplayer",
  },
];

export function KanbanShowcase() {
  const [activeAnnotation, setActiveAnnotation] = useState<string>("all");
  const [completedTaskMap, setCompletedTaskMap] = useState<
    Record<string, boolean>
  >({
    "task-5": true,
    "task-6": true,
  });

  const toggleTaskCompletion = (taskId: string) => {
    setCompletedTaskMap((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const totalTasks = mockColumns.reduce(
    (acc, col) => acc + col.tasks.length,
    0
  );
  const doneTasks = Object.values(completedTaskMap).filter(Boolean).length;
  const progressPercent = Math.round((doneTasks / totalTasks) * 100);

  return (
    <section
      className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      id="canvas"
    >
      <div className="mx-auto max-w-3xl text-center">
        <span className="font-mono text-primary/70 text-xs uppercase tracking-[0.25em]">
          Spatial Kanban Engine
        </span>
        <h2
          className="mt-3 font-bold text-3xl text-foreground sm:text-5xl lg:text-6xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          A real board built for how visual thinkers work.
        </h2>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          No rigid constraints. Place boards anywhere on an infinite canvas.
          Every card carries deep metadata, checklists, and real-time
          multiplayer drag presence.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <button
          className={`cursor-pointer rounded-xl border px-3.5 py-1.5 font-mono text-xs transition-all ${
            activeAnnotation === "all"
              ? "border-primary/60 bg-primary/10 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.15)]"
              : "border-border/40 bg-card/40 text-muted-foreground hover:border-border/80 hover:text-foreground"
          }`}
          onClick={() => setActiveAnnotation("all")}
          type="button"
        >
          All Features
        </button>
        {annotations.map((ann) => (
          <button
            className={`cursor-pointer rounded-xl border px-3.5 py-1.5 font-mono text-xs transition-all ${
              activeAnnotation === ann.id
                ? "border-primary/60 bg-primary/10 text-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.15)]"
                : "border-border/40 bg-card/40 text-muted-foreground hover:border-border/80 hover:text-foreground"
            }`}
            key={ann.id}
            onClick={() => setActiveAnnotation(ann.id)}
            type="button"
          >
            {ann.title}
          </button>
        ))}
      </div>

      <div className="relative mt-10">
        <div
          className={`relative mx-auto w-full overflow-hidden rounded-2xl border transition-all duration-300 ${
            activeAnnotation === "spatial" || activeAnnotation === "all"
              ? "border-primary/50 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.12),inset_0_-2px_6px_rgba(0,0,0,0.5)] ring-1 ring-primary/20"
              : "border-border/60 bg-card/80 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-2px_6px_rgba(0,0,0,0.4)]"
          } bg-linear-to-b from-card via-background to-card/95 backdrop-blur-md`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-border/60 border-b bg-muted/30 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]">
                <Sparkles className="h-4 w-4" />
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
              <div
                className={`relative flex items-center gap-1.5 overflow-hidden rounded-full border px-3 py-1 font-mono text-xs transition-all ${
                  activeAnnotation === "telemetry" || activeAnnotation === "all"
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                    : "border-border/50 bg-secondary/50 text-muted-foreground"
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500/20 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
                <span className="relative flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-semibold text-emerald-400">
                    {doneTasks}/{totalTasks}
                  </span>
                  <span className="opacity-80">({progressPercent}%)</span>
                </span>
              </div>

              <button
                className="hidden items-center gap-1 rounded-lg border border-border/50 bg-card/60 px-2.5 py-1 text-muted-foreground text-xs shadow-xs transition-colors hover:border-border hover:bg-card hover:text-foreground sm:flex"
                type="button"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Task</span>
              </button>

              <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-card/40 p-0.5 text-muted-foreground">
                <button
                  aria-label="View settings"
                  className="cursor-pointer rounded p-1 hover:bg-secondary/60 hover:text-foreground"
                  type="button"
                >
                  <Sliders className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3 md:gap-5 md:p-6">
            {mockColumns.map((col) => {
              const ColIcon = col.icon;
              return (
                <div
                  className="flex flex-col rounded-xl border border-border/40 bg-secondary/15 p-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]"
                  key={col.id}
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <ColIcon
                        className="h-3.5 w-3.5"
                        style={{ color: col.accent }}
                      />
                      <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
                        {col.name}
                      </h4>
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary font-mono text-[10px] text-muted-foreground">
                        {col.tasks.length}
                      </span>
                    </div>

                    <button
                      aria-label={`Add task to ${col.name}`}
                      className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
                      type="button"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {col.tasks.map((task) => {
                      const isCompleted = !!completedTaskMap[task.id];
                      const isDragTarget = !!task.collaborator;

                      return (
                        <div
                          className={`group relative overflow-hidden rounded-xl border p-3.5 transition-all duration-200 ${
                            isDragTarget &&
                            (
                              activeAnnotation === "presence" ||
                                activeAnnotation === "all"
                            )
                              ? "border-emerald-500/70 bg-card/95 shadow-[0_0_20px_rgba(16,185,129,0.2),inset_0_1px_2px_rgba(255,255,255,0.15)] ring-1 ring-emerald-500/40"
                              : isCompleted
                                ? "border-border/30 bg-muted/20 opacity-75 hover:opacity-100"
                                : "border-border/50 bg-card/90 shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(255,255,255,0.08)] hover:border-border/90 hover:shadow-[0_6px_16px_rgba(0,0,0,0.3)]"
                          }`}
                          key={task.id}
                        >
                          {task.collaborator && (
                            <div className="mb-2 flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1">
                              <div className="flex items-center gap-1.5">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 font-bold text-[9px] text-white">
                                  {task.collaborator.avatar}
                                </span>
                                <span className="font-medium text-[10px] text-emerald-300">
                                  {task.collaborator.name}
                                </span>
                              </div>
                              <span className="font-mono text-[9px] text-emerald-400/80">
                                Moving card
                              </span>
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-2">
                            <h5
                              className={`font-semibold text-card-foreground text-xs leading-snug sm:text-sm ${
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

                          <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
                            {task.description}
                          </p>

                          {task.progress > 0 && (
                            <div className="mt-2.5 space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground/80">
                                  Sub-tasks Progress
                                </span>
                                <span className="font-medium font-mono text-foreground/80">
                                  {task.progress}%
                                </span>
                              </div>
                              <div className="h-1 w-full overflow-hidden rounded-full bg-secondary/70">
                                <div
                                  className="h-full bg-primary/80 transition-all duration-300"
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-border/20 border-t pt-2 text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`rounded border px-1.5 py-0.5 font-medium font-mono ${
                                  priorityConfig[task.priority].bg
                                }`}
                              >
                                {priorityConfig[task.priority].label}
                              </span>

                              {task.checklist.total > 0 && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <CheckSquare className="h-3 w-3" />
                                  <span className="font-mono">
                                    {task.checklist.completed}/
                                    {task.checklist.total}
                                  </span>
                                </div>
                              )}
                            </div>

                            {task.dueDate && (
                              <div
                                className={`flex items-center gap-1 font-mono ${
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
                                  className="rounded bg-secondary/50 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
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
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-border/40 border-t bg-muted/20 px-4 py-2 text-muted-foreground">
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <span>SPATIAL SNAP: 16px GRID</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <span>840 × 520 px</span>
              <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary">
                <Move className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-linear-to-b from-primary/10 via-transparent to-primary/5 opacity-40 blur-2xl" />
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {annotations.map((ann) => {
          const isSelected =
            activeAnnotation === ann.id || activeAnnotation === "all";
          return (
            <button
              className={`cursor-pointer rounded-2xl border p-5 text-left transition-all duration-200 ${
                isSelected
                  ? "border-primary/40 bg-linear-to-b from-card via-background to-card shadow-[inset_0_1px_3px_rgba(255,255,255,0.1),0_4px_16px_rgba(0,0,0,0.3)]"
                  : "border-border/30 bg-card/20 opacity-60 hover:opacity-100"
              }`}
              key={ann.id}
              onClick={() => setActiveAnnotation(ann.id)}
              type="button"
            >
              <span className="font-mono text-[10px] text-primary/70 uppercase tracking-wider">
                {ann.tag}
              </span>
              <h4
                className="mt-1.5 font-bold text-foreground text-lg"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {ann.title}
              </h4>
              <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                {ann.desc}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
