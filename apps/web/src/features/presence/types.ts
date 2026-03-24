export interface PresenceUser {
  avatar?: string;
  id: string;
  joinedAt: number;
  name: string;
  status: "online" | "idle" | "away";
}

export interface PresenceState {
  currentUser: PresenceUser | null;
  isConnected: boolean;
  users: Map<string, PresenceUser>;
}

export interface PresenceMessage {
  event: string;
  payload: unknown;
  topic: string;
}
