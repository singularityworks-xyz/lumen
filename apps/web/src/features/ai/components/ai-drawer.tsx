"use client";

import type { AiMessage, ContextSnapshot } from "@lumen/ai/types";
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
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/src/lib/utils";
import { useAiStore } from "../store/ai-store";
import { DotLoader } from "./animations/dot-loader";
import LarityOrb from "./animations/larity-orb";
import { SendButton } from "./animations/send-button";
import { TextShimmer } from "./animations/text-shimmer";

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

type FloatingIndicatorProps = {
  onClick: () => void;
  isOpen: boolean;
  hasMessages: boolean;
  isOffline: boolean;
};

const FloatingIndicator = memo(
  ({ onClick, isOpen, hasMessages, isOffline }: FloatingIndicatorProps) => (
    <motion.button
      animate={{
        x: isOpen ? 100 : 0,
        opacity: isOpen ? 0 : 1,
        scale: isOpen ? 0.8 : 1,
      }}
      aria-label="Open AI assistant"
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
      style={{ marginTop: "104px" }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      type="button"
    >
      <div className="relative">
        <LarityOrb size="xs" speed={0.3} />
        {hasMessages && (
          <motion.span
            animate={{ scale: 1 }}
            className={cn(
              "absolute -top-1.5 -right-1.5",
              "h-2.5 w-2.5",
              "rounded-full bg-primary",
              "shadow-sm"
            )}
            initial={{ scale: 0 }}
          />
        )}
        {isOffline && (
          <WifiOff className="absolute -right-1 -bottom-1 h-3 w-3 text-yellow-500" />
        )}
      </div>
      <span className="writing-mode-vertical font-medium text-[9px] text-muted-foreground transition-colors group-hover:text-foreground">
        Larity
      </span>
    </motion.button>
  )
);

FloatingIndicator.displayName = "FloatingIndicator";

type MessageBubbleProps = {
  message: AiMessage;
  index: number;
};

const MessageBubble = memo(({ message, index }: MessageBubbleProps) => {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming;

  return (
    <motion.div
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className={cn(
        "flex max-w-[90%] gap-2.5",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
      exit={{ opacity: 0, x: isUser ? 20 : -20, scale: 0.95 }}
      initial={{ opacity: 0, x: isUser ? 20 : -20, scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
        delay: index * 0.02,
      }}
    >
      {isUser ? (
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground"
          )}
        >
          <span className="font-semibold text-[10px]">You</span>
        </div>
      ) : (
        <LarityOrb size="sm" speed={isStreaming ? 0.8 : 0.3} />
      )}

      <div
        className={cn(
          "flex flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "relative rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
            "shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(255,255,255,0.1)]",
            "dark:shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(255,255,255,0.05)]",
            isUser
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-muted/80 text-foreground"
          )}
        >
          <p className="wrap-break-word whitespace-pre-wrap">
            {message.content}
          </p>
          {isStreaming && (
            <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-current opacity-60" />
          )}
        </div>

        {message.error && (
          <span className="text-[10px] text-destructive">{message.error}</span>
        )}

        {message.requiresConfirmation && !message.confirmedAt && (
          <ConfirmationPrompt
            action={message.pendingAction}
            messageId={message.id}
          />
        )}
      </div>
    </motion.div>
  );
});

MessageBubble.displayName = "MessageBubble";

type ConfirmationPromptProps = {
  messageId: string;
  action?: AiMessage["pendingAction"];
};

const ConfirmationPrompt = memo(
  ({ messageId, action }: ConfirmationPromptProps) => {
    const confirmAction = useAiStore((state) => state.confirmAction);

    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "mt-2 flex items-center gap-2",
          "rounded-lg bg-yellow-500/10 px-3 py-2",
          "border border-yellow-500/20"
        )}
        initial={{ opacity: 0, y: -10 }}
      >
        <span className="text-xs text-yellow-600 dark:text-yellow-400">
          {action?.description || "Confirm this action?"}
        </span>
        <button
          className={cn(
            "rounded px-2 py-1 font-medium text-xs",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90"
          )}
          onClick={() => confirmAction("", messageId, true)}
          type="button"
        >
          Yes
        </button>
        <button
          className={cn(
            "rounded px-2 py-1 font-medium text-xs",
            "bg-muted text-muted-foreground",
            "hover:bg-muted/80"
          )}
          onClick={() => confirmAction("", messageId, false)}
          type="button"
        >
          Cancel
        </button>
      </motion.div>
    );
  }
);

