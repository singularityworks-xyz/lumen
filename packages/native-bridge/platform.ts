export function isTauri(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  // biome-ignore lint/suspicious/noExplicitAny: Tauri injects this global
  return !!(window as any).__TAURI_INTERNALS__;
}

// Get the current platform, returns 'tauri' for native app, 'web' for browser.
export function getPlatform(): "tauri" | "web" {
  return isTauri() ? "tauri" : "web";
}

// Check if running on a specific operating system in Tauri.
// Only available in Tauri context.
export async function getOS(): Promise<
  "linux" | "macos" | "windows" | "unknown"
> {
  if (!isTauri()) {
    return "unknown";
  }

  try {
    const { platform } = await import("@tauri-apps/plugin-os");
    const os = await platform();
    if (os === "linux" || os === "macos" || os === "windows") {
      return os;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}
