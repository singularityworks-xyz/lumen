import { GlobalRegistrator } from "@happy-dom/global-registrator";

try {
  GlobalRegistrator.register();
} catch {
  /* ignore */
}

import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";

const mockCollaborators = [
  {
    id: "user-1",
    name: "User 1",
    color: "#ff0000",
    role: "editor" as const,
    openDialogs: [{ id: "dialog-1", type: "task-dialog", targetId: "task-1" }],
  },
] as any;

const mockUpdateOpenDialogs = mock(() => undefined) as any;

const mockUseCollaboration = mock(() => ({
  isCollaborating: false,
  awareness: null,
  collaborators: [],
  localUser: null,
  updateOpenDialogs: mockUpdateOpenDialogs,
})) as any;

mock.module("@/src/features/collab", () => ({
  useCollaboration: mockUseCollaboration,
}));

describe("use-dialog-presence", () => {
  it("registers local dialog focus", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: null,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresence } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() => useDialogPresence());

    act(() => {
      result.current.registerDialogFocus({
        id: "dialog-1",
        type: "task-dialog",
        targetId: "task-1",
      });
    });

    expect(mockUpdateFn).toHaveBeenCalledWith([
      { id: "dialog-1", type: "task-dialog", targetId: "task-1" },
    ]);
  });

  it("unregisters local dialog focus", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: null,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresence } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() => useDialogPresence());

    act(() => {
      result.current.clearDialogFocus();
    });

    expect(mockUpdateFn).toHaveBeenCalledWith([]);
  });

  it("finds collaborator with specific dialog open", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: null,
      collaborators: mockCollaborators,
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresence } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() => useDialogPresence());

    const collaborator = result.current.getDialogCollaborator("dialog-1");
    expect(collaborator?.id).toBe("user-1");
  });

  it("returns undefined when no collaborator has dialog", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: null,
      collaborators: mockCollaborators,
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresence } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() => useDialogPresence());

    const collaborator = result.current.getDialogCollaborator("nonexistent");
    expect(collaborator).toBeUndefined();
  });

  it("stale local ownership does not block remote close events", async () => {
    const staleCollaborator = [
      {
        id: "user-stale",
        name: "Stale User",
        color: "#00ff00",
        role: "editor" as const,
        openDialogs: [],
      },
    ];
    const mockUpdateFn = mock(() => undefined);

    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: null,
      collaborators: staleCollaborator,
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresence } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() => useDialogPresence());

    const collaborator = result.current.getDialogCollaborator("dialog-1");
    expect(collaborator).toBeUndefined();
  });

  it("returns collaborators with dialogs", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: null,
      collaborators: mockCollaborators,
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresence } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() => useDialogPresence());

    expect(result.current.collaboratorsWithDialogs).toHaveLength(1);
  });

  it("does nothing when not collaborating", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: false,
      awareness: null,
      collaborators: [],
      localUser: null,
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresence } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() => useDialogPresence());

    act(() => {
      result.current.registerDialogFocus({
        id: "dialog-1",
        type: "task-dialog",
        targetId: "task-1",
      });
    });

    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("getTargetDialogCollaborator finds collaborator by targetId", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: null,
      collaborators: mockCollaborators,
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresence } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() => useDialogPresence());

    const collaborator = result.current.getTargetDialogCollaborator("task-1");
    expect(collaborator?.id).toBe("user-1");
  });

  it("getTargetDialogCollaborator returns undefined when not collaborating", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: false,
      awareness: null,
      collaborators: [],
      localUser: null,
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresence } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() => useDialogPresence());

    const collaborator = result.current.getTargetDialogCollaborator("task-1");
    expect(collaborator).toBeUndefined();
  });

  it("getDialogCollaborator returns undefined when not collaborating", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: false,
      awareness: null,
      collaborators: [],
      localUser: null,
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresence } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() => useDialogPresence());

    const collaborator = result.current.getDialogCollaborator("dialog-1");
    expect(collaborator).toBeUndefined();
  });

  it("collaboratorsWithDialogs returns empty when not collaborating", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: false,
      awareness: null,
      collaborators: mockCollaborators,
      localUser: null,
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresence } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() => useDialogPresence());

    expect(result.current.collaboratorsWithDialogs).toHaveLength(0);
  });

  it("clearDialogFocus does nothing when not collaborating", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: false,
      awareness: null,
      collaborators: [],
      localUser: null,
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresence } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() => useDialogPresence());

    act(() => {
      result.current.clearDialogFocus();
    });

    expect(mockUpdateFn).not.toHaveBeenCalled();
  });
});

