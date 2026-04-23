"use client";

import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "../env";
import { normalizeApiUrlForCurrentHost } from "./url";

interface AuthUser {
  email: string;
  id: string;
  image: string | null;
  name: string | null;
}

const authClient = createAuthClient({
  baseURL: normalizeApiUrlForCurrentHost(env.NEXT_PUBLIC_API_URL),
  credentials: "include",
  plugins: [jwtClient()],
  sessionOptions: {
    refetchInterval: 0,
    refetchOnWindowFocus: false,
    refetchWhenOffline: false,
  },
});

export const { signIn, signOut, signUp, useSession } = authClient;

export async function getCurrentUser(): Promise<AuthUser | null> {
  const sessionResult = await authClient.getSession();
  const user = sessionResult.data?.user;

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email,
    image: user.image ?? null,
  };
}

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
