"use client";

import { useReactFlow } from "@xyflow/react";
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Reply,
  Send,
  Shell,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DeleteIcon } from "@/src/components/animated/icons/delete";
import { XIcon } from "@/src/components/animated/icons/x";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Textarea } from "@/src/components/ui/textarea";
import { useCollaboration } from "@/src/features/collab";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { Comment } from "@/src/features/kanban/types";
import { formatRelativeTime } from "@/src/lib/date";
import { cn } from "@/src/lib/utils";

type ViewMode = "sprawled" | "stacked";

type CommentClusterDialogProps = {
  comments: Comment[];
  onClose: () => void;
  screenPosition: { x: number; y: number };
  zoom: number;
};

// Helper to get/set view mode preference per cluster
// Uses the first comment ID as a stable identifier since cluster IDs change when comments are added/removed
function getClusterViewMode(clusterId: string): ViewMode {
  if (typeof window === "undefined") {
    return "sprawled";
  }
  const stored = localStorage.getItem(`cluster-view-${clusterId}`);
  return stored === "stacked" ? "stacked" : "sprawled";
}

function setClusterViewMode(clusterId: string, mode: ViewMode) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(`cluster-view-${clusterId}`, mode);
}

function getStableClusterId(comments: Comment[]): string {
  // Use the oldest comment's ID as a stable identifier
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  return sorted[0]?.id ?? "unknown";
}

type SplitButtonProps = {
  viewMode: ViewMode;
  onViewToggle: () => void;
  onClose: () => void;
  isVisible: boolean;
  isClosing: boolean;
  transitionDelay: string;
};

function SplitButton({
  viewMode,
  onViewToggle,
  onClose,
  isVisible,
  isClosing,
  transitionDelay,
}: SplitButtonProps) {
  return (
    <div
      className={cn(
        "cubic-bezier(0.34, 1.56, 0.64, 1) pointer-events-auto absolute top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 transition-all duration-500",
        (!isVisible || isClosing) && "rotate-90 scale-0 opacity-0"
      )}
      style={{ transitionDelay }}
    >
      <div className="relative h-14 w-14 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_2px_4px_rgba(0,0,0,0.15),inset_0_-1px_2px_rgba(255,255,255,0.1)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_-1px_2px_rgba(255,255,255,0.05)]">
        <button
          className={cn(
            "absolute inset-0 overflow-hidden rounded-full transition-all duration-200",
            "active:scale-95"
          )}
          onClick={onClose}
          style={{
            clipPath: "polygon(0 0, 50% 0, 50% 100%, 0 100%)",
          }}
          title="Close"
          type="button"
        >
          <div className="flex h-full w-full items-center bg-linear-to-b from-muted to-muted/80 text-muted-foreground shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_-1px_2px_rgba(255,255,255,0.08)] hover:from-destructive/20 hover:to-destructive/10 hover:text-destructive dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25),inset_0_-1px_2px_rgba(255,255,255,0.05)]">
            <XIcon className="ml-2" size={14} />
          </div>
        </button>

        <button
          className={cn(
            "absolute inset-0 overflow-hidden rounded-full transition-all duration-200",
            "active:scale-95"
          )}
          onClick={onViewToggle}
          style={{
            clipPath: "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)",
          }}
          title={
            viewMode === "sprawled"
              ? "Switch to stacked view"
              : "Switch to sprawled view"
          }
          type="button"
        >
          <div className="flex h-full w-full items-center justify-end bg-linear-to-b from-muted to-muted/80 text-muted-foreground shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),inset_0_-1px_2px_rgba(255,255,255,0.08)] hover:from-primary/20 hover:to-primary/10 hover:text-primary dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25),inset_0_-1px_2px_rgba(255,255,255,0.05)]">
            <div className="relative mr-2 h-4 w-4">
              <Shell
                className={cn(
                  "absolute inset-0 h-4 w-4 transition-all duration-300",
                  viewMode === "sprawled"
                    ? "scale-100 opacity-100"
                    : "rotate-180 scale-0 opacity-0"
                )}
              />
              <Layers
                className={cn(
                  "absolute inset-0 h-4 w-4 transition-all duration-300",
                  viewMode === "stacked"
                    ? "scale-100 opacity-100"
                    : "-rotate-180 scale-0 opacity-0"
                )}
              />
            </div>
          </div>
        </button>

        <div className="pointer-events-none absolute top-1.5 bottom-1.5 left-1/2 flex -translate-x-1/2">
          <div className="w-px bg-black/10 dark:bg-black/30" />
          <div className="w-px bg-white/20 dark:bg-white/10" />
        </div>
      </div>
    </div>
  );
}

