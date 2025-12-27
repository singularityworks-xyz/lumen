"use client";

import { MousePointer2, User } from "lucide-react";
import Image from "next/image";
import { memo, useEffect, useState } from "react";
import type { Collaborator } from "@/src/features/collab";
import type { Task } from "@/src/features/kanban";
import { useCachedProfileImage } from "@/src/hooks/use-cached-profile-image";
import { cn } from "@/src/lib/utils";

type TaskDragOverlayProps = {
  task: Task;
  collaborator: Collaborator & {
    image?: string | null;
  };
  cursorX?: number;
  cursorY?: number;
};

export const TaskDragOverlay = memo<TaskDragOverlayProps>(
  ({ collaborator, cursorX = 0, cursorY = 0, task }) => {
    const { imageUrl, hasImage } = useCachedProfileImage(collaborator.image);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    }, []);

    const priorityColors = {
      low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      high: "bg-red-500/20 text-red-400 border-red-500/30",
    };

    return (
      <div
        className={cn(
          "pointer-events-none fixed z-9999 transition-all duration-75 ease-out",
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
        style={{
          left: cursorX,
          top: cursorY,
          transform: "translate(-2px, -2px)",
        }}
      >
        <div style={{ color: collaborator.color }}>
          <MousePointer2
            className="h-5 w-5 drop-shadow-md"
            fill="currentColor"
            strokeWidth={1.5}
          />
        </div>

        <div
          className="relative -mt-1 ml-3 w-56 overflow-visible rounded-lg border-2 bg-card/95 shadow-xl backdrop-blur-md"
          style={{
            borderColor: collaborator.color,
            boxShadow: `
              0 8px 32px -8px ${collaborator.color}40,
              0 16px 48px -16px rgba(0,0,0,0.4)
            `,
          }}
        >
          <div className="absolute -top-3 -right-2 z-10 flex items-center">
            <div
              className="-mr-3 max-w-28 truncate rounded-full py-0.5 pr-4 pl-2 font-medium text-[9px] text-white shadow"
              style={{
                backgroundColor: collaborator.color,
              }}
            >
              {collaborator.name}
            </div>
            <div
              className="relative z-10 overflow-hidden rounded-full border-2 shadow-lg"
              style={{
                borderColor: collaborator.color,
              }}
            >
              {hasImage && imageUrl ? (
                <Image
                  alt={collaborator.name}
                  className="object-cover"
                  height={24}
                  priority
                  src={imageUrl}
                  width={24}
                />
              ) : (
                <div
                  className="flex h-6 w-6 items-center justify-center text-white"
                  style={{ backgroundColor: collaborator.color }}
                >
                  <User className="h-3 w-3" />
                </div>
              )}
            </div>
          </div>

          <div className="p-2.5 pt-3">
            <h4
              className={cn(
                "line-clamp-2 font-medium text-card-foreground text-sm leading-snug",
                task.status === "done" && "line-through opacity-60"
              )}
            >
              {task.title}
            </h4>

            {task.description && (
              <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground leading-tight">
                {task.description}
              </p>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-medium text-[9px]",
                  priorityColors[task.priority]
                )}
              >
                {task.priority}
              </span>

              {task.progress > 0 && (
                <div className="flex items-center gap-1">
                  <div className="h-1 w-8 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full"
                      style={{
                        width: `${task.progress}%`,
                        backgroundColor: collaborator.color,
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {task.progress}%
                  </span>
                </div>
              )}
            </div>

            {task.tags && task.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {task.tags.slice(0, 3).map((tag) => (
                  <span
                    className="rounded bg-secondary/80 px-1.5 py-0.5 text-[8px] text-secondary-foreground"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
                {task.tags.length > 3 && (
                  <span className="text-[8px] text-muted-foreground">
                    +{task.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

TaskDragOverlay.displayName = "TaskDragOverlay";
