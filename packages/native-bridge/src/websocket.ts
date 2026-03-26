import { isTauri } from "./platform";

// This is an example of how to use native WebSocket in Tauri,
// falling back to the browser WebSocket implementation otherwise as workers do not support it.
// biome-ignore lint/suspicious/noExplicitAny: any needed for WebSocket fallback
export async function connectWebSocket(url: string): Promise<WebSocket | any> {
  if (isTauri()) {
    try {
      // Dynamic import to avoid issues in non-Tauri environments
      const { default: WebSocket } = await import(
        "@tauri-apps/plugin-websocket"
      );
      return await WebSocket.connect(url);
    } catch (error) {
      console.warn(
        "Failed to use native WebSocket, falling back to browser implementation",
        error
      );
    }
  }

  return new WebSocket(url);
}
