"use client";

import { createLogger } from "@lumen/logger";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/src/hooks/use-auth";

const logger = createLogger({ name: "collab:join-handler" });

type JoinHandlerProps = {
  shareToken: string | null;
  onJoinSuccess?: (workspaceId: string, role: string) => void;
  onJoinError?: (error: string) => void;
};

type JoinState = "idle" | "validating" | "joining" | "success" | "error";

export function useJoinWorkspace({
  shareToken,
  onJoinSuccess,
  onJoinError,
}: JoinHandlerProps) {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [joinState, setJoinState] = useState<JoinState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [workspaceInfo, setWorkspaceInfo] = useState<{
    workspaceId: string;
  } | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

  const validateToken = useCallback(async () => {
    if (!shareToken) {
      return;
    }

    setJoinState("validating");
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/share/${shareToken}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid share link");
        setJoinState("error");
        onJoinError?.(data.error || "Invalid share link");
        return;
      }

      setWorkspaceInfo({ workspaceId: data.workspaceId });
      logger.info("Share token validated", { workspaceId: data.workspaceId });
      // Stay in "validating" state - the useEffect will trigger join if authenticated
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to validate share link";
      setError(message);
      setJoinState("error");
      onJoinError?.(message);
    }
  }, [shareToken, apiUrl, onJoinError]);

  const joinWorkspace = useCallback(async () => {
    if (!(shareToken && isAuthenticated && workspaceInfo)) {
      return;
    }

    setJoinState("joining");
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/share/${shareToken}/join`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to join workspace");
        setJoinState("error");
        onJoinError?.(data.error || "Failed to join workspace");
        return;
      }

      setJoinState("success");
      logger.info("Successfully joined workspace", {
        workspaceId: data.workspaceId,
        role: data.role,
      });

      onJoinSuccess?.(data.workspaceId, data.role);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to join workspace";
      setError(message);
      setJoinState("error");
      onJoinError?.(message);
    }
  }, [
    shareToken,
    isAuthenticated,
    workspaceInfo,
    apiUrl,
    onJoinSuccess,
    onJoinError,
  ]);

  // Start validation when share token is present
  useEffect(() => {
    if (shareToken && joinState === "idle") {
      validateToken();
    }
  }, [shareToken, joinState, validateToken]);

  // Auto-join when authenticated and workspace info is available
  useEffect(() => {
    if (
      isAuthenticated &&
      !authLoading &&
      workspaceInfo &&
      joinState === "validating"
    ) {
      joinWorkspace();
    }
  }, [isAuthenticated, authLoading, workspaceInfo, joinState, joinWorkspace]);

  return {
    joinState,
    error,
    workspaceInfo,
    isAuthenticated,
    needsLogin:
      !(isAuthenticated || authLoading) &&
      workspaceInfo !== null &&
      joinState === "validating",
    validateToken,
    joinWorkspace,
  };
}

export function JoinWorkspaceHandler({
  shareToken,
  onComplete,
}: {
  shareToken: string | null;
  onComplete?: (workspaceId: string | null) => void;
}) {
  const { joinState, error, needsLogin } = useJoinWorkspace({
    shareToken,
    onJoinSuccess: (workspaceId) => {
      onComplete?.(workspaceId);
    },
    onJoinError: () => {
      onComplete?.(null);
    },
  });

  if (!shareToken) {
    return null;
  }

  if (needsLogin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="mx-4 w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
          <h2 className="mb-2 font-semibold text-lg">Join Workspace</h2>
          <p className="mb-4 text-muted-foreground text-sm">
            Please login to join this workspace collaboration.
          </p>
          <p className="text-muted-foreground text-xs">
            After logging in, you'll automatically join the workspace.
          </p>
        </div>
      </div>
    );
  }

  if (joinState === "validating" || joinState === "joining") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="mx-4 w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">
              {joinState === "validating"
                ? "Validating..."
                : "Joining workspace..."}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (joinState === "error" && error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="mx-4 w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
          <h2 className="mb-2 font-semibold text-destructive text-lg">Error</h2>
          <p className="text-muted-foreground text-sm">{error}</p>
          <button
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground text-sm"
            onClick={() => onComplete?.(null)}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return null;
}
