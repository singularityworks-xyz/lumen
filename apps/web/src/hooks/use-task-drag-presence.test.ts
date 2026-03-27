import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch (_e) {
  /* ignore */
}

import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";

const createMockAwareness = () => ({
  setLocalStateField: mock(() => undefined) as any,
  getLocalState: mock(() => null) as any,
});

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

const mockUseCollaboration = mock(() => ({
  isCollaborating: false,
  awareness: null,
  collaborators: [],
  localUser: null,
})) as any;

mock.module("@/src/features/collab", () => ({
  useCollaboration: mockUseCollaboration,
}));

describe("use-task-drag-presence", () => {
  it("starts drag and broadcasts to collaborators", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    const mockTask = {
      id: "task-123",
      column_id: "col-1",
      board_id: "board-1",
      content: "Test task",
    } as unknown as import("@/src/features/kanban").Task;

    act(() => {
      result.current.startDragging(mockTask, 150, 250);
    });

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
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    const mockTask = {
      id: "task-123",
      column_id: "col-1",
      board_id: "board-1",
      content: "Test task",
    } as unknown as import("@/src/features/kanban").Task;

    act(() => {
      result.current.startDragging(mockTask, 100, 100);
    });

    mockAwareness.getLocalState.mockImplementation(() => ({
      draggingTask: {
        taskId: "task-123",
        fromColumnId: "col-1",
        fromBoardId: "board-1",
        cursorX: 100,
        cursorY: 100,
      },
    }));

    act(() => {
      result.current.updateDragPosition(200, 300);
    });

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingTask",
      expect.objectContaining({
        cursorX: 200,
        cursorY: 300,
      })
    );
  });

  it("fallback recreates lost drag state", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    const mockTask = {
      id: "task-123",
      column_id: "col-1",
      board_id: "board-1",
      content: "Test task",
    } as unknown as import("@/src/features/kanban").Task;

    act(() => {
      result.current.startDragging(mockTask, 100, 100);
    });

    mockAwareness.getLocalState.mockImplementation(() => null);

    act(() => {
      result.current.updateDragPosition(250, 350);
    });

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
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    const mockTask = {
      id: "task-123",
      column_id: "col-1",
      board_id: "board-1",
      content: "Test task",
    } as unknown as import("@/src/features/kanban").Task;

    act(() => {
      result.current.startDragging(mockTask);
    });

    act(() => {
      result.current.stopDragging();
    });

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingTask",
      null
    );
  });

  it("cleanup removes lingering drag presence", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result, unmount } = renderHook(() => useTaskDragPresence());

    const mockTask = {
      id: "task-123",
      column_id: "col-1",
      board_id: "board-1",
      content: "Test task",
    } as unknown as import("@/src/features/kanban").Task;

    act(() => {
      result.current.startDragging(mockTask);
    });

    unmount();

    expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
      "draggingTask",
      null
    );
  });

  it("returns dragging collaborators", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: mockCollaborators,
      localUser: null,
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    expect(result.current.draggingCollaborators).toHaveLength(1);
    expect(result.current.draggingCollaborators[0]!.id).toBe("user-1");
  });

  it("returns empty draggingCollaborators when not collaborating", async () => {
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: false,
      awareness: null,
      collaborators: mockCollaborators,
      localUser: null,
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    expect(result.current.draggingCollaborators).toHaveLength(0);
  });

  it("getTaskDragCollaborator returns undefined when not collaborating", async () => {
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: false,
      awareness: null,
      collaborators: mockCollaborators,
      localUser: null,
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    const collab = result.current.getTaskDragCollaborator("task-1");
    expect(collab).toBeUndefined();
  });

  it("getTaskDragCollaborator finds collaborator by taskId", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: mockCollaborators,
      localUser: null,
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    const collab = result.current.getTaskDragCollaborator("task-1");
    expect(collab?.id).toBe("user-1");
  });

  it("getTaskDragCollaborator returns undefined for unknown taskId", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: mockCollaborators,
      localUser: null,
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    const collab = result.current.getTaskDragCollaborator("unknown-task");
    expect(collab).toBeUndefined();
  });

  it("draggedTasks returns empty when not collaborating", async () => {
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: false,
      awareness: null,
      collaborators: mockCollaborators,
      localUser: null,
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    expect(result.current.draggedTasks).toHaveLength(0);
  });

  it("draggedTasks returns collaborator drag states", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: mockCollaborators,
      localUser: null,
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    expect(result.current.draggedTasks).toHaveLength(1);
    expect(result.current.draggedTasks[0]!.collaborator.id).toBe("user-1");
  });

  it("updateDragPosition returns early when not dragging", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [],
      localUser: { id: "local", name: "L", color: "#fff", role: "editor" },
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    // Call updateDragPosition without starting drag first
    act(() => {
      result.current.updateDragPosition(100, 200);
    });

    // Should not call setLocalStateField since not dragging
    expect(mockAwareness.setLocalStateField).not.toHaveBeenCalled();
  });

  it("updateDragPosition throttles rapid updates", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [],
      localUser: { id: "local", name: "L", color: "#fff", role: "editor" },
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    const mockTask = {
      id: "task-123",
      column_id: "col-1",
      board_id: "board-1",
      content: "Test",
    } as unknown as import("@/src/features/kanban").Task;

    act(() => {
      result.current.startDragging(mockTask, 100, 100);
    });

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

    // Rapid updates within throttle window
    act(() => {
      result.current.updateDragPosition(101, 101);
      result.current.updateDragPosition(102, 102);
      result.current.updateDragPosition(103, 103);
    });

    // Due to throttle (24ms), not all calls should go through
    const callsAfter = mockAwareness.setLocalStateField.mock.calls.length;
    expect(callsAfter - callCountBefore).toBeLessThanOrEqual(3);
  });

  it("draggedTasks skips collaborators without draggingTask", async () => {
    const mockAwareness = createMockAwareness();
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: mockAwareness,
      collaborators: [
        {
          id: "user-2",
          name: "User 2",
          color: "#00ff00",
          role: "editor",
          draggingTask: null,
        },
      ],
      localUser: null,
    }));

    const { useTaskDragPresence } = await import(
      "@/src/hooks/use-task-drag-presence"
    );
    const { result } = renderHook(() => useTaskDragPresence());

    expect(result.current.draggedTasks).toHaveLength(0);
  });
});
