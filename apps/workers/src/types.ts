import type { SessionModel, UserModel } from "@lumen/db";

export interface AuthSession {
  user: UserModel;
  session: SessionModel;
}

export interface AuthContext {
  user: UserModel;
  session: SessionModel;
}

export interface SignInResponse {
  success: boolean;
  user?: UserModel;
  session?: SessionModel;
  error?: string;
}
