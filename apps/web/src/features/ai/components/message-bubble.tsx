"use client";

import type { AiMessage } from "@lumen/ai/types";
import { motion } from "motion/react";
import { memo } from "react";
import { cn } from "@/src/lib/utils";
import { useAiStore } from "../store/ai-store";
import LarityOrb from "./animations/larity-orb";

type MessageBubbleProps = {
  message: AiMessage;
  index: number;
};

export const MessageBubble = memo(({ message, index }: MessageBubbleProps) => {
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
