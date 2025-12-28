import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { memo, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { useCollaboration } from "@/src/features/collab";
import { cn } from "@/src/lib/utils";
import type { Comment } from "../kanban/types";
import { CommentDialog } from "./comment-dialog";

type CommentNodeData = {
  comment: Comment;
};

export const CommentNode = memo(
  ({ data, selected }: NodeProps<Node<CommentNodeData>>) => {
    const { comment } = data;
    const [isOpen, setIsOpen] = useState(false);
    const { collaborators, localUser } = useCollaboration();
    const isOwnComment = localUser?.id === comment.authorId;

    // Try to get author from online collaborators, fall back to stored comment data
    const onlineAuthor = isOwnComment
      ? localUser
      : collaborators.find((c) => c.id === comment.authorId);

    // Use stored author info as fallback
    const authorName = onlineAuthor?.name ?? comment.authorName ?? "Unknown";
    const authorImage = onlineAuthor?.image ?? comment.authorImage;
    const authorColor = isOwnComment
      ? undefined
      : (onlineAuthor?.color ?? "#6e6e6e");
    const fallback = authorName.slice(0, 2).toUpperCase();

    const handleToggle = () => {
      setIsOpen(!isOpen);
    };

    return (
      <div className="group relative">
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: skip */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: skip */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: skip */}
        <div
          className={cn(
            "cursor-grab rounded-full p-0.5 transition-all duration-200 hover:scale-110 active:cursor-grabbing",
            selected
              ? "shadow-[0_4px_12px_rgba(0,0,0,0.25),inset_0_2px_4px_rgba(0,0,0,0.15)] ring-2 ring-offset-2 ring-offset-background dark:shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.1)]"
              : "shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_2px_rgba(255,255,255,0.08)]",
            selected && isOwnComment && "ring-primary", // Use primary ring for own selected comments
            "hover:shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_3px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_3px_rgba(255,255,255,0.1)]"
          )}
          onClick={handleToggle}
          style={
            {
              "--tw-ring-color":
                selected && authorColor ? authorColor : undefined,
            } as React.CSSProperties
          }
        >
          <Avatar
            className={cn(
              "h-8 w-8 border-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]",
              isOwnComment && "border-border" // Neutral border for own comments
            )}
            style={authorColor ? { borderColor: authorColor } : undefined}
          >
            <AvatarImage src={authorImage ?? undefined} />
            <AvatarFallback
              className={cn(
                "font-bold text-xs",
                isOwnComment && "bg-primary/10 text-primary" // Default styling for own comments
              )}
              style={
                authorColor
                  ? {
                      backgroundColor: `${authorColor}20`,
                      color: authorColor,
                    }
                  : undefined
              }
            >
              {fallback}
            </AvatarFallback>
          </Avatar>

          <Handle
            className="h-0 w-0 opacity-0"
            position={Position.Top}
            type="target"
          />
          <Handle
            className="h-0 w-0 opacity-0"
            position={Position.Bottom}
            type="source"
          />
        </div>
        {(isOpen || comment.content === "") && (
          <CommentDialog comment={comment} onClose={() => setIsOpen(false)} />
        )}
      </div>
    );
  }
);

CommentNode.displayName = "CommentNode";
