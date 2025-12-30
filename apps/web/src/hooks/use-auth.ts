"use client";

import { createLogger } from "@lumen/logger";
import {
  initializeNativeAuth,
  isTauri,
  onAuthDeepLink,
  openExternalBrowser,
} from "@lumen/native-bridge";
import { useCallback, useEffect } from "react";
import { signIn, signOut, useSession } from "@/src/lib/auth-client";

const logger = createLogger({ name: "use-auth" });

type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Session = {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UseAuthReturn = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  signInWithGitHub: (callbackURL?: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  exchangeManualToken: (token: string) => Promise<boolean>;
};

async function exchangeTokenForSession(token: string): Promise<boolean> {
  try {
    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

    const response = await fetch(
      `${apiBaseUrl}/api/auth/native/exchange-token`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error("Token exchange failed", {
        status: response.status,
        error: errorData.message,
      });
      return false;
    }

    const data = await response.json();
    logger.info("Token exchange successful", { userId: data.user?.id });
    return true;
  } catch (error) {
    logger.error("Token exchange error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

export function useAuth(): UseAuthReturn {
  const { data, isPending, error, refetch } = useSession();
  const handleDeepLinkCallback = useCallback(
    async (url: string) => {
      if (!url.startsWith("lumen://auth/callback")) {
        return;
      }

      logger.info("Received auth callback deep link", { url });

      try {
        const urlObj = new URL(url);
        const success = urlObj.searchParams.get("success");
        const token = urlObj.searchParams.get("token");
        const errorParam = urlObj.searchParams.get("error");
        const errorDesc = urlObj.searchParams.get("error_description");

        if (errorParam) {
          logger.error("Native auth failed", {
            error: errorParam,
            description: errorDesc,
          });
          return;
        }

        if (success === "true" && token) {
          logger.info("Exchanging one-time token for session");

          const exchangeSuccess = await exchangeTokenForSession(token);

          if (exchangeSuccess) {
            logger.info("Native auth successful, refreshing session");
            await refetch();
          } else {
            logger.error("Failed to exchange token for session");
          }
        }
      } catch (err) {
        logger.error("Error handling deep link callback", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [refetch]
  );

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    initializeNativeAuth().catch((err) => {
      logger.error("Failed to initialize native auth", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    });

    const unsubscribe = onAuthDeepLink(async (url) => {
      try {
        logger.info("Received auth deep link via native-bridge", { url });
        await handleDeepLinkCallback(url);
      } catch (err) {
        logger.error("Error in deep link listener", {
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });

    logger.info("Native auth deep link listener initialized");

    return () => {
      unsubscribe();
    };
  }, [handleDeepLinkCallback]);

  const signInWithGitHub = async (callbackURL = "/") => {
    try {
      logger.info("Initiating GitHub sign in", {
        callbackURL,
        isTauri: isTauri(),
      });

      if (isTauri()) {
        const webUrl =
          typeof window !== "undefined"
            ? window.location.origin
            : "http://localhost:3000";

        // Build the URL to the OAuth launcher page
        // This page runs in the external browser and calls signIn.social there,
        // ensuring the OAuth state cookie is set in the same browser context
        const launcherUrl = new URL(`${webUrl}/auth/native-signin`);
        launcherUrl.searchParams.set("provider", "github");
        launcherUrl.searchParams.set("callbackURL", "/auth/native-callback");

        logger.info("Opening external browser for OAuth", {
          launcherUrl: launcherUrl.toString(),
        });

        await openExternalBrowser(launcherUrl.toString());
        logger.info("External browser opened for GitHub sign in");
        return;
      }

      const absoluteCallbackURL = callbackURL.startsWith("http")
        ? callbackURL
        : `${window.location.origin}${callbackURL}`;

      await signIn.social({
        provider: "github",
        callbackURL: absoluteCallbackURL,
      });

      logger.info("GitHub sign in initiated successfully");
    } catch (err) {
      logger.error("Failed to sign in with GitHub", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  };

  const signOutUser = async () => {
    try {
      logger.info("Initiating sign out", {
        userId: data?.user?.id,
      });

      await signOut();

      logger.info("Sign out successful");
    } catch (err) {
      logger.error("Failed to sign out", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }
  };

  // Manual token exchange for when deep links don't work (e.g., Linux development)
  // It's always linux, every time it's linux
  const exchangeManualToken = async (token: string): Promise<boolean> => {
    logger.info("Manual token exchange initiated");
    const success = await exchangeTokenForSession(token);
    if (success) {
      logger.info("Manual token exchange successful, refreshing session");
      await refetch();
    }
    return success;
  };

  return {
    user: data?.user || null,
    session: data?.session || null,
    isLoading: isPending,
    isAuthenticated: !!data?.user,
    error: error as Error | null,
    signInWithGitHub,
    signOutUser,
    exchangeManualToken,
  };
}