type CommentCardProps = {
  comment: Comment;
  index: number;
  totalCount: number;
  isClosing: boolean;
  isVisible: boolean;
  onDragOut: (
    commentId: string,
    dropPosition: { x: number; y: number }
  ) => void;
  isFocused: boolean;
  onBringToFront: () => void;
  viewMode: ViewMode;
  stackColumn?: "left" | "right";
  onClose?: () => void;
};

function CommentCard({
  comment,
  index,
  totalCount,
  isClosing,
  isVisible,
  onDragOut,
  isFocused,
  onBringToFront,
  viewMode,
  stackColumn,
  onClose,
}: CommentCardProps) {
  const [content, setContent] = useState(comment.content);
  const [isEditing, setIsEditing] = useState(comment.content === "");
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isRepliesExpanded, setIsRepliesExpanded] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const updateComment = useKanbanStore((state) => state.updateComment);
  const removeComment = useKanbanStore((state) => state.removeComment);
  const addReply = useKanbanStore((state) => state.addReply);
  const commentsMap = useKanbanStore((state) => state.comments.byId);

  const replies = useMemo(
    () =>
      Object.values(commentsMap)
        .filter((c) => c.parentId === comment.id)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [commentsMap, comment.id]
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const { localUser, collaborators } = useCollaboration();
  const isAuthor = localUser?.id === comment.authorId;

  const replyAuthors = useMemo(() => {
    const uniqueAuthors = new Map();
    for (const r of replies) {
      if (uniqueAuthors.has(r.authorId)) {
        continue;
      }

      const isOwn = localUser?.id === r.authorId;
      const user = isOwn
        ? localUser
        : collaborators.find((c) => c.id === r.authorId);

      if (user) {
        uniqueAuthors.set(r.authorId, {
          id: r.authorId,
          name: user.name,
          image: user.image,
          color: isOwn ? undefined : user.color,
          isOwn,
        });
      } else {
        // Fallback to stored info on reply for offline users
        uniqueAuthors.set(r.authorId, {
          id: r.authorId,
          name: r.authorName ?? "Unknown",
          image: r.authorImage,
          color: "#6e6e6e",
          isOwn: false,
        });
      }
    }
    return Array.from(uniqueAuthors.values());
  }, [replies, collaborators, localUser]);

  const onlineAuthor = isAuthor
    ? localUser
    : collaborators.find((c) => c.id === comment.authorId);
  const authorColor = isAuthor ? undefined : (onlineAuthor?.color ?? "#6e6e6e");
  const authorName = onlineAuthor?.name ?? comment.authorName ?? "Unknown";
  const authorImage = onlineAuthor?.image ?? comment.authorImage;
  const fallback = authorName.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (showReplyInput && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [showReplyInput]);

  const handleSave = () => {
    if (content.trim()) {
      updateComment(comment.id, {
        content,
        lastEditedById: localUser?.id,
        lastEditorName: localUser?.name,
        lastEditorImage: localUser?.image ?? undefined,
      });
      setIsEditing(false);
    } else {
      removeComment(comment.id);
      if (onClose) {
        onClose();
      }
    }
  };

  const handleSendReply = () => {
    if (!(replyContent.trim() && localUser)) {
      return;
    }

    addReply(comment.id, replyContent.trim(), {
      id: localUser.id,
      name: localUser.name,
      image: localUser.image ?? undefined,
    });

    setReplyContent("");
    setShowReplyInput(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      if (isEditing) {
        // If editing and empty, cancel/delete
        if (content.trim()) {
          // If editing existing content, just cancel edit
          setIsEditing(false);
          setContent(comment.content);
        } else {
          removeComment(comment.id);
          if (onClose) {
            onClose();
          }
        }
      } else if (onClose) {
        // If viewing, close dialog
        onClose();
      }
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
    if (e.key === "Escape") {
      setShowReplyInput(false);
    }
  };

  const EXTRACT_THRESHOLD = 80;

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (totalCount <= 1) {
        return;
      }
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      setDragOffset({ x: 0, y: 0 });
    },
    [totalCount]
  );

  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!(isDragging && dragStartRef.current)) {
        return;
      }
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setDragOffset({ x: dx, y: dy });
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    },
    [isDragging]
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging) {
      return;
    }

    const distance = Math.sqrt(dragOffset.x ** 2 + dragOffset.y ** 2);
    if (distance >= EXTRACT_THRESHOLD && lastMousePosRef.current) {
      onDragOut(comment.id, lastMousePosRef.current);
    }

    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    dragStartRef.current = null;
    lastMousePosRef.current = null;
  }, [isDragging, dragOffset, comment.id, onDragOut]);

  // Global mouse listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      return () => {
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  const dragDistance = Math.sqrt(dragOffset.x ** 2 + dragOffset.y ** 2);
  const isNearExtract = dragDistance >= EXTRACT_THRESHOLD * 0.6;

  // Two-ring layout for 9+ comments:
  // - Inner ring: first 8 comments
  // - Outer ring: remaining comments
  const RING_THRESHOLD = 8;
  const usesTwoRings = totalCount > RING_THRESHOLD;

  let radius: number;
  let angleStep: number;
  let angle: number;
  let offsetX: number;
  let offsetY: number;

  if (viewMode === "sprawled") {
    // Sprawled view logic...
    if (usesTwoRings) {
      if (index < RING_THRESHOLD) {
        // Inner ring
        radius = 220;
        angleStep = (2 * Math.PI) / RING_THRESHOLD;
        angle = index * angleStep - Math.PI / 2;
      } else {
        // Outer ring
        radius = 340; // Larger radius for second ring
        const outerCount = totalCount - RING_THRESHOLD;
        angleStep = (2 * Math.PI) / outerCount;
        angle = (index - RING_THRESHOLD) * angleStep - Math.PI / 2;
      }
    } else {
      // Single ring for fewer comments
      radius = Math.max(200, totalCount * 20);
      angleStep = (2 * Math.PI) / totalCount;
      angle = index * angleStep - Math.PI / 2;
    }

    offsetX = Math.cos(angle) * radius;
    offsetY = Math.sin(angle) * radius;
  } else {
    // Stacked view logic
    const VERTICAL_SPACING = 160;
    const COLUMN_WIDTH = 280;

    if (stackColumn === "left") {
      offsetX = -COLUMN_WIDTH / 2 - 20;
    } else {
      offsetX = COLUMN_WIDTH / 2 + 20;
    }

    // Calculate vertical position in the column
    // The parent determines which items go in which column,
    // so we assume index is relative to the start of the column or we use a simpler stack approach.
    // Actually, let's just use the index directly but centered vertically
    // We need to know the index WITHIN the column to center it properly
    // For simplicity in this specialized tailored view, let's just stack casually
    offsetY = (index - (totalCount - 1) / 2) * VERTICAL_SPACING;
  }

  const currentX = offsetX;
  const currentY = offsetY;

  // Staggered entrance delay
  const delay = index * 50;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: it's needed to prevent hydration issues
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: it's needed to prevent hydration issues
    // biome-ignore lint/a11y/useKeyWithClickEvents: it's needed to prevent hydration issues
    <div
      className={cn(
        "cubic-bezier(0.34, 1.56, 0.64, 1) absolute w-64 rounded-lg border-2 bg-card text-left transition-all duration-500",
        "text-card-foreground shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]",
        "dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]",
        !isVisible || isClosing ? "scale-0 opacity-0" : "scale-100 opacity-100",
        isDragging && "scale-105 shadow-2xl transition-none",
        isDragging && isNearExtract && "ring-2 ring-primary/50",
        isAuthor && "border-border/50"
      )}
      onClick={onBringToFront}
      style={{
        transform: `translate(calc(-50% + ${currentX + dragOffset.x}px), calc(-50% + ${currentY + dragOffset.y}px))`,
        transitionDelay: isClosing
          ? `${(totalCount - index - 1) * 30}ms`
          : `${delay}ms`,
        borderColor: authorColor ?? undefined,
        // z-index: focused card is on top, then dragging, then by index
        zIndex: isFocused ? 200 : isDragging ? 300 : totalCount - index,
      }}
    >
      {/** biome-ignore lint/a11y/noStaticElementInteractions: skip */}
      {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip */}
      <div
        className={cn(
          "flex items-center gap-2 border-border border-b px-2.5 py-1.5",
          totalCount > 1 && "cursor-grab active:cursor-grabbing"
        )}
        onMouseDown={totalCount > 1 ? handleDragStart : undefined}
        style={
          authorColor
            ? {
                background: `linear-gradient(to right, ${authorColor}15, transparent)`,
              }
            : undefined
        }
      >
        <Avatar
          className="h-5 w-5 border"
          style={authorColor ? { borderColor: authorColor } : undefined}
        >
          <AvatarImage src={authorImage ?? undefined} />
          <AvatarFallback
            className="text-[8px]"
            style={
              authorColor
                ? { backgroundColor: `${authorColor}20`, color: authorColor }
                : undefined
            }
          >
            {fallback}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate font-medium text-[11px]">
          {isAuthor ? "You" : authorName}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formatRelativeTime(comment.createdAt)}
        </span>
        {replyAuthors.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-full border border-border/50 bg-muted/50 px-1 py-0.5">
            <Reply className="h-2 w-2 text-muted-foreground" />
            <div className="flex -space-x-1">
              {replyAuthors.slice(0, 3).map((replyAuthor, i) => (
                <Avatar
                  className="h-3 w-3 border border-background ring-1 ring-border/10"
                  key={replyAuthor.id}
                  style={{ zIndex: 10 - i }}
                >
                  <AvatarImage src={replyAuthor.image ?? undefined} />
                  <AvatarFallback className="bg-background text-[4px] text-muted-foreground">
                    {replyAuthor.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {replyAuthors.length > 3 && (
                <div className="z-0 flex h-3 w-3 items-center justify-center rounded-full border border-background bg-background font-bold text-[5px] text-muted-foreground ring-1 ring-border/10">
                  +{replyAuthors.length - 3}
                </div>
              )}
            </div>
          </div>
        )}

        {/* biome-ignore lint/a11y/noStaticElementInteractions: prevents drag when clicking buttons */}
        {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip */}
        <div
          className="flex items-center gap-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {!isEditing && replies.length === 0 && (
            <button
              className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setShowReplyInput(!showReplyInput);
              }}
              title="Reply"
              type="button"
            >
              <Reply size={8} />
            </button>
          )}

          {isAuthor && (
            <button
              className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-destructive/20 hover:text-destructive"
              onClick={() => removeComment(comment.id)}
              type="button"
            >
              <DeleteIcon size={8} />
            </button>
          )}

          {onClose && (
            <button
              className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              type="button"
            >
              <XIcon size={8} />
            </button>
          )}
        </div>
      </div>

      <div className="p-2.5">
        {isEditing ? (
          <div className="relative">
            <Textarea
              className="min-h-14 resize-none border-border/30 bg-muted/80 pb-7 text-xs shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]"
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a comment..."
              ref={textareaRef}
              value={content}
            />
            <button
              className={cn(
                "absolute right-1.5 bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full transition-all",
                !content.trim() &&
                  "cursor-not-allowed bg-muted text-muted-foreground/40",
                content.trim() &&
                  "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              disabled={!content.trim()}
              onClick={handleSave}
              style={
                content.trim() && authorColor
                  ? { backgroundColor: authorColor, color: "white" }
                  : undefined
              }
              type="button"
            >
              <Send className="h-2.5 w-2.5" />
            </button>
          </div>
        ) : isAuthor ? (
          <button
            className={cn(
              "w-full whitespace-pre-wrap text-left text-xs",
              "-m-1 cursor-pointer rounded p-1 transition-colors hover:bg-accent/30"
            )}
            onClick={() => setIsEditing(true)}
            type="button"
          >
            {comment.content}
          </button>
        ) : (
          <div className="whitespace-pre-wrap text-xs">{comment.content}</div>
        )}
      </div>

      {replies.length > 0 && !isRepliesExpanded && (
        <button
          className="flex w-full items-center justify-between border-border/50 border-t bg-muted/10 px-2.5 py-1.5 transition-colors hover:bg-muted/20"
          onClick={() => setIsRepliesExpanded(true)}
          type="button"
        >
          <div className="flex items-center gap-1.5">
            <Reply className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="font-medium text-[9px] text-muted-foreground">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex -space-x-1">
              {replyAuthors.slice(0, 3).map((replyAuthor, i) => (
                <Avatar
                  className="h-3 w-3 border border-background ring-1 ring-border/10"
                  key={replyAuthor.id}
                  style={{ zIndex: 10 - i }}
                >
                  <AvatarImage src={replyAuthor.image ?? undefined} />
                  <AvatarFallback className="bg-background text-[4px] text-muted-foreground">
                    {replyAuthor.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/50" />
          </div>
        </button>
      )}

      {replies.length > 0 && isRepliesExpanded && (
        <div className="border-border/50 border-t">
          <button
            className="flex w-full items-center gap-1.5 bg-muted/10 px-2.5 py-1 transition-colors hover:bg-muted/20"
            onClick={() => setIsRepliesExpanded(false)}
            type="button"
          >
            <ChevronUp className="h-2.5 w-2.5 text-muted-foreground/50" />
            <span className="font-medium text-[8px] text-muted-foreground">
              Hide replies
            </span>
          </button>
          <div className="max-h-32 space-y-2 overflow-y-auto bg-muted/20 p-2">
            {replies.map((reply) => {
              const isReplyAuthor = localUser?.id === reply.authorId;
              const replyOnlineAuthor = isReplyAuthor
                ? localUser
                : collaborators.find((c) => c.id === reply.authorId);

              // Use online author info if available, otherwise fall back to stored info on the reply
              const replyAuthorName =
                replyOnlineAuthor?.name ?? reply.authorName ?? "Unknown";
              const replyAuthorImage =
                replyOnlineAuthor?.image ?? reply.authorImage;
              const replyAuthorColor = isReplyAuthor
                ? undefined
                : (replyOnlineAuthor?.color ?? "#6e6e6e");

              return (
                <div
                  className={cn(
                    "flex gap-2",
                    isReplyAuthor && "flex-row-reverse"
                  )}
                  key={reply.id}
                >
                  <Avatar
                    className="h-4 w-4 shrink-0 border"
                    style={
                      replyAuthorColor
                        ? { borderColor: replyAuthorColor }
                        : undefined
                    }
                  >
                    <AvatarImage src={replyAuthorImage ?? undefined} />
                    <AvatarFallback
                      className="text-[6px]"
                      style={
                        replyAuthorColor
                          ? {
                              backgroundColor: `${replyAuthorColor}20`,
                              color: replyAuthorColor,
                            }
                          : undefined
                      }
                    >
                      {replyAuthorName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "flex max-w-[80%] flex-col gap-0.5",
                      isReplyAuthor ? "items-end" : "items-start"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span
                        className={cn(
                          "font-medium text-[9px]",
                          isReplyAuthor
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      >
                        {isReplyAuthor ? "You" : replyAuthorName}
                      </span>
                      <span className="text-[8px] text-muted-foreground/50">
                        {formatRelativeTime(reply.createdAt)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "wrap-break-word rounded-lg px-2 py-1 text-[10px]",
                        isReplyAuthor
                          ? "rounded-br-sm bg-primary/10 text-foreground"
                          : "rounded-bl-sm bg-muted text-foreground/80"
                      )}
                      style={
                        !isReplyAuthor && replyAuthorColor
                          ? {
                              background: `linear-gradient(135deg, ${replyAuthorColor}10, ${replyAuthorColor}05)`,
                              borderLeft: `2px solid ${replyAuthorColor}30`,
                            }
                          : undefined
                      }
                    >
                      {reply.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-muted/20 px-1.5 py-1">
            <div className="flex items-center gap-1">
              <Textarea
                className="max-h-12 min-h-5 flex-1 resize-none rounded border-border/30 bg-background/50 px-1.5 py-1 text-[8px]! leading-tight shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),inset_0_-1px_1px_rgba(255,255,255,0.05)] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/30 dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),inset_0_-1px_1px_rgba(255,255,255,0.03)]"
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={handleReplyKeyDown}
                placeholder="Reply..."
                ref={replyInputRef}
                rows={1}
                value={replyContent}
              />
              <button
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded transition-all",
                  "shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]",
                  replyContent.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted/50 text-muted-foreground/30"
                )}
                disabled={!replyContent.trim()}
                onClick={handleSendReply}
                type="button"
              >
                <Send className="h-2 w-2" />
              </button>
            </div>
          </div>
        </div>
      )}

      {replies.length === 0 && showReplyInput && (
        <div className="border-border/50 border-t bg-muted/20 px-1.5 py-1">
          <div className="flex items-center gap-1">
            <Textarea
              className="max-h-12 min-h-5 flex-1 resize-none rounded border-border/30 bg-background/50 px-1.5 py-1 text-[8px]! leading-tight shadow-[inset_0_1px_3px_rgba(0,0,0,0.1),inset_0_-1px_1px_rgba(255,255,255,0.05)] placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/30 dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),inset_0_-1px_1px_rgba(255,255,255,0.03)]"
              onChange={(e) => setReplyContent(e.target.value)}
              onKeyDown={handleReplyKeyDown}
              placeholder="Reply..."
              ref={replyInputRef}
              rows={1}
              value={replyContent}
            />
            <button
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded transition-all",
                "shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]",
                replyContent.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted/50 text-muted-foreground/30"
              )}
              disabled={!replyContent.trim()}
              onClick={handleSendReply}
              type="button"
            >
              <Send className="h-2 w-2" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CommentClusterDialog({
  comments,
  onClose,
  screenPosition,
  zoom,
}: CommentClusterDialogProps) {
  const clusterId = getStableClusterId(comments);
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    getClusterViewMode(clusterId)
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const updateComment = useKanbanStore((state) => state.updateComment);
  const { screenToFlowPosition } = useReactFlow();

  // Sort comments by creation time for stacked view
  const sortedComments = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Split into left and right columns for stacked view
  const leftColumnComments = sortedComments.filter((_, i) => i % 2 === 0);
  const rightColumnComments = sortedComments.filter((_, i) => i % 2 === 1);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setClusterViewMode(clusterId, mode);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: The callback only needs clusterId which is stable
  const handleViewToggle = useCallback(() => {
    const nextMode = viewMode === "sprawled" ? "stacked" : "sprawled";
    handleViewModeChange(nextMode);
  }, [viewMode, clusterId]);

  useEffect(() => {
    setMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The effect only needs to run once on mount
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(
      () => {
        onClose();
      },
      comments.length * 50 + 300
    );
  };

  const handleDragOut = useCallback(
    (commentId: string, dropPosition: { x: number; y: number }) => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) {
        return;
      }

      // Convert the screen drop position directly to flow coordinates
      // This places the comment exactly where the user released the mouse
      const flowDropPos = screenToFlowPosition(dropPosition);

      // Get the cluster centroid in flow coordinates to check distance
      const clusterFlowPos = screenToFlowPosition(screenPosition);

      // Calculate if the drop position is far enough from the cluster
      // CLUSTER_RADIUS is 80px in the clustering algorithm
      const dx = flowDropPos.x - clusterFlowPos.x;
      const dy = flowDropPos.y - clusterFlowPos.y;
      const distanceFromCluster = Math.sqrt(dx * dx + dy * dy);

      // If too close to cluster, push it out in the same direction
      const minDistance = 100;
      let finalX = flowDropPos.x;
      let finalY = flowDropPos.y;

      if (distanceFromCluster < minDistance && distanceFromCluster > 0) {
        // Normalize direction and push out to minimum distance
        const scale = minDistance / distanceFromCluster;
        finalX = clusterFlowPos.x + dx * scale;
        finalY = clusterFlowPos.y + dy * scale;
      } else if (distanceFromCluster === 0) {
        // Edge case: dropped exactly on center, push in a default direction
        finalX = clusterFlowPos.x + minDistance;
      }

      updateComment(commentId, {
        x: finalX,
        y: finalY,
      });

      onClose();
    },
    [comments, updateComment, onClose, screenPosition, screenToFlowPosition]
  );

  if (!mounted) {
    return null;
  }

  // screenPosition is already in screen coordinates from flowToScreenPosition
  const centerX = screenPosition.x;
  const centerY = screenPosition.y;
  const containerSize = 800;
  const isSingle = comments.length === 1;

  const dialogContent = (
    <div
      className="pointer-events-none fixed"
      ref={dialogRef}
      style={{
        top: centerY,
        left: centerX,
        width: containerSize,
        height: containerSize,
        zIndex: 9999,
        pointerEvents: "none",
        // Translate to center, then scale - order matters!
        transform: `translate(-50%, -50%) scale(${zoom})`,
        transformOrigin: "center center",
      }}
    >
      {!isSingle && (
        <SplitButton
          isClosing={isClosing}
          isVisible={isVisible}
          onClose={handleClose}
          onViewToggle={handleViewToggle}
          transitionDelay={
            isClosing ? "0ms" : `${comments.length * 50 + 100}ms`
          }
          viewMode={viewMode}
        />
      )}

      <div className="relative h-full w-full">
        {viewMode === "sprawled" ? (
          <div className="absolute top-1/2 left-1/2">
            {comments.map((comment, index) => (
              <div className="pointer-events-auto" key={comment.id}>
                <CommentCard
                  comment={comment}
                  index={index}
                  isClosing={isClosing}
                  isFocused={focusedIndex === index}
                  isVisible={isVisible}
                  onBringToFront={() => setFocusedIndex(index)}
                  onClose={isSingle ? handleClose : undefined}
                  onDragOut={handleDragOut}
                  totalCount={comments.length}
                  viewMode={viewMode}
                />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="absolute top-1/2 left-1/2">
              {leftColumnComments.map((comment, index) => {
                const originalIndex = sortedComments.indexOf(comment);
                return (
                  <div className="pointer-events-auto" key={comment.id}>
                    <CommentCard
                      comment={comment}
                      index={index}
                      isClosing={isClosing}
                      isFocused={focusedIndex === originalIndex}
                      isVisible={isVisible}
                      onBringToFront={() => setFocusedIndex(originalIndex)}
                      onClose={isSingle ? handleClose : undefined}
                      onDragOut={handleDragOut}
                      stackColumn="left"
                      totalCount={leftColumnComments.length}
                      viewMode={viewMode}
                    />
                  </div>
                );
              })}
            </div>
            <div className="absolute top-1/2 left-1/2">
              {rightColumnComments.map((comment, index) => {
                const originalIndex = sortedComments.indexOf(comment);
                return (
                  <div className="pointer-events-auto" key={comment.id}>
                    <CommentCard
                      comment={comment}
                      index={index}
                      isClosing={isClosing}
                      isFocused={focusedIndex === originalIndex}
                      isVisible={isVisible}
                      onBringToFront={() => setFocusedIndex(originalIndex)}
                      onClose={isSingle ? handleClose : undefined}
                      onDragOut={handleDragOut}
                      stackColumn="right"
                      totalCount={rightColumnComments.length}
                      viewMode={viewMode}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}
