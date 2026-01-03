"use client";

import { GripVertical, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type CommentClusterDialogProps = {
  comments: Comment[];
  onClose: () => void;
  screenPosition: { x: number; y: number };
  zoom: number;
};

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
};

function CommentCard({
  comment,
  index,
  totalCount,
  isClosing,
  isVisible,
  onDragOut,
}: CommentCardProps) {
  const [content, setContent] = useState(comment.content);
  const [isEditing, setIsEditing] = useState(comment.content === "");
  const [isDragging, setIsDragging] = useState(false);
  const updateComment = useKanbanStore((state) => state.updateComment);
  const removeComment = useKanbanStore((state) => state.removeComment);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    onDragOut(comment.id);
  }, [comment.id, onDragOut]);

  // Dynamic radius based on comment count:
  // - 1-2 comments: closer (120px base)
  // - 6+ comments: farther apart (260px max)
  // Linear interpolation between these values
  const minRadius = 120;
  const maxRadius = 260;
  const minCount = 1;
  const maxCount = 6;
  const clampedCount = Math.min(Math.max(totalCount, minCount), maxCount);
  const t = (clampedCount - minCount) / (maxCount - minCount);
  const radius = minRadius + t * (maxRadius - minRadius);

  const angleStep = (Math.PI * 2) / totalCount;
  const angle = index * angleStep - Math.PI / 2;
  const offsetX = Math.cos(angle) * radius;
  const offsetY = Math.sin(angle) * radius;
  const delay = index * 50;
  const targetX = isClosing ? 0 : offsetX;
  const targetY = isClosing ? 0 : offsetY;
  const currentX = isVisible ? targetX : 0;
  const currentY = isVisible ? targetY : 0;

  return (
    <div
      className={cn(
        "cubic-bezier(0.34, 1.56, 0.64, 1) absolute w-64 rounded-lg border-2 bg-card transition-all duration-500",
        "text-card-foreground shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]",
        "dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]",
        !isVisible || isClosing ? "scale-0 opacity-0" : "scale-100 opacity-100",
        isDragging && "scale-105 shadow-2xl",
        isAuthor && "border-border/50"
      )}
      style={{
        transform: `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`,
        transitionDelay: isClosing
          ? `${(totalCount - index - 1) * 30}ms`
          : `${delay}ms`,
        borderColor: authorColor ?? undefined,
        zIndex: isDragging ? 100 : totalCount - index,
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
            <GripVertical className="h-3 w-3" />
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
        {isAuthor && (
          <button
            className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-destructive/20 hover:text-destructive"
            onClick={() => removeComment(comment.id)}
            type="button"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        )}
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
    </div>
  );
}

export function CommentClusterDialog({
  comments,
  onClose,
  screenPosition,
  zoom,
}: CommentClusterDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const updateComment = useKanbanStore((state) => state.updateComment);

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

      const angle = Math.random() * Math.PI * 2;
      const distance = 150;
      updateComment(commentId, {
        x: comment.x + Math.cos(angle) * distance,
        y: comment.y + Math.sin(angle) * distance,
      });

      onClose();
    },
    [comments, updateComment, onClose]
  );

  if (!mounted) {
    return null;
  }

  // screenPosition is already in screen coordinates from flowToScreenPosition
  const centerX = screenPosition.x;
  const centerY = screenPosition.y;
  const containerSize = 800;

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
      <button
        className={cn(
          "cubic-bezier(0.34, 1.56, 0.64, 1) pointer-events-auto absolute z-50 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-b from-muted to-muted/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(0,0,0,0.1),inset_0_-1px_1px_rgba(255,255,255,0.15)] transition-all duration-500",
          "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "hover:scale-105 hover:brightness-105 active:scale-95 active:brightness-95",
          (!isVisible || isClosing) && "rotate-90 scale-0 opacity-0"
        )}
        onClick={handleClose}
        style={{
          transitionDelay: isClosing
            ? "0ms"
            : `${comments.length * 50 + 100}ms`,
        }}
        type="button"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="relative h-full w-full">
        <div className="absolute top-1/2 left-1/2">
          {comments.map((comment, index) => (
            <div className="pointer-events-auto" key={comment.id}>
              <CommentCard
                comment={comment}
                index={index}
                isClosing={isClosing}
                isVisible={isVisible}
                key={comment.id}
                onDragOut={handleDragOut}
                totalCount={comments.length}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}
