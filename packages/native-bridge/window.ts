import { isTauri } from "./platform";

export async function minimizeWindow(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  } catch (error) {
    console.error("Failed to minimize window:", error);
  }
}

export async function toggleMaximize(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  } catch (error) {
    console.error("Failed to toggle maximize:", error);
  }
}

export async function closeWindow(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch (error) {
    console.error("Failed to close window:", error);
  }
}

export async function startDragging(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  } catch (error) {
    console.error("Failed to start dragging:", error);
  }
}

export async function isMaximized(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return await getCurrentWindow().isMaximized();
  } catch {
    return false;
  }
}
