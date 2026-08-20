import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  /* ignore */
}

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";
import type { Collaborator } from "@/src/features/collab";

let timeCounter = 1_000_000;
Date.now = () => ++timeCounter;

const mockAwareness = {
  setLocalStateField: mock(() => undefined),
  getLocalState: mock(() => null as Record<string, unknown> | null),
};

const mockCollaborators: Collaborator[] = [
  {
    id: "user-1",
    name: "User 1",
    color: "#ff0000",
    role: "editor" as const,
    draggingBoard: {
      id: "board-1",
      kind: "board" as const,
      x: 320,
      y: 180,
      cursorX: 120,
      cursorY: 80,
    },
  },
];

const collabState = {
  isCollaborating: false as boolean,
  awareness: null as typeof mockAwareness | null,
  collaborators: [] as Collaborator[],
  localUser: null as unknown,
};

mock.module("@/src/features/collab", () => ({
  useCollaboration: () => collabState,
}));

beforeEach(() => {
  mockAwareness.setLocalStateField.mockClear();
  mockAwareness.getLocalState.mockClear();
  mockAwareness.getLocalState.mockImplementation(() => null);
  collabState.isCollaborating = false;
  collabState.awareness = null;
  collabState.collaborators = [];
  collabState.localUser = null;
  timeCounter = 1_000_000;
  Date.now = () => ++timeCounter;
});

describe("use-board-drag-presence", () => {
  it("publishes draggingBoard metadata on start", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;

    const { useBoardDragPresence } = await import(
      "@/src/hooks/use-board-drag-presence"
    );
    const { result } = renderHook(() => useBoardDragPresence());

    result.current.startDragging({
      id: "board-1",
      kind: "board",
      x: 100,
      y: 200,
      cursorX: 50,
      cursorY: 60,
    });

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingBoard",
      expect.objectContaining({
        id: "board-1",
        kind: "board",
        x: 100,
        y: 200,
        cursorX: 50,
        cursorY: 60,
      })
    );
  });

  it("updates live position and cursor during drag", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;

    const { useBoardDragPresence } = await import(
      "@/src/hooks/use-board-drag-presence"
    );
    const { result } = renderHook(() => useBoardDragPresence());

    result.current.startDragging({
      id: "board-1",
      kind: "board",
      x: 100,
      y: 200,
    });

    mockAwareness.getLocalState.mockImplementation(() => ({
      draggingBoard: {
        id: "board-1",
        kind: "board",
        x: 100,
        y: 200,
        cursorX: 50,
        cursorY: 60,
      },
    }));

    result.current.updateDragPosition(320, 180, 150, 90);

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingBoard",
      expect.objectContaining({
        id: "board-1",
        x: 320,
        y: 180,
        cursorX: 150,
        cursorY: 90,
      })
    );
  });

  it("preserves cursor when only position is provided", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;

    const { useBoardDragPresence } = await import(
      "@/src/hooks/use-board-drag-presence"
    );
    const { result } = renderHook(() => useBoardDragPresence());

    result.current.startDragging({
      id: "area_1",
      kind: "area",
      x: 10,
      y: 20,
      cursorX: 5,
      cursorY: 6,
    });

    mockAwareness.getLocalState.mockImplementation(() => ({
      draggingBoard: {
        id: "area_1",
        kind: "area",
        x: 10,
        y: 20,
        cursorX: 5,
        cursorY: 6,
      },
    }));

    result.current.updateDragPosition(40, 50);

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingBoard",
      expect.objectContaining({
        id: "area_1",
        x: 40,
        y: 50,
        cursorX: 5,
        cursorY: 6,
      })
    );
  });

  it("skips updates before a drag starts", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;

    const { useBoardDragPresence } = await import(
      "@/src/hooks/use-board-drag-presence"
    );
    const { result } = renderHook(() => useBoardDragPresence());

    result.current.updateDragPosition(222, 333);

    expect(mockAwareness.getLocalState).not.toHaveBeenCalled();
    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled();
  });

  it("throttles high-frequency drag position updates", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;

    const { useBoardDragPresence } = await import(
      "@/src/hooks/use-board-drag-presence"
    );
    const { result } = renderHook(() => useBoardDragPresence());

    result.current.startDragging({
      id: "board-1",
      kind: "board",
      x: 10,
      y: 10,
    });

    mockAwareness.getLocalState.mockImplementation(() => ({
      draggingBoard: {
        id: "board-1",
        kind: "board",
        x: 10,
        y: 10,
      },
    }));

    result.current.updateDragPosition(20, 20);
    result.current.updateDragPosition(30, 30);

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledTimes(2);
    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalledWith(
      "draggingBoard",
      expect.objectContaining({ x: 30, y: 30 })
    );
  });

  it("stops dragging and clears state", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;

    const { useBoardDragPresence } = await import(
      "@/src/hooks/use-board-drag-presence"
    );
    const { result } = renderHook(() => useBoardDragPresence());

    result.current.startDragging({ id: "board-1", kind: "board", x: 0, y: 0 });
    result.current.stopDragging();

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingBoard",
      null
    );
  });

  it("cleanup clears lingering drag presence on unmount", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;

    const { useBoardDragPresence } = await import(
      "@/src/hooks/use-board-drag-presence"
    );
    const { result, unmount } = renderHook(() => useBoardDragPresence());

    result.current.startDragging({ id: "board-1", kind: "board", x: 0, y: 0 });
    unmount();

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingBoard",
      null
    );
  });

  it("builds livePositions keyed by dragged entity id", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.collaborators = mockCollaborators;

    const { useBoardDragPresence } = await import(
      "@/src/hooks/use-board-drag-presence"
    );
    const { result } = renderHook(() => useBoardDragPresence());

    expect(result.current.draggingBoards).toHaveLength(1);
    expect(result.current.draggingBoards[0]?.collaborator.id).toBe("user-1");
    expect(result.current.draggingBoards[0]?.dragState.id).toBe("board-1");

    const live = result.current.livePositions.get("board-1");
    expect(live).toEqual({
      id: "board-1",
      kind: "board",
      x: 320,
      y: 180,
      cursorX: 120,
      cursorY: 80,
    });
  });

  it("returns empty livePositions when no one is dragging", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;

    const { useBoardDragPresence } = await import(
      "@/src/hooks/use-board-drag-presence"
    );
    const { result } = renderHook(() => useBoardDragPresence());

    expect(result.current.livePositions.size).toBe(0);
    expect(result.current.draggingBoards).toHaveLength(0);
  });

  it("does not publish when not collaborating", async () => {
    collabState.isCollaborating = false;
    collabState.awareness = mockAwareness;

    const { useBoardDragPresence } = await import(
      "@/src/hooks/use-board-drag-presence"
    );
    const { result } = renderHook(() => useBoardDragPresence());

    result.current.startDragging({ id: "board-1", kind: "board", x: 0, y: 0 });

    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled();
  });
});
