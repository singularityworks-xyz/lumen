"use client";

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getJwtToken } from "@/src/lib/auth-client";
import { PresenceManager } from "./presence-manager";
import type { PresenceUser } from "./types";

interface PresenceContextValue {
  currentUser: PresenceUser | null;
  isConnected: boolean;
  users: PresenceUser[];
}

const PresenceContext = createContext<PresenceContextValue>({
  users: [],
  isConnected: false,
  currentUser: null,
});

interface PresenceProviderProps {
  children?: React.ReactNode;
  enabled?: boolean;
  userAvatar?: string;
  userId: string;
  userName: string;
  workspaceId: string;
}

export const PresenceProvider = memo(
  ({
    workspaceId,
    userId,
    userName,
    userAvatar,
    enabled = true,
    children,
  }: PresenceProviderProps) => {
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
      if (!(enabled && workspaceId && userId)) {
        return;
      }

      let cancelled = false;

      async function connect() {
        const token = await getJwtToken();
        if (cancelled || !token) {
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
      }

      connect();

      return () => {
        cancelled = true;
        managerRef.current?.disconnect();
        managerRef.current = null;
      };
    }, [
      enabled,
      workspaceId,
      userId,
      userName,
      userAvatar,
      handlePresenceUpdate,
      handleConnectionChange,
    ]);

    const currentUser = useMemo(
      () =>
        users.find((user) => user.id === userId) ||
        ({
          id: userId,
          name: userName,
          avatar: userAvatar,
          status: "online",
          joinedAt: Date.now(),
        } as PresenceUser),
      [users, userId, userName, userAvatar]
    );

    const value = useMemo(
      () => ({
        users,
        isConnected,
        currentUser,
      }),
      [users, isConnected, currentUser]
    );

    return (
      <PresenceContext.Provider value={value}>
        {children}
      </PresenceContext.Provider>
    );
  }
);

PresenceProvider.displayName = "PresenceProvider";

export function usePresenceContext(): PresenceContextValue {
  return useContext(PresenceContext);
}
