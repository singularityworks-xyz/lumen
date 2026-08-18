import { describe, expect, it } from "bun:test";
import type { DenormalizedColumn, Task } from "../types";
import {
  calculateColumnHeight,
  calculateContentDimensions,
  calculateInitialBoardDimensions,
  calculateMaxDimensions,
  calculateMinDimensions,
  shouldApplyResize,
} from "./board-resize-rules";

describe("board-resize-rules", () => {
  const createMockTask = (status: Task["status"] = "todo"): Task => ({
    id: `task-${Math.random()}`,
    board_id: "board-1",
    column_id: "col-1",
    title: "Test Task",
    status,
    priority: "medium",
    progress: 0,
    position: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: "user-1",
  });

  const createMockColumn = (tasks: Task[] = []): DenormalizedColumn => ({
    id: "col-1",
    name: "Test Column",
    tasks,
    icon: undefined,
    accentColor: undefined,
    position: 0,
    board_id: "board-1",
  });

  describe("initial and content dimension calculations", () => {
    it("calculateInitialBoardDimensions returns deterministic dimensions for 0 columns", () => {
      const result1 = calculateInitialBoardDimensions(0);
      const result2 = calculateInitialBoardDimensions(0);
      expect(result1).toEqual(result2);
    });

    it("calculateInitialBoardDimensions returns deterministic dimensions for 3 columns", () => {
      const result1 = calculateInitialBoardDimensions(3);
      const result2 = calculateInitialBoardDimensions(3);
      expect(result1).toEqual(result2);
      expect(result1.width).toBe(result2.width);
      expect(result1.height).toBe(result2.height);
    });

    it("calculateContentDimensions returns deterministic dimensions for same column set", () => {
      const columns = [createMockColumn()];
      const result1 = calculateContentDimensions(columns);
      const result2 = calculateContentDimensions(columns);
      expect(result1).toEqual(result2);
      expect(result1.width).toBe(result2.width);
      expect(result1.height).toBe(result2.height);
    });

    it("calculateMinDimensions returns deterministic minimum dimensions", () => {
      const dims1 = calculateMinDimensions();
      const dims2 = calculateMinDimensions();
      expect(dims1).toEqual(dims2);
    });

    it("calculateMaxDimensions returns deterministic dimensions for same column set", () => {
      const columns = [createMockColumn([]), createMockColumn([])];
      const result1 = calculateMaxDimensions(columns);
      const result2 = calculateMaxDimensions(columns);
      expect(result1).toEqual(result2);
    });

    it("calculateColumnHeight returns deterministic height for same column", () => {
      const tasks = [createMockTask("todo"), createMockTask("todo")];
      const column = createMockColumn(tasks);
      const height1 = calculateColumnHeight(column);
      const height2 = calculateColumnHeight(column);
      expect(height1).toBe(height2);
    });
  });

  describe("calculateInitialBoardDimensions", () => {
    it("scales width linearly with column count", () => {
      const dims1 = calculateInitialBoardDimensions(1);
      const dims2 = calculateInitialBoardDimensions(2);
      const dims3 = calculateInitialBoardDimensions(3);
      const width1 = dims1.width;
      const width2 = dims2.width;
      const width3 = dims3.width;
      expect(width2 - width1).toBe(width3 - width2);
    });
  });

  describe("calculateContentDimensions", () => {
    it("increases width when adding columns", () => {
      const oneCol = calculateContentDimensions([createMockColumn()]);
      const twoCols = calculateContentDimensions([
        createMockColumn(),
        createMockColumn(),
      ]);
      expect(twoCols.width).toBeGreaterThan(oneCol.width);
    });

    it("increases height with more todo tasks", () => {
      const emptyCol = createMockColumn([]);
      const tasks = new Array(5).fill(null).map(() => createMockTask("todo"));
      const fullCol = createMockColumn(tasks);
      const emptyDims = calculateContentDimensions([emptyCol]);
      const fullDims = calculateContentDimensions([fullCol]);
      expect(fullDims.height).toBeGreaterThan(emptyDims.height);
    });

    it("uses tallest column for height calculation", () => {
      const shortCol = createMockColumn([
        createMockTask("todo"),
        createMockTask("todo"),
      ]);
      const tallCol = createMockColumn([
        createMockTask("todo"),
        createMockTask("todo"),
        createMockTask("todo"),
        createMockTask("todo"),
        createMockTask("todo"),
      ]);
      const dims = calculateContentDimensions([shortCol, tallCol]);
      const tallColHeight = calculateColumnHeight(tallCol);
      expect(dims.height).toBe(tallColHeight + 66);
    });
  });

  describe("calculateMinDimensions", () => {
    it("has positive width and height", () => {
      const dims = calculateMinDimensions();
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    });
  });

  describe("calculateMaxDimensions", () => {
    it("scales width with column count", () => {
      const oneCol = calculateMaxDimensions([createMockColumn([])]);
      const twoCols = calculateMaxDimensions([
        createMockColumn([]),
        createMockColumn([]),
      ]);
      expect(twoCols.width).toBeGreaterThan(oneCol.width);
    });

    it("considers task count in height calculation", () => {
      const noTasks = calculateMaxDimensions([createMockColumn([])]);
      const withTasks = calculateMaxDimensions([
        createMockColumn([createMockTask("todo"), createMockTask("todo")]),
      ]);
      expect(withTasks.height).toBeGreaterThan(noTasks.height);
    });
  });

  describe("calculateColumnHeight", () => {
    it("calculates height for todo tasks only", () => {
      const column = createMockColumn([
        createMockTask("todo"),
        createMockTask("done"),
        createMockTask("todo"),
        createMockTask("trash"),
      ]);
      const height = calculateColumnHeight(column, true);
      const expected = 56 + 24 + 2 * 120 + 1 * 8 + 48;
      expect(height).toBe(expected);
    });

    it("excludes footer when includeFooter is false", () => {
      const column = createMockColumn([createMockTask("todo")]);
      const withFooter = calculateColumnHeight(column, true);
      const withoutFooter = calculateColumnHeight(column, false);
      expect(withoutFooter).toBe(withFooter - 48);
    });

    it("uses placeholder height for empty column", () => {
      const column = createMockColumn([]);
      const height = calculateColumnHeight(column, false);
      expect(height).toBe(56 + 24 + 160);
    });
  });

  describe("width/height rules do not regress across column count changes", () => {
    it("initial dimensions scale predictably with column count", () => {
      const counts = [1, 2, 3, 4, 5];
      const widths = counts.map(
        (c) => calculateInitialBoardDimensions(c).width
      );
      for (let i = 1; i < widths.length; i++) {
        const diff = widths[i]! - widths[i - 1]!;
        expect(diff).toBe(297);
      }
    });

    it("content dimensions increase with column count", () => {
      const counts = [1, 2, 3];
      const widths = counts.map((c) => {
        const cols = new Array(c).fill(null).map(() => createMockColumn([]));
        return calculateContentDimensions(cols).width;
      });
      expect(widths[1]!).toBeGreaterThan(widths[0]!);
      expect(widths[2]!).toBeGreaterThan(widths[1]!);
    });

    it("max dimensions scale predictably with column count", () => {
      const oneCol = calculateMaxDimensions([createMockColumn([])]);
      const twoCols = calculateMaxDimensions([
        createMockColumn([]),
        createMockColumn([]),
      ]);
      const diff = twoCols.width - oneCol.width;
      expect(diff).toBe(297);
    });

    it("resize decision is deterministic for same inputs", () => {
      const current = { width: 500, height: 400 };
      const content = { width: 300, height: 200 };
      const result1 = shouldApplyResize(current, content, false);
      const result2 = shouldApplyResize(current, content, false);
      expect(result1.shouldResize).toBe(result2.shouldResize);
    });
  });
});
