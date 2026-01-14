"use client";

import type { ContextSnapshot } from "@lumen/ai/types";
import { getSuggestionsForContext } from "@lumen/ai/types";
import { PulsingBorder } from "@paper-design/shaders-react";
import {
  ChevronRight,
  LayoutGrid,
  MessageCircle,
  Trash2,
  WifiOff,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SwitchButtons } from "@/src/components/ui/switch-buttons";
import { useAuth } from "@/src/hooks/use-auth";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../kanban";
import { streamChat } from "../lib/api-client";
import { useAiStore } from "../store/ai-store";
import { DotLoader } from "./animations/dot-loader";
import LarityOrb from "./animations/larity-orb";
import { SendButton } from "./animations/send-button";
import { MessageBubble } from "./message-bubble";
import { SuggestionChip } from "./suggestion-chip";

const heartbitFrames = [
  [],
  [3],
  [10, 2, 4, 3],
  [17, 9, 1, 11, 5, 10, 4, 3, 2],
  [24, 16, 8, 1, 3, 5, 18, 12, 17, 11, 4, 10, 9, 2],
  [31, 23, 15, 8, 10, 2, 4, 12, 25, 19, 24, 18, 11, 17, 16, 9],
  [38, 30, 22, 15, 17, 9, 11, 19, 32, 26, 31, 25, 18, 24, 23, 16],
  [38, 30, 22, 15, 17, 9, 11, 19, 32, 26, 31, 25, 18, 24, 23, 16],
  [
    38, 30, 22, 17, 9, 11, 19, 32, 26, 31, 25, 18, 24, 23, 16, 45, 37, 29, 21,
    14, 8, 15, 12, 20, 27, 33, 39,
  ],
  [
    38, 30, 22, 17, 9, 11, 19, 32, 26, 31, 25, 18, 24, 23, 16, 45, 37, 29, 21,
    14, 8, 15, 12, 20, 27, 33, 39,
  ],
  [38, 30, 22, 15, 17, 9, 11, 19, 32, 26, 31, 25, 18, 24, 23, 16],
  [38, 30, 22, 15, 17, 9, 11, 19, 32, 26, 31, 25, 18, 24, 23, 16],
  [
    38, 30, 22, 17, 9, 11, 19, 32, 26, 31, 25, 18, 24, 23, 16, 45, 37, 29, 21,
    14, 8, 15, 12, 20, 27, 33, 39,
  ],
  [
    38, 30, 22, 17, 9, 11, 19, 32, 26, 31, 25, 18, 24, 23, 16, 45, 37, 29, 21,
    14, 8, 15, 12, 20, 27, 33, 39,
  ],
  [38, 30, 22, 15, 17, 9, 11, 19, 32, 26, 31, 25, 18, 24, 23, 16],
  [39, 33, 37, 29, 17, 38, 30, 22, 15, 16, 23, 24, 31, 32, 25, 18, 26, 19],
  [17, 30, 16, 23, 24, 31, 32, 25, 18],
  [24],
];

type AiDrawerContentProps = {
  workspaceId: string;
  onClose: () => void;
  onSwitchToBoards?: () => void;
  onSwitchToComments?: () => void;
  boardCount?: number;
  commentCount?: number;
};

