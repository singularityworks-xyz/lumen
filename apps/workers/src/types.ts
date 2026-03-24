import type { SessionModel, UserModel } from "@lumen/db";

export interface AuthSession {
  session: SessionModel;
  user: UserModel;
}

export interface AuthContext {
  session: SessionModel;
  user: UserModel;
}

export interface SignInResponse {
  error?: string;
  session?: SessionModel;
  success: boolean;
  user?: UserModel;
}
