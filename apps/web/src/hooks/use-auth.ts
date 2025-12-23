"use client";

import { createLogger } from "@lumen/logger";
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
};

export function useAuth(): UseAuthReturn {
  const { data, isPending, error } = useSession();

  const signInWithGitHub = async (callbackURL = "/") => {
    try {
      logger.info("Initiating GitHub sign in", { callbackURL });

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

  return {
    user: data?.user || null,
    session: data?.session || null,
    isLoading: isPending,
    isAuthenticated: !!data?.user,
    error: error as Error | null,
    signInWithGitHub,
    signOutUser,
  };
}
