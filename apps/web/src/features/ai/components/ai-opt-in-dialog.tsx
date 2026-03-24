"use client";

import { Info, Shield, ShieldAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect } from "react";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../kanban";
import LarityOrb from "./animations/larity-orb";

interface AiOptInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  workspaceId: string;
  workspaceName: string;
}

export const AiOptInDialog = memo(
  ({
    workspaceId,
    workspaceName,
    isOpen,
    onClose,
    onConfirm,
  }: AiOptInDialogProps) => {
    const enableWorkspaceAi = useKanbanStore(
      (state) => state.enableWorkspaceAi
    );

    const handleConfirm = useCallback(() => {
      enableWorkspaceAi(workspaceId);
      onConfirm();
    }, [workspaceId, enableWorkspaceAi, onConfirm]);

    useEffect(() => {
      if (!isOpen) {
        return;
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-background/60"
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            onClick={onClose}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              aria-describedby="ai-opt-in-description"
              aria-labelledby="ai-opt-in-title"
              aria-modal="true"
              className={cn(
                "w-full max-w-sm rounded-xl p-5",
                "border border-border/50 bg-card/98 backdrop-blur-xl",
                "shadow-[0_8px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05)]",
                "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.05)]"
              )}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
            >
              <div className="mb-3 flex items-center gap-3">
                <LarityOrb size="md" speed={0.5} />
                <div>
                  <h3
                    className="font-semibold text-base text-foreground"
                    id="ai-opt-in-title"
                  >
                    Enable Larity AI
                  </h3>
                  <p
                    className="text-muted-foreground text-xs"
                    id="ai-opt-in-description"
                  >
                    for "{workspaceName}"
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "mb-3 rounded-lg p-3",
                  "border border-amber-500/20 bg-amber-500/10",
                  "shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]",
                  "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_0_rgba(251,191,36,0.1)]"
                )}
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  <span className="font-medium text-amber-600 text-xs dark:text-amber-400">
                    Privacy Notice
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  This is a <strong>local workspace</strong>. Enabling Larity
                  will send your workspace data (board names, task titles,
                  descriptions) to our servers to provide AI assistance.
                </p>
              </div>

              <div className="mb-4 space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Shield className="h-2.5 w-2.5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-xs">
                      Conversations stored locally
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Chat history stays in your browser
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Info className="h-2.5 w-2.5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-xs">
                      Workspace data sent for context
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Task info is sent to provide relevant assistance
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  className={cn(
                    "flex-1 rounded-xl px-3 py-1.5",
                    "bg-card/80 text-sm",
                    "shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]",
                    "dark:bg-card/50 dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]",
                    "transition-colors hover:bg-card dark:hover:bg-card/70"
                  )}
                  onClick={onClose}
                  type="button"
                >
                  Keep Disabled
                </button>
                <button
                  className={cn(
                    "flex-1 rounded-xl px-3 py-1.5",
                    "bg-primary font-medium text-primary-foreground text-sm",
                    "shadow-[0_2px_4px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)]",
                    "dark:shadow-[0_2px_4px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.4)]",
                    "transition-colors hover:bg-primary/90"
                  )}
                  onClick={handleConfirm}
                  type="button"
                >
                  Enable Larity
                </button>
              </div>

              <p className="mt-3 text-center text-[10px] text-muted-foreground/60">
                You can disable AI anytime from workspace settings
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

AiOptInDialog.displayName = "AiOptInDialog";
