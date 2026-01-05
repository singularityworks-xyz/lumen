import { createLogger } from "@lumen/logger";
import { isTauri } from "@lumen/native-bridge";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Copy,
  Github,
  Key,
  Link,
  Loader2,
  LogOut,
  Share2,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { env } from "@/src/env";
import { useCollaboration } from "@/src/features/collab";
import { useKanbanStore } from "@/src/features/kanban/store";
import { useAuth } from "@/src/hooks/use-auth";
import { useNativeTitlebarOffset } from "@/src/hooks/use-native-titlebar";

const logger = createLogger({ name: "profile-modal" });

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
};

export const ProfileModal = memo(({ open, onClose }: ProfileModalProps) => {
  const {
    user,
    isLoading,
    signInWithGitHub,
    signOutUser,
    exchangeManualToken,
  } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showShareInput, setShowShareInput] = useState(false);
  const [isLoadingShare, setIsLoadingShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingShareWorkspaceId, setPendingShareWorkspaceId] = useState<
    string | null
  >(null);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [isExchangingToken, setIsExchangingToken] = useState(false);

  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const currentWorkspace = useKanbanStore((state) =>
    currentWorkspaceId ? state.workspaces.byId[currentWorkspaceId] : null
  );
  const defaultWorkspaceId = useKanbanStore(
    (state) => state.workspaces.allIds[0] ?? null
  );
  const shareUrl = useKanbanStore((state) =>
    currentWorkspaceId ? state.workspaceShareUrls[currentWorkspaceId] : null
  );
  const setWorkspaceShareUrl = useKanbanStore(
    (state) => state.setWorkspaceShareUrl
  );
  const clearWorkspaceShareUrl = useKanbanStore(
    (state) => state.clearWorkspaceShareUrl
  );
  const workspaces = useKanbanStore((state) => state.workspaces);
  const workspaceShareUrls = useKanbanStore(
    (state) => state.workspaceShareUrls
  );
  const apiUrl = (env.NEXT_PUBLIC_API_URL || "http://localhost:3002") as string;

  const isDefaultWorkspace = currentWorkspaceId === defaultWorkspaceId;

  const sharedWorkspaces = Object.entries(workspaceShareUrls)
    .filter(
      ([wsId, url]) =>
        url && wsId !== currentWorkspaceId && workspaces.byId[wsId]
    )
    .map(([wsId, url]) => ({
      id: wsId,
      name: workspaces.byId[wsId]?.name || "Unknown Workspace",
      url,
    }));

  const totalSharedCount = Object.entries(workspaceShareUrls).filter(
    ([wsId, url]) => url && workspaces.byId[wsId]
  ).length;
  const [copiedWorkspaceId, setCopiedWorkspaceId] = useState<string | null>(
    null
  );
  const [showOtherShared, setShowOtherShared] = useState(false);
  const titlebarOffset = useNativeTitlebarOffset();

  useEffect(() => {
    if (!open) {
      return;
    }

    for (const wsId of Object.keys(workspaceShareUrls)) {
      if (!workspaces.byId[wsId]) {
        clearWorkspaceShareUrl(wsId);
      }
    }
  }, [open, workspaces.byId, workspaceShareUrls, clearWorkspaceShareUrl]);

  useEffect(() => {
    if (!(open && currentWorkspaceId && user)) {
      return;
    }

    if (shareUrl) {
      setShowShareInput(true);
      return;
    }

    if (isDefaultWorkspace) {
      return;
    }

    const fetchExistingShare = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/api/workspaces/${currentWorkspaceId}/share`,
          {
            method: "GET",
            credentials: "include",
          }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            setWorkspaceShareUrl(currentWorkspaceId, data.url);
            setShowShareInput(true);
          }
        }
      } catch {
        // No existing share link - that's fine
      }
    };

    fetchExistingShare();
  }, [
    open,
    currentWorkspaceId,
    user,
    apiUrl,
    shareUrl,
    setWorkspaceShareUrl,
    isDefaultWorkspace,
  ]);

  // Reset share input state when workspace changes to prevent auto-sharing new workspace
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally trigger on workspace change
  useEffect(() => {
    setShowShareInput(false);
    setIsLoadingShare(false);
    setError(null);
    setPendingShareWorkspaceId(null); // Clear pending share on workspace change
  }, [currentWorkspaceId]);

  // When showShareInput is true and we don't have a shareUrl yet, create the share
  // Flow: 1) Create share in DB first, 2) Then connect via WebSocket
  useEffect(() => {
    // Only create share if this is the workspace we intentionally want to share
    const shouldCreateShare =
      showShareInput &&
      currentWorkspaceId &&
      !shareUrl &&
      pendingShareWorkspaceId === currentWorkspaceId;

    if (!shouldCreateShare) {
      return;
    }

    const createShare = async () => {
      setIsLoadingShare(true);
      setError(null);
      try {
        // Step 1: Create the share link (this creates workspace in DB if needed)
        const response = await fetch(
          `${apiUrl}/api/workspaces/${currentWorkspaceId}/share`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: currentWorkspace?.name,
            }),
          }
        );
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to create share link");
          return;
        }

        if (data.url) {
          setWorkspaceShareUrl(currentWorkspaceId, data.url);
          // Note: collab-wrapper will auto-connect when workspaceShareUrls changes
        }
      } catch {
        setError("Failed to create share link");
      } finally {
        setIsLoadingShare(false);
      }
    };

    createShare();
  }, [
    showShareInput,
    currentWorkspaceId,
    currentWorkspace?.name,
    shareUrl,
    apiUrl,
    setWorkspaceShareUrl,
    pendingShareWorkspaceId,
  ]);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy link");
    }
  }, [shareUrl]);

  const handleCopyWorkspaceLink = useCallback(
    async (workspaceId: string, url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedWorkspaceId(workspaceId);
        setTimeout(() => setCopiedWorkspaceId(null), 2000);
      } catch {
        setError("Failed to copy link");
      }
    },
    []
  );

  const handleGithubLogin = async () => {
    setIsSigningIn(true);
    setError(null);

    try {
      await signInWithGitHub("/");
    } catch (err) {
      logger.error("GitHub login failed", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setError("Failed to sign in. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleManualTokenExchange = async () => {
    if (!manualToken.trim()) {
      setError("Please enter a token");
      return;
    }

    setIsExchangingToken(true);
    setError(null);

    try {
      const success = await exchangeManualToken(manualToken.trim());
      if (success) {
        setManualToken("");
        setShowTokenInput(false);
      } else {
        setError("Invalid or expired token. Please try again.");
      }
    } catch (err) {
      logger.error("Manual token exchange failed", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setError("Failed to exchange token. Please try again.");
    } finally {
      setIsExchangingToken(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setError(null);

    try {
      await signOutUser();
      onClose();
    } catch (err) {
      logger.error("Sign out failed", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setError("Failed to sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-black/20"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="fixed left-1/2 z-50 w-100 -translate-x-1/2 overflow-hidden rounded-xl border-2 border-border/50 bg-card p-4 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: -12 }}
            style={{ top: `${16 + titlebarOffset}px` }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <button
              className="absolute top-2.5 right-2.5 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : user ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 rounded-xl">
                    <AvatarImage
                      alt={user.name || "User"}
                      src={user.image || ""}
                    />
                    <AvatarFallback className="rounded-xl bg-primary/10 text-primary">
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-medium text-sm">
                      {user.name || "User"}
                    </h2>
                    <p className="truncate text-muted-foreground text-xs">
                      {user.email || "No email"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button
                        className="h-7 rounded-lg px-3 text-xs"
                        disabled={isSigningOut}
                        onClick={handleSignOut}
                        size="sm"
                        variant="outline"
                      >
                        {isSigningOut ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Signing out...
                          </>
                        ) : (
                          <>
                            <LogOut className="mr-1 h-3 w-3" />
                            Sign out
                          </>
                        )}
                      </Button>
                      {currentWorkspaceId && (
                        <Button
                          className="h-7 gap-1 rounded-lg px-2.5 text-xs"
                          onClick={() => {
                            if (showShareInput && shareUrl) {
                              clearWorkspaceShareUrl(currentWorkspaceId);
                            }
                            if (showShareInput) {
                              // User is closing share panel - clear pending
                              setPendingShareWorkspaceId(null);
                            } else {
                              // User is opening share panel - record which workspace they want to share
                              setPendingShareWorkspaceId(currentWorkspaceId);
                            }
                            setShowShareInput(!showShareInput);
                          }}
                          size="sm"
                          variant="outline"
                        >
                          {isLoadingShare ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Link className="h-3 w-3" />
                          )}
                          Share
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {showShareInput && (
                  <div className="space-y-2">
                    {/* Current workspace share link */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                          <Share2 className="h-3 w-3" />
                          {currentWorkspace?.name || "Workspace"}
                        </span>
                        {totalSharedCount > 0 && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {totalSharedCount} shared
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isLoadingShare ? (
                          <div className="flex h-7 flex-1 items-center justify-center rounded-md border bg-muted/30">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <Input
                            className="h-7 flex-1 text-xs"
                            placeholder="Share link"
                            readOnly
                            value={shareUrl || ""}
                          />
                        )}
                        <Button
                          className="h-7 w-7 shrink-0 p-0"
                          disabled={!shareUrl || isLoadingShare}
                          onClick={handleCopyLink}
                          size="sm"
                          variant="outline"
                        >
                          {copied ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Other shared workspaces */}
                    {sharedWorkspaces.length > 0 && (
                      <div className="space-y-1.5">
                        <button
                          className="flex w-full items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
                          onClick={() => setShowOtherShared(!showOtherShared)}
                          type="button"
                        >
                          <ChevronDown
                            className={`h-3 w-3 transition-transform ${showOtherShared ? "rotate-0" : "-rotate-90"}`}
                          />
                          <span>
                            Other shared workspaces ({sharedWorkspaces.length})
                          </span>
                        </button>

                        <AnimatePresence>
                          {showOtherShared && (
                            <motion.div
                              animate={{ height: "auto", opacity: 1 }}
                              className="space-y-1 overflow-hidden"
                              exit={{ height: 0, opacity: 0 }}
                              initial={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              {sharedWorkspaces.map((ws) => (
                                <div
                                  className="flex items-center gap-1.5 rounded-md bg-muted/30 px-2 py-1.5"
                                  key={ws.id}
                                >
                                  <span className="flex-1 truncate text-xs">
                                    {ws.name}
                                  </span>
                                  <TooltipProvider delayDuration={300}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          className="h-6 w-6 shrink-0 p-0"
                                          onClick={() =>
                                            handleCopyWorkspaceLink(
                                              ws.id,
                                              ws.url
                                            )
                                          }
                                          size="sm"
                                          variant="ghost"
                                        >
                                          {copiedWorkspaceId === ws.id ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                          ) : (
                                            <Copy className="h-3 w-3" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left">
                                        <p className="text-xs">
                                          Copy share link
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                )}

                {(currentWorkspace?.isShared || shareUrl) && (
                  <CollaboratorsList
                    apiUrl={apiUrl}
                    open={open}
                    workspaceId={currentWorkspaceId}
                  />
                )}
              </div>
            ) : (
              <div>
                <div className="mb-3 pr-6">
                  <h2 className="font-semibold text-sm">Welcome</h2>
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    Sign in to sync your boards
                  </p>
                </div>

                {error && (
                  <div className="mb-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-destructive text-xs">
                    {error}
                  </div>
                )}

                <Button
                  className="h-8 w-full gap-1.5 rounded-lg bg-[#24292f] font-medium text-white text-xs shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-[#24292f]/90 dark:bg-[#f0f0f0] dark:text-[#24292f] dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.4),inset_0_-1px_1px_rgba(0,0,0,0.1)] dark:hover:bg-[#f0f0f0]/90"
                  disabled={isSigningIn}
                  onClick={handleGithubLogin}
                  type="button"
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <Github className="h-3.5 w-3.5" />
                      Continue with GitHub
                    </>
                  )}
                </Button>

                {/* Manual token input for Tauri when deep links don't work */}
                {isTauri() && (
                  <div className="mt-3">
                    <button
                      className="flex w-full items-center justify-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
                      onClick={() => setShowTokenInput(!showTokenInput)}
                      type="button"
                    >
                      <Key className="h-3 w-3" />
                      <span>Paste auth token manually</span>
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${showTokenInput ? "rotate-180" : ""}`}
                      />
                    </button>

                    <AnimatePresence>
                      {showTokenInput && (
                        <motion.div
                          animate={{ height: "auto", opacity: 1 }}
                          className="overflow-hidden"
                          exit={{ height: 0, opacity: 0 }}
                          initial={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <div className="mt-2 space-y-2">
                            <p className="text-[10px] text-muted-foreground">
                              After signing in via browser, copy the token from
                              the callback page and paste it here.
                            </p>
                            <div className="flex gap-1.5">
                              <Input
                                className="h-7 flex-1 font-mono text-xs"
                                onChange={(e) => setManualToken(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleManualTokenExchange();
                                  }
                                }}
                                placeholder="Paste token here..."
                                value={manualToken}
                              />
                              <Button
                                className="h-7 px-3"
                                disabled={
                                  isExchangingToken || !manualToken.trim()
                                }
                                onClick={handleManualTokenExchange}
                                size="sm"
                                variant="outline"
                              >
                                {isExchangingToken ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Submit"
                                )}
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
});

const CollaboratorsList = memo(
  ({
    workspaceId,
    apiUrl,
    open,
  }: {
    workspaceId: string | null;
    apiUrl: string;
    open: boolean;
  }) => {
    const { user: authUser } = useAuth();
    const {
      collaborators: onlineCollaborators,
      isCollaborating,
      localUser: collabLocalUser,
    } = useCollaboration();

    // Use TanStack Query for caching collaborators data
    const { data: apiMembers = [], isLoading } = useQuery({
      queryKey: ["workspace-collaborators", workspaceId],
      queryFn: async () => {
        const response = await fetch(
          `${apiUrl}/api/workspaces/${workspaceId}/collaborators`,
          { credentials: "include" }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch collaborators");
        }
        const data = await response.json();
        return (data.collaborators || []) as Array<{
          id: string;
          name: string | null;
          image: string | null;
          role: string;
        }>;
      },
      enabled: !!workspaceId && open,
      staleTime: 30 * 1000, // Consider data stale after 30 seconds
      gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
    });

    // Build combined members list from WS + API data
    const { allMembers, onlineIds } = useMemo(() => {
      const ids = new Set<string>();
      const onlineMembers: Array<{
        id: string;
        name: string;
        image: string | null;
        role: string;
        color?: string;
      }> = [];

      // Add current user if collaborating
      if (isCollaborating && authUser) {
        ids.add(authUser.id);
        onlineMembers.push({
          id: authUser.id,
          name: authUser.name || "You",
          image: authUser.image || null,
          role: "owner",
          color: collabLocalUser?.color, // Use the local user's cursor color
        });
      }

      // Add WebSocket collaborators
      for (const c of onlineCollaborators) {
        if (!ids.has(c.id)) {
          ids.add(c.id);
          onlineMembers.push({
            id: c.id,
            name: c.name,
            image: null,
            role: c.role,
            color: c.color,
          });
        }
      }

      // Merge with API data for images and past members
      const members = [...onlineMembers];

      for (const apiMember of apiMembers) {
        if (ids.has(apiMember.id)) {
          // Update online member with API image if available
          const existing = members.find((m) => m.id === apiMember.id);
          if (existing && apiMember.image) {
            existing.image = apiMember.image;
          }
        } else {
          members.push({
            id: apiMember.id,
            name: apiMember.name || "Unknown",
            image: apiMember.image,
            role: apiMember.role,
          });
        }
      }

      return { allMembers: members, onlineIds: ids };
    }, [
      isCollaborating,
      authUser,
      collabLocalUser,
      onlineCollaborators,
      apiMembers,
    ]);

    if (!workspaceId) {
      return null;
    }

    if (isLoading && allMembers.length === 0) {
      return (
        <div className="space-y-2 pt-2">
          <Skeleton className="h-3 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      );
    }

    if (allMembers.length === 0) {
      return null;
    }

    return (
      <div className="pt-2">
        <h3 className="mb-2 font-medium text-muted-foreground text-xs">
          Members
        </h3>
        <div className="flex flex-wrap gap-2">
          <TooltipProvider delayDuration={0}>
            {allMembers.map((member) => {
              const isOnline = onlineIds.has(member.id);
              const cursorColor = member.color;
              return (
                <Tooltip key={member.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={`relative transition-all ${isOnline ? "" : "grayscale hover:grayscale-0"}`}
                    >
                      <Avatar
                        className={`h-8 w-8 cursor-help rounded-lg ring-2 ring-background ${isOnline ? "hover:scale-110" : "border border-border/50 bg-muted"}`}
                        style={
                          isOnline && cursorColor
                            ? { border: `2px solid ${cursorColor}` }
                            : isOnline
                              ? { border: "2px solid hsl(var(--primary))" }
                              : undefined
                        }
                      >
                        <AvatarImage src={member.image || ""} />
                        <AvatarFallback
                          className="rounded-lg text-[10px]"
                          style={
                            cursorColor
                              ? {
                                  backgroundColor: `${cursorColor}20`,
                                  color: cursorColor,
                                }
                              : undefined
                          }
                        >
                          {member.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <span
                          className="absolute -right-0.5 -bottom-0.5 block h-2.5 w-2.5 rounded-full border-2 border-background"
                          style={{ backgroundColor: cursorColor || "#22c55e" }}
                        />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">
                      {member.name}
                      {member.role === "owner" && " (Owner)"}
                      {isOnline && " • Online"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
      </div>
    );
  }
);

ProfileModal.displayName = "ProfileModal";
