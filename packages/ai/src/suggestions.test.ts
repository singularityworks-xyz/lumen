import { describe, expect, it } from "bun:test";
import {
  BOARD_SUGGESTIONS,
  type ContextualSuggestion,
  GENERAL_SUGGESTIONS,
  getSuggestionsForContext,
  TASK_SUGGESTIONS,
  WORKSPACE_SUGGESTIONS,
} from "./types/suggestions";

function assertSuggestionShape(s: ContextualSuggestion) {
  expect(typeof s.id).toBe("string");
  expect(s.id.length).toBeGreaterThan(0);
  expect(typeof s.label).toBe("string");
  expect(s.label.length).toBeGreaterThan(0);
  expect(typeof s.prompt).toBe("string");
  expect(s.prompt.length).toBeGreaterThan(0);
  expect(["workspace", "board", "task", "general"]).toContain(s.category);
}

describe("suggestion constants", () => {
  it("WORKSPACE_SUGGESTIONS has exactly 3 items", () => {
    expect(WORKSPACE_SUGGESTIONS).toHaveLength(3);
    for (const s of WORKSPACE_SUGGESTIONS) {
      assertSuggestionShape(s);
      expect(s.category).toBe("workspace");
    }
  });

  it("BOARD_SUGGESTIONS has exactly 3 items", () => {
    expect(BOARD_SUGGESTIONS).toHaveLength(3);
    for (const s of BOARD_SUGGESTIONS) {
      assertSuggestionShape(s);
      expect(s.category).toBe("board");
    }
  });

  it("TASK_SUGGESTIONS has exactly 2 items", () => {
    expect(TASK_SUGGESTIONS).toHaveLength(2);
    for (const s of TASK_SUGGESTIONS) {
      assertSuggestionShape(s);
      expect(s.category).toBe("task");
    }
  });

  it("GENERAL_SUGGESTIONS has exactly 2 items", () => {
    expect(GENERAL_SUGGESTIONS).toHaveLength(2);
    for (const s of GENERAL_SUGGESTIONS) {
      assertSuggestionShape(s);
      expect(s.category).toBe("general");
    }
  });

  it("all suggestion IDs are unique across categories", () => {
    const all = [
      ...WORKSPACE_SUGGESTIONS,
      ...BOARD_SUGGESTIONS,
      ...TASK_SUGGESTIONS,
      ...GENERAL_SUGGESTIONS,
    ];
    const ids = all.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getSuggestionsForContext", () => {
  it("returns general + workspace suggestions when no board or tasks selected", () => {
    const result = getSuggestionsForContext({
      currentBoardId: null,
      selectedTaskIds: [],
    });
    expect(result.length).toBeLessThanOrEqual(4);
    const categories = result.map((s) => s.category);
    expect(categories).toContain("general");
    expect(categories).toContain("workspace");
    expect(categories).not.toContain("board");
    expect(categories).not.toContain("task");
  });

  it("returns general + board suggestions when a board is selected but no tasks", () => {
    const result = getSuggestionsForContext({
      currentBoardId: "board-1",
      selectedTaskIds: [],
    });
    expect(result.length).toBeLessThanOrEqual(4);
    const categories = result.map((s) => s.category);
    expect(categories).toContain("general");
    expect(categories).toContain("board");
    expect(categories).not.toContain("workspace");
    expect(categories).not.toContain("task");
  });

  it("returns general + task suggestions when tasks are selected but no board", () => {
    const result = getSuggestionsForContext({
      currentBoardId: null,
      selectedTaskIds: ["task-1"],
    });
    expect(result.length).toBeLessThanOrEqual(4);
    const categories = result.map((s) => s.category);
    expect(categories).toContain("general");
    expect(categories).toContain("task");
    expect(categories).not.toContain("workspace");
  });

  it("includes board and task categories when both board and tasks are selected", () => {
    const result = getSuggestionsForContext({
      currentBoardId: "board-1",
      selectedTaskIds: ["task-1", "task-2"],
    });
    expect(result.length).toBeLessThanOrEqual(4);
    const categories = result.map((s) => s.category);
    expect(categories).toContain("general");
    expect(categories).toContain("board");
    expect(categories).not.toContain("workspace");
  });

  it("never returns more than 4 suggestions regardless of context", () => {
    const contexts = [
      { currentBoardId: null, selectedTaskIds: [] },
      { currentBoardId: "b1", selectedTaskIds: [] },
      { currentBoardId: null, selectedTaskIds: ["t1"] },
      { currentBoardId: "b1", selectedTaskIds: ["t1", "t2"] },
    ];
    for (const ctx of contexts) {
      const result = getSuggestionsForContext(ctx);
      expect(result.length).toBeLessThanOrEqual(4);
    }
  });

  it("every returned suggestion has a valid shape", () => {
    const result = getSuggestionsForContext({
      currentBoardId: "b1",
      selectedTaskIds: ["t1"],
    });
    for (const s of result) {
      assertSuggestionShape(s);
    }
  });

  it("builds the expected pool for workspace context (5 items)", () => {
    const result = getSuggestionsForContext({
      currentBoardId: null,
      selectedTaskIds: [],
    });
    expect(result).toHaveLength(4);
    const ids = result.map((s) => s.id);
    expect(ids).toContain("help");
    expect(ids).toContain("create-task");
  });

  it("builds the expected pool for board context (5 items)", () => {
    const result = getSuggestionsForContext({
      currentBoardId: "b1",
      selectedTaskIds: [],
    });
    expect(result).toHaveLength(4);
    const ids = result.map((s) => s.id);
    expect(ids).toContain("help");
    expect(ids).toContain("create-task");
    expect(ids.some((id) => BOARD_SUGGESTIONS.find((s) => s.id === id))).toBe(
      true
    );
  });
});