ConfirmationPrompt.displayName = "ConfirmationPrompt";

type SuggestionChipProps = {
  label: string;
  onClick: () => void;
};

const SuggestionChip = memo(({ label, onClick }: SuggestionChipProps) => (
  <button
    className={cn(
      "rounded-full px-3 py-1.5 font-medium text-xs",
      "bg-muted/60 text-muted-foreground",
      "border border-border/50",
      "hover:bg-muted hover:text-foreground",
      "transition-colors duration-200"
    )}
    onClick={onClick}
    type="button"
  >
    {label}
  </button>
));

SuggestionChip.displayName = "SuggestionChip";

type AiDrawerContentProps = {
  workspaceId: string;
  onClose: () => void;
  onSwitchToBoards?: () => void;
  onSwitchToComments?: () => void;
  boardCount?: number;
  commentCount?: number;
};

const AiDrawerContent = memo(
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
    const messages = useAiStore(
      useShallow((state) => state.conversations[workspaceId]?.messages ?? [])
    );
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
    }, [messages.length]);

    const handleSend = useCallback(() => {
      const content = inputValue.trim();
      if (!content || isStreaming) {
        return;
      }

      setInputValue("");
      sendMessage(workspaceId, content, currentContext);
      const assistantId = addAssistantMessage(workspaceId, "");
      const mockResponse = `I understand you're asking about "${content}". This is a placeholder response - the AI backend will be connected in the next stage. For now, the UI is fully functional and ready for integration.`;

      let charIndex = 0;
      const streamInterval = setInterval(() => {
        const char = mockResponse[charIndex];
        if (charIndex < mockResponse.length && char !== undefined) {
          appendStreamChunk(workspaceId, assistantId, char);
          charIndex += 1;
        } else {
          clearInterval(streamInterval);
          completeStream(workspaceId, assistantId);
        }
      }, 20);
    }, [
      inputValue,
      isStreaming,
      workspaceId,
      currentContext,
      sendMessage,
      addAssistantMessage,
      appendStreamChunk,
      completeStream,
    ]);

    const handleSuggestionClick = useCallback((prompt: string) => {
      setInputValue(prompt);
      inputRef.current?.focus();
    }, []);

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
            {isStreaming && (
              <motion.div
                animate={{ opacity: 1 }}
                className="pointer-events-none absolute inset-0 z-50 overflow-hidden rounded-2xl"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
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
                  ) : isStreaming ? (
                    <span className="flex items-center gap-1">
                      <TextShimmer className="pt-1 text-[10px]" duration={1}>
                        Contemplating...
                      </TextShimmer>
                    </span>
                  ) : (
                    "powered by Singularity Works"
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {messages.length > 0 && (
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
            {messages.length === 0 ? (
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
                {messages.map((message, index) => (
                  <MessageBubble
                    index={index}
                    key={message.id}
                    message={message}
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
                onCancel={cancelStream}
                onSend={handleSend}
              />
            </div>
            <p className="mt-1.5 text-center text-[9px] text-muted-foreground/40">
              Enter to send · Shift+Enter for new line · AI can make mistakes
            </p>
          </div>
        </div>

        {onSwitchToBoards && (
          <motion.button
            animate={{ opacity: 1 }}
            aria-label="Switch to Boards"
            className={cn(
              "absolute top-1/3 left-0 -translate-x-full -translate-y-1/2",
              "flex flex-col items-center justify-center gap-1",
              "w-9 rounded-l-xl py-3",
              "bg-card/95 backdrop-blur-md",
              "border-2 border-border/50 border-r-0",
              "shadow-[0_4px_16px_rgba(0,0,0,0.15),-4px_0_10px_rgba(0,0,0,0.08),inset_0_3px_10px_rgba(0,0,0,0.22),inset_0_-2px_6px_rgba(255,255,255,0.07),inset_1px_0_4px_rgba(0,0,0,0.12)]",
              "dark:shadow-[0_4px_16px_rgba(0,0,0,0.5),-4px_0_10px_rgba(0,0,0,0.25),inset_0_3px_12px_rgba(255,255,255,0.1),inset_0_-3px_10px_rgba(0,0,0,0.45),inset_1px_0_5px_rgba(0,0,0,0.25)]",
              "hover:bg-muted/80",
              "group cursor-pointer transition-all duration-200"
            )}
            initial={{ opacity: 0 }}
            onClick={onSwitchToBoards}
            transition={{
              type: "tween",
              ease: "easeOut",
              duration: 0.25,
              delay: 0.15,
            }}
            type="button"
          >
            <div className="relative">
              <LayoutGrid className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
              {boardCount > 0 && (
                <span
                  className={cn(
                    "absolute -top-1 -right-1",
                    "h-3 min-w-3 px-0.5",
                    "flex items-center justify-center",
                    "rounded-full bg-primary text-primary-foreground",
                    "font-bold text-[7px]"
                  )}
                >
                  {boardCount > 9 ? "9+" : boardCount}
                </span>
              )}
            </div>
            <span className="writing-mode-vertical font-medium text-[8px] text-muted-foreground transition-colors group-hover:text-foreground">
              Boards
            </span>
          </motion.button>
        )}

        {onSwitchToComments && (
          <motion.button
            animate={{ opacity: 1 }}
            aria-label="Switch to Comments"
            className={cn(
              "absolute top-2/3 left-0 -translate-x-full -translate-y-1/2",
              "flex flex-col items-center justify-center gap-1",
              "w-9 rounded-l-xl py-3",
              "bg-card/95 backdrop-blur-md",
              "border-2 border-border/50 border-r-0",
              "shadow-[0_4px_16px_rgba(0,0,0,0.15),-4px_0_10px_rgba(0,0,0,0.08),inset_0_3px_10px_rgba(0,0,0,0.22),inset_0_-2px_6px_rgba(255,255,255,0.07),inset_1px_0_4px_rgba(0,0,0,0.12)]",
              "dark:shadow-[0_4px_16px_rgba(0,0,0,0.5),-4px_0_10px_rgba(0,0,0,0.25),inset_0_3px_12px_rgba(255,255,255,0.1),inset_0_-3px_10px_rgba(0,0,0,0.45),inset_1px_0_5px_rgba(0,0,0,0.25)]",
              "hover:bg-muted/80",
              "group cursor-pointer transition-all duration-200"
            )}
            initial={{ opacity: 0 }}
            onClick={onSwitchToComments}
            transition={{
              type: "tween",
              ease: "easeOut",
              duration: 0.25,
              delay: 0.2,
            }}
            type="button"
          >
            <div className="relative">
              <MessageCircle className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
              {commentCount > 0 && (
                <span
                  className={cn(
                    "absolute -top-1 -right-1",
                    "h-3 min-w-3 px-0.5",
                    "flex items-center justify-center",
                    "rounded-full bg-primary text-primary-foreground",
                    "font-bold text-[7px]"
                  )}
                >
                  {commentCount > 9 ? "9+" : commentCount}
                </span>
              )}
            </div>
            <span className="writing-mode-vertical font-medium text-[8px] text-muted-foreground transition-colors group-hover:text-foreground">
              Comments
            </span>
          </motion.button>
        )}
      </motion.div>
    );
  }
);

AiDrawerContent.displayName = "AiDrawerContent";

export type AiDrawerProps = {
  workspaceId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToBoards?: () => void;
  onSwitchToComments?: () => void;
  boardCount?: number;
  commentCount?: number;
};

export const AiDrawer = memo(
  ({
    workspaceId,
    isOpen,
    onOpenChange,
    onSwitchToBoards,
    onSwitchToComments,
    boardCount = 0,
    commentCount = 0,
  }: AiDrawerProps) => {
    const [mounted, setMounted] = useState(false);

    const messages = useAiStore(
      useShallow((state) => state.conversations[workspaceId]?.messages ?? [])
    );
    const isOffline = useAiStore((state) => state.isOffline);

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
        if (e.key === "a" && e.metaKey && e.shiftKey) {
          e.preventDefault();
          onOpenChange(!isOpen);
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onOpenChange]);

    useEffect(() => {
      const setOffline = useAiStore.getState().setOffline;

      const handleOnline = () => setOffline(false);
      const handleOffline = () => setOffline(true);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      setOffline(!navigator.onLine);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }, []);

    if (!mounted || typeof document === "undefined" || !workspaceId) {
      return null;
    }

    return createPortal(
      <>
        <FloatingIndicator
          hasMessages={messages.length > 0}
          isOffline={isOffline}
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

              <AiDrawerContent
                boardCount={boardCount}
                commentCount={commentCount}
                onClose={handleClose}
                onSwitchToBoards={onSwitchToBoards}
                onSwitchToComments={onSwitchToComments}
                workspaceId={workspaceId}
              />
            </>
          )}
        </AnimatePresence>
      </>,
      document.body
    );
  }
);

AiDrawer.displayName = "AiDrawer";

export default AiDrawer;
