"use client";

import { Info, Shield, ShieldAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback } from "react";
import { cn } from "@/src/lib/utils";
import { useKanbanStore } from "../../kanban";
import LarityOrb from "./animations/larity-orb";

type AiOptInDialogProps = {
  workspaceId: string;
  workspaceName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

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
              className={cn(
                "w-full max-w-md rounded-2xl p-6",
                "bg-card/98 backdrop-blur-xl",
                "border border-border/50",
                "shadow-[0_8px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05)]",
                "dark:shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)]"
              )}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
            >
              <div className="mb-4 flex items-center gap-3">
                <LarityOrb size="lg" speed={0.5} />
                <div>
                  <h3 className="font-semibold text-foreground text-lg">
                    Enable Larity AI
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    for "{workspaceName}"
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "mb-4 rounded-xl p-4",
                  "border border-amber-500/20 bg-amber-500/10"
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-amber-600 text-sm dark:text-amber-400">
                    Privacy Notice
                  </span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  This is a <strong>local workspace</strong>. Enabling Larity
                  will send your workspace data (board names, task titles,
                  descriptions) to our servers to provide AI assistance.
                </p>
              </div>

              <div className="mb-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Shield className="h-3 w-3 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      AI conversations stored locally
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Your chat history stays in your browser, not on our
                      servers
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Info className="h-3 w-3 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      Workspace data sent for context
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Task and board information is sent to provide relevant
                      assistance
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  className={cn(
                    "flex-1 rounded-xl px-4 py-2.5",
                    "bg-muted/40 font-medium text-muted-foreground text-sm",
                    "border border-border/40",
                    "shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
                    "dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]",
                    "hover:border-border/60 hover:bg-muted/60",
                    "transition-all duration-200"
                  )}
                  onClick={onClose}
                  type="button"
                >
                  Keep Disabled
                </button>
                <button
                  className={cn(
                    "flex-1 rounded-xl px-4 py-2.5",
                    "bg-primary font-medium text-primary-foreground text-sm",
                    "shadow-[0_2px_8px_rgba(0,0,0,0.15)]",
                    "hover:bg-primary/90",
                    "transition-all duration-200"
                  )}
                  onClick={handleConfirm}
                  type="button"
                >
                  Enable Larity
                </button>
              </div>

              <p className="mt-4 text-center text-[10px] text-muted-foreground/60">
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
