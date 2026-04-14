"use client";

import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "../env";

interface AuthUser {
  email: string;
  id: string;
  image: string | null;
  name: string | null;
}

function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return env.NEXT_PUBLIC_API_URL.replace("localhost", "127.0.0.1");
  }
  const origin = window.location.origin;
  if (origin && origin !== "null") {
    return origin;
  }
  return env.NEXT_PUBLIC_API_URL;
}

const authClient = createAuthClient({
  baseURL: getBaseUrl(),
  credentials: "include",
  plugins: [jwtClient()],
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
