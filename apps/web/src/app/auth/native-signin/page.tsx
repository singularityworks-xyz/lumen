"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { signIn } from "@/src/lib/auth-client";

function NativeSignInContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = searchParams.get("provider") || "github";
    const callbackPath =
      searchParams.get("callbackURL") || "/auth/native-callback";

    // Build absolute callback URL using current origin (the web app origin)
    const callbackURL = callbackPath.startsWith("http")
      ? callbackPath
      : `${window.location.origin}${callbackPath}`;

    async function initiateSignIn() {
      try {
        // This runs in the external browser context, so cookies are set here
        await signIn.social({
          provider: provider as "github",
          callbackURL,
        });
      } catch (err) {
        console.error("Failed to initiate sign in:", err);
        setError(
          err instanceof Error ? err.message : "Failed to initiate sign in"
        );
      }
    }

    initiateSignIn();
  }, [searchParams]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="max-w-md p-8 text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Error</title>
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </div>
          <h1 className="mb-2 font-semibold text-white text-xl">
            Sign In Failed
          </h1>
          <p className="text-sm text-white/60">{error}</p>
          <p className="mt-4 text-white/40 text-xs">
            You can close this window and try again in the app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="max-w-md p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-white border-b-2" />
        </div>
        <h1 className="mb-2 font-semibold text-white text-xl">
          Redirecting to GitHub...
        </h1>
        <p className="text-sm text-white/60">
          Please wait while we redirect you to sign in.
        </p>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="max-w-md p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-white border-b-2" />
        </div>
        <h1 className="mb-2 font-semibold text-white text-xl">
          Preparing Sign In...
        </h1>
        <p className="text-sm text-white/60">
          Please wait while we prepare your sign in.
        </p>
      </div>
    </div>
  );
}

export default function NativeSignInPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <NativeSignInContent />
    </Suspense>
  );
}