describe("useDialogPresenceLifecycle", () => {
  it("returns dialog collaborator when collaborating", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: null,
      collaborators: mockCollaborators,
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresenceLifecycle } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() =>
      useDialogPresenceLifecycle("dialog-1", "task-dialog", "task-1")
    );

    expect(result.current.dialogCollaborator?.id).toBe("user-1");
    expect(result.current.isCollaborating).toBe(true);
  });

  it("returns undefined dialogCollaborator when not collaborating", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: false,
      awareness: null,
      collaborators: [],
      localUser: null,
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresenceLifecycle } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() =>
      useDialogPresenceLifecycle("dialog-1", "task-dialog", "task-1")
    );

    expect(result.current.dialogCollaborator).toBeUndefined();
    expect(result.current.isCollaborating).toBe(false);
  });

  it("handleDialogPointerDown updates open dialogs when collaborating", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: null,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresenceLifecycle } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() =>
      useDialogPresenceLifecycle("dialog-1", "task-dialog", "task-1")
    );

    act(() => {
      result.current.handleDialogPointerDown();
    });

    expect(mockUpdateFn).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "dialog-1",
        type: "task-dialog",
        targetId: "task-1",
      }),
    ]);
  });

  it("handleDialogPointerDown does nothing when not collaborating", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: false,
      awareness: null,
      collaborators: [],
      localUser: null,
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresenceLifecycle } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { result } = renderHook(() =>
      useDialogPresenceLifecycle("dialog-1", "task-dialog", "task-1")
    );

    act(() => {
      result.current.handleDialogPointerDown();
    });

    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it("auto-registers on mount when option is set", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: null,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresenceLifecycle } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    renderHook(() =>
      useDialogPresenceLifecycle("dialog-1", "task-dialog", "task-1", {
        autoRegisterOnMount: true,
      })
    );

    expect(mockUpdateFn).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "dialog-1",
        type: "task-dialog",
        targetId: "task-1",
      }),
    ]);
  });

  it("does not auto-register when option is false", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: null,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresenceLifecycle } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    renderHook(() =>
      useDialogPresenceLifecycle("dialog-1", "task-dialog", "task-1", {
        autoRegisterOnMount: false,
      })
    );

    // Should not be called for auto-registration (only called during cleanup if registered)
    const autoRegisterCalls = mockUpdateFn.mock.calls.filter(
      (call: any[]) =>
        call[0] &&
        Array.isArray(call[0]) &&
        call[0].length > 0 &&
        call[0][0]?.id === "dialog-1"
    );
    expect(autoRegisterCalls).toHaveLength(0);
  });

  it("cleans up on unmount when registered", async () => {
    const mockUpdateFn = mock(() => undefined);
    mockUseCollaboration.mockImplementation(() => ({
      isCollaborating: true,
      awareness: null,
      collaborators: [],
      localUser: {
        id: "local-user",
        name: "Local",
        color: "#fff",
        role: "editor",
      },
      updateOpenDialogs: mockUpdateFn,
    }));

    const { useDialogPresenceLifecycle } = await import(
      "@/src/hooks/use-dialog-presence"
    );
    const { unmount } = renderHook(() =>
      useDialogPresenceLifecycle("dialog-1", "task-dialog", "task-1", {
        autoRegisterOnMount: true,
      })
    );

    mockUpdateFn.mockClear();
    unmount();

    expect(mockUpdateFn).toHaveBeenCalledWith([]);
  });
});
