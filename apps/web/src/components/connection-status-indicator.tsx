"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useKanbanStore } from "@/src/features/kanban/store";
import { useNativeTitlebarOffset } from "@/src/hooks/use-native-titlebar";

export function ConnectionStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showIndicator, setShowIndicator] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentWorkspace = useKanbanStore((s) =>
    s.currentWorkspaceId ? s.workspaces.byId[s.currentWorkspaceId] : null
  );
  const shareUrl = useKanbanStore((s) =>
    s.currentWorkspaceId ? s.workspaceShareUrls[s.currentWorkspaceId] : null
  );

  const isSharedWorkspace =
    currentWorkspace?.isShared === true ||
    !!shareUrl ||
    !!currentWorkspace?.shareToken;

  const titlebarOffset = useNativeTitlebarOffset();

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (isSharedWorkspace) {
        setShowIndicator(true);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          setShowIndicator(false);
          timeoutRef.current = null;
        }, 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (isSharedWorkspace) {
        setShowIndicator(true);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isSharedWorkspace]);

  if (!isSharedWorkspace) {
    return null;
  }

  if (!showIndicator) {
    return null;
  }

  return (
    <div
      className="fixed right-4 z-50 flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-lg"
      style={{ top: `${16 + titlebarOffset}px` }}
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="font-medium text-sm">Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-orange-500" />
          <span className="font-medium text-sm">Offline mode</span>
        </>
      )}
    </div>
  );
}
