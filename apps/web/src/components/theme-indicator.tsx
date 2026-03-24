"use client";

import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useEffect, useState } from "react";
import type { Theme } from "../features/kanban/hooks/use-theme";

interface ThemeIndicatorProps {
  onHide: () => void;
  show: boolean;
  theme: Theme;
}

export const ThemeIndicator = memo(
  ({ theme, show, onHide }: ThemeIndicatorProps) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
      if (show) {
        setIsVisible(true);
        const timer = setTimeout(() => {
          setIsVisible(false);
          onHide();
        }, 800);
        return () => clearTimeout(timer);
      }
    }, [show, onHide]);

    return (
      <AnimatePresence>
        {isVisible && (
          <motion.div
            animate={{ opacity: 1 }}
            className="pointer-events-none fixed inset-0 z-100 flex items-center justify-center"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <motion.div
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-3 rounded-2xl border-2 border-border/50 bg-card/95 px-8 py-6 shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_2px_8px_rgba(0,0,0,0.1)] backdrop-blur-md dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_2px_8px_rgba(255,255,255,0.1)]"
              exit={{ scale: 0.9, opacity: 0 }}
              initial={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  animate={{ rotate: 0, scale: 1 }}
                  className="flex items-center justify-center"
                  exit={{ rotate: 90, scale: 0 }}
                  initial={{ rotate: -90, scale: 0 }}
                  key={theme}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {theme === "dark" ? (
                    <Moon className="h-12 w-12 text-foreground" />
                  ) : (
                    <Sun className="h-12 w-12 text-foreground" />
                  )}
                </motion.div>
              </AnimatePresence>
              <motion.span
                animate={{ opacity: 1, y: 0 }}
                className="font-medium text-foreground text-sm"
                initial={{ opacity: 0, y: 5 }}
                transition={{ delay: 0.1 }}
              >
                {theme === "dark" ? "Dark Mode" : "Light Mode"}
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

ThemeIndicator.displayName = "ThemeIndicator";
