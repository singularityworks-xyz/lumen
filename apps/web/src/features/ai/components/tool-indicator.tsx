"use client";

import { Check, CircleDashed, Hammer, Search, X } from "lucide-react";
import { memo } from "react";
import { cn } from "@/src/lib/utils";

interface ToolIndicatorProps {
  toolName: string;
  status: "pending" | "success" | "error";
  className?: string;
}

export const ToolIndicator = memo(
  ({ toolName, status, className }: ToolIndicatorProps) => {
    const isQuery = toolName.startsWith("get") || toolName.startsWith("search");
    const label = formatToolName(toolName);

    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-2.5 py-1.5",
          "border border-border/30 bg-muted/30",
          className
        )}
      >
        <div
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-md",
            status === "success"
              ? "bg-green-500/10 text-green-500"
              : status === "error"
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
          )}
        >
          {status === "pending" ? (
            <CircleDashed className="h-3 w-3 animate-spin" />
          ) : status === "success" ? (
            <Check className="h-3 w-3" />
          ) : status === "error" ? (
            <X className="h-3 w-3" />
          ) : isQuery ? (
            <Search className="h-3 w-3" />
          ) : (
            <Hammer className="h-3 w-3" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
            {isQuery ? "Checking" : "Executing"}
          </span>
          <span className="font-medium text-foreground text-xs">{label}</span>
        </div>
      </div>
    );
  }
);

ToolIndicator.displayName = "ToolIndicator";

function formatToolName(name: string): string {
  // Convert camelCase to Title Case
  // e.g. getWorkspaceOverview -> Get Workspace Overview
  // e.g. createTask -> Create Task
  return (
    (name || "")
      .replace(/([A-Z])/g, " $1")
      // biome-ignore lint/performance/useTopLevelRegex: it's fine
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  );
}
