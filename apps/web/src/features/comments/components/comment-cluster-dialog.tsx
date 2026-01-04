"use client";

import { useReactFlow } from "@xyflow/react";
import { Layers, MessageCircle, Reply, Send, Shell } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DeleteIcon } from "@/src/components/animated/icons/delete";
import { GripVerticalIcon } from "@/src/components/animated/icons/grip-vertical";
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

type CommentCardProps = {
  comment: Comment;
  index: number;
  totalCount: number;
  isClosing: boolean;
  isVisible: boolean;
  onDragOut: (commentId: string) => void;
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
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState("");

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

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    onDragOut(comment.id);
  }, [comment.id, onDragOut]);

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
        radius = 160;
        angleStep = (2 * Math.PI) / RING_THRESHOLD;
        angle = index * angleStep - Math.PI / 2;
      } else {
        // Outer ring
        radius = 260; // Larger radius for second ring
        const outerCount = totalCount - RING_THRESHOLD;
        angleStep = (2 * Math.PI) / outerCount;
        angle = (index - RING_THRESHOLD) * angleStep - Math.PI / 2;
      }
    } else {
      // Single ring for fewer comments
      radius = Math.max(140, totalCount * 15);
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
        isDragging && "scale-105 shadow-2xl",
        isAuthor && "border-border/50"
      )}
      onClick={onBringToFront}
      style={{
        transform: `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`,
        transitionDelay: isClosing
          ? `${(totalCount - index - 1) * 30}ms`
          : `${delay}ms`,
        borderColor: authorColor ?? undefined,
        // z-index: focused card is on top, then dragging, then by index
        zIndex: isFocused ? 200 : isDragging ? 100 : totalCount - index,
      }}
    >
      <div
        className="flex items-center gap-2 border-border border-b px-2.5 py-1.5"
        style={
          authorColor
            ? {
                background: `linear-gradient(to right, ${authorColor}15, transparent)`,
              }
            : undefined
        }
      >
        {totalCount > 1 && (
          <button
            className="flex h-4 w-4 cursor-grab items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-accent hover:text-muted-foreground active:cursor-grabbing"
            onMouseDown={handleDragStart}
            onMouseUp={handleDragEnd}
            title="Drag to separate from group"
            type="button"
          >
            <GripVerticalIcon size={12} />
          </button>
        )}

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
        {replies.length > 0 && (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-1.5 py-0.5",
              "bg-primary/10 text-primary",
              "font-semibold text-[9px]"
            )}
          >
            <MessageCircle className="h-2 w-2" />
            {replies.length}
          </span>
        )}

        <div className="flex items-center gap-1">
          {!isEditing && (
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

      {replies.length > 0 && (
        <div className="max-h-40 space-y-2 overflow-y-auto border-border/50 border-t bg-muted/20 p-2.5">
          {replies.map((reply) => {
            const isReplyAuthor = localUser?.id === reply.authorId;
            const replyAuthorInfo = isReplyAuthor
              ? localUser
              : collaborators.find((c) => c.id === reply.authorId);

            return (
              <div className="flex gap-2" key={reply.id}>
                <div className="h-full pt-1">
                  <div className="mx-auto h-full w-px bg-border/50" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-3 w-3">
                      <AvatarImage src={replyAuthorInfo?.image ?? undefined} />
                      <AvatarFallback className="text-[6px]">
                        {(replyAuthorInfo?.name ?? "?").slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-[9px] text-muted-foreground">
                      {isReplyAuthor ? "You" : replyAuthorInfo?.name}
                    </span>
                    <span className="text-[8px] text-muted-foreground/50">
                      {formatRelativeTime(reply.createdAt)}
                    </span>
                  </div>
                  <div className="wrap-break-word text-[10px] text-foreground/80">
                    {reply.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showReplyInput && (
        <div className="border-border/50 border-t bg-muted/30 p-2">
          <div className="relative">
            <Textarea
              className="min-h-8 resize-none py-1.5 pr-8 text-[10px]"
              onChange={(e) => setReplyContent(e.target.value)}
              onKeyDown={handleReplyKeyDown}
              placeholder="Reply..."
              ref={replyInputRef}
              value={replyContent}
            />
            <button
              className={cn(
                "absolute right-1 bottom-1 flex h-6 w-6 items-center justify-center rounded-md transition-all",
                replyContent.trim()
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground/40"
              )}
              disabled={!replyContent.trim()}
              onClick={handleSendReply}
              type="button"
            >
              <Send className="h-3 w-3" />
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
    (commentId: string) => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) {
        return;
      }

      // The dialog is positioned by screenPosition, which is derived from the centroid.
      // We convert it back to flow coordinates to ensure the comment lands where the dialog was.
      const flowPos = screenToFlowPosition(screenPosition);

      const angle = Math.random() * Math.PI * 2;
      const distance = 150 / zoom;
      updateComment(commentId, {
        x: flowPos.x + Math.cos(angle) * distance,
        y: flowPos.y + Math.sin(angle) * distance,
      });

      onClose();
    },
    [
      comments,
      updateComment,
      onClose,
      screenPosition,
      zoom,
      screenToFlowPosition,
    ]
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
