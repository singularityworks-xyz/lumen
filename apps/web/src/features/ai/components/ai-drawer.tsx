"use client";

import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { useAiStore } from "../store/ai-store";
import { AiDrawerContent } from "./ai-drawer-content";
import { FloatingIndicator } from "./floating-indicator";

export interface AiDrawerProps {
  boardCount?: number;
  commentCount?: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToBoards?: () => void;
  onSwitchToComments?: () => void;
  workspaceId: string;
}

export const AiDrawer = memo(
  ({
    workspaceId,
    isOpen,
    onOpenChange,
    onSwitchToBoards,
    onSwitchToComments,
    boardCount = 0,
    commentCount = 0,
  }: AiDrawerProps) => {
    const [mounted, setMounted] = useState(false);

    const messages = useAiStore(
      useShallow((state) => state.conversations[workspaceId]?.messages ?? [])
    );
    const isOffline = useAiStore((state) => state.isOffline);

    useEffect(() => {
      setMounted(true);
    }, []);

    const handleOpen = useCallback(() => onOpenChange(true), [onOpenChange]);
    const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isOpen) {
          onOpenChange(false);
        }
        if (e.key === "a" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
          e.preventDefault();
          onOpenChange(!isOpen);
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onOpenChange]);

    useEffect(() => {
      const setOffline = useAiStore.getState().setOffline;

      const handleOnline = () => setOffline(false);
      const handleOffline = () => setOffline(true);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      setOffline(!navigator.onLine);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }, []);

    if (!mounted || typeof document === "undefined" || !workspaceId) {
      return null;
    }

    return createPortal(
      <>
        <FloatingIndicator
          hasMessages={messages.length > 0}
          isOffline={isOffline}
          isOpen={isOpen}
          onClick={handleOpen}
        />

        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                onClick={handleClose}
                transition={{ duration: 0.2 }}
              />

              <AiDrawerContent
                boardCount={boardCount}
                commentCount={commentCount}
                onClose={handleClose}
                onSwitchToBoards={onSwitchToBoards}
                onSwitchToComments={onSwitchToComments}
                workspaceId={workspaceId}
              />
            </>
          )}
        </AnimatePresence>
      </>,
      document.body
    );
  }
);

AiDrawer.displayName = "AiDrawer";

export default AiDrawer;
