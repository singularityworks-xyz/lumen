"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function NativeAuthCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<
    "processing" | "success" | "waiting" | "error"
  >("processing");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (errorParam) {
      setStatus("error");
      setError(errorDescription || errorParam);
      // Try deep link anyway
      window.location.href = `lumen://auth/callback?error=${encodeURIComponent(errorParam)}&error_description=${encodeURIComponent(errorDescription || "")}`;
      return;
    }

    // Check for the native_token that was added by the workers callback handler
    const nativeToken = searchParams.get("native_token");

    if (nativeToken) {
      setToken(nativeToken);
      setStatus("success");

      // Try deep link redirect
      const deepLinkUrl = `lumen://auth/callback?success=true&token=${encodeURIComponent(nativeToken)}`;

      // Attempt the deep link
      window.location.href = deepLinkUrl;

      // After a delay, if we're still here, the deep link didn't work
      // Show fallback UI
      setTimeout(() => {
        setStatus("waiting");
      }, 2000);

      return;
    }

    // No token in URL - this shouldn't happen with the new flow
    setStatus("error");
    setError("Authentication token not found. Please try again.");
  }, [searchParams]);

  const handleCopyToken = async () => {
    if (token) {
      try {
        await navigator.clipboard.writeText(token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = token;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleRetryDeepLink = () => {
    if (token) {
      window.location.href = `lumen://auth/callback?success=true&token=${encodeURIComponent(token)}`;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="max-w-md p-8 text-center">
        <div className="mb-6">
          {(status === "processing" || status === "success") && (
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-white border-b-2" />
          )}
          {status === "waiting" && (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Success</title>
                <path
                  d="M5 13l4 4L19 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </div>
          )}
          {status === "error" && (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
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
          )}
        </div>

        <h1 className="mb-2 font-semibold text-white text-xl">
          {(status === "processing" || status === "success") &&
            "Completing Sign In..."}
          {status === "waiting" && "Sign In Successful!"}
          {status === "error" && "Sign In Failed"}
        </h1>

        <p className="text-sm text-white/60">
          {(status === "processing" || status === "success") &&
            "Redirecting you back to Lumen..."}
          {status === "waiting" &&
            "The app should open automatically. If it doesn't, use the options below."}
          {status === "error" && (error || "An error occurred during sign in.")}
        </p>

        {status === "waiting" && token && (
          <div className="mt-6 space-y-4">
            <button
              className="w-full rounded-lg bg-white px-4 py-3 font-medium text-black transition-colors hover:bg-white/90"
              onClick={handleRetryDeepLink}
              type="button"
            >
              Open Lumen App
            </button>

            <div className="text-sm text-white/40">
              <p className="mb-2">
                If the button above doesn&apos;t work, copy this token and paste
                it in the app:
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-white/10 p-3">
                <code className="flex-1 truncate text-white/80 text-xs">
                  {token.slice(0, 20)}...
                </code>
                <button
                  className="rounded bg-white/20 px-3 py-1 text-white text-xs transition-colors hover:bg-white/30"
                  onClick={handleCopyToken}
                  type="button"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}

        {status === "error" && (
          <p className="mt-4 text-white/40 text-xs">
            You can close this window and try again in the app.
          </p>
        )}
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
          Completing Sign In...
        </h1>
        <p className="text-sm text-white/60">
          Please wait while we complete your sign in.
        </p>
      </div>
    </div>
  );
}

export default function NativeAuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <NativeAuthCallbackContent />
    </Suspense>
  );
}
