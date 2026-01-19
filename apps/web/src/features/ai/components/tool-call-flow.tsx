"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { cn } from "@/src/lib/utils";
import { DotLoader } from "./animations/dot-loader";
import { TextShimmer } from "./animations/text-shimmer";

const customTheme: { [key: string]: React.CSSProperties } = {
  'code[class*="language-"]': {
    color: "hsl(var(--foreground) / 0.9)",
    background: "transparent",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "9px",
    lineHeight: "1.1",
  },
  'pre[class*="language-"]': {
    color: "hsl(var(--foreground) / 0.9)",
    background: "transparent",
    margin: 0,
    padding: 0,
    overflow: "auto",
    lineHeight: "1.1",
  },
  comment: { color: "hsl(var(--muted-foreground) / 0.6)" },
  prolog: { color: "hsl(var(--muted-foreground) / 0.6)" },
  punctuation: { color: "hsl(var(--muted-foreground) / 0.7)" },
  property: { color: "hsl(210, 80%, 65%)" },
  string: { color: "hsl(150, 60%, 55%)" },
  number: { color: "hsl(35, 90%, 60%)" },
  boolean: { color: "hsl(280, 70%, 65%)" },
  "attr-name": { color: "hsl(210, 80%, 65%)" },
  keyword: { color: "hsl(280, 70%, 65%)" },
  operator: { color: "hsl(var(--muted-foreground) / 0.8)" },
  null: { color: "hsl(var(--muted-foreground) / 0.6)", fontStyle: "italic" },
};

const camelCaseRegex = /([A-Z])/g;
const firstCharRegex = /^./;

type ToolCall = {
  id: string;
  name: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
};

type ToolCallFlowProps = {
  toolCalls: ToolCall[];
  toolResult?: unknown;
  className?: string;
};

