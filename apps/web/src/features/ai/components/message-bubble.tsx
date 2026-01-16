"use client";

import type { AiMessage } from "@lumen/ai/types";
import { motion } from "motion/react";
import Image from "next/image";
import { memo } from "react";
import { useAuth } from "@/src/hooks/use-auth";
import { cn } from "@/src/lib/utils";
import { useAiStore } from "../store/ai-store";
import { DotLoader } from "./animations/dot-loader";
import LarityOrb from "./animations/larity-orb";
import { TextShimmer } from "./animations/text-shimmer";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolIndicator } from "./tool-indicator";

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

type MessageBubbleProps = {
  message: AiMessage;
  index: number;
  workspaceId: string;
};

export const MessageBubble = memo(
  ({ message, index, workspaceId }: MessageBubbleProps) => {
    const isUser = message.role === "user";
    const isStreaming = message.isStreaming;
    const { user } = useAuth();

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
            {message.toolCalls?.map((toolCall) => (
              <ToolIndicator
                className="mb-2"
                key={toolCall.id}
                status={
                  message.toolResult
                    ? (message.toolResult as { success: boolean }).success
                      ? "success"
                      : "error"
                    : "pending"
                }
                toolName={toolCall.name}
              />
            ))}

            {message.toolName && (
              <ToolIndicator
                className="mb-2"
                status={
                  message.toolResult
                    ? (message.toolResult as { success: boolean }).success
                      ? "success"
                      : "error"
                    : "pending"
                }
                toolName={message.toolName}
              />
            )}

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

          {message.requiresConfirmation && !message.confirmedAt && (
            <ConfirmationPrompt
              action={message.pendingAction}
              messageId={message.id}
              workspaceId={workspaceId}
            />
          )}
        </div>
      </motion.div>
    );
  }
);

MessageBubble.displayName = "MessageBubble";

type ConfirmationPromptProps = {
  messageId: string;
  workspaceId: string;
  action?: AiMessage["pendingAction"];
};

const ConfirmationPrompt = memo(
  ({ messageId, workspaceId, action }: ConfirmationPromptProps) => {
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
          onClick={() => confirmAction(workspaceId, messageId, true)}
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
          onClick={() => confirmAction(workspaceId, messageId, false)}
          type="button"
        >
          Cancel
        </button>
      </motion.div>
    );
  }
);

ConfirmationPrompt.displayName = "ConfirmationPrompt";
