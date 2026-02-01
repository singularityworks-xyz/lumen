"use client";

import type { AiMessage } from "@lumen/ai/types";
import {
  Brain,
  Check,
  ClockCheck,
  Copy,
  Info,
  RotateCcw,
  Shell,
} from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { memo, useCallback, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { useAuth } from "@/src/hooks/use-auth";
import { cn } from "@/src/lib/utils";
import { DotLoader } from "./animations/dot-loader";
import LarityOrb from "./animations/larity-orb";
import { TextShimmer } from "./animations/text-shimmer";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolCallFlow } from "./tool-call-flow";

const formatTokens = (tokens: number) => {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
};

const thinkingFrames = [
  [24],
  [17, 23, 25, 31],
  [10, 16, 18, 22, 26, 30, 32, 38],
  [3, 9, 11, 15, 19, 29, 33, 37, 39, 45],
  [2, 4, 8, 12, 14, 20, 28, 34, 36, 40, 44, 46],
  [1, 5, 7, 13, 21, 27, 35, 41, 43, 47],
  [0, 6, 42, 48],
  [1, 5, 7, 13, 21, 27, 35, 41, 43, 47],
  [2, 4, 8, 12, 14, 20, 28, 34, 36, 40, 44, 46],
  [3, 9, 11, 15, 19, 29, 33, 37, 39, 45],
  [10, 16, 18, 22, 26, 30, 32, 38],
  [17, 23, 25, 31],
  [24],
  [],
];

interface MessageBubbleProps {
  message: AiMessage;
  index: number;
  workspaceId: string;
  onRegenerate?: (messageId: string) => void;
}

export const MessageBubble = memo(
  ({ message, index, onRegenerate }: MessageBubbleProps) => {
    const isUser = message.role === "user";
    const isStreaming = message.isStreaming;
    const { user } = useAuth();
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = useCallback(async () => {
      if (!message.content) {
        return;
      }
      try {
        await navigator.clipboard.writeText(message.content);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch {
        // ignore
      }
    }, [message.content]);

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
          user?.image ? (
            <Image
              alt={user.name || "You"}
              className="h-7 w-7 shrink-0 rounded-full object-cover"
              height={28}
              src={user.image}
              width={28}
            />
          ) : (
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                "bg-primary text-primary-foreground"
              )}
            >
              <span className="font-semibold text-[10px]">
                {user?.name?.[0]?.toUpperCase() || "Y"}
              </span>
            </div>
          )
        ) : (
          <LarityOrb size="sm" speed={isStreaming ? 0.8 : 0.3} />
        )}

        <div
          className={cn(
            "flex flex-col gap-1.5",
            isUser ? "items-end" : "items-start"
          )}
        >
          {message.toolCalls && message.toolCalls.length > 0 && (
            <ToolCallFlow
              toolCalls={message.toolCalls}
              toolResult={message.toolResult}
            />
          )}

          {!message.content &&
          message.toolCalls &&
          message.toolCalls.length > 0 &&
          !message.toolResult &&
          !isStreaming &&
          !message.error ? null : (
            <div
              className={cn(
                "relative rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                // Engraved effect
                "shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.5)]",
                "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),inset_0_1px_2px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.08)]",
                isUser
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md bg-muted/80 text-foreground"
              )}
            >
              {isStreaming &&
              !message.content &&
              !message.error &&
              !message.toolName &&
              !message.toolCalls?.length ? (
                <div className="flex items-center gap-2 py-0.5">
                  <DotLoader
                    className="gap-px"
                    dotClassName={cn(
                      "size-[2px] rounded-[0.5px]",
                      "bg-foreground/10 [&.active]:bg-foreground/60"
                    )}
                    duration={80}
                    frames={thinkingFrames}
                    repeatCount={-1}
                  />
                  <TextShimmer
                    as="span"
                    className="text-[11px] text-muted-foreground"
                    duration={1.5}
                  >
                    Thinking...
                  </TextShimmer>
                </div>
              ) : message.error && !message.content ? (
                <p className="text-[11px] text-muted-foreground italic">
                  Failed to generate response
                </p>
              ) : isUser ? (
                <p className="wrap-break-word whitespace-pre-wrap">
                  {message.content}
                </p>
              ) : (
                <div className="flex items-end gap-1">
                  <MarkdownRenderer
                    className="min-w-0 flex-1"
                    content={message.content}
                  />
                  {isStreaming && (
                    <span className="mb-1 inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-foreground/40" />
                  )}
                </div>
              )}
            </div>
          )}

          {!(isUser || isStreaming) && message.metadata && (
            <div className="flex w-full items-center justify-between px-1 opacity-70">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="flex h-3 w-3 items-center justify-center text-muted-foreground/40 transition-colors hover:text-foreground"
                    title="View details"
                    type="button"
                  >
                    {message.metadata.classifier ? (
                      <Brain className="h-2.5 w-2.5" />
                    ) : (
                      <Info className="h-2.5 w-2.5" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className={cn(
                    "w-auto p-2",
                    "bg-muted/80 backdrop-blur-md",
                    "border border-border/40",
                    // Engraved effect
                    "shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.1),0_1px_0_rgba(255,255,255,0.5)]",
                    "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),inset_0_1px_2px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.08)]"
                  )}
                >
                  <div className="flex flex-col gap-1.5 text-muted-foreground text-xs">
                    {message.metadata.classifier && (
                      <div className="flex items-center gap-2">
                        <Brain className="h-3 w-3" />
                        <span>
                          Intent:{" "}
                          <span className="font-medium text-foreground">
                            {message.metadata.classifier.intent}
                          </span>
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Shell className="h-3 w-3" />
                      <span>
                        {message.metadata.usage?.totalTokens
                          ? `${formatTokens(message.metadata.usage.totalTokens)} tokens`
                          : "Unknown tokens"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ClockCheck className="h-3 w-3" />
                      <span>
                        {message.metadata.duration
                          ? `${message.metadata.duration.toFixed(2)}s`
                          : "Unknown duration"}
                      </span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-2">
                <button
                  className="flex h-3 w-3 items-center justify-center text-muted-foreground/40 transition-colors hover:text-foreground"
                  onClick={handleCopy}
                  title="Copy"
                  type="button"
                >
                  {isCopied ? (
                    <Check className="h-2.5 w-2.5" />
                  ) : (
                    <Copy className="h-2.5 w-2.5" />
                  )}
                </button>
                {onRegenerate && (
                  <button
                    className="flex h-3 w-3 items-center justify-center text-muted-foreground/40 transition-colors hover:text-foreground"
                    onClick={() => onRegenerate(message.id)}
                    title="Regenerate"
                    type="button"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {message.error && (
            <div
              className={cn(
                "mt-1.5 flex items-start gap-2 rounded-lg px-3 py-2",
                "border border-destructive/20 bg-destructive/10"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[11px] text-destructive">
                  {message.error.includes("Rate limit") ||
                  message.error.includes("wait")
                    ? "Rate limit reached"
                    : "Something went wrong"}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  It's not you, it's us.
                </p>
                <p className="mt-1 text-[10px] text-destructive/70">
                  {message.error}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }
);

MessageBubble.displayName = "MessageBubble";
