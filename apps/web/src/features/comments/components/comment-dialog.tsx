import { MessageCircle, Reply, Send, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { formatRelativeTime } from "@/src/lib/date";
import { cn } from "@/src/lib/utils";

interface CommentDialogProps {
  comment: Comment;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

export function CommentDialog({
  comment,
  onClose,
  anchorRect,
}: CommentDialogProps) {
  const [content, setContent] = useState(comment.content);
  const [isEditing, setIsEditing] = useState(comment.content === "");
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState("");

  const updateComment = useKanbanStore((state) => state.updateComment);
  const removeComment = useKanbanStore((state) => state.removeComment);
  const addReply = useKanbanStore((state) => state.addReply);
  const getRepliesForComment = useKanbanStore(
    (state) => state.getRepliesForComment
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const [mounted, setMounted] = useState(false);
  const { localUser, collaborators } = useCollaboration();
  const isAuthor = localUser?.id === comment.authorId;

  const allReplies = useMemo(
    () => getRepliesForComment(comment.id),
    [getRepliesForComment, comment.id]
  );

  const hasReplies = allReplies.length > 0;

  const replyAuthors = useMemo(() => {
    const uniqueAuthors = new Map();
    for (const r of allReplies) {
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
  }, [allReplies, collaborators, localUser]);

  const onlineAuthor = isAuthor
    ? localUser
    : collaborators.find((c) => c.id === comment.authorId);
  const authorColor = isAuthor ? undefined : (onlineAuthor?.color ?? "#6e6e6e");
  const authorName = onlineAuthor?.name ?? comment.authorName ?? "Unknown";
  const authorImage = onlineAuthor?.image ?? comment.authorImage;

  useEffect(() => {
    setMounted(true);
  }, []);

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
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      if (comment.content === "") {
        removeComment(comment.id);
      }
      onClose();
    }
  };

  const handleDelete = () => {
    removeComment(comment.id);
    onClose();
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

  const handleReplyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
    if (e.key === "Escape") {
      setShowReplyInput(false);
      setReplyContent("");
    }
  };

  if (!(mounted && anchorRect)) {
    return null;
  }

  const dialogLeft = anchorRect.left + anchorRect.width / 2;
  const dialogTop = anchorRect.bottom + 8;

  const dialogContent = (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip
    <div
      aria-modal="true"
      className={cn(
        "fade-in zoom-in-95 nodrag nopan nowheel fixed w-64 animate-in cursor-default rounded-lg bg-card duration-200",
        "shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)]",
        "dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
      )}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          if (comment.content === "") {
            removeComment(comment.id);
          }
          onClose();
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      style={{
        top: dialogTop,
        left: dialogLeft,
        transform: "translateX(-50%)",
        zIndex: 9999,
      }}
      tabIndex={-1}
    >
      <div
        className={cn(
          "overflow-hidden rounded-lg border-2",
          isAuthor && "border-border/50"
        )}
        style={authorColor ? { borderColor: authorColor } : undefined}
      >
        {isEditing ? (
          <>
            <div className="flex items-center justify-between border-border border-b bg-muted/95 px-2.5 py-1.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-[11px] text-muted-foreground">
                  Comment
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
              </div>
              <div className="flex items-center gap-0.5">
                {isAuthor && comment.content && (
                  <button
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-card/80 text-destructive/70 shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDelete();
                    }}
                    type="button"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
                <button
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (comment.content === "") {
                      removeComment(comment.id);
                    }
                    onClose();
                  }}
                  type="button"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>

            <div className="p-2.5">
              <div className="relative">
                <Textarea
                  className="min-h-17.5 resize-none border-border/30 bg-muted/80 pb-8 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] dark:bg-secondary/80 dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.05)]"
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a comment..."
                  ref={textareaRef}
                  value={content}
                />
                <button
                  className={cn(
                    "absolute right-2 bottom-2 flex h-6 w-6 items-center justify-center rounded-full transition-all",
                    "shadow-[0_1px_3px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.15)]",
                    !content.trim() &&
                      "cursor-not-allowed bg-muted text-muted-foreground/40",
                    content.trim() &&
                      isAuthor &&
                      "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                  disabled={!content.trim()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleSave();
                  }}
                  style={
                    content.trim() && authorColor
                      ? { backgroundColor: authorColor, color: "white" }
                      : undefined
                  }
                  type="button"
                >
                  <Send className="h-3 w-3" />
                </button>
              </div>
            </div>
          </>
        ) : showReplyInput ? (
          <>
            <div className="flex items-center justify-between border-border border-b bg-muted/95 px-2.5 py-1.5">
              <span className="font-medium text-[11px] text-muted-foreground">
                Reply to {isAuthor ? "your comment" : authorName}
              </span>
              <button
                className="flex h-5 w-5 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-colors hover:bg-muted"
                onClick={() => {
                  setShowReplyInput(false);
                  setReplyContent("");
                }}
                type="button"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
            <div className="p-2.5">
              <div className="relative">
                <Textarea
                  className="min-h-14 resize-none border-border/30 bg-muted/80 pb-8 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]"
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyDown={handleReplyKeyDown}
                  placeholder="Write a reply..."
                  ref={replyInputRef}
                  value={replyContent}
                />
                <button
                  className={cn(
                    "absolute right-2 bottom-2 flex h-6 w-6 items-center justify-center rounded-full transition-all",
                    !replyContent.trim() &&
                      "cursor-not-allowed bg-muted text-muted-foreground/40",
                    replyContent.trim() &&
                      "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                  disabled={!replyContent.trim()}
                  onClick={handleSendReply}
                  type="button"
                >
                  <Send className="h-3 w-3" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="relative p-2.5 pr-8">
            <button
              className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClose();
              }}
              type="button"
            >
              <X className="h-2.5 w-2.5" />
            </button>

            {/** biome-ignore lint/a11y/noStaticElementInteractions: skip */}
            {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip */}
            <div
              className={cn(
                "whitespace-pre-wrap text-sm",
                isAuthor &&
                  "-m-1.5 cursor-pointer rounded p-1.5 transition-colors hover:bg-accent/30"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (isAuthor) {
                  setIsEditing(true);
                }
              }}
              onKeyDown={(e) => {
                if (isAuthor && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsEditing(true);
                }
              }}
              role={isAuthor ? "button" : undefined}
              tabIndex={isAuthor ? 0 : undefined}
            >
              {comment.content}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Avatar
                  className="h-4 w-4 border"
                  style={authorColor ? { borderColor: authorColor } : undefined}
                >
                  <AvatarImage src={authorImage ?? undefined} />
                  <AvatarFallback
                    className="text-[7px]"
                    style={
                      authorColor
                        ? {
                            backgroundColor: `${authorColor}20`,
                            color: authorColor,
                          }
                        : undefined
                    }
                  >
                    {authorName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground/60">
                  {isAuthor ? "you" : authorName}
                </span>
                <span className="text-[9px] text-muted-foreground/40">
                  {formatRelativeTime(comment.createdAt)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {hasReplies && (
                  <span
                    className={cn(
                      "flex items-center gap-0.5 rounded-full px-1.5 py-0.5",
                      "bg-primary/10 text-primary",
                      "font-semibold text-[9px]"
                    )}
                  >
                    <MessageCircle className="h-2 w-2" />
                    {allReplies.length}
                  </span>
                )}

                <button
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5",
                    "bg-muted/50 text-muted-foreground",
                    "font-medium text-[9px]",
                    "hover:bg-muted hover:text-foreground",
                    "transition-colors"
                  )}
                  onClick={() => setShowReplyInput(true)}
                  type="button"
                >
                  <Reply className="h-2.5 w-2.5" />
                  Reply
                </button>

                {isAuthor && (
                  <button
                    className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-destructive/20 hover:text-destructive"
                    onClick={handleDelete}
                    type="button"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}
