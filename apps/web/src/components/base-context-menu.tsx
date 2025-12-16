"use client";

import type { LucideIcon } from "lucide-react";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/src/lib/utils";

export type ContextMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "destructive";
  showDividerAfter?: boolean;
};

type BaseContextMenuProps = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  width?: string;
};

export const BaseContextMenu = memo(
  ({ x, y, items, onClose, width = "w-44" }: BaseContextMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x, y });

    useLayoutEffect(() => {
      if (!menuRef.current) {
        return;
      }

      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + menuRect.width > viewportWidth - 8) {
        adjustedX = viewportWidth - menuRect.width - 8;
      }
      if (adjustedX < 8) {
        adjustedX = 8;
      }

      if (y + menuRect.height > viewportHeight - 8) {
        adjustedY = viewportHeight - menuRect.height - 8;
      }
      if (adjustedY < 8) {
        adjustedY = 8;
      }

      setPosition({ x: adjustedX, y: adjustedY });
    }, [x, y]);

    useEffect(() => {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onClose();
        }
      };

      document.addEventListener("keydown", handleEscape);

      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }, [onClose]);

    const menuContent = (
      <>
        {/* Invisible backdrop to capture clicks outside and block interactions with content behind */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop for click capture */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Backdrop for click capture */}
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Backdrop for click capture */}
        <div
          className="fixed inset-0 z-9998"
          onClick={onClose}
          onContextMenu={(e) => {
            e.preventDefault();
            onClose();
          }}
        />

        <div
          className={cn(
            "fade-in-0 zoom-in-95 fixed z-9999 animate-in rounded-md border-2 border-border/50 bg-popover shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] duration-100 dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]",
            width
          )}
          ref={menuRef}
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          <div className="p-1">
            {items.map((item, index) => {
              const Icon = item.icon;
              const isDestructive = item.variant === "destructive";

              return (
                <div key={item.id}>
                  <button
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none transition-colors",
                      isDestructive
                        ? "text-red-600 hover:bg-red-100 focus:bg-red-100 dark:text-red-400 dark:focus:bg-red-900/30 dark:hover:bg-red-900/30"
                        : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    )}
                    onClick={() => {
                      item.onClick();
                      onClose();
                    }}
                    type="button"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </button>
                  {item.showDividerAfter && index < items.length - 1 && (
                    <div className="my-0.5 h-px bg-border/50" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </>
    );

    return createPortal(menuContent, document.body);
  }
);

BaseContextMenu.displayName = "BaseContextMenu";
