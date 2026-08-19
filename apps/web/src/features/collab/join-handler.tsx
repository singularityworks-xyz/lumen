"use client";

import { createLogger } from "@lumen/logger";
import { withSpanAsync } from "@lumen/logger/tracer";
import { Eye, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { env } from "@/src/env";
import { useAuth } from "@/src/hooks/use-auth";
import { normalizeApiUrlForCurrentHost } from "@/src/lib/url";
import { useKanbanStore } from "../kanban/store";

const logger = createLogger({ name: "collab:join-handler" });

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export interface JoinSuccessData {
  isGuest?: boolean;
  owner?: {
    id: string;
    name: string | null;
    image: string | null;
    email: string;
  };
  role: string;
  workspaceId: string;
  workspaceName?: string;
}

interface JoinHandlerProps {
  guestToken?: string | null;
  onJoinError?: (error: string) => void;
  onJoinSuccess?: (data: JoinSuccessData) => void;
  shareToken?: string | null;
}

type JoinState = "idle" | "validating" | "joining" | "success" | "error";

export function useJoinWorkspace({
  shareToken,
  guestToken,
  onJoinSuccess,
  onJoinError,
}: JoinHandlerProps) {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [joinState, setJoinState] = useState<JoinState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [workspaceInfo, setWorkspaceInfo] = useState<{
    workspaceId: string;
    workspaceName?: string;
    owner?: {
      id: string;
      name: string | null;
      image: string | null;
      email: string;
    };
    isGuest?: boolean;
  } | null>(null);

  const apiUrl = normalizeApiUrlForCurrentHost(env.NEXT_PUBLIC_API_URL);
  const effectiveToken = guestToken || shareToken;
  const isGuest = !!guestToken;

  const validateToken = useCallback(() => {
    if (!effectiveToken) {
      return;
    }

    setJoinState("validating");
    setError(null);

    return withSpanAsync("share.validateToken", async (span) => {
      const tokenHash = await hashString(effectiveToken);
      span.setAttribute("share.token_fingerprint", tokenHash);
      span.setAttribute("share.is_guest", isGuest);

      try {
        const endpoint = isGuest
          ? `${apiUrl}/api/share/guest/${effectiveToken}`
          : `${apiUrl}/api/share/${effectiveToken}`;
        const response = await fetch(endpoint);
        const data = await response.json();

        span.setAttribute("http.status_code", response.status);

        if (!response.ok) {
          setError(data.error || "Invalid share link");
          setJoinState("error");
          span.setAttribute("share.validate.success", false);
          onJoinError?.(data.error || "Invalid share link");
          return;
        }

        setWorkspaceInfo({
          workspaceId: data.workspaceId,
          workspaceName: data.workspaceName,
          owner: data.owner,
          isGuest,
        });
        span.setAttribute("share.validate.success", true);
        span.setAttribute("workspace.id", data.workspaceId);
        logger.info("Share token validated", {
          workspaceId: data.workspaceId,
          isGuest,
        });

        if (isGuest) {
          // Guest view mode requires no authentication
          useKanbanStore.getState().setGuestMode(true, effectiveToken);
          setJoinState("success");
          onJoinSuccess?.({
            workspaceId: data.workspaceId,
            workspaceName: data.workspaceName,
            owner: data.owner,
            role: "VIEWER",
            isGuest: true,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to validate share link";
        setError(message);
        setJoinState("error");
        onJoinError?.(message);
        span.recordException(err as Error);
        span.setStatus({ code: 2, message });
      }
    });
  }, [effectiveToken, isGuest, onJoinSuccess, onJoinError, apiUrl]);

  const joinWorkspace = useCallback(() => {
    if (!(shareToken && isAuthenticated && workspaceInfo && !isGuest)) {
      return;
    }

    setJoinState("joining");
    setError(null);

    return withSpanAsync("share.joinWorkspace", async (span) => {
      span.setAttribute("workspace.id", workspaceInfo.workspaceId);

      try {
        const response = await fetch(`${apiUrl}/api/share/${shareToken}/join`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        span.setAttribute("http.status_code", response.status);

        if (!response.ok) {
          setError(data.error || "Failed to join workspace");
          setJoinState("error");
          span.setAttribute("share.join.success", false);
          onJoinError?.(data.error || "Failed to join workspace");
          return;
        }

        setJoinState("success");
        span.setAttribute("share.join.success", true);
        span.setAttribute("share.join.role", data.role);
        logger.info("Successfully joined workspace", {
          workspaceId: data.workspaceId,
          role: data.role,
        });

        onJoinSuccess?.({
          workspaceId: data.workspaceId,
          role: data.role,
          workspaceName: data.workspaceName,
          owner: data.owner,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to join workspace";
        setError(message);
        setJoinState("error");
        onJoinError?.(message);
        span.recordException(err as Error);
        span.setStatus({ code: 2, message });
      }
    });
  }, [
    shareToken,
    isGuest,
    isAuthenticated,
    workspaceInfo,
    onJoinSuccess,
    onJoinError,
    apiUrl,
  ]);

  // Start validation when token is present
  useEffect(() => {
    if (effectiveToken && joinState === "idle") {
      validateToken();
    }
  }, [effectiveToken, joinState, validateToken]);

  // Auto-join collaborator when authenticated and workspace info is available
  useEffect(() => {
    if (
      !isGuest &&
      isAuthenticated &&
      !authLoading &&
      workspaceInfo &&
      joinState === "validating"
    ) {
      joinWorkspace();
    }
  }, [
    isGuest,
    isAuthenticated,
    authLoading,
    workspaceInfo,
    joinState,
    joinWorkspace,
  ]);

  return {
    joinState,
    error,
    workspaceInfo,
    isAuthenticated,
    needsLogin:
      !(isGuest || isAuthenticated || authLoading) &&
      workspaceInfo !== null &&
      joinState === "validating",
    validateToken,
    joinWorkspace,
  };
}

export function JoinWorkspaceHandler({
  shareToken,
  guestToken,
  onComplete,
}: {
  guestToken?: string | null;
  onComplete?: (data: JoinSuccessData | null) => void;
  shareToken?: string | null;
}) {
  const { joinState, error, needsLogin, workspaceInfo } = useJoinWorkspace({
    shareToken,
    guestToken,
    onJoinSuccess: (data) => {
      onComplete?.(data);
    },
    onJoinError: () => {
      onComplete?.(null);
    },
  });

  const openProfileModal = useKanbanStore((state) => state.openProfileModal);

  const handleLogin = () => {
    openProfileModal();
  };

  const handleContinueAsGuest = () => {
    const effectiveToken = shareToken || guestToken;
    if (workspaceInfo && effectiveToken) {
      useKanbanStore.getState().setGuestMode(true, effectiveToken);
      onComplete?.({
        workspaceId: workspaceInfo.workspaceId,
        workspaceName: workspaceInfo.workspaceName,
        owner: workspaceInfo.owner,
        role: "VIEWER",
        isGuest: true,
      });
    }
  };

  if (!(shareToken || guestToken)) {
    return null;
  }

  if (needsLogin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="mx-4 w-full max-w-sm rounded-xl bg-card p-6 shadow-xl">
          <h2 className="mb-2 font-semibold text-lg">
            Join{" "}
            {workspaceInfo?.workspaceName
              ? `"${workspaceInfo.workspaceName}"`
              : "Workspace"}
          </h2>
          {workspaceInfo?.owner && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/50 p-2">
              {workspaceInfo.owner.image ? (
                // biome-ignore lint/performance/noImgElement: External user avatars
                <img
                  alt=""
                  className="h-6 w-6 rounded-full"
                  height={24}
                  src={workspaceInfo.owner.image}
                  width={24}
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/10" />
              )}
              <div className="flex flex-col">
                <span className="font-medium text-xs">Invited by</span>
                <span className="text-sm">
                  {workspaceInfo.owner.name || workspaceInfo.owner.email}
                </span>
              </div>
            </div>
          )}
          <p className="mb-4 text-muted-foreground text-sm">
            Please login to join this workspace collaboration.
          </p>
          <p className="text-muted-foreground text-xs">
            After logging in, you'll automatically join the workspace as an
            editor.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              className="w-full gap-2 rounded-xl bg-[#1a1a1a] font-medium text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.15),0_4px_8px_rgba(0,0,0,0.15)] transition-all hover:bg-[#000000] hover:shadow-[inset_0_1px_3px_rgba(255,255,255,0.2),0_6px_12px_rgba(0,0,0,0.2)] active:scale-[0.98] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] dark:bg-[#e0e0e0] dark:text-black dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.1)] dark:active:shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)] dark:hover:bg-[#ffffff] dark:hover:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.2)]"
              onClick={handleLogin}
            >
              <User className="h-4 w-4" />
              Continue to Lumen
            </Button>
            <Button
              className="w-full gap-2 rounded-xl border border-border/70 bg-secondary/50 font-medium text-foreground transition-all hover:bg-secondary hover:text-foreground active:scale-[0.98]"
              data-testid="continue-as-guest-button"
              onClick={handleContinueAsGuest}
              variant="outline"
            >
              <Eye className="h-4 w-4 text-emerald-500" />
              Continue as Guest
            </Button>
          </div>
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
