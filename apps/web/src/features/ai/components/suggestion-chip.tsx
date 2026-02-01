"use client";

import { memo } from "react";
import { cn } from "@/src/lib/utils";

interface SuggestionChipProps {
  label: string;
  onClick: () => void;
}

export const SuggestionChip = memo(
  ({ label, onClick }: SuggestionChipProps) => (
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
  )
);

SuggestionChip.displayName = "SuggestionChip";
