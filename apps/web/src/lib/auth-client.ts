"use client";

import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "../env";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_API_URL,
  credentials: "include",
  plugins: [jwtClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;

export async function getJwtToken(): Promise<string | null> {
  try {
    const result = await authClient.token();
    if (result.error || !result.data) {
      return null;
    }
    return result.data.token;
  } catch {
    return null;
  }
}
