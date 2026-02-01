"use client";

import { Send, Square } from "lucide-react";
import { memo } from "react";
import { cn } from "@/src/lib/utils";
import { DotLoader } from "./dot-loader";

const frames = [
  [],
  [7, 1],
  [15, 9, 7, 1],
  [23, 17, 21, 15, 9, 3],
  [31, 25, 29, 23, 17, 11],
  [39, 33, 37, 31, 25, 19],
  [47, 41, 45, 39, 33, 27],
  [47, 41, 45, 39, 33, 27],
  [47, 41, 45, 39, 33, 27],
  [47, 41, 45, 39, 33, 27],
  [39, 33, 37, 31, 25, 19],
  [31, 25, 29, 23, 17, 11],
  [23, 17, 21, 15, 9, 3],
  [15, 9, 7, 1],
  [7, 1],
  [],
];

interface SendButtonProps {
  isStreaming: boolean;
  isDisabled: boolean;
  onSend: () => void;
  onCancel: () => void;
}

export const SendButton = memo(
  ({ isStreaming, isDisabled, onSend, onCancel }: SendButtonProps) => (
    <button
      aria-label={isStreaming ? "Cancel" : "Send"}
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        "h-9 w-9 rounded-xl",
        "bg-muted/40",
        "border border-border/40",
        "shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.08)]",
        "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(0,0,0,0.15)]",
        "transition-all duration-200",
        isStreaming
          ? "hover:border-destructive/50 hover:bg-destructive/5"
          : "hover:border-border/60 hover:shadow-[inset_0_2px_6px_rgba(0,0,0,0.08),inset_0_1px_3px_rgba(0,0,0,0.1)] dark:hover:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25),inset_0_1px_3px_rgba(0,0,0,0.2)]",
        !isStreaming && isDisabled && "cursor-not-allowed opacity-40"
      )}
      disabled={!isStreaming && isDisabled}
      onClick={isStreaming ? onCancel : onSend}
      type="button"
    >
      {isStreaming ? (
        <div className="relative">
          <DotLoader
            className="gap-px"
            dotClassName={cn(
              "size-[3px] rounded-[1px]",
              "bg-muted-foreground/20 [&.active]:bg-foreground"
            )}
            duration={120}
            frames={frames}
            repeatCount={-1}
          />
          <div className="absolute -right-1 -bottom-1 flex h-3 w-3 items-center justify-center rounded-full bg-destructive/80">
            <Square className="h-1.5 w-1.5 text-white" />
          </div>
        </div>
      ) : (
        <Send className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  )
);

SendButton.displayName = "SendButton";

export default SendButton;
