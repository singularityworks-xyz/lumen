"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { ThemeIndicator } from "@/src/components/theme-indicator";
import { CollaborationWrapper } from "@/src/features/collab";
import { useTheme } from "@/src/features/kanban/hooks/use-theme";
import { ThemeProvider } from "./theme-provider";

interface AppProvidersProps {
  children: ReactNode;
}

function ThemeIndicatorWrapper() {
  const { theme, showIndicator, hideIndicator } = useTheme();
  return (
    <ThemeIndicator onHide={hideIndicator} show={showIndicator} theme={theme} />
  );
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());
  const isTauriBuild = process.env.IS_TAURI_BUILD === "true";

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CollaborationWrapper>
          <SerwistProvider
            cacheOnNavigation
            disable={isTauriBuild}
            register
            reloadOnOnline={false}
            swUrl="/serwist/sw.js"
          >
            {children}
          </SerwistProvider>
          <ThemeIndicatorWrapper />
        </CollaborationWrapper>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
