export type PresenceUser = {
  id: string;
  name: string;
  avatar?: string;
  status: "online" | "idle" | "away";
  joinedAt: number;
};

export type PresenceState = {
  users: Map<string, PresenceUser>;
  currentUser: PresenceUser | null;
  isConnected: boolean;
};

export type PresenceMessage = {
  topic: string;
  event: string;
  payload: unknown;
};
