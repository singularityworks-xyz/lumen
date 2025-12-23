"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
  credentials: "include",
});

export const { signIn, signOut, signUp, useSession } = authClient;