export const ToolCallFlow = memo(
  ({ toolCalls, toolResult, className }: ToolCallFlowProps) => {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpanded = (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    };

    const getToolAnimation = (toolName: string) => {
      const name = toolName.toLowerCase();
      if (
        name.includes("get") ||
        name.includes("search") ||
        name.includes("find")
      ) {
        return searchingFrames;
      }
      if (
        name.includes("create") ||
        name.includes("write") ||
        name.includes("update")
      ) {
        return writingFrames;
      }
      if (
        name.includes("git") ||
        name.includes("branch") ||
        name.includes("commit")
      ) {
        return syncingFrames;
      }
      if (
        name.includes("read") ||
        name.includes("open") ||
        name.includes("list")
      ) {
        return readingFrames;
      }
      return processingFrames;
    };

    const getToolCategory = (toolName: string): string => {
      const name = toolName.toLowerCase();
      if (
        name.includes("get") ||
        name.includes("search") ||
        name.includes("find")
      ) {
        return "Searching";
      }
      if (
        name.includes("create") ||
        name.includes("write") ||
        name.includes("update")
      ) {
        return "Executing";
      }
      if (
        name.includes("git") ||
        name.includes("branch") ||
        name.includes("commit")
      ) {
        return "Syncing";
      }
      if (
        name.includes("read") ||
        name.includes("open") ||
        name.includes("list")
      ) {
        return "Reading";
      }
      return "Processing";
    };

    const formatToolName = (name: string): string =>
      name
        .replace(camelCaseRegex, " $1")
        .replace(firstCharRegex, (str) => str.toUpperCase())
        .trim();

    const formatOutput = (result: unknown): string => {
      if (result === null || result === undefined) {
        return "No output";
      }
      if (typeof result === "string") {
        return result;
      }
      try {
        return JSON.stringify(result, null, 2);
      } catch {
        return String(result);
      }
    };

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <AnimatePresence mode="popLayout">
          {toolCalls.map((toolCall, index) => {
            const result = toolCall.result ?? toolResult;
            const isSuccess =
              result && typeof result === "object" && "success" in result
                ? (result as { success: boolean }).success
                : false;
            const isCompleted = result !== undefined;
            const isExpanded = expandedIds.has(toolCall.id);

            if (isCompleted) {
              return (
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col"
                  exit={{ opacity: 0, scale: 0.9 }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  key={toolCall.id}
                  layout
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                  }}
                >
                  <button
                    className={cn(
                      "inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1",
                      "transition-all duration-200",
                      "hover:opacity-80",
                      isSuccess
                        ? [
                            "border border-border/50 bg-muted/50 text-muted-foreground",
                            "hover:bg-muted/70 hover:text-foreground",
                          ]
                        : [
                            "bg-destructive/10 text-destructive",
                            "shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_2px_rgba(0,0,0,0.08)]",
                            "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(0,0,0,0.15)]",
                          ]
                    )}
                    onClick={() => toggleExpanded(toolCall.id)}
                    type="button"
                  >
                    {isSuccess ? (
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    ) : (
                      <X className="h-3 w-3" strokeWidth={2.5} />
                    )}
                    <span className="font-medium text-[10px]">
                      {formatToolName(toolCall.name)}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                      strokeWidth={2}
                    />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        animate={{ opacity: 1, height: "auto" }}
                        className="overflow-hidden"
                        exit={{ opacity: 0, height: 0 }}
                        initial={{ opacity: 0, height: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      >
                        <div
                          className={cn(
                            "mt-1.5 max-h-40 overflow-auto rounded-lg p-2.5",
                            "bg-muted/50 backdrop-blur-sm",
                            "border border-border/40",
                            "shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
                            "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]",
                            "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                          )}
                        >
                          <SyntaxHighlighter
                            customStyle={{
                              background: "transparent",
                              padding: 0,
                              margin: 0,
                            }}
                            language="json"
                            style={customTheme}
                            wrapLongLines
                          >
                            {formatOutput(result)}
                          </SyntaxHighlighter>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            }

            // In-progress state - full card
            return (
              <motion.div
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2",
                  "bg-muted/40 backdrop-blur-sm",
                  "border border-border/40",
                  "shadow-[inset_0_2px_4px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.08)]",
                  "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(0,0,0,0.15)]",
                  "transition-all duration-300"
                )}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                key={toolCall.id}
                layout
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                  delay: index * 0.05,
                }}
              >
                <div
                  className={cn(
                    "relative flex shrink-0 items-center justify-center",
                    "h-7 w-7 rounded-lg",
                    "bg-primary/10 text-primary",
                    "shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]",
                    "dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"
                  )}
                >
                  <DotLoader
                    className="scale-[0.42] gap-px"
                    dotClassName={cn(
                      "h-[3px] w-[3px] rounded-sm",
                      "bg-primary/20 [&.active]:bg-primary"
                    )}
                    duration={120}
                    frames={getToolAnimation(toolCall.name)}
                    repeatCount={-1}
                  />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                    {getToolCategory(toolCall.name)}
                  </span>
                  <TextShimmer
                    as="span"
                    className="truncate font-medium text-[11px] text-foreground/90"
                    duration={2}
                  >
                    {formatToolName(toolCall.name)}
                  </TextShimmer>
                </div>

                <motion.div
                  animate={{ opacity: 1 }}
                  className="absolute right-0 bottom-0 left-0 h-0.5 overflow-hidden rounded-b-xl"
                  initial={{ opacity: 0 }}
                >
                  <motion.div
                    animate={{
                      x: ["-100%", "100%"],
                    }}
                    className="h-full w-full bg-linear-to-r from-primary/20 via-primary/60 to-primary/20"
                    transition={{
                      duration: 1.5,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "linear",
                    }}
                  />
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  }
);

ToolCallFlow.displayName = "ToolCallFlow";

const readingFrames = [
  [0, 7, 14, 21, 28, 35, 42],
  [1, 8, 15, 22, 29, 36, 43],
  [2, 9, 16, 23, 30, 37, 44],
  [3, 10, 17, 24, 31, 38, 45],
  [4, 11, 18, 25, 32, 39, 46],
  [5, 12, 19, 26, 33, 40, 47],
  [6, 13, 20, 27, 34, 41, 48],
];

const writingFrames = [
  [24],
  [17, 23, 25, 31],
  [10, 16, 18, 22, 26, 30, 32, 38],
  [3, 9, 11, 15, 19, 29, 33, 37, 39, 45],
  [2, 4, 8, 12, 14, 20, 28, 34, 36, 40, 44, 46],
  [1, 5, 7, 13, 21, 27, 35, 41, 43, 47],
  [0, 6, 42, 48],
];

const searchingFrames = [
  [24],
  [16, 17, 18],
  [9, 10, 11, 15, 17, 19, 23, 24, 25],
  [
    2, 3, 4, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 28,
    29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 40,
  ],
  [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
    40, 41, 42, 43, 44, 45, 46, 47, 48,
  ],
  [
    2, 3, 4, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 28,
    29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 40,
  ],
  [9, 10, 11, 15, 17, 19, 23, 24, 25],
  [16, 17, 18],
  [24],
];

const syncingFrames = [
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
];

const processingFrames = [
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
];
