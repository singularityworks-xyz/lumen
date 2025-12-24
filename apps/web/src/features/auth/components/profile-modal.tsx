import { createLogger } from "@lumen/logger";
import {
  Check,
  Copy,
  Github,
  Link,
  Loader2,
  LogOut,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useKanbanStore } from "@/src/features/kanban/store";
import { useAuth } from "@/src/hooks/use-auth";

const logger = createLogger({ name: "profile-modal" });

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
};

export const ProfileModal = memo(({ open, onClose }: ProfileModalProps) => {
  const { user, isLoading, signInWithGitHub, signOutUser } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showShareInput, setShowShareInput] = useState(false);
  const [isLoadingShare, setIsLoadingShare] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

  useEffect(() => {
    if (!(open && currentWorkspaceId && user)) {
      return;
    }

    if (shareUrl) {
      setShowShareInput(true);
      return;
    }

    // Fetch from backend and cache in store
    const fetchExistingShare = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/api/workspaces/${currentWorkspaceId}/share`,
          { credentials: "include" }
        );
        const data = await response.json();
        if (data.url) {
          setWorkspaceShareUrl(currentWorkspaceId, data.url);
          setShowShareInput(true);
        }
      } catch {
        // No existing share link - that's fine
      }
    };

    fetchExistingShare();
  }, [open, currentWorkspaceId, user, apiUrl, shareUrl, setWorkspaceShareUrl]);

  useEffect(() => {
    if (!(showShareInput && currentWorkspaceId) || shareUrl) {
      return;
    }

    const createShare = async () => {
      setIsLoadingShare(true);
      try {
        const response = await fetch(
          `${apiUrl}/api/workspaces/${currentWorkspaceId}/share`,
          { method: "POST", credentials: "include" }
        );
        const data = await response.json();
        if (data.url) {
          setWorkspaceShareUrl(currentWorkspaceId, data.url);
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
    shareUrl,
    apiUrl,
    setWorkspaceShareUrl,
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
            className="fixed top-4 left-1/2 z-50 w-72 -translate-x-1/2 overflow-hidden rounded-xl border-2 border-border/50 bg-card p-4 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: -12 }}
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
                            setShowShareInput(!showShareInput);
                          }}
                          size="sm"
                          variant="outline"
                        >
                          <Link className="h-3 w-3" />
                          Share
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {showShareInput && (
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
                )}

                {/* Collaborators List */}
                <CollaboratorsList
                  apiUrl={apiUrl}
                  open={open}
                  workspaceId={currentWorkspaceId}
                />
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
    const [collaborators, setCollaborators] = useState<
      Array<{
        id: string;
        name: string | null;
        image: string | null;
        role: string;
        isOnline: boolean;
      }>
    >([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (!(workspaceId && open)) {
        return;
      }

      const fetchCollaborators = async () => {
        setLoading(true);
        try {
          const response = await fetch(
            `${apiUrl}/api/workspaces/${workspaceId}/collaborators`,
            { credentials: "include" }
          );
          if (response.ok) {
            const data = await response.json();
            setCollaborators(data.collaborators || []);
          }
        } catch (error) {
          console.error("Failed to fetch collaborators", error);
        } finally {
          setLoading(false);
        }
      };

      fetchCollaborators();
      // Poll for online status every 10s
      const interval = setInterval(fetchCollaborators, 10_000);
      return () => clearInterval(interval);
    }, [workspaceId, apiUrl, open]);

    if (!workspaceId || (!loading && collaborators.length === 0)) {
      return null;
    }

    return (
      <div className="pt-2">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium text-muted-foreground text-xs">
            Collaborators
          </h3>
          <span className="text-[10px] text-muted-foreground">
            {collaborators.length} member{collaborators.length !== 1 && "s"}
          </span>
        </div>

        {loading && collaborators.length === 0 ? (
          <div className="flex justify-center py-2">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {collaborators.map((collab) => (
              <div
                className="flex items-center gap-2 rounded-lg border border-border/40 bg-card/50 p-1.5"
                key={collab.id}
              >
                <div className="relative">
                  <Avatar className="h-6 w-6 rounded-md">
                    <AvatarImage src={collab.image || ""} />
                    <AvatarFallback className="rounded-md text-[10px]">
                      {collab.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {collab.isOnline && (
                    <span className="absolute -right-0.5 -bottom-0.5 block h-2 w-2 rounded-full border border-background bg-green-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-xs leading-none">
                      {collab.name || "Unknown User"}
                    </span>
                    {collab.role === "owner" && (
                      <span className="rounded bg-primary/10 px-1 py-0.5 font-medium text-[9px] text-primary leading-none">
                        Owner
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);

ProfileModal.displayName = "ProfileModal";
