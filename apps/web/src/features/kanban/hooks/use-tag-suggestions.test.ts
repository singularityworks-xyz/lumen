import { describe, expect, it } from "bun:test";

// Test the pure tag suggestion scoring algorithm.
// The hook wraps this in useMemo with store access.

interface Task {
  board_id: string;
  column_id: string;
  id: string;
  tags?: string[];
}

function computeTagSuggestions(
  tasks: { allIds: string[]; byId: Record<string, Task> },
  boardId: string,
  columnId: string,
  currentTags: string[] = []
): string[] {
  const usageCount: Record<string, number> = {};
  const inColumn = new Set<string>();
  const existingTags = new Set(currentTags);

  for (const taskId of tasks.allIds) {
    const task = tasks.byId[taskId];
    if (task?.board_id === boardId && task.tags) {
      for (const tag of task.tags) {
        usageCount[tag] = (usageCount[tag] || 0) + 1;
        if (task.column_id === columnId) {
          inColumn.add(tag);
        }
      }
    }
  }

  const scoredTags = Object.keys(usageCount)
    .filter((tag) => !existingTags.has(tag))
    .map((tag) => {
      const score = (inColumn.has(tag) ? 10_000 : 0) + (usageCount[tag] ?? 0);
      return { tag, score };
    });

  scoredTags.sort((a, b) => b.score - a.score);

  return scoredTags.map((item) => item.tag);
}

describe("tag suggestions algorithm", () => {
  const tasks = {
    allIds: ["t1", "t2", "t3", "t4"],
    byId: {
      t1: {
        id: "t1",
        board_id: "board-1",
        column_id: "col-1",
        tags: ["bug", "frontend"],
      },
      t2: {
        id: "t2",
        board_id: "board-1",
        column_id: "col-1",
        tags: ["bug", "urgent"],
      },
      t3: {
        id: "t3",
        board_id: "board-1",
        column_id: "col-2",
        tags: ["backend", "bug"],
      },
      t4: {
        id: "t4",
        board_id: "board-2",
        column_id: "col-3",
        tags: ["infra"],
      },
    } as Record<string, Task>,
  };

  it("returns tags sorted by column-locality then frequency", () => {
    const result = computeTagSuggestions(tasks, "board-1", "col-1");

    // "bug" is in col-1 (10000 + 3 = 10003) → first
    // "frontend" is in col-1 (10000 + 1 = 10001) → second
    // "urgent" is in col-1 (10000 + 1 = 10001) → tied with frontend
    // "backend" is not in col-1 (0 + 1 = 1) → last
    expect(result[0]).toBe("bug");
    expect(result).toContain("frontend");
    expect(result).toContain("urgent");
    expect(result.at(-1)).toBe("backend");
  });

  it("excludes currently applied tags", () => {
    const result = computeTagSuggestions(tasks, "board-1", "col-1", ["bug"]);

    expect(result).not.toContain("bug");
    expect(result).toContain("frontend");
  });

  it("excludes tags from other boards", () => {
    const result = computeTagSuggestions(tasks, "board-1", "col-1");

    expect(result).not.toContain("infra"); // infra is on board-2
  });

  it("returns empty for board with no tags", () => {
    const result = computeTagSuggestions(tasks, "board-nonexistent", "col-1");
    expect(result).toHaveLength(0);
  });

  it("returns empty when all tags are already applied", () => {
    const result = computeTagSuggestions(tasks, "board-1", "col-1", [
      "bug",
      "frontend",
      "urgent",
      "backend",
    ]);
    expect(result).toHaveLength(0);
  });

  it("handles tasks without tags", () => {
    const tasksWithNoTags = {
      allIds: ["t1"],
      byId: {
        t1: { id: "t1", board_id: "board-1", column_id: "col-1" },
      } as Record<string, Task>,
    };

    const result = computeTagSuggestions(tasksWithNoTags, "board-1", "col-1");
    expect(result).toHaveLength(0);
  });

  it("prioritizes column-local tags over globally frequent tags", () => {
    const localTasks = {
      allIds: ["t1", "t2", "t3", "t4", "t5"],
      byId: {
        t1: {
          id: "t1",
          board_id: "b1",
          column_id: "col-target",
          tags: ["rare-local"],
        },
        t2: {
          id: "t2",
          board_id: "b1",
          column_id: "col-other",
          tags: ["popular"],
        },
        t3: {
          id: "t3",
          board_id: "b1",
          column_id: "col-other",
          tags: ["popular"],
        },
        t4: {
          id: "t4",
          board_id: "b1",
          column_id: "col-other",
          tags: ["popular"],
        },
        t5: {
          id: "t5",
          board_id: "b1",
          column_id: "col-other",
          tags: ["popular"],
        },
      } as Record<string, Task>,
    };

    const result = computeTagSuggestions(localTasks, "b1", "col-target");
    // rare-local: 10000 + 1 = 10001
    // popular: 0 + 4 = 4
    expect(result[0]).toBe("rare-local");
    expect(result[1]).toBe("popular");
  });
});
