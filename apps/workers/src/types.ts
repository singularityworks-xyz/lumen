import type { SessionModel, UserModel } from "@lumen/db";

export type AuthSession = {
  user: UserModel;
  session: SessionModel;
};

export type AuthContext = {
  user: UserModel;
  session: SessionModel;
};

export type SignInResponse = {
  success: boolean;
  user?: UserModel;
  session?: SessionModel;
  error?: string;
};