export const AiDrawerContent = memo(
  ({
    workspaceId,
    onClose,
    onSwitchToBoards,
    onSwitchToComments,
    boardCount = 0,
    commentCount = 0,
  }: AiDrawerContentProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [inputValue, setInputValue] = useState("");
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { isAuthenticated } = useAuth();
    const openProfileModal = useKanbanStore((state) => state.openProfileModal);
    // Subscribe to streamVersion to force re-renders during streaming
    const streamVersion = useAiStore(
      (state) => state.conversations[workspaceId]?.streamVersion ?? 0
    );
    const messages = useAiStore(
      (state) => state.conversations[workspaceId]?.messages
    );
    // Use streamVersion in a way that doesn't trigger lint warnings
    // This ensures we re-render when chunks arrive
    const _forceUpdate = streamVersion;
    const isStreaming = useAiStore(
      (state) => state.conversations[workspaceId]?.isStreaming ?? false
    );
    const isOffline = useAiStore((state) => state.isOffline);
    const sendMessage = useAiStore((state) => state.sendMessage);
    const addAssistantMessage = useAiStore(
      (state) => state.addAssistantMessage
    );
    const appendStreamChunk = useAiStore((state) => state.appendStreamChunk);
    const completeStream = useAiStore((state) => state.completeStream);
    const clearConversation = useAiStore((state) => state.clearConversation);
    const cancelStream = useAiStore((state) => state.cancelStream);
    const setStreamError = useAiStore((state) => state.setStreamError);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Memoize messages with stable empty array fallback
    const messagesList = useMemo(() => messages ?? [], [messages]);

    const currentContext: ContextSnapshot = useMemo(
      () => ({
        currentBoardId: null,
        selectedTaskIds: [],
        selectedBoardIds: [],
        viewportCenter: { x: 0, y: 0 },
        viewportZoom: 1,
      }),
      []
    );

    const suggestions = useMemo(
      () => getSuggestionsForContext(currentContext),
      [currentContext]
    );

    // Auto-scroll to bottom on new messages
    // biome-ignore lint/correctness/useExhaustiveDependencies: Only scroll on message count change
    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [messagesList.length]);

    // Set mounted state to prevent shader loading issues
    useEffect(() => {
      setMounted(true);
    }, []);

    const handleSend = useCallback(() => {
      const content = inputValue.trim();
      if (!content || isStreaming) {
        return;
      }

      setInputValue("");
      sendMessage(workspaceId, content, currentContext);
      const assistantId = addAssistantMessage(workspaceId, "");

      // Convert messages to history format for the API, including the new message
      const history = [
        ...messagesList.map((msg) => ({
          role: msg.role as "user" | "assistant" | "tool",
          content: msg.content,
        })),
        { role: "user" as const, content },
      ];

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      try {
        abortControllerRef.current = streamChat(
          {
            workspaceId,
            message: content,
            context: currentContext,
            history,
          },
          {
            onContentDelta: (chunk) => {
              appendStreamChunk(workspaceId, assistantId, chunk);
            },
            onMessageComplete: () => {
              completeStream(workspaceId, assistantId);
              abortControllerRef.current = null;
            },
            onError: (error) => {
              setStreamError(workspaceId, assistantId, error);
              abortControllerRef.current = null;
            },
          }
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to send message";
        setStreamError(workspaceId, assistantId, errorMessage);
      }
    }, [
      inputValue,
      isStreaming,
      workspaceId,
      currentContext,
      messagesList,
      sendMessage,
      addAssistantMessage,
      appendStreamChunk,
      completeStream,
      setStreamError,
    ]);

    const handleSuggestionClick = useCallback((prompt: string) => {
      setInputValue(prompt);
      inputRef.current?.focus();
    }, []);

    const handleCancel = useCallback(() => {
      // Abort the HTTP request if in progress
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Update store state
      cancelStream();
    }, [cancelStream]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      },
      [handleSend]
    );

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
            "relative z-10 flex h-full w-full flex-col",
            "overflow-hidden rounded-2xl",
            "bg-card/98 backdrop-blur-xl",
            "border-2 border-border/50",
            "shadow-[0_8px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05),inset_0_2px_8px_rgba(0,0,0,0.15),inset_0_-2px_6px_rgba(255,255,255,0.05)]",
            "dark:shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05),inset_0_2px_8px_rgba(255,255,255,0.1),inset_0_-2px_6px_rgba(0,0,0,0.4)]"
          )}
        >
          <AnimatePresence>
            {!isAuthenticated && (
              <motion.div
                animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-background/30"
                exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={cn(
                    "w-full max-w-64 rounded-2xl p-5",
                    "bg-card/95 backdrop-blur-md",
                    "border border-border/50",
                    "shadow-[0_8px_30px_rgba(0,0,0,0.15),inset_0_2px_4px_rgba(0,0,0,0.08),inset_0_-1px_2px_rgba(255,255,255,0.06)]",
                    "dark:shadow-[0_8px_30px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.06),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
                  )}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="mb-4 flex justify-center">
                    <DotLoader
                      className="gap-px"
                      dotClassName={cn(
                        "size-[4px] rounded-[1px]",
                        "bg-primary/20 [&.active]:bg-primary"
                      )}
                      duration={100}
                      frames={[
                        [45, 38, 31, 24, 17, 23, 25],
                        [38, 31, 24, 17, 10, 16, 18],
                        [31, 24, 17, 10, 3, 9, 11],
                        [24, 17, 10, 3, 2, 4],
                        [17, 10, 3],
                        [10, 3],
                        [3],
                        [],
                        [45],
                        [45, 38, 44, 46],
                        [45, 38, 31, 37, 39],
                        [45, 38, 31, 24, 30, 32],
                      ]}
                      repeatCount={-1}
                    />
                  </div>
                  <h4 className="mb-1 text-center font-medium text-foreground text-sm">
                    Sign in required
                  </h4>
                  <p className="mb-4 text-center text-muted-foreground text-xs">
                    Larity requires authentication to provide AI assistance.
                  </p>
                  <div className="flex gap-2">
                    <button
                      className={cn(
                        "flex-1 rounded-xl px-3 py-2",
                        "bg-muted/40 font-medium text-muted-foreground text-xs",
                        "border border-border/40",
                        "shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.08)]",
                        "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(0,0,0,0.15)]",
                        "hover:border-border/60 hover:bg-muted/60",
                        "transition-all duration-200"
                      )}
                      onClick={onClose}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className={cn(
                        "flex-1 rounded-xl px-3 py-2",
                        "bg-primary/10 font-medium text-primary text-xs",
                        "border border-primary/30",
                        "shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.08)]",
                        "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(0,0,0,0.15)]",
                        "hover:border-primary/50 hover:bg-primary/20",
                        "transition-all duration-200"
                      )}
                      onClick={() => openProfileModal()}
                      type="button"
                    >
                      Sign In
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
            {isStreaming && mounted && (
              <motion.div
                animate={{ opacity: 1 }}
                className="pointer-events-none absolute inset-0 z-50 overflow-hidden rounded-2xl"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {(() => {
                  try {
                    return (
                      <PulsingBorder
                        aspectRatio="auto"
                        bloom={0.25}
                        colorBack="#00000000"
                        colors={["#ffffff", "#a0a0a0", "#ffffff", "#c0c0c0"]}
                        intensity={0.25}
                        margin={0}
                        pulse={0.5}
                        roundness={0.08}
                        scale={1}
                        smoke={0.3}
                        smokeSize={0.5}
                        softness={0.6}
                        speed={0.7}
                        spotSize={0.35}
                        spots={5}
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: "1rem",
                        }}
                        thickness={0.02}
                      />
                    );
                  } catch (_error) {
                    // Fallback: render a simple animated border if shader fails
                    return (
                      <div
                        className="h-full w-full animate-pulse rounded-2xl border-2 border-white/20"
                        style={{
                          boxShadow: "0 0 20px rgba(255, 255, 255, 0.1)",
                        }}
                      />
                    );
                  }
                })()}
              </motion.div>
            )}
          </AnimatePresence>
          <div
            className={cn(
              "flex items-center justify-between px-4 py-3",
              "border-border/50 border-b",
              "bg-linear-to-b from-muted/50 to-transparent"
            )}
          >
            <div className="flex items-center gap-2.5">
              <LarityOrb size="md" speed={isStreaming ? 0.8 : 0.4} />
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Larity — Work, illuminated
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {isOffline ? (
                    <span className="flex items-center gap-1 text-yellow-500">
                      <WifiOff className="h-3 w-3" /> Offline
                    </span>
                  ) : isAuthenticated ? (
                    "powered by Singularity Works"
                  ) : (
                    "Sign in to unlock AI assistance"
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {messagesList.length > 0 && (
                <button
                  aria-label="Clear conversation"
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg",
                    "text-muted-foreground hover:text-destructive",
                    "hover:bg-destructive/10",
                    "transition-all duration-200"
                  )}
                  onClick={() => setShowClearConfirm(true)}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                aria-label="Close"
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
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className={cn(
              "flex-1 overflow-y-auto overflow-x-hidden",
              "space-y-4 px-4 py-4",
              "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            )}
            ref={scrollRef}
          >
            {messagesList.length === 0 ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex h-full flex-col items-center justify-center py-12 text-center"
                initial={{ opacity: 0, y: 10 }}
              >
                <div className="mb-4">
                  <LarityOrb size="xl" speed={0.4} />
                </div>
                <p className="font-medium text-muted-foreground text-sm">
                  How can I help you today?
                </p>
                <p className="mt-1 max-w-50 text-muted-foreground/60 text-xs">
                  Ask me about your workspace, create tasks, or get suggestions
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {suggestions.map((suggestion) => (
                    <SuggestionChip
                      key={suggestion.id}
                      label={suggestion.label}
                      onClick={() => handleSuggestionClick(suggestion.prompt)}
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                {messagesList.map((message, index) => (
                  <MessageBubble
                    index={index}
                    key={message.id}
                    message={message}
                    workspaceId={workspaceId}
                  />
                ))}
              </AnimatePresence>
            )}

            <AnimatePresence>
              {showClearConfirm && (
                <motion.div
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                >
                  <motion.div
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={cn(
                      "mx-4 w-full max-w-64 rounded-2xl p-5",
                      "bg-card/95 backdrop-blur-md",
                      "border border-border/50",
                      "shadow-[0_8px_30px_rgba(0,0,0,0.15),inset_0_2px_4px_rgba(0,0,0,0.08),inset_0_-1px_2px_rgba(255,255,255,0.06)]",
                      "dark:shadow-[0_8px_30px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.06),inset_0_-1px_2px_rgba(0,0,0,0.3)]"
                    )}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  >
                    <div className="mb-4 flex justify-center">
                      <DotLoader
                        className="gap-px"
                        dotClassName={cn(
                          "size-[4px] rounded-[1px]",
                          "bg-destructive/20 [&.active]:bg-destructive"
                        )}
                        duration={150}
                        frames={heartbitFrames}
                        repeatCount={-1}
                      />
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
                        className={cn(
                          "flex-1 rounded-xl px-3 py-2",
                          "bg-muted/40 font-medium text-muted-foreground text-xs",
                          "border border-border/40",
                          "shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.08)]",
                          "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(0,0,0,0.15)]",
                          "hover:border-border/60 hover:bg-muted/60",
                          "transition-all duration-200"
                        )}
                        onClick={() => setShowClearConfirm(false)}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className={cn(
                          "flex-1 rounded-xl px-3 py-2",
                          "bg-destructive/10 font-medium text-destructive text-xs",
                          "border border-destructive/30",
                          "shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.08)]",
                          "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(0,0,0,0.15)]",
                          "hover:border-destructive/50 hover:bg-destructive/20",
                          "transition-all duration-200"
                        )}
                        onClick={() => {
                          clearConversation(workspaceId);
                          setShowClearConfirm(false);
                        }}
                        type="button"
                      >
                        Clear
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div
            className={cn(
              "pointer-events-none relative z-10 -mt-6 h-6",
              "bg-linear-to-t from-card to-transparent"
            )}
          />

          <div className={cn("border-border/30 border-t px-3 py-2")}>
            <div className="flex items-end gap-2">
              <textarea
                className={cn(
                  "flex-1 resize-none rounded-xl px-3 py-2",
                  "max-h-24 min-h-9",
                  "bg-muted/40 text-xs",
                  "border border-border/40",
                  "shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.08)]",
                  "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(0,0,0,0.15)]",
                  "placeholder:text-muted-foreground/50",
                  "focus:border-border/60 focus:outline-none",
                  "focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_3px_rgba(0,0,0,0.1)]",
                  "dark:focus:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25),inset_0_1px_3px_rgba(0,0,0,0.2)]",
                  "disabled:opacity-50",
                  "overflow-hidden",
                  "not-focus:overflow-hidden",
                  "focus:overflow-y-auto",
                  "scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent"
                )}
                disabled={isStreaming}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  e.target.style.height = "auto";
                  const newHeight = Math.min(e.target.scrollHeight, 96);
                  e.target.style.height = `${newHeight}px`;
                  e.target.style.overflowY =
                    e.target.scrollHeight > 96 ? "auto" : "hidden";
                }}
                onKeyDown={handleKeyDown}
                placeholder={isOffline ? "Offline..." : "Message Larity..."}
                ref={inputRef}
                rows={1}
                value={inputValue}
              />
              <SendButton
                isDisabled={!inputValue.trim() || isOffline}
                isStreaming={isStreaming}
                onCancel={handleCancel}
                onSend={handleSend}
              />
            </div>
            <p className="mt-1.5 text-center text-[9px] text-muted-foreground/40">
              Enter to send · Shift+Enter for new line · AI can make mistakes
            </p>
          </div>
        </div>

        <SwitchButtons
          buttons={[
            ...(onSwitchToBoards
              ? [
                  {
                    id: "boards",
                    icon: (
                      <LayoutGrid className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    ),
                    label: "Boards",
                    onClick: onSwitchToBoards,
                    count: boardCount,
                  },
                ]
              : []),
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
          ]}
        />
      </motion.div>
    );
  }
);

AiDrawerContent.displayName = "AiDrawerContent";
