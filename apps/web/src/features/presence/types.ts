export interface PresenceUser {
  id: string;
  name: string;
  avatar?: string;
  status: "online" | "idle" | "away";
  joinedAt: number;
}

export interface PresenceState {
  users: Map<string, PresenceUser>;
  currentUser: PresenceUser | null;
  isConnected: boolean;
}

export interface PresenceMessage {
  topic: string;
  event: string;
  payload: unknown;
}
