"use client";

import { useReactFlow } from "@xyflow/react";
import { Layers, Send, Shell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

  if (viewMode === "stacked") {
    // Stacked layout: two columns, sorted by time
    const cardHeight = 100; // Approximate card height + gap
    const columnOffset = 150; // Distance from center for each column

    if (stackColumn === "left") {
      offsetX = -columnOffset;
      offsetY = index * cardHeight - ((totalCount - 1) * cardHeight) / 2;
    } else {
      offsetX = columnOffset;
      offsetY = index * cardHeight - ((totalCount - 1) * cardHeight) / 2;
    }
  } else if (usesTwoRings) {
    // Two-ring mode
    const innerRingCount = RING_THRESHOLD;
    const outerRingCount = totalCount - RING_THRESHOLD;
    const isInnerRing = index < innerRingCount;

    if (isInnerRing) {
      // Inner ring - closer to center
      radius = 180;
      angleStep = (Math.PI * 2) / innerRingCount;
      angle = index * angleStep - Math.PI / 2;
    } else {
      // Outer ring - farther from center
      radius = 320;
      const outerIndex = index - innerRingCount;
      angleStep = (Math.PI * 2) / outerRingCount;
      // Offset by half a step to stagger with inner ring
      angle = outerIndex * angleStep - Math.PI / 2 + angleStep / 2;
    }
    offsetX = Math.cos(angle) * radius;
    offsetY = Math.sin(angle) * radius;
  } else {
    // Single ring mode - dynamic radius based on count
    const minRadius = 120;
    const maxRadius = 220;
    const minCount = 1;
    const maxCount = 6;
    const clampedCount = Math.min(Math.max(totalCount, minCount), maxCount);
    const t = (clampedCount - minCount) / (maxCount - minCount);
    radius = minRadius + t * (maxRadius - minRadius);

    angleStep = (Math.PI * 2) / totalCount;
    angle = index * angleStep - Math.PI / 2;
    offsetX = Math.cos(angle) * radius;
    offsetY = Math.sin(angle) * radius;
  }

  const delay = index * 50;
  const targetX = isClosing ? 0 : offsetX;
  const targetY = isClosing ? 0 : offsetY;
  const currentX = isVisible ? targetX : 0;
  const currentY = isVisible ? targetY : 0;

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
        {isAuthor && (
          <button
            className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-destructive/20 hover:text-destructive"
            onClick={() => removeComment(comment.id)}
            type="button"
          >
            <DeleteIcon size={8} />
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
      <SplitButton
        isClosing={isClosing}
        isVisible={isVisible}
        onClose={handleClose}
        onViewToggle={handleViewToggle}
        transitionDelay={isClosing ? "0ms" : `${comments.length * 50 + 100}ms`}
        viewMode={viewMode}
      />

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
