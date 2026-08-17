"use client";

import {
  ArrowRight,
  Boxes,
  CheckCircle,
  type Cpu,
  GitBranch,
  GitMerge,
  Layers,
  Network,
  Share2,
  Sparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface ConnectedNode {
  accentColor: string;
  badge: string;
  description: string;
  icon: typeof Cpu;
  id: string;
  metrics: string;
  status: "synced" | "active" | "live" | "deployed";
  tasks: { done: boolean; title: string }[];
  title: string;
}

const nodes: ConnectedNode[] = [
  {
    id: "node-design",
    title: "Spatial Design System",
    badge: "01 / Interface",
    accentColor: "#a855f7",
    icon: Layers,
    description: "3D glassmorphic tokens, viewport anchors & auto-snapping.",
    metrics: "12 components • 0ms lag",
    status: "synced",
    tasks: [
      { title: "Dynamic Bezier Handle Ports", done: true },
      { title: "Inset Specular 3D Elevation", done: true },
      { title: "Infinite Pan/Zoom Viewport", done: true },
    ],
  },
  {
    id: "node-crdt",
    title: "Yjs CRDT Sync Core",
    badge: "02 / Engine",
    accentColor: "#10b981",
    icon: Zap,
    description:
      "Local-first state machine with zero-latency IndexedDB commits.",
    metrics: "0.2ms write • 0 conflicts",
    status: "live",
    tasks: [
      { title: "Binary State Vector Diffs", done: true },
      { title: "Offline Local Transaction Log", done: true },
      { title: "Deterministic Auto-Merge", done: true },
    ],
  },
  {
    id: "node-presence",
    title: "Phoenix Presence Hub",
    badge: "03 / Multiplayer",
    accentColor: "#3b82f6",
    icon: Share2,
    description: "Sub-15ms broadcast channels for peer cursors and live drag.",
    metrics: "60 fps • Global mesh",
    status: "active",
    tasks: [
      { title: "Cursor Coordinate Interpolation", done: true },
      { title: "Off-screen Radar Direction", done: true },
      { title: "In-situ Canvas Comments", done: true },
    ],
  },
  {
    id: "node-edge",
    title: "Global Edge Runtime",
    badge: "04 / Distribution",
    accentColor: "#f59e0b",
    icon: Network,
    description: "Cloudflare Workers & durable websocket relays at the edge.",
    metrics: "280+ locations • 99.99%",
    status: "deployed",
    tasks: [
      { title: "Zero-Downtime Migration", done: true },
      { title: "Multi-region Session Routing", done: true },
      { title: "Automated Snapshot Archive", done: true },
    ],
  },
];

const connectionPaths = [
  {
    from: "node-design",
    to: "node-crdt",
    label: "triggers state update",
    style: "solid",
    color: "#a855f7",
  },
  {
    from: "node-crdt",
    to: "node-presence",
    label: "streams delta to peers",
    style: "solid",
    color: "#10b981",
  },
  {
    from: "node-crdt",
    to: "node-edge",
    label: "persists to edge durable store",
    style: "dashed",
    color: "#f59e0b",
  },
  {
    from: "node-presence",
    to: "node-edge",
    label: "relays ephemeral rooms",
    style: "solid",
    color: "#3b82f6",
  },
];

export function ConnectedCardsSection() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  return (
    <section
      className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      id="connectors"
    >
      <div className="mx-auto max-w-3xl text-center">
        <span className="font-mono text-primary/70 text-xs uppercase tracking-[0.25em]">
          Spatial Workflow Graph
        </span>
        <h2
          className="mt-3 font-bold text-3xl text-foreground sm:text-5xl lg:text-6xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Connect your thoughts. Map your architecture.
        </h2>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          Break out of isolated silos. Draw visual links between boards, trace
          upstream dependencies, and build a living map of how your system
          actually functions.
        </p>
      </div>

      <div className="relative mt-12 overflow-hidden rounded-3xl border border-border/60 bg-linear-to-b from-card via-background to-card/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.08),inset_0_-2px_6px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-70" />

        <div className="relative z-10 mb-8 flex flex-wrap items-center justify-between gap-3 border-border/40 border-b pb-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <span className="font-medium font-mono text-foreground text-xs uppercase tracking-wider">
              Connected Graph View
            </span>
            <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
              4 Nodes • 4 Connectors
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              Design
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Engine
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Multiplayer
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Edge
            </span>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
          {nodes.map((node) => {
            const NodeIcon = node.icon;
            const isHovered = hoveredNode === node.id;
            const hasHover = hoveredNode !== null;
            const isDimmed = hasHover && !isHovered;

            return (
              <button
                className={`group relative cursor-pointer rounded-2xl border p-5 text-left transition-all duration-300 sm:p-6 ${
                  isHovered
                    ? "border-primary/70 bg-card shadow-[0_16px_36px_rgba(0,0,0,0.5),inset_0_2px_8px_rgba(255,255,255,0.15)] ring-1 ring-primary/30"
                    : isDimmed
                      ? "border-border/30 bg-card/40 opacity-60"
                      : "border-border/60 bg-card/75 shadow-[0_8px_24px_rgba(0,0,0,0.3),inset_0_1px_4px_rgba(255,255,255,0.08)] hover:border-border/90 hover:bg-card/90"
                }`}
                key={node.id}
                onBlur={() => setHoveredNode(null)}
                onFocus={() => setHoveredNode(node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                type="button"
              >
                <div
                  className="absolute -top-2 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background shadow-xs transition-transform group-hover:scale-125"
                  style={{ borderColor: node.accentColor }}
                >
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: node.accentColor }}
                  />
                </div>
                <div
                  className="absolute top-1/2 -right-2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-xs transition-transform group-hover:scale-125"
                  style={{ borderColor: node.accentColor }}
                >
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: node.accentColor }}
                  />
                </div>
                <div
                  className="absolute -bottom-2 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background shadow-xs transition-transform group-hover:scale-125"
                  style={{ borderColor: node.accentColor }}
                >
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: node.accentColor }}
                  />
                </div>
                <div
                  className="absolute top-1/2 -left-2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-xs transition-transform group-hover:scale-125"
                  style={{ borderColor: node.accentColor }}
                >
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: node.accentColor }}
                  />
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.15)]"
                      style={{
                        backgroundColor: `${node.accentColor}20`,
                        color: node.accentColor,
                        border: `1px solid ${node.accentColor}40`,
                      }}
                    >
                      <NodeIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <span
                        className="font-medium font-mono text-[10px] uppercase tracking-wider"
                        style={{ color: node.accentColor }}
                      >
                        {node.badge}
                      </span>
                      <h4 className="font-semibold text-base text-foreground">
                        {node.title}
                      </h4>
                    </div>
                  </div>

                  <span className="rounded-full bg-secondary/80 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
                    {node.status}
                  </span>
                </div>

                <p className="mt-3 text-muted-foreground text-xs leading-relaxed">
                  {node.description}
                </p>

                <div className="mt-4 space-y-2 rounded-xl border border-border/30 bg-background/50 p-3">
                  {node.tasks.map((task) => (
                    <div
                      className="flex items-center gap-2 text-foreground/90 text-xs"
                      key={task.title}
                    >
                      <CheckCircle
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: node.accentColor }}
                      />
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-border/20 border-t pt-3 font-mono text-[11px] text-muted-foreground">
                  <span>{node.metrics}</span>
                  <span className="flex items-center gap-1 text-primary/80 transition-transform group-hover:translate-x-1">
                    Inspect Port <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-border/40 bg-secondary/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Live Lumen Bezier Connectors
            </span>
            <span className="font-mono text-[10px] text-primary/80">
              Interactive Path Router
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {connectionPaths.map((conn) => (
              <div
                className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 px-3 py-2 text-xs shadow-xs"
                key={conn.label}
              >
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: conn.color }}
                />
                <span className="truncate font-mono text-[11px] text-foreground/90">
                  {conn.label}
                </span>
                <span className="ml-auto font-mono text-[9px] text-muted-foreground">
                  {conn.style}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-border/40 bg-card/40 p-6 shadow-[inset_0_1px_3px_rgba(255,255,255,0.08)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GitMerge className="h-4 w-4" />
          </div>
          <h4
            className="mt-3 font-bold text-foreground text-xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Upstream Dependency Tracking
          </h4>
          <p className="mt-2 text-muted-foreground text-xs leading-relaxed">
            Trace requirements across teams. If an API contract changes in
            backend, see exactly which frontend boards and deployment pipelines
            depend on it.
          </p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card/40 p-6 shadow-[inset_0_1px_3px_rgba(255,255,255,0.08)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Boxes className="h-4 w-4" />
          </div>
          <h4
            className="mt-3 font-bold text-foreground text-xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Non-Linear Spatial Workflow
          </h4>
          <p className="mt-2 text-muted-foreground text-xs leading-relaxed">
            Real engineering and creative projects aren't 1-dimensional lists.
            Branch, group, and merge tasks across an infinite spatial canvas.
          </p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card/40 p-6 shadow-[inset_0_1px_3px_rgba(255,255,255,0.08)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <h4
            className="mt-3 font-bold text-foreground text-xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Living Architectural Blueprint
          </h4>
          <p className="mt-2 text-muted-foreground text-xs leading-relaxed">
            Your task management doubles as your system architecture diagram.
            Keep docs, specs, and execution unified in a single spatial surface.
          </p>
        </div>
      </div>
    </section>
  );
}
