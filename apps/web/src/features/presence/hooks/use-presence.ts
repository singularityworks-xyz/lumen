"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PresenceManager } from "../presence-manager";
import type { PresenceUser } from "../types";

type UsePresenceOptions = {
  workspaceId: string;
  userId: string;
  token: string;
  userName: string;
  userAvatar?: string;
  enabled?: boolean;
};

type UsePresenceReturn = {
  users: PresenceUser[];
  isConnected: boolean;
  currentUser: PresenceUser | null;
};

export function usePresence({
  workspaceId,
  userId,
  token,
  userName,
  userAvatar,
  enabled = true,
}: UsePresenceOptions): UsePresenceReturn {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const managerRef = useRef<PresenceManager | null>(null);

  const handlePresenceUpdate = useCallback((newUsers: PresenceUser[]) => {
    setUsers(newUsers);
  }, []);

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
  }, []);

  useEffect(() => {
    if (!(enabled && workspaceId && userId && token)) {
      return;
    }

    managerRef.current = new PresenceManager({
      workspaceId,
      userId,
      token,
      userName,
      userAvatar,
      onPresenceUpdate: handlePresenceUpdate,
      onConnectionChange: handleConnectionChange,
    });

    return () => {
      managerRef.current?.disconnect();
      managerRef.current = null;
    };
  }, [
    enabled,
    workspaceId,
    userId,
    token,
    userName,
    userAvatar,
    handlePresenceUpdate,
    handleConnectionChange,
  ]);

  const currentUser =
    users.find((user) => user.id === userId) ||
    ({
      id: userId,
      name: userName,
      avatar: userAvatar,
      status: "online",
      joinedAt: Date.now(),
    } as PresenceUser);

  return {
    users,
    isConnected,
    currentUser,
  };
}
