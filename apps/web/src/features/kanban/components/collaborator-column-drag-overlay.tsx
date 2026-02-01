"use client";

import { MousePointer2, User } from "lucide-react";
import Image from "next/image";
import { memo, useEffect, useState } from "react";
import type { Collaborator } from "@/src/features/collab";
import { useCachedProfileImage } from "@/src/hooks/use-cached-profile-image";
import { cn } from "@/src/lib/utils";

interface CollaboratorColumnDragOverlayProps {
  columnName: string;
  taskCount: number;
  collaborator: Collaborator & {
    image?: string | null;
  };
  cursorX?: number;
  cursorY?: number;
}

export const CollaboratorColumnDragOverlay =
  memo<CollaboratorColumnDragOverlayProps>(
    ({ collaborator, cursorX = 0, cursorY = 0, columnName, taskCount }) => {
      const { imageUrl, hasImage } = useCachedProfileImage(collaborator.image);
      const [isVisible, setIsVisible] = useState(false);

      useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
      }, []);

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
            className="relative -mt-1 ml-3 w-64 overflow-visible rounded-lg border-2 bg-card/95 shadow-xl backdrop-blur-md"
            style={{
              borderColor: collaborator.color,
              boxShadow: `
              0 8px 32px -8px ${collaborator.color}40,
              0 16px 48px -16px rgba(0,0,0,0.4)
            `,
            }}
          >
            {/* Collaborator Identification Badge */}
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

            <div className="flex cursor-grabbing items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                {/** biome-ignore lint/a11y/noSvgWithoutTitle: decorative cursor */}
                <svg
                  className="h-4 w-4 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <rect height="18" rx="2" ry="2" width="7" x="3" y="3" />
                  <rect height="18" rx="2" ry="2" width="7" x="14" y="3" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-foreground text-sm">
                  {columnName}
                </span>
                <span className="text-muted-foreground text-xs">
                  {taskCount} {taskCount === 1 ? "task" : "tasks"}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
  );

CollaboratorColumnDragOverlay.displayName = "CollaboratorColumnDragOverlay";
