"use client";

import { ChevronLeft, LayoutGrid, MessageCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { useCollaboration } from "@/src/features/collab";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { Comment } from "@/src/features/kanban/types";
import { cn } from "@/src/lib/utils";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return "just now";
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  if (diffDay === 1) {
    return "yesterday";
  }
  if (diffDay < 7) {
    return `${diffDay}d ago`;
  }
  return date.toLocaleDateString();
}

type CommentBubbleProps = {
  comment: Comment;
  isOwn: boolean;
  authorColor?: string;
  authorName: string;
  authorImage?: string | null;
  index: number;
};

const CommentBubble = memo(
  ({
    comment,
    isOwn,
    authorColor,
    authorName,
    authorImage,
    index,
  }: CommentBubbleProps) => {
    const fallback = authorName.slice(0, 2).toUpperCase();

    return (
      <motion.div
        animate={{ opacity: 1, x: 0, scale: 1 }}
        className={cn(
          "flex max-w-[85%] gap-2.5",
          isOwn ? "ml-auto flex-row-reverse" : "mr-auto"
        )}
        exit={{ opacity: 0, x: isOwn ? 20 : -20, scale: 0.95 }}
        initial={{ opacity: 0, x: isOwn ? 20 : -20, scale: 0.95 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
          delay: index * 0.03,
        }}
      >
        <Avatar
          className={cn(
            "h-7 w-7 shrink-0 border-2 shadow-sm",
            isOwn ? "border-primary/30" : "border-border"
          )}
          style={
            !isOwn && authorColor ? { borderColor: authorColor } : undefined
          }
        >
          <AvatarImage src={authorImage ?? undefined} />
          <AvatarFallback
            className="font-medium text-[10px]"
            style={
              !isOwn && authorColor
                ? { backgroundColor: `${authorColor}20`, color: authorColor }
                : undefined
            }
          >
            {fallback}
          </AvatarFallback>
        </Avatar>

        <div
          className={cn(
            "flex flex-col gap-0.5",
            isOwn ? "items-end" : "items-start"
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-medium text-[10px]",
                isOwn ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isOwn ? "You" : authorName}
            </span>
            <span className="text-[9px] text-muted-foreground/60">
              {formatRelativeTime(comment.createdAt)}
            </span>
          </div>

          <div
            className={cn(
              "relative rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
              "shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(255,255,255,0.1)]",
              "dark:shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(255,255,255,0.05)]",
              isOwn
                ? "rounded-br-md bg-primary text-primary-foreground"
                : "rounded-bl-md bg-muted/80 text-foreground",
              isOwn
                ? "shadow-[0_2px_8px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.15)]"
                : ""
            )}
            style={
              !isOwn && authorColor
                ? {
                    background: `linear-gradient(135deg, ${authorColor}08, ${authorColor}03)`,
                    borderLeft: `2px solid ${authorColor}40`,
                  }
                : undefined
            }
          >
            <p className="wrap-break-word whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }
);

type FloatingIndicatorProps = {
  onClick: () => void;
  commentCount: number;
  isOpen: boolean;
};

const FloatingIndicator = memo(
  ({ onClick, commentCount, isOpen }: FloatingIndicatorProps) => (
    <motion.button
      animate={{
        x: isOpen ? 100 : 0,
        opacity: isOpen ? 0 : 1,
        scale: isOpen ? 0.8 : 1,
      }}
      aria-label="Open comments"
      className={cn(
        "fixed top-1/2 right-0 z-40",
        "flex flex-col items-center justify-center gap-1",
        "w-10 rounded-l-xl py-4",
        "bg-card/95 backdrop-blur-md",
        "border-2 border-border/50 border-r-0",
        "shadow-[0_4px_20px_rgba(0,0,0,0.15),-4px_0_12px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_-1px_2px_rgba(255,255,255,0.08)]",
        "dark:shadow-[0_4px_20px_rgba(0,0,0,0.4),-4px_0_12px_rgba(0,0,0,0.2),inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_-1px_2px_rgba(255,255,255,0.05)]",
        "hover:bg-card hover:shadow-[0_4px_24px_rgba(0,0,0,0.2),-6px_0_16px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_-1px_2px_rgba(255,255,255,0.08)]",
        "dark:hover:shadow-[0_4px_24px_rgba(0,0,0,0.5),-6px_0_16px_rgba(0,0,0,0.25),inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_-1px_2px_rgba(255,255,255,0.05)]",
        "group cursor-pointer transition-shadow duration-300"
      )}
      initial={{ x: 100, opacity: 0 }}
      onClick={onClick}
      style={{ marginTop: "-96px" }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      type="button"
    >
      <div className="relative">
        <MessageCircle className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
        {commentCount > 0 && (
          <motion.span
            animate={{ scale: 1 }}
            className={cn(
              "absolute -top-1.5 -right-1.5",
              "h-4 min-w-4 px-1",
              "flex items-center justify-center",
              "rounded-full bg-primary text-primary-foreground",
              "font-bold text-[9px]",
              "shadow-sm"
            )}
            initial={{ scale: 0 }}
          >
            {commentCount > 99 ? "99+" : commentCount}
          </motion.span>
        )}
      </div>
      <span className="writing-mode-vertical font-medium text-[9px] text-muted-foreground transition-colors group-hover:text-foreground">
        Comments
      </span>
    </motion.button>
  )
);

type CommentsDrawerContentProps = {
  comments: Comment[];
  onClose: () => void;
  localUserId?: string;
  onSwitchToBoards?: () => void;
  boardCount?: number;
};

const CommentsDrawerContent = memo(
  ({
    comments,
    onClose,
    localUserId,
    onSwitchToBoards,
    boardCount = 0,
  }: CommentsDrawerContentProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const { collaborators, localUser } = useCollaboration();

    const sortedComments = useMemo(
      () =>
        [...comments].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
      [comments]
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: Only want to run on new comments
    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [sortedComments.length]);

    const getAuthorInfo = useCallback(
      (comment: Comment) => {
        const isOwn = comment.authorId === localUserId;
        const onlineAuthor = isOwn
          ? localUser
          : collaborators.find((c) => c.id === comment.authorId);

        return {
          isOwn,
          authorColor: isOwn ? undefined : (onlineAuthor?.color ?? "#6e6e6e"),
          authorName: onlineAuthor?.name ?? comment.authorName ?? "Unknown",
          authorImage: onlineAuthor?.image ?? comment.authorImage,
        };
      },
      [localUserId, localUser, collaborators]
    );

    return (
      <motion.div
        animate={{ opacity: 1, x: 0, scale: 1, y: "-50%" }}
        className={cn(
          "fixed top-1/2 right-4 z-50",
          "w-[30vw] min-w-[320px] max-w-105",
          "h-[70vh] max-h-175 min-h-100",
          "flex flex-col"
        )}
        exit={{ opacity: 0, x: "100%", scale: 0.98, y: "-50%" }}
        initial={{ opacity: 0, x: "100%", scale: 0.98, y: "-50%" }}
        transition={{ type: "spring", stiffness: 350, damping: 35 }}
      >
        <div
          className={cn(
            "flex h-full w-full flex-col",
            "overflow-hidden rounded-2xl",
            "bg-card/98 backdrop-blur-xl",
            "border-2 border-border/50",
            "shadow-[0_8px_40px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05),inset_0_2px_8px_rgba(0,0,0,0.15),inset_0_-2px_6px_rgba(255,255,255,0.05)]",
            "dark:shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05),inset_0_2px_8px_rgba(255,255,255,0.1),inset_0_-2px_6px_rgba(0,0,0,0.4)]"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between px-4 py-3",
              "border-border/50 border-b",
              "bg-linear-to-b from-muted/50 to-transparent"
            )}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  "bg-primary/10 text-primary",
                  "shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
                )}
              >
                <MessageCircle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  Comments
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {comments.length}{" "}
                  {comments.length === 1 ? "comment" : "comments"} in workspace
                </p>
              </div>
            </div>
            <button
              aria-label="Close comments"
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg",
                "text-muted-foreground hover:text-foreground",
                "hover:bg-muted/80 active:bg-muted",
                "transition-all duration-200",
                "shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]",
                "hover:shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)]"
              )}
              onClick={onClose}
              type="button"
            >
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </button>
          </div>

          <div
            className={cn(
              "flex-1 overflow-y-auto overflow-x-hidden",
              "space-y-4 px-4 py-4",
              "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            )}
            ref={scrollRef}
          >
            {sortedComments.length === 0 ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex h-full flex-col items-center justify-center py-12 text-center"
                initial={{ opacity: 0, y: 10 }}
              >
                <div
                  className={cn(
                    "mb-4 h-16 w-16 rounded-2xl",
                    "flex items-center justify-center",
                    "bg-muted/50",
                    "shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_-1px_2px_rgba(255,255,255,0.05)]",
                    "dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_-1px_2px_rgba(255,255,255,0.03)]"
                  )}
                >
                  <MessageCircle className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="font-medium text-muted-foreground text-sm">
                  No comments yet
                </p>
                <p className="mt-1 text-muted-foreground/60 text-xs">
                  Comments from the workspace will appear here
                </p>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                {sortedComments.map((comment, index) => {
                  const { isOwn, authorColor, authorName, authorImage } =
                    getAuthorInfo(comment);
                  return (
                    <CommentBubble
                      authorColor={authorColor}
                      authorImage={authorImage}
                      authorName={authorName}
                      comment={comment}
                      index={index}
                      isOwn={isOwn}
                      key={comment.id}
                    />
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          <div
            className={cn(
              "pointer-events-none relative z-10 -mt-6 h-6",
              "bg-linear-to-t from-card to-transparent"
            )}
          />

          <div
            className={cn(
              "h-1 w-full",
              "bg-linear-to-r from-transparent via-primary/20 to-transparent"
            )}
          />
        </div>

        {onSwitchToBoards && (
          <motion.button
            animate={{ x: 0, opacity: 1 }}
            aria-label="Switch to Boards"
            className={cn(
              "absolute top-1/2 left-0 -translate-x-full -translate-y-1/2",
              "flex flex-col items-center justify-center gap-1",
              "w-9 rounded-l-xl py-3",
              "bg-card/95 backdrop-blur-md",
              "border-2 border-border/50 border-r-0",
              "shadow-[0_4px_16px_rgba(0,0,0,0.12),-4px_0_8px_rgba(0,0,0,0.06),inset_0_2px_4px_rgba(0,0,0,0.08),inset_0_-1px_2px_rgba(255,255,255,0.06)]",
              "dark:shadow-[0_4px_16px_rgba(0,0,0,0.3),-4px_0_8px_rgba(0,0,0,0.15),inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_-1px_2px_rgba(255,255,255,0.04)]",
              "hover:bg-muted/80",
              "group cursor-pointer transition-colors duration-200"
            )}
            initial={{ x: -20, opacity: 0 }}
            onClick={onSwitchToBoards}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
              delay: 0.2,
            }}
            type="button"
          >
            <div className="relative">
              <LayoutGrid className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
              {boardCount > 0 && (
                <span
                  className={cn(
                    "absolute -top-1 -right-1",
                    "h-3 min-w-3 px-0.5",
                    "flex items-center justify-center",
                    "rounded-full bg-primary text-primary-foreground",
                    "font-bold text-[7px]"
                  )}
                >
                  {boardCount > 9 ? "9+" : boardCount}
                </span>
              )}
            </div>
            <span className="writing-mode-vertical font-medium text-[8px] text-muted-foreground transition-colors group-hover:text-foreground">
              Boards
            </span>
          </motion.button>
        )}
      </motion.div>
    );
  }
);

export type CommentsDrawerProps = {
  defaultOpen?: boolean;
  onSwitchToBoards?: () => void;
  boardCount?: number;
};

export const CommentsDrawer = memo(
  ({
    defaultOpen = false,
    onSwitchToBoards,
    boardCount = 0,
  }: CommentsDrawerProps) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [mounted, setMounted] = useState(false);
    const { localUser } = useCollaboration();

    const comments = useKanbanStore((state) => state.comments);
    const currentWorkspaceId = useKanbanStore(
      (state) => state.currentWorkspaceId
    );

    const workspaceComments = useMemo(
      () =>
        comments.allIds
          .map((id) => comments.byId[id])
          .filter(
            (c): c is Comment => !!c && c.workspaceId === currentWorkspaceId
          ),
      [comments, currentWorkspaceId]
    );

    useEffect(() => {
      setMounted(true);
    }, []);

    const handleOpen = useCallback(() => setIsOpen(true), []);
    const handleClose = useCallback(() => setIsOpen(false), []);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isOpen) {
          handleClose();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, handleClose]);

    if (!mounted || typeof document === "undefined") {
      return null;
    }

    return createPortal(
      <>
        <FloatingIndicator
          commentCount={workspaceComments.length}
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

              <CommentsDrawerContent
                boardCount={boardCount}
                comments={workspaceComments}
                localUserId={localUser?.id}
                onClose={handleClose}
                onSwitchToBoards={onSwitchToBoards}
              />
            </>
          )}
        </AnimatePresence>
      </>,
      document.body
    );
  }
);

export default CommentsDrawer;
