"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { memo } from "react";

export const SharedViaLumenWatermark = memo(function SharedViaLumenWatermark() {
  return (
    <div
      className="pointer-events-auto fixed right-5 bottom-5 z-50 select-none"
      data-testid="shared-via-lumen-watermark"
    >
      <Link
        className="group flex items-center gap-2 rounded-full border border-border/70 bg-card/85 px-3.5 py-1.5 shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-primary/40 hover:bg-card hover:shadow-primary/10 dark:bg-card/75 dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
        href="/"
        rel="noopener noreferrer"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary text-xs transition-transform duration-200 group-hover:rotate-12">
          <Sparkles className="h-3 w-3" />
        </span>
        <div className="flex items-baseline gap-1 text-xs">
          <span className="font-medium text-[11px] text-muted-foreground">
            Shared via
          </span>
          <span className="font-bold text-foreground tracking-tight transition-colors group-hover:text-primary">
            Lumen
          </span>
        </div>
      </Link>
    </div>
  );
});
