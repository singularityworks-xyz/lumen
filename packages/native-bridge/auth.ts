import { isTauri } from "./platform";

let oauthResolver: ((url: string) => void) | null = null;
let oauthRejecter: ((error: Error) => void) | null = null;
let oauthTimeoutId: ReturnType<typeof setTimeout> | null = null;

const authDeepLinkCallbacks: Set<(url: string) => void> = new Set();
const DEEP_LINK_SCHEME = "lumen";
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

export async function initializeNativeAuth(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  try {
    const { onOpenUrl, getCurrent } = await import(
      "@tauri-apps/plugin-deep-link"
    );

    try {
      const initialUrls = await getCurrent();
      if (initialUrls && initialUrls.length > 0) {
        handleDeepLinkUrls(initialUrls);
      }
    } catch {
      // No initial deep links, which is fine
    }

    await onOpenUrl((urls) => {
      handleDeepLinkUrls(urls);
    });

    console.log("[NativeAuth] Deep link listener initialized");
  } catch (error) {
    console.error(
      "[NativeAuth] Failed to initialize deep link listener:",
      error
    );
  }
}

function handleDeepLinkUrls(urls: string[]): void {
  for (const url of urls) {
    console.log("[NativeAuth] Received deep link:", url);

    if (url.startsWith(`${DEEP_LINK_SCHEME}://auth/callback`)) {
      // Call the internal OAuth resolver if set
      if (oauthResolver) {
        oauthResolver(url);
        cleanupOAuthState();
      }

      // Also notify all external callbacks (e.g., use-auth hook)
      for (const callback of authDeepLinkCallbacks) {
        try {
          callback(url);
        } catch (err) {
          console.error("[NativeAuth] Error in deep link callback:", err);
        }
      }
    }
  }
}

function cleanupOAuthState(): void {
  if (oauthTimeoutId) {
    clearTimeout(oauthTimeoutId);
    oauthTimeoutId = null;
  }
  oauthResolver = null;
  oauthRejecter = null;
}

export async function openExternalBrowser(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank");
    return;
  }

  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
  } catch (error) {
    console.error("[NativeAuth] Failed to open external browser:", error);
    throw error;
  }
}

export function initiateOAuthFlow(authUrl: string): Promise<URLSearchParams> {
  if (!isTauri()) {
    throw new Error("Native OAuth flow is only available in Tauri");
  }

  if (oauthRejecter) {
    oauthRejecter(new Error("OAuth flow cancelled - new flow started"));
    cleanupOAuthState();
  }

  return new Promise((resolve, reject) => {
    oauthResolver = (callbackUrl: string) => {
      try {
        const url = new URL(callbackUrl);
        const params = url.searchParams;

        const error = params.get("error");
        if (error) {
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        resolve(params);
      } catch (err) {
        reject(err);
      }
    };

    oauthRejecter = reject;

    oauthTimeoutId = setTimeout(() => {
      if (oauthRejecter) {
        oauthRejecter(new Error("OAuth flow timed out"));
        cleanupOAuthState();
      }
    }, OAUTH_TIMEOUT_MS);

    openExternalBrowser(authUrl).catch((error) => {
      cleanupOAuthState();
      reject(error);
    });
  });
}

export function getOAuthCallbackUrl(): string {
  return `${DEEP_LINK_SCHEME}://auth/callback`;
}

export function shouldUseNativeAuth(): boolean {
  return isTauri();
}

export function cancelOAuthFlow(): void {
  if (oauthRejecter) {
    oauthRejecter(new Error("OAuth flow cancelled by user"));
    cleanupOAuthState();
  }
}

// Subscribe to auth deep link callbacks (returns unsubscribe function)
export function onAuthDeepLink(callback: (url: string) => void): () => void {
  authDeepLinkCallbacks.add(callback);
  return () => {
    authDeepLinkCallbacks.delete(callback);
  };
}
