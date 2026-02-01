"use client";

import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { memo } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/src/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { ICON_MAP } from "@/src/features/kanban/utils/color-icon-utils";
import { cn } from "@/src/lib/utils";

export interface BlockingDialog {
  id: string;
  name: string;
  icon?: string | LucideIcon;
  accentColor?: string;
  type: string;
}

interface BlockingDialogsManagerProps {
  dialogs: BlockingDialog[];
  onCloseAll: () => void;
  onCloseMenu: () => void;
  children: React.ReactNode;
}

export const BlockingDialogsManager = memo(
  ({
    dialogs,
    onCloseAll,
    onCloseMenu,
    children,
  }: BlockingDialogsManagerProps) => {
    const hasOpenDialogs = dialogs.length > 0;

    if (hasOpenDialogs) {
      return (
        <HoverCard closeDelay={300} openDelay={0}>
          <HoverCardTrigger asChild>
            <button
              className="flex h-6 w-6 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-card/80 text-muted-foreground opacity-50 shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              disabled
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            className="w-auto overflow-hidden rounded-lg border-2 border-border/50 bg-card p-0 shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_2px_8px_rgba(0,0,0,0.2),inset_0_-1px_4px_rgba(255,255,255,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.6),inset_0_2px_8px_rgba(255,255,255,0.15),inset_0_-2px_6px_rgba(0,0,0,0.5)]"
            side="top"
            sideOffset={8}
          >
            <div className="flex items-center gap-2 px-2.5 py-2">
              <div className="flex items-center gap-1.5">
                {dialogs.map((dialog) => {
                  let IconComponent: LucideIcon | null = null;
                  if (typeof dialog.icon === "string") {
                    IconComponent = ICON_MAP[dialog.icon] || null;
                  } else if (dialog.icon) {
                    IconComponent = dialog.icon;
                  }
                  return (
                    <span
                      className={cn(
                        "flex h-6 items-center gap-1.5 rounded-md px-2 font-medium text-[11px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.1),inset_0_-1px_1px_rgba(255,255,255,0.1)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),inset_0_-1px_2px_rgba(255,255,255,0.08)]",
                        !dialog.accentColor && "bg-primary/15 text-primary"
                      )}
                      key={dialog.id}
                      style={
                        dialog.accentColor
                          ? {
                              backgroundColor: `${dialog.accentColor}20`,
                              color: dialog.accentColor,
                            }
                          : {}
                      }
                      title={dialog.name}
                    >
                      {IconComponent && (
                        <IconComponent className="h-3.5 w-3.5" />
                      )}
                      <span className="max-w-20 truncate">{dialog.name}</span>
                    </span>
                  );
                })}
              </div>
              <button
                className="flex h-6 shrink-0 items-center gap-1.5 rounded-md bg-destructive/15 px-2 font-medium text-[11px] text-destructive shadow-[inset_0_1px_2px_rgba(0,0,0,0.1),inset_0_-1px_1px_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/25 dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),inset_0_-1px_2px_rgba(255,255,255,0.08)]"
                onClick={onCloseAll}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
                <span>Close</span>
              </button>
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    }

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card/80 text-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] transition-colors hover:bg-destructive/20 hover:text-destructive dark:bg-card/50 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.3)]"
              onClick={onCloseMenu}
              type="button"
            >
              {children}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Close menu</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

BlockingDialogsManager.displayName = "BlockingDialogsManager";
