"use client";

import {
  Building2,
  Check,
  ChevronDown,
  CircleDot,
  GitPullRequest,
  Link2,
  Plus,
  Share2,
  User,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

interface DemoWorkspace {
  description?: string;
  id: string;
  isShared: boolean;
  name: string;
  ownerName?: string;
}

const initialWorkspaces: DemoWorkspace[] = [
  {
    id: "ws-1",
    name: "Singularity Core Engineering",
    description: "Spatial execution pipeline",
    isShared: true,
  },
  {
    id: "ws-2",
    name: "Personal Scratchpad",
    description: "Private workspace",
    isShared: false,
  },
];

const sharedWorkspaces: DemoWorkspace[] = [
  {
    id: "ws-3",
    name: "Design Systems & UI",
    description: "Tokens, components, motion",
    isShared: true,
    ownerName: "Elena",
  },
];

interface IssueLabel {
  color: string;
  name: string;
}

interface DemoIssue {
  id: string;
  labels: IssueLabel[];
  number: number;
  open: boolean;
  title: string;
}

const demoIssues: DemoIssue[] = [
  {
    id: "i1",
    number: 128,
    title: "Cards disappear after an offline merge",
    labels: [{ name: "bug", color: "#d73a4a" }],
    open: true,
  },
  {
    id: "i2",
    number: 127,
    title: "Presence cursors drift on high-DPI screens",
    labels: [{ name: "bug", color: "#d73a4a" }],
    open: true,
  },
  {
    id: "i3",
    number: 124,
    title: "Link a board to a GitHub repository",
    labels: [{ name: "enhancement", color: "#0e7490" }],
    open: true,
  },
  {
    id: "i4",
    number: 119,
    title: "Share a workspace from the board menu",
    labels: [
      { name: "enhancement", color: "#0e7490" },
      { name: "shipped", color: "#15803d" },
    ],
    open: false,
  },
];

const openIssueCount = demoIssues.filter((issue) => issue.open).length;
const closedIssueCount = demoIssues.length - openIssueCount;

let workspaceCounter = 0;
let shareCounter = 0;

export function WorkspaceFeaturesSection() {
  const [workspaces, setWorkspaces] =
    useState<DemoWorkspace[]>(initialWorkspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("ws-1");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    },
    []
  );

  const activeWorkspace =
    [...workspaces, ...sharedWorkspaces].find(
      (ws) => ws.id === activeWorkspaceId
    ) ?? workspaces[0];

  const createWorkspace = () => {
    workspaceCounter += 1;
    const id = `ws-new-${workspaceCounter}`;
    setWorkspaces((prev) => [
      ...prev,
      {
        id,
        name: `New Workspace ${workspaceCounter}`,
        description: "Private workspace",
        isShared: false,
      },
    ]);
    setActiveWorkspaceId(id);
    setWorkspaceOpen(false);
  };

  const handleCreateShareLink = () => {
    if (shareLink || shareLoading) {
      return;
    }
    setShareLoading(true);
    shareTimeoutRef.current = setTimeout(() => {
      shareCounter += 1;
      setShareLink(
        `https://canvas.itssingularity.com/w/lumen-share-${shareCounter}`
      );
      setShareLoading(false);
    }, 600);
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) {
      return;
    }
    setCopied(true);
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink);
      }
    } catch {
      // clipboard unavailable in test env
    }
  };

  return (
    <section
      className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      id="workspace"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2
          className="font-bold text-3xl text-foreground sm:text-5xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          One workspace, every way in.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground text-sm leading-relaxed sm:text-base">
          Switch between workspaces, hand out share links and track GitHub
          issues from the same boards. Workspace switching and sharing are the
          application's real components; issue tracking is planned.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Workspace selector, the real component */}
        <div className="relative flex flex-col rounded-2xl border border-border/30 bg-linear-to-br from-background via-background to-muted p-5 shadow-[0_0_24px_rgba(255,255,255,0.05),inset_0_2px_10px_rgba(255,255,255,0.08),inset_0_-2px_10px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-30" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                <Building2 className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Workspace switching
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Real selector, live workspaces
                </p>
              </div>
            </div>

            <div className="relative">
              <button
                className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-xl border-2 border-border/50 bg-card/95 px-4 font-medium shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] transition-colors hover:bg-card/98"
                onClick={() => setWorkspaceOpen((open) => !open)}
                type="button"
              >
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="max-w-40 truncate text-sm">
                  {activeWorkspace.name}
                </span>
                <ChevronDown
                  className={cn(
                    "ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                    workspaceOpen && "rotate-180"
                  )}
                />
              </button>

              {workspaceOpen && (
                <div className="absolute top-12 right-0 left-0 z-20 rounded-xl border-2 border-border/50 bg-card/98 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
                  <div className="px-2 py-1.5 font-semibold text-muted-foreground text-xs">
                    My Workspaces
                  </div>
                  {workspaces.map((ws) => (
                    <button
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left transition-colors",
                        activeWorkspaceId === ws.id
                          ? "bg-accent/50"
                          : "hover:bg-accent/30"
                      )}
                      key={ws.id}
                      onClick={() => {
                        setActiveWorkspaceId(ws.id);
                        setWorkspaceOpen(false);
                      }}
                      type="button"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-sm">
                            {ws.name}
                          </span>
                          {ws.isShared && (
                            <span className="flex shrink-0 items-center gap-1 rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] text-zinc-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              <Users className="h-3 w-3" />
                              SHARED
                            </span>
                          )}
                        </div>
                        {ws.description && (
                          <span className="truncate text-muted-foreground text-xs">
                            {ws.description}
                          </span>
                        )}
                      </div>
                      {activeWorkspaceId === ws.id && (
                        <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  ))}

                  <div className="my-2 h-px bg-border/50" />
                  <div className="px-2 py-1.5 font-semibold text-muted-foreground text-xs">
                    Shared with Me
                  </div>
                  {sharedWorkspaces.map((ws) => (
                    <button
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left transition-colors",
                        activeWorkspaceId === ws.id
                          ? "bg-accent/50"
                          : "hover:bg-accent/30"
                      )}
                      key={ws.id}
                      onClick={() => {
                        setActiveWorkspaceId(ws.id);
                        setWorkspaceOpen(false);
                      }}
                      type="button"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium text-sm">
                            {ws.name}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate text-muted-foreground text-xs">
                            {ws.ownerName}
                          </span>
                        </div>
                      </div>
                      {activeWorkspaceId === ws.id && (
                        <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  ))}

                  <div className="my-2 h-px bg-border/50" />
                  <button
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 font-medium transition-colors hover:bg-accent/30"
                    onClick={createWorkspace}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm">Create Workspace</span>
                  </button>
                </div>
              )}
            </div>

            <p className="mt-4 text-muted-foreground text-xs leading-relaxed">
              The same selector the app pins to the canvas: switch workspaces in
              place, keep personal and shared ones apart, and create new ones
              without leaving the board.
            </p>
          </div>
        </div>

        {/* Share dialog, the real component */}
        <div className="relative flex flex-col rounded-2xl border border-border/30 bg-linear-to-br from-background via-background to-muted p-5 shadow-[0_0_24px_rgba(255,255,255,0.05),inset_0_2px_10px_rgba(255,255,255,0.08),inset_0_-2px_10px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-30" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                <Share2 className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Share links
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Real share dialog flow
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-muted/20">
              <div className="flex items-center justify-between gap-2 border-border/40 border-b bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary">
                    <Share2 className="h-3 w-3" />
                  </span>
                  <span className="font-semibold text-xs">Share Board</span>
                </div>
                <span className="flex h-5 max-w-32 items-center gap-1 truncate rounded bg-primary/10 px-1.5 text-[10px] text-primary">
                  <span className="truncate">Core Engine & Architecture</span>
                </span>
              </div>

              <div className="flex flex-1 flex-col p-3">
                <p className="mb-3 text-muted-foreground text-xs leading-relaxed">
                  Create a shareable link for this workspace. Anyone with the
                  link can view and collaborate on this board.
                </p>

                {shareLink ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-border/40 bg-card/60 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground"
                        readOnly
                        value={shareLink}
                      />
                      <button
                        className="shrink-0 cursor-pointer rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 font-medium text-xs transition-colors hover:bg-card hover:text-foreground"
                        onClick={handleCopyShareLink}
                        type="button"
                      >
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Anyone with this link can join as a collaborator.
                    </p>
                  </div>
                ) : (
                  <button
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 font-semibold text-primary-foreground text-xs transition-opacity hover:opacity-90 disabled:opacity-60"
                    disabled={shareLoading}
                    onClick={handleCreateShareLink}
                    type="button"
                  >
                    <Link2 className="h-4 w-4" />
                    {shareLoading ? "Creating..." : "Create Share Link"}
                  </button>
                )}
              </div>
            </div>

            <p className="mt-4 text-muted-foreground text-xs leading-relaxed">
              Generate a link, copy it, and anyone with it joins the workspace
              as a collaborator, exactly like the app's share dialog.
            </p>
          </div>
        </div>

        {/* GitHub issue tracking, planned */}
        <div className="relative flex flex-col rounded-2xl border border-border/30 bg-linear-to-br from-background via-background to-muted p-5 shadow-[0_0_24px_rgba(255,255,255,0.05),inset_0_2px_10px_rgba(255,255,255,0.08),inset_0_-2px_10px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-primary/5 via-transparent to-primary/10 opacity-30" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                <GitPullRequest className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground text-sm">
                  GitHub issue tracking
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Boards meet issues
                </p>
              </div>
              <span className="ml-auto shrink-0 rounded bg-secondary/80 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                PLANNED
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/50 bg-muted/20">
              <div className="flex items-center justify-between gap-2 border-border/40 border-b bg-muted/40 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium text-[11px]">
                    singularityworks-xyz/lumen
                  </span>
                </div>
                <div className="flex shrink-0 gap-2 font-mono text-[9px]">
                  <span className="text-emerald-400">
                    {openIssueCount} open
                  </span>
                  <span className="text-muted-foreground">
                    {closedIssueCount} closed
                  </span>
                </div>
              </div>
              <ul className="divide-y divide-border/30">
                {demoIssues.map((issue) => (
                  <li
                    className="flex items-start gap-2 px-3 py-2"
                    key={issue.id}
                  >
                    <CircleDot
                      className={cn(
                        "mt-0.5 h-3 w-3 shrink-0",
                        issue.open
                          ? "text-emerald-400"
                          : "text-muted-foreground/50"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] text-foreground/90">
                        {issue.title}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {issue.labels.map((label) => (
                          <span
                            className="rounded px-1 py-0.5 font-medium text-[8px]"
                            key={label.name}
                            style={{
                              backgroundColor: `${label.color}22`,
                              color: label.color,
                            }}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[9px] text-muted-foreground/60">
                      #{issue.number}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 text-muted-foreground text-xs leading-relaxed">
              Boards will link straight to GitHub issues, with status and labels
              synced in place. This is on the roadmap.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
