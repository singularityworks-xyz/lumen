"use client";

import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Cloud,
  CloudOff,
  Layers,
  Loader2,
  MessageSquare,
  Navigation,
  Plus,
  User,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useState } from "react";

export function ArchitectureConceptsSection() {
  const [networkOnline, setNetworkOnline] = useState(true);
  const [syncState, setSyncState] = useState<"synced" | "syncing" | "offline">(
    "synced"
  );
  const [opsCount, setOpsCount] = useState(482);
  const [activeWorkspace, setActiveWorkspace] = useState("ws-1");
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);

  const toggleNetwork = () => {
    if (networkOnline) {
      setNetworkOnline(false);
      setSyncState("offline");
    } else {
      setNetworkOnline(true);
      setSyncState("syncing");
      setTimeout(() => {
        setSyncState("synced");
        setOpsCount((c) => c + 3);
      }, 1200);
    }
  };

  const handleSimulateMutation = () => {
    setOpsCount((c) => c + 1);
    if (networkOnline) {
      setSyncState("syncing");
      setTimeout(() => setSyncState("synced"), 800);
    }
  };

  return (
    <section
      className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      id="architecture"
    >
      <div className="mx-auto max-w-3xl text-center">
        <span className="font-mono text-primary/70 text-xs uppercase tracking-[0.25em]">
          System Foundations
        </span>
        <h2
          className="mt-3 font-bold text-3xl text-foreground sm:text-5xl lg:text-6xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Engineered for spatial clarity, scale, and resilience.
        </h2>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          Three deep architectural pillars power every interaction in Lumen.
          Local-first by design, collaborative by default.
        </p>
      </div>

      <div className="mt-16 space-y-20 lg:space-y-28">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-linear-to-b from-card via-background to-card p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_2px_8px_rgba(255,255,255,0.08),inset_0_-2px_6px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-border/40 border-b pb-4">
                <div className="relative">
                  <button
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/60 bg-secondary/50 px-3.5 py-2 text-foreground text-xs shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-all hover:border-border hover:bg-secondary/80"
                    onClick={() =>
                      setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)
                    }
                    type="button"
                  >
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-semibold">
                      {activeWorkspace === "ws-1"
                        ? "Singularity Core Engineering"
                        : activeWorkspace === "ws-2"
                          ? "Design Systems & UI"
                          : "Personal Scratchpad"}
                    </span>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                      {activeWorkspace === "ws-3" ? "Private" : "4 Members"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>

                  {isWorkspaceDropdownOpen && (
                    <div className="absolute top-12 left-0 z-30 w-72 rounded-2xl border border-border/70 bg-card p-2 shadow-[0_12px_32px_rgba(0,0,0,0.6),inset_0_1px_3px_rgba(255,255,255,0.1)] backdrop-blur-xl">
                      <div className="px-2 py-1 font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
                        Team Workspaces
                      </div>
                      <button
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                          activeWorkspace === "ws-1"
                            ? "bg-primary/15 font-semibold text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        }`}
                        onClick={() => {
                          setActiveWorkspace("ws-1");
                          setIsWorkspaceDropdownOpen(false);
                        }}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-primary" />
                          <span>Singularity Core Engineering</span>
                        </div>
                        {activeWorkspace === "ws-1" && (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        )}
                      </button>
                      <button
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                          activeWorkspace === "ws-2"
                            ? "bg-primary/15 font-semibold text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        }`}
                        onClick={() => {
                          setActiveWorkspace("ws-2");
                          setIsWorkspaceDropdownOpen(false);
                        }}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="h-3.5 w-3.5 text-purple-400" />
                          <span>Design Systems & UI</span>
                        </div>
                        {activeWorkspace === "ws-2" && (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        )}
                      </button>

                      <div className="my-1 border-border/40 border-t" />
                      <div className="px-2 py-1 font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
                        Personal
                      </div>
                      <button
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                          activeWorkspace === "ws-3"
                            ? "bg-primary/15 font-semibold text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        }`}
                        onClick={() => {
                          setActiveWorkspace("ws-3");
                          setIsWorkspaceDropdownOpen(false);
                        }}
                        type="button"
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-blue-400" />
                          <span>Personal Scratchpad</span>
                        </div>
                        {activeWorkspace === "ws-3" && (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span className="rounded bg-secondary/50 px-2 py-1">
                    Zoom: 100%
                  </span>
                  <span className="rounded bg-secondary/50 px-2 py-1">
                    Pos: 0, 0
                  </span>
                </div>
              </div>

              <div className="relative rounded-2xl border-2 border-primary/30 border-dashed bg-primary/5 p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-[10px] text-primary">
                    [Area: Core Platform Subsystems]
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Bound: 960 × 480 px
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-card p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        ⚡ WebAssembly CRDT
                      </span>
                      <span className="font-mono text-[10px] text-emerald-400">
                        3/3 Done
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        <span>State vector diffing</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        <span>Binary encoding</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-card p-3.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        🌐 Edge WebSocket Relay
                      </span>
                      <span className="font-mono text-[10px] text-amber-400">
                        2/3 In Progress
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        <span>Phoenix Channel bindings</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 text-amber-400" />
                        <span>Reconnection backoff</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <span className="font-mono text-[10px] text-primary/70 uppercase tracking-wider">
              Concept 01 / Spatial Canvas
            </span>
            <h3
              className="mt-2 font-bold text-3xl text-foreground sm:text-4xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Workspaces with boundless spatial freedom.
            </h3>
            <p className="mt-4 text-muted-foreground text-sm leading-relaxed sm:text-base">
              Say goodbye to buried sub-folders and cramped sidebar menus. Lumen
              gives you an infinite 2D canvas per workspace. Group related
              boards into spatial bounding areas, zoom seamlessly from 10%
              galaxy view to 200% detail view, and switch between personal and
              team workspaces with a single hotkey.
            </p>

            <ul className="mt-6 space-y-3 font-mono text-foreground/80 text-xs">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Infinite pan, inertial zoom, and spatial clustering</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Seamless switching between team & personal domains</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>
                  Area bounding nodes to visually organize complex apps
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="order-2 lg:order-1 lg:col-span-5">
            <span className="font-mono text-[10px] text-primary/70 uppercase tracking-wider">
              Concept 02 / Multiplayer Presence
            </span>
            <h3
              className="mt-2 font-bold text-3xl text-foreground sm:text-4xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Real-time collaboration that feels like being in the room.
            </h3>
            <p className="mt-4 text-muted-foreground text-sm leading-relaxed sm:text-base">
              Work together seamlessly on the same canvas. Experience smooth
              60fps peer cursors, off-screen radar navigation indicators, live
              card drag ghosting, and contextual comment threads anchored
              directly onto tasks and boards.
            </p>

            <ul className="mt-6 space-y-3 font-mono text-foreground/80 text-xs">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Sub-15ms cursor interpolation over Phoenix Channels</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>
                  Off-screen edge radar so you never lose your teammates
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>
                  Threaded canvas comment clusters pinned directly to nodes
                </span>
              </li>
            </ul>
          </div>

          <div className="order-1 lg:order-2 lg:col-span-7">
            <div className="relative h-96 overflow-hidden rounded-3xl border border-border/60 bg-linear-to-b from-card via-background to-card p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_2px_8px_rgba(255,255,255,0.08),inset_0_-2px_6px_rgba(0,0,0,0.4)] backdrop-blur-md">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] opacity-60" />

              <div className="absolute top-12 left-16 z-20 transition-transform duration-700 hover:scale-105">
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="18"
                  style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}
                  viewBox="0 0 14 18"
                  width="14"
                >
                  <path
                    d="M1 1L1 16L5.5 11.5L12 11.5L1 1Z"
                    fill="#10b981"
                    stroke="white"
                    strokeLinejoin="round"
                    strokeWidth="1"
                  />
                </svg>
                <div className="absolute top-4 left-3 rounded-full bg-emerald-500 px-2 py-0.5 font-medium text-[10px] text-white shadow-md">
                  Sarah (Product)
                </div>
              </div>

              <div className="absolute top-36 right-24 z-20 transition-transform duration-700 hover:scale-105">
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="18"
                  style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}
                  viewBox="0 0 14 18"
                  width="14"
                >
                  <path
                    d="M1 1L1 16L5.5 11.5L12 11.5L1 1Z"
                    fill="#8b5cf6"
                    stroke="white"
                    strokeLinejoin="round"
                    strokeWidth="1"
                  />
                </svg>
                <div className="absolute top-4 left-3 rounded-full bg-purple-500 px-2 py-0.5 font-medium text-[10px] text-white shadow-md">
                  Liam (Lead Dev)
                </div>
              </div>

              <div className="absolute bottom-6 left-8 z-20 max-w-sm rounded-2xl border border-border/70 bg-card/95 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.6),inset_0_1px_3px_rgba(255,255,255,0.1)] backdrop-blur-xl">
                <div className="flex items-center justify-between border-border/30 border-b pb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    <span className="font-semibold text-foreground text-xs">
                      Canvas Discussion #42
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-emerald-400">
                    2 replies
                  </span>
                </div>

                <div className="mt-2.5 space-y-2">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500 font-bold text-[9px] text-white">
                      L
                    </span>
                    <div>
                      <span className="font-semibold text-foreground">
                        Liam:
                      </span>{" "}
                      <span className="text-muted-foreground">
                        Benchmarked 60fps panning with 1,000 active nodes on
                        WebGL.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 font-bold text-[9px] text-white">
                      S
                    </span>
                    <div>
                      <span className="font-semibold text-foreground">
                        Sarah:
                      </span>{" "}
                      <span className="text-muted-foreground">
                        Incredible. Let's roll to staging for team testing.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute top-6 right-4 z-20 flex cursor-pointer items-center gap-1.5 rounded-full bg-blue-500 px-3 py-1 text-white shadow-lg transition-transform hover:scale-105">
                <Navigation className="h-3 w-3 rotate-45" />
                <span className="font-medium text-[10px]">
                  Elena (Design) 420px →
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-linear-to-b from-card via-background to-card p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_2px_8px_rgba(255,255,255,0.08),inset_0_-2px_6px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-border/40 border-b pb-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.15)] transition-all ${
                      syncState === "synced"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : syncState === "syncing"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-blue-500/15 text-blue-400"
                    }`}
                  >
                    {syncState === "synced" ? (
                      <Cloud className="h-4 w-4" />
                    ) : syncState === "syncing" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CloudOff className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-xs">
                        {syncState === "synced"
                          ? "Yjs CRDT Document Synced"
                          : syncState === "syncing"
                            ? "Merging Delta Changes..."
                            : "Offline Mode (Local-First Active)"}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {networkOnline
                        ? "WebSocket Relay Active • Sub-5ms merge"
                        : "IndexedDB Local Store • Zero packet loss"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-xs transition-all ${
                      networkOnline
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    }`}
                    onClick={toggleNetwork}
                    type="button"
                  >
                    {networkOnline ? (
                      <>
                        <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Network: Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3.5 w-3.5 text-amber-400" />
                        <span>Network: Offline</span>
                      </>
                    )}
                  </button>

                  <button
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border/50 bg-secondary/50 px-3 py-1.5 font-mono text-foreground text-xs hover:bg-secondary"
                    onClick={handleSimulateMutation}
                    type="button"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Trigger Mutation</span>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/40 bg-background/80 p-4 font-mono text-xs">
                <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>TRANSACTION LOG & REPLICATION TELEMETRY</span>
                  <span>TOTAL OPS: {opsCount}</span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <span className="text-muted-foreground">[0.2ms]</span>
                    <span>LOCAL COMMIT: IndexedDB transaction persisted</span>
                  </div>
                  <div className="flex items-center gap-2 text-blue-400">
                    <span className="text-muted-foreground">[0.8ms]</span>
                    <span>
                      YJS STATE VECTOR: Binary delta computed (184 bytes)
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-2 ${
                      networkOnline ? "text-purple-400" : "text-amber-400"
                    }`}
                  >
                    <span className="text-muted-foreground">
                      {networkOnline ? "[4.2ms]" : "[QUEUED]"}
                    </span>
                    <span>
                      {networkOnline
                        ? "RELAY: Broadcasted to 4 peers over WebSocket"
                        : "OFFLINE: Op queued locally in SQLite transaction store"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground/90">
                    <span className="text-muted-foreground">[0.0ms]</span>
                    <span>
                      CRDT CONVERGENCE: Deterministic 0-conflict merge
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <span className="font-mono text-[10px] text-primary/70 uppercase tracking-wider">
              Concept 03 / Offline-First CRDT
            </span>
            <h3
              className="mt-2 font-bold text-3xl text-foreground sm:text-4xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Zero-latency local writes. Mathematical conflict resolution.
            </h3>
            <p className="mt-4 text-muted-foreground text-sm leading-relaxed sm:text-base">
              Lumen never blocks your keyboard waiting on a remote server. All
              actions commit instantaneously to your local device in under 1ms.
              When reconnecting to WiFi, Yjs CRDTs deterministically merge
              changes with no conflicting overwrites or lost work.
            </p>

            <ul className="mt-6 space-y-3 font-mono text-foreground/80 text-xs">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>
                  Instantaneous 0ms local mutation with IndexedDB & SQLite
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>
                  True offline capability — work anywhere on planes or trains
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>
                  Conflict-free Replicated Data Types guarantee convergence
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
