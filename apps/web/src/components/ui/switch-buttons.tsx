"use client";

import { motion } from "motion/react";
import { memo } from "react";
import { cn } from "@/src/lib/utils";

interface SwitchButtonConfig {
  count?: number;
  icon: React.ReactNode;
  id: string;
  label: string;
  onClick: () => void;
}

interface SwitchButtonsProps {
  buttons: SwitchButtonConfig[];
}

export const SwitchButtons = memo(({ buttons }: SwitchButtonsProps) => {
  if (buttons.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-1/2 left-0 flex -translate-x-full -translate-y-1/2 flex-col gap-1.5">
      {buttons.map((button, index) => (
        <motion.button
          animate={{ opacity: 1, x: 0 }}
          aria-label={`Switch to ${button.label}`}
          className={cn(
            "flex flex-col items-center justify-center",
            "w-9 rounded-l-xl py-2.5",
            "bg-card/95 backdrop-blur-md",
            "border-2 border-border/50 border-r-0",
            "shadow-[0_4px_16px_rgba(0,0,0,0.15),-4px_0_10px_rgba(0,0,0,0.08),inset_0_3px_10px_rgba(0,0,0,0.22),inset_0_-2px_6px_rgba(255,255,255,0.07),inset_1px_0_4px_rgba(0,0,0,0.12)]",
            "dark:shadow-[0_4px_16px_rgba(0,0,0,0.5),-4px_0_10px_rgba(0,0,0,0.25),inset_0_3px_12px_rgba(255,255,255,0.1),inset_0_-3px_10px_rgba(0,0,0,0.45),inset_1px_0_5px_rgba(0,0,0,0.25)]",
            "hover:bg-muted/80 hover:shadow-[0_4px_20px_rgba(0,0,0,0.18),-5px_0_12px_rgba(0,0,0,0.1),inset_0_3px_12px_rgba(0,0,0,0.26),inset_0_-2px_8px_rgba(255,255,255,0.09),inset_1px_0_5px_rgba(0,0,0,0.15)]",
            "dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.6),-5px_0_12px_rgba(0,0,0,0.3),inset_0_3px_14px_rgba(255,255,255,0.12),inset_0_-3px_12px_rgba(0,0,0,0.5),inset_1px_0_6px_rgba(0,0,0,0.3)]",
            "group cursor-pointer transition-all duration-200"
          )}
          initial={{ opacity: 0, x: 20 }}
          key={button.id}
          onClick={button.onClick}
          transition={{
            type: "tween",
            ease: "easeOut",
            duration: 0.25,
            delay: index * 0.05,
          }}
          type="button"
        >
          <div className="relative flex h-5 items-center justify-center">
            {button.icon}
            {button.count !== undefined && button.count > 0 && (
              <span
                className={cn(
                  "absolute -top-0.5 -right-1.5",
                  "h-3.5 min-w-3.5 px-0.5",
                  "flex items-center justify-center",
                  "rounded-full bg-primary text-primary-foreground",
                  "font-bold text-[8px] leading-none"
                )}
              >
                {button.count > 99 ? "99+" : button.count}
              </span>
            )}
          </div>
          <span className="writing-mode-vertical mt-1.5 font-medium text-[8px] text-muted-foreground leading-tight transition-colors group-hover:text-foreground">
            {button.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
});

SwitchButtons.displayName = "SwitchButtons";
