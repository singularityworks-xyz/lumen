import {
  Handle,
  type Node,
  type NodeProps,
  Position,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { useCollaboration } from "@/src/features/collab";
import { cn } from "@/src/lib/utils";
import type { Comment } from "../../kanban/types";
import { CommentClusterDialog } from "./comment-cluster-dialog";

type CommentClusterNodeData = {
  comments: Comment[];
  centroid: { x: number; y: number };
  isSingle: boolean;
};

export const CommentClusterNode = memo(
  ({ data, selected }: NodeProps<Node<CommentClusterNodeData>>) => {
    const { comments, centroid, isSingle } = data;
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const { collaborators, localUser } = useCollaboration();
    const { zoom, x: vpX, y: vpY } = useViewport();
    const { flowToScreenPosition } = useReactFlow();
    const displayComments = comments.slice(0, 5);

    // Convert centroid flow position to screen position
    // This updates when viewport changes (pan/zoom), keeping dialog anchored to canvas
    // Center offset is no longer needed as we center the visuals on the node itself
    const screenPosition = useMemo(() => {
      // Using viewport values to trigger recalculation on pan/zoom
      const _viewport = { vpX, vpY, zoom };
      const pos = flowToScreenPosition({
        x: centroid.x,
        y: centroid.y,
      });
      return pos;
    }, [flowToScreenPosition, centroid.x, centroid.y, vpX, vpY, zoom]);

    // Only auto-open for empty comments created by the local user
    // This prevents the dialog opening when a collaborator creates a new comment
    const hasOwnEmptyComment = comments.some(
      (c) => c.content === "" && c.authorId === localUser?.id
    );

    useEffect(() => {
      if (hasOwnEmptyComment && !isOpen) {
        setIsOpen(true);
      }
    }, [hasOwnEmptyComment, isOpen]);

    const handleToggle = () => {
      setIsOpen(!isOpen);
    };

    const getAuthorInfo = (comment: Comment) => {
      const isOwnComment = localUser?.id === comment.authorId;
      const onlineAuthor = isOwnComment
        ? localUser
        : collaborators.find((c) => c.id === comment.authorId);
      return {
        name: onlineAuthor?.name ?? comment.authorName ?? "Unknown",
        image: onlineAuthor?.image ?? comment.authorImage,
        color: isOwnComment ? undefined : (onlineAuthor?.color ?? "#6e6e6e"),
        isOwn: isOwnComment,
      };
    };

    if (isSingle) {
      const comment = comments[0];
      if (!comment) {
        return null; // Should not happen if isSingle is true, but satisfies TS
      }
      const author = getAuthorInfo(comment);
      const fallback = author.name.slice(0, 2).toUpperCase();

      return (
        <div className="group relative">
          <button
            aria-expanded={isOpen}
            aria-label={`View comment by ${author.name}`}
            className={cn(
              "cursor-grab rounded-full p-0.5 transition-all duration-200 hover:scale-110 active:cursor-grabbing",
              selected
                ? "shadow-[0_4px_12px_rgba(0,0,0,0.25),inset_0_2px_4px_rgba(0,0,0,0.15)] ring-2 ring-offset-2 ring-offset-background dark:shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.1)]"
                : "shadow-[0_2px_8px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_2px_rgba(255,255,255,0.08)]",
              selected && author.isOwn && "ring-primary",
              "hover:shadow-[0_4px_12px_rgba(0,0,0,0.2),inset_0_1px_3px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.5),inset_0_1px_3px_rgba(255,255,255,0.1)]"
            )}
            onClick={handleToggle}
            ref={buttonRef}
            style={
              {
                "--tw-ring-color":
                  selected && author.color ? author.color : undefined,
              } as React.CSSProperties
            }
            type="button"
          >
            <Avatar
              className={cn(
                "h-8 w-8 border-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]",
                author.isOwn && "border-border"
              )}
              style={author.color ? { borderColor: author.color } : undefined}
            >
              <AvatarImage src={author.image ?? undefined} />
              <AvatarFallback
                className={cn(
                  "font-bold text-xs",
                  author.isOwn && "bg-primary/10 text-primary"
                )}
                style={
                  author.color
                    ? {
                        backgroundColor: `${author.color}20`,
                        color: author.color,
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
          </button>
          {isOpen && (
            <CommentClusterDialog
              comments={comments}
              onClose={() => setIsOpen(false)}
              screenPosition={screenPosition}
              zoom={zoom}
            />
          )}
        </div>
      );
    }

    const mainComment = displayComments[0];
    const secondaryComments = displayComments.slice(1, 5);

    const secondaryPositions = [
      { x: -14, y: 8, z: 4 }, // bottom-left
      { x: 12, y: 12, z: 3 }, // bottom-right
      { x: -6, y: 20, z: 2 }, // bottom-center
      { x: 18, y: 2, z: 1 }, // right side
    ];

    return (
      <div className="group relative">
        <div
          className="absolute rounded-full bg-primary/10 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] dark:bg-primary/15 dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)]"
          style={{
            width: 48 + Math.min(comments.length, 5) * 4,
            height: 48 + Math.min(comments.length, 5) * 4,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        <button
          aria-expanded={isOpen}
          aria-label={`View ${comments.length} comments`}
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab transition-all duration-200 hover:scale-105 active:cursor-grabbing",
            selected &&
              "ring-2 ring-primary ring-offset-2 ring-offset-background",
            isOpen && "pointer-events-none opacity-0"
          )}
          onClick={handleToggle}
          ref={buttonRef}
          type="button"
        >
          <div className="relative" style={{ width: 48, height: 48 }}>
            {mainComment &&
              (() => {
                const author = getAuthorInfo(mainComment);
                const fallback = author.name.slice(0, 2).toUpperCase();

                return (
                  <Avatar
                    className={cn(
                      "absolute h-7 w-7 border-2 shadow-[0_2px_6px_rgba(0,0,0,0.2)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.5)]",
                      author.isOwn ? "border-border" : "border-card"
                    )}
                    style={{
                      top: 6,
                      left: 10,
                      zIndex: 5,
                      borderColor: author.color ?? undefined,
                    }}
                  >
                    <AvatarImage src={author.image ?? undefined} />
                    <AvatarFallback
                      className={cn(
                        "font-bold text-[10px]",
                        author.isOwn && "bg-primary/10 text-primary"
                      )}
                      style={
                        author.color
                          ? {
                              backgroundColor: `${author.color}20`,
                              color: author.color,
                            }
                          : undefined
                      }
                    >
                      {fallback}
                    </AvatarFallback>
                  </Avatar>
                );
              })()}

            {secondaryComments.map((comment, index) => {
              const author = getAuthorInfo(comment);
              const fallback = author.name.slice(0, 2).toUpperCase();
              const pos = secondaryPositions[index];

              if (!pos) {
                return null;
              }

              return (
                <Avatar
                  className={cn(
                    "absolute h-5 w-5 border-2 shadow-[0_2px_4px_rgba(0,0,0,0.15)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.4)]",
                    author.isOwn ? "border-border" : "border-card"
                  )}
                  key={comment.id}
                  style={{
                    top: pos.y + 10,
                    left: pos.x + 14,
                    zIndex: pos.z,
                    borderColor: author.color ?? undefined,
                  }}
                >
                  <AvatarImage src={author.image ?? undefined} />
                  <AvatarFallback
                    className={cn(
                      "font-bold text-[8px]",
                      author.isOwn && "bg-primary/10 text-primary"
                    )}
                    style={
                      author.color
                        ? {
                            backgroundColor: `${author.color}20`,
                            color: author.color,
                          }
                        : undefined
                    }
                  >
                    {fallback}
                  </AvatarFallback>
                </Avatar>
              );
            })}
          </div>

          <div
            className="absolute flex h-5 min-w-5 items-center justify-center rounded-full bg-linear-to-b from-muted to-muted/80 px-1.5 font-bold text-[10px] text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(0,0,0,0.1),inset_0_-1px_1px_rgba(255,255,255,0.15)] dark:from-muted/90 dark:to-muted/70 dark:shadow-[0_1px_3px_rgba(0,0,0,0.4),inset_0_1px_3px_rgba(0,0,0,0.3),inset_0_-1px_1px_rgba(255,255,255,0.08)]"
            style={{
              top: -8,
              right: -10,
            }}
          >
            {comments.length}
          </div>

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
        </button>

        {isOpen && (
          <CommentClusterDialog
            comments={comments}
            onClose={() => setIsOpen(false)}
            screenPosition={screenPosition}
            zoom={zoom}
          />
        )}
      </div>
    );
  }
);

CommentClusterNode.displayName = "CommentClusterNode";
