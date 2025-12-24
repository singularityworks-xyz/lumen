import { createLogger } from "@lumen/logger";
import { Check, Copy, Github, Link, Loader2, User, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Button } from "@/src/components/ui/button";
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
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentWorkspaceId = useKanbanStore(
    (state) => state.currentWorkspaceId
  );
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

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

  const handleShareWorkspace = useCallback(async () => {
    if (!currentWorkspaceId) {
      setError("No workspace selected");
      return;
    }

    setIsGeneratingLink(true);
    setError(null);

    try {
      const response = await fetch(
        `${apiUrl}/api/workspaces/${currentWorkspaceId}/share`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate share link");
      }

      setShareUrl(data.url);
      logger.info("Share link generated", { url: data.url });
    } catch (err) {
      logger.error("Share link generation failed", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
      setError(
        err instanceof Error ? err.message : "Failed to generate share link"
      );
    } finally {
      setIsGeneratingLink(false);
    }
  }, [currentWorkspaceId, apiUrl]);

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
              <div className="space-y-4">
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
                  </div>
                </div>

                {/* Share Workspace Section */}
                {currentWorkspaceId && (
                  <div className="border-border/50 border-t pt-3">
                    <h3 className="mb-2 flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                      <Link className="h-3 w-3" />
                      Collaborate
                    </h3>

                    {shareUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
                          <input
                            className="flex-1 truncate bg-transparent text-xs outline-none"
                            readOnly
                            type="text"
                            value={shareUrl}
                          />
                          <Button
                            className="h-6 w-6 p-0"
                            onClick={handleCopyLink}
                            size="sm"
                            variant="ghost"
                          >
                            {copied ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          Share this link to collaborate in real-time
                        </p>
                      </div>
                    ) : (
                      <Button
                        className="h-8 w-full gap-1.5 text-xs"
                        disabled={isGeneratingLink}
                        onClick={handleShareWorkspace}
                        variant="outline"
                      >
                        {isGeneratingLink ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Link className="h-3 w-3" />
                            Share Workspace
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {error && (
                  <div className="rounded-lg bg-destructive/10 px-2 py-1.5 text-destructive text-xs">
                    {error}
                  </div>
                )}

                <Button
                  className="h-7 w-full rounded-lg px-3 text-xs"
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
                    "Sign out"
                  )}
                </Button>
              </div>
            ) : (
              <div>
                <div className="mb-3 pr-6">
                  <h2 className="font-semibold text-sm">Welcome</h2>
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    Sign in to sync and collaborate
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

ProfileModal.displayName = "ProfileModal";
