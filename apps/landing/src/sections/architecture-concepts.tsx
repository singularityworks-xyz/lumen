"use client";

import {
  Brain,
  Check,
  ChevronDown,
  Copy,
  Info,
  RotateCcw,
  Shell,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  SnakeArrowBottomLeft,
  SnakeArrowBottomRight,
  SnakeArrowTopLeft,
  SnakeArrowTopRight,
} from "../components/hero-arrows";
import LarityOrb from "../components/larity-orb";
import { cn } from "../lib/utils";

interface DemoMessage {
  content: string;
  id: number;
  role: "user" | "assistant";
  toolCall?: {
    label: string;
    result: Record<string, unknown>;
    status?: "done";
  };
}

const suggestions = [
  {
    id: "s1",
    label: "Create a task to ship the WebGL viewport",
    reply:
      "Created the task. I put it in Core Engine & Architecture, To Do column, tagged it #viewport #perf, and set priority to high. It will surface on your board the next time you open the workspace.",
    toolCall: {
      label: "Create Task",
      result: {
        success: true,
        task: {
          title: "Ship the WebGL viewport",
          column: "To Do",
          priority: "high",
        },
      },
    },
  },
  {
    id: "s2",
    label: "Summarize the In Progress column",
    reply:
      "In Progress has 2 open tasks: Multiplayer Drag Presence Overlay (80%) and Spatial Connectors & Dynamic Bezier Paths (65%). Both are on track; nothing is blocked.",
  },
  {
    id: "s3",
    label: "What is blocking the board?",
    reply:
      "Nothing is currently blocked. The oldest open task is the Local SQLite & Yjs Storage Engine, in To Do since last sprint. Want me to move it into In Progress?",
  },
];

const initialMessages: DemoMessage[] = [
  {
    id: 1,
    role: "user",
    content: "How far along is the offline sync engine?",
  },
  {
    id: 2,
    role: "assistant",
    content:
      "The write queue is done and the CRDT state vectors are merged. Delta compaction is the remaining 35% on the storage task.",
    toolCall: {
      label: "Search Tasks",
      result: {
        success: true,
        matches: [
          "Local SQLite & Yjs Storage Engine",
          "Binary CRDT State Vector Compression",
        ],
      },
    },
  },
];

