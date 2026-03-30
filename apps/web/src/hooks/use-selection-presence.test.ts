import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch (_e) {
  /* ignore */
}

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";

let timeCounter = 1_000_000;
Date.now = () => ++timeCounter;

const mockAwareness = {
  setLocalStateField: mock(() => undefined),
  getLocalState: mock(() => null),
};

const collabState = {
  isCollaborating: false as boolean,
  awareness: null as any,
  collaborators: [] as any[],
};

mock.module("@/src/features/collab", () => ({
  useCollaboration: () => collabState,
}));

beforeEach(() => {
  mockAwareness.setLocalStateField.mockClear();
  mockAwareness.getLocalState.mockClear();
  collabState.isCollaborating = false;
  collabState.awareness = null;
  collabState.collaborators = [];
  timeCounter = 1_000_000;
  Date.now = () => ++timeCounter;
});

describe("use-selection-presence", () => {
  it("reflects current board selection state", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.collaborators = [
      {
        id: "user-1",
        name: "User 1",
        color: "#ff0000",
        role: "editor",
        selectionBox: { x: 10, y: 20, width: 100, height: 50 },
      },
    ];

    const { useSelectionPresence } = await import(
      "@/src/hooks/use-selection-presence"
    );
    const { result } = renderHook(() => useSelectionPresence());

    result.current.setSelectionBox({ x: 5, y: 10, width: 200, height: 100 });

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "selectionBox",
      { x: 5, y: 10, width: 200, height: 100 }
    );
  });

  it("reflects task selection state from collaborators", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.collaborators = [
      {
        id: "user-2",
        name: "User 2",
        color: "#00ff00",
        role: "owner",
        selection: ["task-1", "task-2"],
      },
    ];

    const { useSelectionPresence } = await import(
      "@/src/hooks/use-selection-presence"
    );
    const { result } = renderHook(() => useSelectionPresence());

    result.current.setSelectionBox({ x: 0, y: 0, width: 50, height: 30 });

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "selectionBox",
      { x: 0, y: 0, width: 50, height: 30 }
    );
  });

  it("cleanup clears shared selection presence", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.collaborators = [];

    const { useSelectionPresence } = await import(
      "@/src/hooks/use-selection-presence"
    );
    const { result, unmount } = renderHook(() => useSelectionPresence());

    result.current.setSelectionBox({ x: 10, y: 20, width: 100, height: 50 });

    unmount();

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "selectionBox",
      null
    );
  });

  it("does not update when not collaborating", async () => {
    collabState.isCollaborating = false;
    collabState.awareness = mockAwareness;
    collabState.collaborators = [];

    const { useSelectionPresence } = await import(
      "@/src/hooks/use-selection-presence"
    );
    const { result } = renderHook(() => useSelectionPresence());

    result.current.setSelectionBox({ x: 10, y: 20, width: 100, height: 50 });

    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled();
  });

  it("returns collaborators for external observation", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.collaborators = [
      {
        id: "user-1",
        name: "User 1",
        color: "#ff0000",
        role: "editor",
        selectionBox: { x: 10, y: 20, width: 100, height: 50 },
      },
    ];

    const { useSelectionPresence } = await import(
      "@/src/hooks/use-selection-presence"
    );
    const { result } = renderHook(() => useSelectionPresence());

    expect(result.current.collaborators).toEqual(collabState.collaborators);
  });
});
