"use client";

import {
  ChevronLeft,
  LayoutGrid,
  MessageCircle,
  Send,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { SwitchButtons } from "@/src/components/ui/switch-buttons";
import LarityOrb from "@/src/features/ai/components/animations/larity-orb";
import { useCollaboration } from "@/src/features/collab";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { Comment } from "@/src/features/kanban/types";
import { formatRelativeTime } from "@/src/lib/date";
import { cn } from "@/src/lib/utils";
import { DiscussionTab } from "./discussion-tab";

const COMMENT_MENTION_SPLIT_REGEX = /(@[a-zA-Z0-9_]+)/g;
const COMMENT_MENTION_PART_REGEX = /^@[a-zA-Z0-9_]+$/;

function renderCommentContentWithMentions(content: string, keyPrefix: string) {
  const nodes: Array<string | ReactNode> = [];
  let lastEnd = 0;

  for (const match of content.matchAll(COMMENT_MENTION_SPLIT_REGEX)) {
    const mentionText = match[0];
    const mentionStart = match.index;

    if (mentionStart === undefined) {
      continue;
    }

    if (mentionStart > lastEnd) {
      nodes.push(content.slice(lastEnd, mentionStart));
    }

    if (COMMENT_MENTION_PART_REGEX.test(mentionText)) {
      nodes.push(
        <span
          className="font-medium text-primary"
          data-testid="comment-mention"
          key={`${keyPrefix}-mention-${mentionStart}-${mentionText}`}
        >
          {mentionText}
        </span>
      );
    } else {
      nodes.push(mentionText);
    }

    lastEnd = mentionStart + mentionText.length;
  }

  if (lastEnd < content.length) {
    nodes.push(content.slice(lastEnd));
  }

  return nodes;
}

interface CommentBubbleProps {
  authorColor?: string;
  authorImage?: string | null;
  authorName: string;
  comment: Comment;
  index: number;
  isOwn: boolean;
  isReply?: boolean;
  onClick?: () => void;
  replyCount?: number;
}

const CommentBubble = memo(
  ({
    comment,
    isOwn,
    authorColor,
    authorName,
    authorImage,
    index,
    replyCount = 0,
    isReply = false,
    onClick,
  }: CommentBubbleProps) => {
    const { localUser } = useCollaboration();
    const updateComment = useKanbanStore((state) => state.updateComment);
    const removeComment = useKanbanStore((state) => state.removeComment);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(comment.content);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const fallback = authorName.slice(0, 2).toUpperCase();
    const canManageComment = !isReply;

    useEffect(() => {
      if (!isEditing) {
        setEditValue(comment.content);
      }
    }, [comment.content, isEditing]);

    const handleSaveEdit = useCallback(() => {
      const nextContent = editValue.trim();
      if (nextContent.length === 0) {
        return;
      }

      updateComment(comment.id, {
        content: nextContent,
        lastEditedById: localUser?.id,
        lastEditorName: localUser?.name,
        lastEditorImage: localUser?.image ?? undefined,
      });

      setIsEditing(false);
      setShowDeleteConfirm(false);
    }, [comment.id, editValue, localUser, updateComment]);

    const handleConfirmDelete = useCallback(() => {
      removeComment(comment.id);
      setShowDeleteConfirm(false);
    }, [comment.id, removeComment]);

    return (
      <motion.div
        animate={{ opacity: 1, x: 0, scale: 1 }}
        className={cn(
          "flex max-w-[85%] gap-2.5 text-left",
          isOwn ? "ml-auto flex-row-reverse" : "mr-auto",
          isReply && "ml-8 max-w-[75%]",
          onClick &&
            "cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
        )}
        data-testid="comment"
        exit={{ opacity: 0, x: isOwn ? 20 : -20, scale: 0.95 }}
        initial={{ opacity: 0, x: isOwn ? 20 : -20, scale: 0.95 }}
        onClick={onClick}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
          delay: index * 0.03,
        }}
      >
        <Avatar
          className={cn(
            "shrink-0 border-2 shadow-sm",
            isReply ? "h-5 w-5" : "h-7 w-7",
            isOwn ? "border-primary/30" : "border-border"
          )}
          style={
            !isOwn && authorColor ? { borderColor: authorColor } : undefined
          }
        >
          <AvatarImage src={authorImage ?? undefined} />
          <AvatarFallback
            className={cn(
              "font-medium",
              isReply ? "text-[8px]" : "text-[10px]"
            )}
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
                "font-medium",
                isReply ? "text-[9px]" : "text-[10px]",
                isOwn ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isOwn ? "You" : authorName}
            </span>
            <span
              className={cn(
                "text-muted-foreground/60",
                isReply ? "text-[8px]" : "text-[9px]"
              )}
            >
              {formatRelativeTime(comment.createdAt)}
            </span>
            {replyCount > 0 && (
              <span
                className={cn(
                  "flex items-center gap-0.5 rounded-full px-1.5 py-0.5",
                  "bg-primary/10 text-primary",
                  "font-semibold text-[8px]",
                  "shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
                )}
              >
                <MessageCircle className="h-2 w-2" />
                {replyCount}
              </span>
            )}
          </div>

          <div
            className={cn(
              "relative rounded-2xl leading-relaxed",
              isReply
                ? "px-2.5 py-1.5 text-[11px]"
                : "px-3.5 py-2.5 text-[13px]",
              "shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(255,255,255,0.1)]",
              "dark:shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_1px_2px_rgba(255,255,255,0.05)]",
              isOwn
                ? "rounded-br-md bg-primary text-primary-foreground"
                : "rounded-bl-md bg-muted/80 text-foreground",
              isOwn
                ? "shadow-[0_2px_8px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.15)]"
                : "",
              onClick &&
                "hover:shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.15)]"
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
              {renderCommentContentWithMentions(comment.content, comment.id)}
            </p>

            {canManageComment && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  className="rounded-md bg-muted/60 px-2 py-1 font-medium text-[10px] text-muted-foreground transition-colors hover:bg-muted"
                  data-testid="comment-edit-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowDeleteConfirm(false);
                    setIsEditing(true);
                  }}
                  type="button"
                >
                  Edit
                </button>
                <button
                  className="rounded-md bg-destructive/10 px-2 py-1 font-medium text-[10px] text-destructive transition-colors hover:bg-destructive/20"
                  data-testid="comment-delete-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsEditing(false);
                    setShowDeleteConfirm((prev) => !prev);
                  }}
                  type="button"
                >
                  Delete
                </button>
              </div>
            )}

            {canManageComment && isEditing && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-[12px]"
                  data-testid="comment-edit-input"
                  onChange={(event) => setEditValue(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      handleSaveEdit();
                    }
                  }}
                  value={editValue}
                />
                <button
                  className="rounded-md bg-primary px-2 py-1 font-medium text-[10px] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="comment-save-edit"
                  disabled={editValue.trim().length === 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSaveEdit();
                  }}
                  type="button"
                >
                  Save
                </button>
              </div>
            )}

            {canManageComment && showDeleteConfirm && (
              <div className="mt-2">
                <button
                  className="rounded-md bg-destructive px-2 py-1 font-medium text-[10px] text-destructive-foreground"
                  data-testid="comment-confirm-delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleConfirmDelete();
                  }}
                  type="button"
                >
                  Confirm Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