const tokenFormat = (tokens: number) =>
  tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K` : String(tokens);

export function ArchitectureConceptsSection() {
  const [messages, setMessages] = useState<DemoMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [activeTool, setActiveTool] = useState<DemoMessage["toolCall"] | null>(
    null
  );
  const [expandedTool, setExpandedTool] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(3);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearPendingTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    for (const timeout of timeoutsRef.current) {
      clearTimeout(timeout);
    }
    timeoutsRef.current = [];
  }, []);

  // Scroll to the newest content whenever the visible conversation changes;
  // the deps are the trigger, the body only touches the ref.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll position is driven by conversation state
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamedText, isThinking]);

  // Clear any pending stream timers on unmount (stable callback, empty deps)
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable ref cleanup on unmount only
  useEffect(() => clearPendingTimers, []);

  const handleSend = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || isThinking) {
        return;
      }

      const userMessage: DemoMessage = {
        id: nextId.current,
        role: "user",
        content,
      };
      nextId.current += 1;
      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsThinking(true);
      setStreamedText("");
      setActiveTool(null);

      // Match against canned suggestions; otherwise fall back to a generic
      // reply so the drawer is never a dead control.
      const match = suggestions.find((s) => s.label === content);
      const reply =
        match?.reply ??
        "I can do that. I read the workspace state and found no blockers. Want me to open the relevant board?";
      const tool = match?.toolCall;

      const replyId = nextId.current;
      nextId.current += 1;

      // Simulate the tool call completing first, then stream the reply.
      const toolDelay = setTimeout(() => {
        setActiveTool(tool ?? null);
      }, 600);

      const streamStart = setTimeout(() => {
        let index = 0;
        const words = reply.split(" ");
        setIsThinking(false);
        intervalRef.current = setInterval(() => {
          index += 1;
          setStreamedText(words.slice(0, index).join(" "));
          if (index >= words.length) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setMessages((prev) => [
              ...prev,
              {
                id: replyId,
                role: "assistant",
                content: reply,
                toolCall: tool,
              },
            ]);
            setStreamedText("");
            setActiveTool(null);
          }
        }, 60);
      }, 1200);

      timeoutsRef.current.push(toolDelay, streamStart);
    },
    // clearPendingTimers is a stable ref-based callback and can be omitted
    [isThinking]
  );

  const handleSuggestionClick = useCallback(
    (prompt: string) => {
      handleSend(prompt);
    },
    [handleSend]
  );

  const handleRegenerate = useCallback(() => {
    if (isThinking || streamedText) {
      return;
    }
    // Re-send the most recent user message to produce a fresh reply
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      handleSend(lastUser.content);
    }
  }, [isThinking, streamedText, messages, handleSend]);

  const handleClearConversation = useCallback(() => {
    clearPendingTimers();
    setShowClearConfirm(false);
    setMessages([]);
    setStreamedText("");
    setIsThinking(false);
    setActiveTool(null);
    nextId.current = 1;
  }, [clearPendingTimers]);

  const handleCopy = useCallback(async () => {
    try {
      const last = messages.at(-1);
      if (last && last.role === "assistant") {
        await navigator.clipboard.writeText(last.content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }
    } catch {
      // clipboard unavailable in test env
    }
  }, [messages]);
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const hasMessages = messages.length > 0;

  return (
    <section
      className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
      id="larity"
    >
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:col-span-5">
          <h2
            className="font-bold text-3xl text-foreground sm:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Ask your workspace, not a chatbot.
          </h2>
          <p className="mt-4 text-muted-foreground text-sm leading-relaxed sm:text-base">
            Larity reads the actual board state, runs tools against it, and
            shows you every step. Create tasks, summarize columns, trace
            dependencies. This drawer is the real component from the
            application, wired to a live demo conversation.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                className="cursor-pointer rounded-full border border-border/50 bg-muted/60 px-3 py-1.5 font-medium text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion.label)}
                type="button"
              >
                {suggestion.label}
              </button>
            ))}
          </div>

          <div className="mt-10 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                <Brain className="h-3.5 w-3.5 text-foreground" />
              </div>
              <div>
                <h4 className="font-medium text-foreground text-sm">
                  Tools, executed for real
                </h4>
                <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                  Search tasks, create cards, summarize boards. Every tool call
                  is rendered as a card with its result, expandable in place.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                <Shell className="h-3.5 w-3.5 text-foreground" />
              </div>
              <div>
                <h4 className="font-medium text-foreground text-sm">
                  Offline-first, always on
                </h4>
                <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                  Conversations persist locally. If the network drops, the
                  drawer tells you and your draft stays put.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* The live Larity drawer */}
        <div className="lg:col-span-7">
          <div className="group relative mx-auto w-full max-w-96">
            {/* Corner arrows point inward at the live drawer */}
            <SnakeArrowTopLeft className="pointer-events-none absolute -top-12 -left-12 hidden h-10 w-8 text-primary/50 sm:block" />
            <SnakeArrowTopRight className="pointer-events-none absolute -top-12 -right-12 hidden h-10 w-8 text-primary/50 sm:block" />
            <SnakeArrowBottomLeft className="pointer-events-none absolute -bottom-12 -left-12 hidden h-10 w-8 text-primary/50 sm:block" />
            <SnakeArrowBottomRight className="pointer-events-none absolute -right-12 -bottom-12 hidden h-10 w-8 text-primary/50 sm:block" />
            {/* On hover the chat wakes: the drawer lifts, the orb scales up
                and the message bubbles ripple upward in sequence */}
            <div className="flex h-[500px] w-full flex-col overflow-hidden rounded-2xl border-2 border-border/50 bg-card/98 shadow-[0_8px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(0,0,0,0.05),inset_0_2px_8px_rgba(0,0,0,0.15),inset_0_-2px_6px_rgba(255,255,255,0.05)] backdrop-blur-xl transition-all duration-500 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_16px_56px_rgba(0,0,0,0.6),0_0_0_1px_rgba(0,0,0,0.05),inset_0_2px_8px_rgba(0,0,0,0.15),inset_0_-2px_6px_rgba(255,255,255,0.05)]">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-border/50 border-b bg-linear-to-b from-muted/50 to-transparent px-4 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <LarityOrb
                    className="transition-transform duration-500 ease-out group-hover:scale-110"
                    size="md"
                    speed={isThinking ? 0.8 : 0.4}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-foreground text-sm">
                      Larity
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      {isThinking
                        ? "Thinking..."
                        : "powered by Singularity Works"}
                    </p>
                  </div>
                </div>{" "}
                <div className="flex shrink-0 items-center gap-2">
                  {hasMessages && (
                    <button
                      aria-label="Clear conversation"
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setShowClearConfirm(true)}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div
                className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-4"
                data-testid="larity-messages"
                ref={scrollRef}
              >
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                    <div className="mb-4">
                      <LarityOrb size="xl" speed={0.4} />
                    </div>
                    <p className="font-medium text-muted-foreground text-sm">
                      How can I help you today?
                    </p>
                    <p className="mt-1 max-w-50 text-muted-foreground/60 text-xs">
                      Ask me about your workspace, create tasks, or get
                      suggestions
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((message, index) => (
                      <div
                        className={cn(
                          "flex max-w-[90%] gap-2.5 transition-transform duration-300 ease-out group-hover:-translate-y-0.5",
                          message.role === "user"
                            ? "ml-auto flex-row-reverse"
                            : "mr-auto"
                        )}
                        key={message.id}
                        style={{ transitionDelay: `${index * 60}ms` }}
                      >
                        {message.role === "user" ? (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <span className="font-semibold text-[10px]">Y</span>
                          </div>
                        ) : (
                          <LarityOrb size="sm" speed={0.3} />
                        )}
                        <div
                          className={cn(
                            "flex flex-col gap-1.5",
                            message.role === "user"
                              ? "items-end"
                              : "items-start"
                          )}
                        >
                          {message.toolCall && (
                            <div className="flex w-full flex-col">
                              <button
                                className={cn(
                                  "inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-border/50 bg-muted/50 px-2 py-1 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                                )}
                                onClick={() =>
                                  setExpandedTool((expanded) => !expanded)
                                }
                                type="button"
                              >
                                <Check
                                  className="h-3 w-3 text-emerald-400"
                                  strokeWidth={2.5}
                                />
                                <span className="font-medium text-[10px]">
                                  {message.toolCall.label}
                                </span>
                                <ChevronDown
                                  className={cn(
                                    "h-3 w-3 transition-transform duration-200",
                                    expandedTool && "rotate-180"
                                  )}
                                  strokeWidth={2}
                                />
                              </button>
                              {expandedTool && (
                                <div className="mt-1.5 max-h-40 overflow-auto rounded-lg border border-border/40 bg-muted/50 p-2.5">
                                  <pre className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                                    {JSON.stringify(
                                      message.toolCall.result,
                                      null,
                                      2
                                    )}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}

                          <div
                            className={cn(
                              "relative rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                              "shadow-[inset_0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(0,0,0,0.1)]",
                              message.role === "user"
                                ? "rounded-br-md bg-primary text-primary-foreground"
                                : "rounded-bl-md bg-muted/80 text-foreground"
                            )}
                          >
                            <p className="whitespace-pre-wrap">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}

                    {isThinking && (
                      <div className="mr-auto flex max-w-[90%] gap-2.5">
                        <LarityOrb size="sm" speed={0.8} />
                        <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted/80 px-3.5 py-2.5 text-muted-foreground">
                          <span className="flex gap-0.5">
                            {[0, 1, 2].map((i) => (
                              <span
                                className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/40"
                                key={i}
                                style={{ animationDelay: `${i * 0.15}s` }}
                              />
                            ))}
                          </span>
                          <span className="text-[11px]">
                            {activeTool
                              ? `Running ${activeTool.label.toLowerCase()}...`
                              : "Thinking..."}
                          </span>
                        </div>
                      </div>
                    )}

                    {streamedText && (
                      <div className="mr-auto flex max-w-[90%] gap-2.5">
                        <LarityOrb size="sm" speed={0.3} />
                        <div className="relative rounded-2xl rounded-bl-md bg-muted/80 px-3.5 py-2.5 text-[13px] text-foreground shadow-[inset_0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(0,0,0,0.1)]">
                          <p className="whitespace-pre-wrap">
                            {streamedText}
                            <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-foreground/60 align-middle" />
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Clear confirm */}
                {showClearConfirm && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-64 rounded-2xl border border-border/50 bg-card/95 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
                      <div className="mb-4 flex justify-center">
                        <LarityOrb size="lg" speed={0.3} />
                      </div>
                      <h4 className="mb-1 text-center font-medium text-foreground text-sm">
                        Clear conversation?
                      </h4>
                      <p className="mb-4 text-center text-muted-foreground text-xs">
                        This will delete all messages. This action cannot be
                        undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 cursor-pointer rounded-xl border border-border/40 bg-muted/40 px-3 py-2 font-medium text-muted-foreground text-xs transition-colors hover:bg-muted/60"
                          onClick={() => setShowClearConfirm(false)}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="flex-1 cursor-pointer rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 font-medium text-destructive text-xs transition-colors hover:bg-destructive/20"
                          onClick={handleClearConversation}
                          type="button"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Assistant metadata row */}
              {lastAssistant && !isThinking && !streamedText && (
                <div className="flex items-center justify-between px-4 pb-1 opacity-70">
                  <div className="flex items-center gap-2 text-muted-foreground/60">
                    <Info className="h-2.5 w-2.5" />
                    <span className="font-mono text-[9px]">
                      {tokenFormat(318)} tokens · 1.2s
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      aria-label="Copy"
                      className="flex h-3 w-3 cursor-pointer items-center justify-center text-muted-foreground/40 transition-colors hover:text-foreground"
                      onClick={handleCopy}
                      title="Copy"
                      type="button"
                    >
                      {isCopied ? (
                        <Check className="h-2.5 w-2.5" />
                      ) : (
                        <Copy className="h-2.5 w-2.5" />
                      )}
                    </button>{" "}
                    <button
                      aria-label="Regenerate"
                      className="flex h-3 w-3 cursor-pointer items-center justify-center text-muted-foreground/40 transition-colors hover:text-foreground"
                      onClick={handleRegenerate}
                      title="Regenerate"
                      type="button"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="border-border/30 border-t px-3 py-2">
                <div className="flex items-end gap-2">
                  <textarea
                    aria-label="Message Larity"
                    className="max-h-24 min-h-9 flex-1 resize-none overflow-hidden rounded-xl border border-border/40 bg-muted/40 px-3 py-2 text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] placeholder:text-muted-foreground/50 focus:border-border/60 focus:outline-none"
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(inputValue);
                      }
                    }}
                    placeholder="Message Larity..."
                    rows={1}
                    value={inputValue}
                  />
                  <button
                    aria-label={isThinking ? "Cancel" : "Send message"}
                    className={cn(
                      "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors",
                      inputValue.trim() && !isThinking
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted/60 text-muted-foreground"
                    )}
                    disabled={!inputValue.trim() || isThinking}
                    onClick={() => handleSend(inputValue)}
                    type="button"
                  >
                    {isThinking ? (
                      <span className="flex gap-0.5">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-current" />
                        <span
                          className="h-1 w-1 animate-pulse rounded-full bg-current"
                          style={{ animationDelay: "0.15s" }}
                        />
                        <span
                          className="h-1 w-1 animate-pulse rounded-full bg-current"
                          style={{ animationDelay: "0.3s" }}
                        />
                      </span>
                    ) : (
                      <svg
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 19V5M5 12l7-7 7 7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
