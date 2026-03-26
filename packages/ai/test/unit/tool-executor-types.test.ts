import { describe, expect, it, spyOn } from "bun:test";
import {
  type ExecutorContext,
  getWorkspaceFromSnapshot,
  mapPriority,
  type WorkspaceSnapshot,
} from "../../src/tools/executors/types";

function makeSnapshot(): WorkspaceSnapshot {
  return {
    name: "Test Workspace",
    boards: [
      {
        id: "board-1",
        name: "Board One",
        columns: [
          {
            id: "col-1",
            name: "Todo",
            position: 0,
            tasks: [
              {
                id: "task-1",
                title: "Task 1",
                priority: "high",
                status: "todo",
                progress: 0,
                position: 0,
              },
            ],
          },
        ],
      },
    ],
  };
}

function makeContext(
  overrides: Partial<ExecutorContext> = {}
): ExecutorContext {
  return {
    userId: "user-1",
    workspaceId: "ws-1",
    ...overrides,
  };
}

describe("getWorkspaceFromSnapshot", () => {
  it("returns the snapshot when present in context", () => {
    const snapshot = makeSnapshot();
    const ctx = makeContext({ snapshot });
    const result = getWorkspaceFromSnapshot(ctx);
    expect(result).toBe(snapshot);
    expect(result?.name).toBe("Test Workspace");
    expect(result?.boards).toHaveLength(1);
  });

  it("returns null and warns when snapshot is missing", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => undefined);
    const ctx = makeContext({ snapshot: undefined });
    const result = getWorkspaceFromSnapshot(ctx);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("preserves board structure from snapshot", () => {
    const snapshot = makeSnapshot();
    const ctx = makeContext({ snapshot });
    const result = getWorkspaceFromSnapshot(ctx);
    expect(result?.boards[0].id).toBe("board-1");
    expect(result?.boards[0].columns[0].tasks[0].title).toBe("Task 1");
  });
});

describe("mapPriority", () => {
  it("returns 'medium' when priority is undefined", () => {
    expect(mapPriority(undefined)).toBe("medium");
  });

  it("returns 'medium' for empty string", () => {
    expect(mapPriority("")).toBe("medium");
  });

  it("maps 'urgent' to 'high'", () => {
    expect(mapPriority("urgent")).toBe("high");
  });

  it("passes through 'low' unchanged", () => {
    expect(mapPriority("low")).toBe("low");
  });

  it("passes through 'medium' unchanged", () => {
    expect(mapPriority("medium")).toBe("medium");
  });

  it("passes through 'high' unchanged", () => {
    expect(mapPriority("high")).toBe("high");
  });

  it("returns 'medium' for unknown priority strings", () => {
    expect(mapPriority("critical")).toBe("medium");
    expect(mapPriority("NORMAL")).toBe("medium");
    expect(mapPriority("p0")).toBe("medium");
    expect(mapPriority("1")).toBe("medium");
  });

  it("never returns 'urgent' (normalizes to 'high')", () => {
    const inputs = [
      undefined,
      "",
      "low",
      "medium",
      "high",
      "urgent",
      "critical",
      "p0",
    ];
    for (const input of inputs) {
      expect(mapPriority(input)).not.toBe("urgent");
    }
  });
});