CommentBubble.displayName = "CommentBubble";

interface FloatingIndicatorProps {
  commentCount: number;
  icon: ReactNode;
  isOpen: boolean;
  label: string;
  onClick: () => void;
  testId: string;
  verticalOffset: number;
}

const FloatingIndicator = memo(
  ({
    onClick,
    commentCount,
    isOpen,
    icon,
    label,
    testId,
    verticalOffset,
  }: FloatingIndicatorProps) => (
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
        "shadow-[0_4px_20px_rgba(0,0,0,0.15),-4px_0_12px_rgba(0,0,0,0.08),inset_0_3px_10px_rgba(0,0,0,0.25),inset_0_-2px_6px_rgba(255,255,255,0.08),inset_1px_0_4px_rgba(0,0,0,0.15)]",
        "dark:shadow-[0_4px_20px_rgba(0,0,0,0.6),-4px_0_12px_rgba(0,0,0,0.3),inset_0_3px_12px_rgba(255,255,255,0.12),inset_0_-3px_10px_rgba(0,0,0,0.5),inset_1px_0_6px_rgba(0,0,0,0.3)]",
        "hover:bg-card hover:shadow-[0_4px_24px_rgba(0,0,0,0.2),-6px_0_16px_rgba(0,0,0,0.12),inset_0_3px_12px_rgba(0,0,0,0.3),inset_0_-2px_8px_rgba(255,255,255,0.1),inset_1px_0_5px_rgba(0,0,0,0.18)]",
        "dark:hover:shadow-[0_4px_24px_rgba(0,0,0,0.7),-6px_0_16px_rgba(0,0,0,0.35),inset_0_3px_14px_rgba(255,255,255,0.15),inset_0_-3px_12px_rgba(0,0,0,0.55),inset_1px_0_7px_rgba(0,0,0,0.35)]",
        "group cursor-pointer transition-shadow duration-300"
      )}
      data-testid={testId}
      initial={{ x: 100, opacity: 0 }}
      onClick={onClick}
      style={{ marginTop: `${verticalOffset}px` }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      type="button"
    >
      <div className="relative">
        <span className="text-muted-foreground transition-colors group-hover:text-primary">
          {icon}
        </span>
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
        {label}
      </span>
    </motion.button>
  )
);

