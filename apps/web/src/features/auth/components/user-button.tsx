"use client";

import { Loader2, User } from "lucide-react";
import { memo, useState } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { useAuth } from "@/src/hooks/use-auth";
import { cn } from "@/src/lib/utils";
import { ProfileModal } from "./profile-modal";

type UserButtonProps = {
  size?: "sm" | "md";
  className?: string;
  showLabel?: boolean;
};

export const UserButton = memo(
  ({ size = "md", className, showLabel = true }: UserButtonProps) => {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { user, isLoading } = useAuth();

    const userName = user?.name || user?.email || "Guest";
    const userImage = user?.image;

    const avatarSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";
    const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
    const textSize = size === "sm" ? "text-[11px]" : "text-xs";
    const buttonHeight = "h-8";
    const buttonPadding = size === "sm" ? "px-2" : "px-2";

    if (isLoading) {
      return (
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full bg-card/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]",
            buttonHeight,
            buttonPadding,
            className
          )}
        >
          <Loader2
            className={cn(iconSize, "animate-spin text-muted-foreground")}
          />
        </div>
      );
    }

    return (
      <>
        <button
          className={cn(
            "flex items-center gap-1.5 rounded-full bg-card/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)] transition-colors hover:bg-secondary/70 dark:shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)]",
            buttonHeight,
            buttonPadding,
            className
          )}
          onClick={() => setIsProfileOpen(true)}
          title={userName}
          type="button"
        >
          <Avatar className={cn(avatarSize, "bg-primary/20")}>
            {userImage && <AvatarImage alt={userName} src={userImage} />}
            <AvatarFallback className="bg-primary/20 text-primary">
              <User className={iconSize} />
            </AvatarFallback>
          </Avatar>
          {showLabel && (
            <span className={cn("font-medium text-foreground/80", textSize)}>
              {userName}
            </span>
          )}
        </button>

        <ProfileModal
          onClose={() => setIsProfileOpen(false)}
          open={isProfileOpen}
        />
      </>
    );
  }
);

UserButton.displayName = "UserButton";
