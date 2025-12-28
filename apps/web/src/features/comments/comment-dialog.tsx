import { Send, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/src/components/ui/textarea";
import { useCollaboration } from "@/src/features/collab";
import { useKanbanStore } from "@/src/features/kanban/store/kanban-store";
import type { Comment } from "@/src/features/kanban/types";
import { cn } from "@/src/lib/utils";

type CommentDialogProps = {
  comment: Comment;
  onClose: () => void;
};

export function CommentDialog({ comment, onClose }: CommentDialogProps) {
  const [content, setContent] = useState(comment.content);
  const [isEditing, setIsEditing] = useState(comment.content === "");
  const updateComment = useKanbanStore((state) => state.updateComment);
  const removeComment = useKanbanStore((state) => state.removeComment);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { localUser, collaborators } = useCollaboration();
  const isAuthor = localUser?.id === comment.authorId;

  const author = isAuthor
    ? localUser
    : collaborators.find((c) => c.id === comment.authorId);
  const isOwnComment = isAuthor;
  const authorColor = isOwnComment ? undefined : (author?.color ?? "#6e6e6e");

  const lastEditor = comment.lastEditedById
    ? comment.lastEditedById === localUser?.id
      ? localUser
      : collaborators.find((c) => c.id === comment.lastEditedById)
    : null;
  const wasEditedBySomeoneElse =
    comment.lastEditedById && comment.lastEditedById !== comment.authorId;

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
      });
      setIsEditing(false);
    } else {
      removeComment(comment.id);
    }
    onClose();
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

  const getDisplayName = (
    userId: string | undefined | null,
    userData: typeof author
  ) => {
    if (!(userId && userData)) {
      return "Unknown";
    }
    if (userId === localUser?.id) {
      return "you";
    }
    return userData.name ?? "Unknown";
  };

  const authorDisplayName = getDisplayName(comment.authorId, author);
  const editorDisplayName = lastEditor
    ? getDisplayName(comment.lastEditedById, lastEditor)
    : null;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: skip
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip
    // biome-ignore lint/a11y/noStaticElementInteractions: skip
    <div
      className="fade-in zoom-in-95 nodrag nopan nowheel absolute z-50 w-64 animate-in cursor-default rounded-lg bg-card shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] duration-200 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      style={{
        top: "100%",
        left: "50%",
        transform: "translateX(-50%) translateY(8px)",
      }}
    >
      <div
        className={cn(
          "overflow-hidden rounded-lg border-2",
          isOwnComment && "border-border/50" // Neutral border for own comments
        )}
        style={authorColor ? { borderColor: authorColor } : undefined}
      >
        {isEditing ? (
          <>
            <div className="flex items-center justify-between border-border border-b bg-muted/95 px-2.5 py-1.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] dark:bg-secondary/95 dark:shadow-[inset_0_2px_6px_rgba(255,255,255,0.08),inset_0_-1px_3px_rgba(0,0,0,0.4)]">
              <span className="font-medium text-[11px] text-muted-foreground">
                Comment
              </span>
              <div className="flex items-center gap-0.5">
                {isAuthor && (
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
                      isOwnComment &&
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
        ) : (
          <div className="relative p-2.5 pr-8">
            {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: skip */}
            {/** biome-ignore lint/a11y/useKeyWithClickEvents: skip */}
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
            >
              {comment.content}
            </div>
            <div className="mt-1.5 text-[10px] text-muted-foreground/60">
              {wasEditedBySomeoneElse ? (
                <>
                  <span
                    className="inline-block max-w-20 truncate align-bottom"
                    title={author?.name}
                  >
                    {authorDisplayName}
                  </span>
                  {" · edited by "}
                  <span
                    className="inline-block max-w-20 truncate align-bottom"
                    title={lastEditor?.name}
                  >
                    {editorDisplayName}
                  </span>
                </>
              ) : (
                <span
                  className="inline-block max-w-30 truncate"
                  title={author?.name}
                >
                  {authorDisplayName}
                </span>
              )}
            </div>
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
          </div>
        )}
      </div>
    </div>
  );
}