type DrawerTab = "comments" | "discussion";

interface CommentsDrawerContentProps {
  boardCount?: number;
  commentInputValue: string;
  comments: Comment[];
  localUserId?: string;
  onAddComment: (content: string) => void;
  onClose: () => void;
  onCommentClick?: (comment: Comment) => void;
  onCommentInputChange: (value: string) => void;
  onSwitchToAi?: () => void;
  onSwitchToBoards?: () => void;
  workspaceId: string;
}

const CommentsDrawerContent = memo(
  ({
    comments,
    onClose,
    localUserId,
    commentInputValue,
    onCommentInputChange,
    onAddComment,
    workspaceId,
    onSwitchToBoards,
    onSwitchToAi,
    boardCount = 0,
    onCommentClick,
  }: CommentsDrawerContentProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const { collaborators, localUser } = useCollaboration();

    const lastActiveDrawerTab = useKanbanStore(
      (state) => state.lastActiveDrawerTab
    );
    const setLastActiveDrawerTab = useKanbanStore(
      (state) => state.setLastActiveDrawerTab
    );
    const [activeTab, setActiveTabState] = useState<DrawerTab>(
      lastActiveDrawerTab ?? "comments"
    );

    const setActiveTab = useCallback(
      (tab: DrawerTab) => {
        setActiveTabState(tab);
        setLastActiveDrawerTab(tab);
      },
      [setLastActiveDrawerTab]
    );

    const chatMessages = useKanbanStore((state) => state.chatMessages);
    const discussionCount = useMemo(
      () =>
        chatMessages.allIds.filter(
          (id) => chatMessages.byId[id]?.workspaceId === workspaceId
        ).length,
      [chatMessages, workspaceId]
    );

    const filteredCollaborators = useMemo(
      () => collaborators.filter((c) => c.id !== localUser?.id),
      [collaborators, localUser?.id]
    );

    const topLevelComments = useMemo(
      () =>
        [...comments]
          .filter((c) => !c.parentId)
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
      [comments]
    );

    const getReplies = useCallback(
      (parentId: string) =>
        comments
          .filter((c) => c.parentId === parentId)
          .sort(
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
    }, [topLevelComments.length]);

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
              "flex flex-col",
              "border-border/50 border-b",
              "bg-linear-to-b from-muted/50 to-transparent"
            )}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h3 className="font-semibold text-foreground text-sm">
                Workspace Chat
              </h3>

              <div className="flex items-center gap-3">
                <div className="flex items-center -space-x-1.5 transition-all duration-300 hover:space-x-0.5">
                  {filteredCollaborators.slice(0, 5).map((user) => (
                    <div
                      className="group relative transition-all duration-300 hover:z-10 hover:scale-110"
                      key={user.id}
                      title={`${user.name} (Online)`}
                    >
                      <Avatar className="h-5 w-5 border border-background shadow-sm ring-1 ring-background/50">
                        <AvatarImage src={user.image ?? undefined} />
                        <AvatarFallback className="bg-primary/10 font-medium text-[6px] text-primary">
                          {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute right-0 bottom-0 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-background" />
                    </div>
                  ))}
                  {filteredCollaborators.length > 5 && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-background bg-muted font-medium text-[8px] text-muted-foreground ring-1 ring-background/50">
                      +{filteredCollaborators.length - 5}
                    </div>
                  )}
                </div>

                <button
                  aria-label="Close"
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
            </div>

            <div className="flex gap-1 px-3 pb-0">
              <button
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-2 rounded-t-lg px-3 py-2",
                  "font-medium text-sm transition-colors",
                  activeTab === "comments"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveTab("comments")}
                type="button"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Comments</span>
                {comments.length > 0 && (
                  <span
                    className={cn(
                      "ml-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1",
                      "font-bold text-[10px]",
                      activeTab === "comments"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {comments.length > 99 ? "99+" : comments.length}
                  </span>
                )}
                {activeTab === "comments" && (
                  <motion.div
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
                    layoutId="drawer-tab-indicator"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </button>

              <button
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-2 rounded-t-lg px-3 py-2",
                  "font-medium text-sm transition-colors",
                  activeTab === "discussion"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setActiveTab("discussion")}
                type="button"
              >
                <Users className="h-4 w-4" />
                <span>Discussion</span>
                {discussionCount > 0 && (
                  <span
                    className={cn(
                      "ml-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1",
                      "font-bold text-[10px]",
                      activeTab === "discussion"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {discussionCount > 99 ? "99+" : discussionCount}
                  </span>
                )}
                {activeTab === "discussion" && (
                  <motion.div
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
                    layoutId="drawer-tab-indicator"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            </div>
          </div>

          {activeTab === "comments" ? (
            <>
              <div className="border-border/50 border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    className="h-10 flex-1 rounded-xl border border-border/40 bg-background/90 px-3 text-foreground text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40"
                    data-testid="new-comment-input"
                    onChange={(event) =>
                      onCommentInputChange(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        onAddComment(commentInputValue);
                      }
                    }}
                    placeholder="Write a workspace comment..."
                    value={commentInputValue}
                  />
                  <button
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                    data-testid="submit-comment"
                    disabled={commentInputValue.trim().length === 0}
                    onClick={() => onAddComment(commentInputValue)}
                    type="button"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                className={cn(
                  "flex-1 overflow-y-auto overflow-x-hidden",
                  "space-y-4 px-4 py-4",
                  "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                )}
                ref={scrollRef}
              >
                {topLevelComments.length === 0 ? (
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
                    {topLevelComments.map((comment, index) => {
                      const { isOwn, authorColor, authorName, authorImage } =
                        getAuthorInfo(comment);
                      const replies = getReplies(comment.id);
                      const replyCount = comment.replyCount ?? replies.length;
                      const visibleReplies = replies.slice(-2);
                      const hiddenReplyCount =
                        replies.length - visibleReplies.length;

                      return (
                        <div className="space-y-2" key={comment.id}>
                          <CommentBubble
                            authorColor={authorColor}
                            authorImage={authorImage}
                            authorName={authorName}
                            comment={comment}
                            index={index}
                            isOwn={isOwn}
                            onClick={
                              onCommentClick
                                ? () => onCommentClick(comment)
                                : undefined
                            }
                            replyCount={replyCount}
                          />
                          {hiddenReplyCount > 0 && (
                            <button
                              className={cn(
                                "ml-10 flex items-center gap-1.5 rounded-full px-2.5 py-1",
                                "bg-muted/50 text-muted-foreground/70",
                                "font-medium text-[10px]",
                                "shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]",
                                "transition-colors hover:bg-muted hover:text-muted-foreground"
                              )}
                              onClick={() => onCommentClick?.(comment)}
                              type="button"
                            >
                              <MessageCircle className="h-2.5 w-2.5" />+
                              {hiddenReplyCount} more{" "}
                              {hiddenReplyCount === 1 ? "reply" : "replies"}
                            </button>
                          )}
                          {visibleReplies.map((reply, replyIndex) => {
                            const replyAuthorInfo = getAuthorInfo(reply);
                            return (
                              <CommentBubble
                                authorColor={replyAuthorInfo.authorColor}
                                authorImage={replyAuthorInfo.authorImage}
                                authorName={replyAuthorInfo.authorName}
                                comment={reply}
                                index={replyIndex}
                                isOwn={replyAuthorInfo.isOwn}
                                isReply
                                key={reply.id}
                                onClick={
                                  onCommentClick
                                    ? () => onCommentClick(comment)
                                    : undefined
                                }
                              />
                            );
                          })}
                        </div>
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
            </>
          ) : (
            <DiscussionTab workspaceId={workspaceId} />
          )}
        </div>

        <SwitchButtons
          buttons={[
            ...(onSwitchToBoards
              ? [
                  {
                    id: "boards",
                    icon: (
                      <LayoutGrid className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    ),
                    label: "Boards",
                    onClick: onSwitchToBoards,
                    count: boardCount,
                  },
                ]
              : []),
            ...(onSwitchToAi
              ? [
                  {
                    id: "ai",
                    icon: <LarityOrb size="xs" speed={0.3} />,
                    label: "Larity",
                    onClick: onSwitchToAi,
                  },
                ]
              : []),
          ]}
        />
      </motion.div>
    );
  }
);

export interface CommentsDrawerProps {
  boardCount?: number;
  isOpen: boolean;
  onCommentClick?: (comment: Comment) => void;
  onOpenChange: (open: boolean) => void;
  onSwitchToAi?: () => void;
  onSwitchToBoards?: () => void;
}

export const CommentsDrawer = memo(
  ({
    isOpen,
    onOpenChange,
    onSwitchToBoards,
    onSwitchToAi,
    boardCount = 0,
    onCommentClick,
  }: CommentsDrawerProps) => {
    const [mounted, setMounted] = useState(false);
    const [commentInputValue, setCommentInputValue] = useState("");
    const { localUser } = useCollaboration();
    const addComment = useKanbanStore((state) => state.addComment);
    const boardPositions = useKanbanStore((state) => state.boardPositions);
    const setLastActiveDrawerTab = useKanbanStore(
      (state) => state.setLastActiveDrawerTab
    );

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

    const handleOpen = useCallback(() => onOpenChange(true), [onOpenChange]);
    const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isOpen) {
          onOpenChange(false);
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onOpenChange]);

    useEffect(() => {
      if (!isOpen) {
        setCommentInputValue("");
      }
    }, [isOpen]);

    const handleCommentInputChange = useCallback((value: string) => {
      setCommentInputValue(value);
    }, []);

    const handleAddComment = useCallback(
      (value: string) => {
        const nextContent = value.trim();
        if (nextContent.length === 0 || !localUser) {
          return;
        }

        const firstBoardId = boardPositions.allIds[0];
        const firstBoardPosition = firstBoardId
          ? boardPositions.byId[firstBoardId]
          : null;

        const fallbackPosition =
          firstBoardPosition &&
          typeof firstBoardPosition.x === "number" &&
          typeof firstBoardPosition.y === "number"
            ? {
                x: firstBoardPosition.x + 60,
                y: firstBoardPosition.y + 80,
              }
            : { x: 120, y: 120 };

        addComment(fallbackPosition, nextContent, {
          id: localUser.id,
          name: localUser.name,
          image: localUser.image ?? undefined,
        });

        setCommentInputValue("");
      },
      [addComment, boardPositions, localUser]
    );

    if (!mounted || typeof document === "undefined") {
      return null;
    }

    return createPortal(
      <>
        <FloatingIndicator
          commentCount={workspaceComments.filter((c) => !c.parentId).length}
          icon={<MessageCircle className="h-5 w-5" />}
          isOpen={isOpen}
          label="Comments"
          onClick={handleOpen}
          testId="comments-drawer-trigger"
          verticalOffset={-100}
        />

        <FloatingIndicator
          commentCount={0}
          icon={<Users className="h-5 w-5" />}
          isOpen={isOpen}
          label="Chat"
          onClick={() => {
            onOpenChange(true);
            setLastActiveDrawerTab("discussion");
          }}
          testId="chat-drawer-trigger"
          verticalOffset={-16}
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
                commentInputValue={commentInputValue}
                comments={workspaceComments}
                localUserId={localUser?.id}
                onAddComment={handleAddComment}
                onClose={handleClose}
                onCommentClick={onCommentClick}
                onCommentInputChange={handleCommentInputChange}
                onSwitchToAi={onSwitchToAi}
                onSwitchToBoards={onSwitchToBoards}
                workspaceId={currentWorkspaceId ?? ""}
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
