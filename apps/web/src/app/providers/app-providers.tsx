"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { ThemeIndicator } from "@/src/components/theme-indicator";
import { useTheme } from "@/src/features/kanban/hooks/use-theme";
import { ThemeProvider } from "./theme-provider";

type AppProvidersProps = {
  children: ReactNode;
};

function ThemeIndicatorWrapper() {
  const { theme, showIndicator, hideIndicator } = useTheme();
  return (
    <ThemeIndicator onHide={hideIndicator} show={showIndicator} theme={theme} />
  );
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
        <ThemeIndicatorWrapper />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
