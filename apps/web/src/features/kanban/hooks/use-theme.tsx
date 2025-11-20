"use client";

import { useTheme as useNextTheme } from "next-themes";

export type Theme = "light" | "dark";

export function useTheme() {
  const { theme: rawTheme, setTheme } = useNextTheme();
  const theme: Theme = (rawTheme as Theme | undefined) ?? "dark";

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return { theme, toggleTheme };
}
