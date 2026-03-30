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
  getLocalState: mock(() => null as any),
};

const mockCollaborators = [
  {
    id: "user-1",
    name: "User 1",
    color: "#ff0000",
    role: "editor" as const,
    draggingTask: {
      taskId: "task-1",
      fromColumnId: "col-1",
      fromBoardId: "board-1",
      cursorX: 100,
      cursorY: 200,
    },
  },
] as any;

const collabState = {
  isCollaborating: false as boolean,
  awareness: null as any,
  collaborators: [] as any[],
  localUser: null as any,
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

const mockTask = {
  id: "task-123",
  column_id: "col-1",
  board_id: "board-1",
  content: "Test task",
} as unknown as import("@/src/features/kanban").Task;

describe("use-task-drag-presence", () => {
  it("starts drag and broadcasts to collaborators", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.localUser = {
      id: "local-user",
      name: "Local",
      color: "#fff",
      role: "editor",
    };

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    result.current.startDragging(mockTask, 150, 250);

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingTask",
      expect.objectContaining({
        taskId: "task-123",
        fromColumnId: "col-1",
        fromBoardId: "board-1",
        cursorX: 150,
        cursorY: 250,
      })
    );
  });

  it("updates drag position while moving", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.localUser = {
      id: "local-user",
      name: "Local",
      color: "#fff",
      role: "editor",
    };

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    result.current.startDragging(mockTask, 100, 100);

    mockAwareness.getLocalState.mockImplementation(() => ({
      draggingTask: {
        taskId: "task-123",
        fromColumnId: "col-1",
        fromBoardId: "board-1",
        cursorX: 100,
        cursorY: 100,
      },
    }));

    result.current.updateDragPosition(200, 300);

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingTask",
      expect.objectContaining({
        cursorX: 200,
        cursorY: 300,
      })
    );
  });

  it("fallback recreates lost drag state", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.localUser = {
      id: "local-user",
      name: "Local",
      color: "#fff",
      role: "editor",
    };

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    result.current.startDragging(mockTask, 100, 100);

    mockAwareness.getLocalState.mockImplementation(() => null);

    result.current.updateDragPosition(250, 350);

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingTask",
      expect.objectContaining({
        taskId: "task-123",
        cursorX: 250,
        cursorY: 350,
      })
    );
  });

  it("clears drag state on stop", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.localUser = {
      id: "local-user",
      name: "Local",
      color: "#fff",
      role: "editor",
    };

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    result.current.startDragging(mockTask);
    result.current.stopDragging();

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingTask",
      null
    );
  });

  it("cleanup removes lingering drag presence", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.localUser = {
      id: "local-user",
      name: "Local",
      color: "#fff",
      role: "editor",
    };

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result, unmount } = renderHook(() => useTaskDragPresence());

    result.current.startDragging(mockTask);
    unmount();

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingTask",
      null
    );
  });

  it("returns dragging collaborators", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.collaborators = mockCollaborators;

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    expect(result.current.draggingCollaborators).toHaveLength(1);
    expect(result.current.draggingCollaborators[0]!.id).toBe("user-1");
  });

  it("returns empty draggingCollaborators when not collaborating", async () => {
    collabState.isCollaborating = false;
    collabState.collaborators = mockCollaborators;

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    expect(result.current.draggingCollaborators).toHaveLength(0);
  });

  it("getTaskDragCollaborator returns undefined when not collaborating", async () => {
    collabState.isCollaborating = false;
    collabState.collaborators = mockCollaborators;

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    const collab = result.current.getTaskDragCollaborator("task-1");
    expect(collab).toBeUndefined();
  });

  it("getTaskDragCollaborator finds collaborator by taskId", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.collaborators = mockCollaborators;

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    const collab = result.current.getTaskDragCollaborator("task-1");
    expect(collab?.id).toBe("user-1");
  });

  it("getTaskDragCollaborator returns undefined for unknown taskId", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.collaborators = mockCollaborators;

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    const collab = result.current.getTaskDragCollaborator("unknown-task");
    expect(collab).toBeUndefined();
  });

  it("draggedTasks returns empty when not collaborating", async () => {
    collabState.isCollaborating = false;
    collabState.collaborators = mockCollaborators;

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    expect(result.current.draggedTasks).toHaveLength(0);
  });

  it("draggedTasks returns collaborator drag states", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.collaborators = mockCollaborators;

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    expect(result.current.draggedTasks).toHaveLength(1);
    expect(result.current.draggedTasks[0]!.collaborator.id).toBe("user-1");
  });

  it("updateDragPosition returns early when not dragging", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.localUser = {
      id: "local",
      name: "L",
      color: "#fff",
      role: "editor",
    };

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    result.current.updateDragPosition(100, 200);

    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled();
  });

  it("updateDragPosition throttles rapid updates", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.localUser = {
      id: "local",
      name: "L",
      color: "#fff",
      role: "editor",
    };

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    result.current.startDragging(mockTask, 100, 100);

    mockAwareness.getLocalState.mockImplementation(() => ({
      draggingTask: {
        taskId: "task-123",
        fromColumnId: "col-1",
        fromBoardId: "board-1",
        cursorX: 100,
        cursorY: 100,
      },
    }));

    const callCountBefore = mockAwareness.setLocalStateField.mock.calls.length;

    result.current.updateDragPosition(101, 101);
    result.current.updateDragPosition(102, 102);
    result.current.updateDragPosition(103, 103);

    const callsAfter = mockAwareness.setLocalStateField.mock.calls.length;
    expect(callsAfter - callCountBefore).toBeLessThanOrEqual(3);
  });

  it("draggedTasks skips collaborators without draggingTask", async () => {
    collabState.isCollaborating = true;
    collabState.awareness = mockAwareness;
    collabState.collaborators = [
      {
        id: "user-2",
        name: "User 2",
        color: "#00ff00",
        role: "editor",
        draggingTask: null,
      },
    ];

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    expect(result.current.draggedTasks).toHaveLength(0);
  });
});
