"use client";

import { useTheme as useNextTheme } from "next-themes";
import { useCallback } from "react";
import { create } from "zustand";

export type Theme = "light" | "dark";

type ThemeIndicatorStore = {
  showIndicator: boolean;
  setShowIndicator: (show: boolean) => void;
};

const useThemeIndicatorStore = create<ThemeIndicatorStore>((set) => ({
  showIndicator: false,
  setShowIndicator: (show) => set({ showIndicator: show }),
}));

export function useTheme() {
  const { theme: rawTheme, setTheme } = useNextTheme();
  const theme: Theme = (rawTheme as Theme | undefined) ?? "dark";
  const showIndicator = useThemeIndicatorStore((state) => state.showIndicator);
  const setShowIndicator = useThemeIndicatorStore(
    (state) => state.setShowIndicator
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
    setShowIndicator(true);
  }, [theme, setTheme, setShowIndicator]);

  const hideIndicator = useCallback(() => {
    setShowIndicator(false);
  }, [setShowIndicator]);

  return { theme, toggleTheme, showIndicator, hideIndicator };
}
