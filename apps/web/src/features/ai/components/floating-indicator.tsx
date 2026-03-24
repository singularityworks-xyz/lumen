"use client";

import { WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { memo } from "react";
import { cn } from "@/src/lib/utils";
import LarityOrb from "./animations/larity-orb";

interface FloatingIndicatorProps {
  hasMessages: boolean;
  isOffline: boolean;
  isOpen: boolean;
  onClick: () => void;
}

export const FloatingIndicator = memo(
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
      style={{ marginTop: "100px" }}
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
