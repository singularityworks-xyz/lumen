import { GlobalRegistrator } from "@happy-dom/global-registrator";
try { GlobalRegistrator.register(); } catch {}
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
});
