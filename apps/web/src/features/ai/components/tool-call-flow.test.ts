import { describe, expect, it } from "bun:test";

const camelCaseRegex = /([A-Z])/g;
const firstCharRegex = /^./;

const formatToolName = (name: string): string =>
  (name || "")
    .replace(camelCaseRegex, " $1")
    .replace(firstCharRegex, (str) => str.toUpperCase())
    .trim();

const formatOutput = (result: unknown): string => {
  if (result === null || result === undefined) {
    return "No output";
  }
  if (typeof result === "string") {
    return result;
  }
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
};

const getToolCategory = (toolName: string): string => {
  const name = toolName.toLowerCase();
  if (
    name.includes("get") ||
    name.includes("search") ||
    name.includes("find")
  ) {
    return "Searching";
  }
  if (
    name.includes("create") ||
    name.includes("write") ||
    name.includes("update")
  ) {
    return "Executing";
  }
  if (
    name.includes("git") ||
    name.includes("branch") ||
    name.includes("commit")
  ) {
    return "Syncing";
  }
  if (name.includes("read") || name.includes("open") || name.includes("list")) {
    return "Reading";
  }
  return "Processing";
};

const getToolAnimation = (toolName: string) => {
  const name = toolName.toLowerCase();
  if (
    name.includes("get") ||
    name.includes("search") ||
    name.includes("find")
  ) {
    return searchingFrames;
  }
  if (
    name.includes("create") ||
    name.includes("write") ||
    name.includes("update")
  ) {
    return writingFrames;
  }
  if (
    name.includes("git") ||
    name.includes("branch") ||
    name.includes("commit")
  ) {
    return syncingFrames;
  }
  if (name.includes("read") || name.includes("open") || name.includes("list")) {
    return readingFrames;
  }
  return processingFrames;
};

const readingFrames = [
  [0, 7, 14, 21, 28, 35, 42],
  [1, 8, 15, 22, 29, 36, 43],
  [2, 9, 16, 23, 30, 37, 44],
  [3, 10, 17, 24, 31, 38, 45],
  [4, 11, 18, 25, 32, 39, 46],
  [5, 12, 19, 26, 33, 40, 47],
  [6, 13, 20, 27, 34, 41, 48],
];

const writingFrames = [
  [24],
  [17, 23, 25, 31],
  [10, 16, 18, 22, 26, 30, 32, 38],
  [3, 9, 11, 15, 19, 29, 33, 37, 39, 45],
  [2, 4, 8, 12, 14, 20, 28, 34, 36, 40, 44, 46],
  [1, 5, 7, 13, 21, 27, 35, 41, 43, 47],
  [0, 6, 42, 48],
];

const searchingFrames = [
  [24],
  [16, 17, 18],
  [9, 10, 11, 15, 17, 19, 23, 24, 25],
  [
    2, 3, 4, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 28,
    29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 40,
  ],
  [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
    40, 41, 42, 43, 44, 45, 46, 47, 48,
  ],
  [
    2, 3, 4, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 28,
    29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 40,
  ],
  [9, 10, 11, 15, 17, 19, 23, 24, 25],
  [16, 17, 18],
  [24],
];

const syncingFrames = [
  [45, 38, 31, 24, 17, 23, 25],
  [38, 31, 24, 17, 10, 16, 18],
  [31, 24, 17, 10, 3, 9, 11],
  [24, 17, 10, 3, 2, 4],
  [17, 10, 3],
  [10, 3],
  [3],
  [],
  [45],
  [45, 38, 44, 46],
  [45, 38, 31, 37, 39],
  [45, 38, 31, 24, 30, 32],
];

const processingFrames = [
  [24],
  [17, 23, 25, 31],
  [10, 16, 18, 22, 26, 30, 32, 38],
  [3, 9, 11, 15, 19, 29, 33, 37, 39, 45],
  [2, 4, 8, 12, 14, 20, 28, 34, 36, 40, 44, 46],
  [1, 5, 7, 13, 21, 27, 35, 41, 43, 47],
  [0, 6, 42, 48],
  [1, 5, 7, 13, 21, 27, 35, 41, 43, 47],
  [2, 4, 8, 12, 14, 20, 28, 34, 36, 40, 44, 46],
  [3, 9, 11, 15, 19, 29, 33, 37, 39, 45],
  [10, 16, 18, 22, 26, 30, 32, 38],
  [17, 23, 25, 31],
  [24],
];

describe("tool-call-flow utilities", () => {
  describe("formatToolName", () => {
    it("converts camelCase to spaced words", () => {
      expect(formatToolName("createTask")).toBe("Create Task");
      expect(formatToolName("updateBoard")).toBe("Update Board");
      expect(formatToolName("deleteColumn")).toBe("Delete Column");
    });

    it("handles consecutive uppercase letters", () => {
      expect(formatToolName("getURL")).toBe("Get U R L");
      expect(formatToolName("parseXML")).toBe("Parse X M L");
    });

    it("handles single word input", () => {
      expect(formatToolName("create")).toBe("Create");
      expect(formatToolName("delete")).toBe("Delete");
    });

    it("handles empty string", () => {
      expect(formatToolName("")).toBe("");
    });

    it("handles all uppercase acronym", () => {
      expect(formatToolName("getAPIKey")).toBe("Get A P I Key");
    });
  });

  describe("formatOutput", () => {
    it("returns 'No output' for null", () => {
      expect(formatOutput(null)).toBe("No output");
    });

    it("returns 'No output' for undefined", () => {
      expect(formatOutput(undefined)).toBe("No output");
    });

    it("returns string as-is", () => {
      expect(formatOutput("simple string")).toBe("simple string");
    });

    it("formats object as JSON", () => {
      const result = formatOutput({ key: "value", count: 42 });
      expect(result).toBe('{\n  "key": "value",\n  "count": 42\n}');
    });

    it("formats array as JSON", () => {
      const result = formatOutput([1, 2, 3]);
      expect(result).toBe("[\n  1,\n  2,\n  3\n]");
    });

    it("returns String() for objects that throw on JSON.stringify", () => {
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;
      const result = formatOutput(circular);
      expect(result).toBe("[object Object]");
    });

    it("formats nested objects", () => {
      const result = formatOutput({ user: { name: "Test", age: 30 } });
      expect(result).toContain('"user"');
      expect(result).toContain('"name"');
      expect(result).toContain("Test");
    });
  });

  describe("getToolCategory", () => {
    it("returns 'Searching' for get operations", () => {
      expect(getToolCategory("getTask")).toBe("Searching");
      expect(getToolCategory("searchBoards")).toBe("Searching");
      expect(getToolCategory("findTask")).toBe("Searching");
    });

    it("returns 'Executing' for create/write/update operations", () => {
      expect(getToolCategory("createTask")).toBe("Executing");
      expect(getToolCategory("writeBoard")).toBe("Executing");
      expect(getToolCategory("updateColumn")).toBe("Executing");
    });

    it("returns 'Syncing' for git operations (git prefix takes precedence)", () => {
      expect(getToolCategory("gitCommit")).toBe("Syncing");
      expect(getToolCategory("gitBranch")).toBe("Syncing");
    });

    it("returns 'Reading' for read/open/list operations", () => {
      expect(getToolCategory("readFile")).toBe("Reading");
      expect(getToolCategory("openDocument")).toBe("Reading");
      expect(getToolCategory("listTasks")).toBe("Reading");
    });

    it("returns 'Processing' for unknown operations", () => {
      expect(getToolCategory("unknownAction")).toBe("Processing");
      expect(getToolCategory("customTool")).toBe("Processing");
    });

    it("is case insensitive", () => {
      expect(getToolCategory("GETTask")).toBe("Searching");
      expect(getToolCategory("CREATETask")).toBe("Executing");
    });
  });

  describe("getToolAnimation", () => {
    it("returns searchingFrames for search operations", () => {
      expect(getToolAnimation("getTask")).toBe(searchingFrames);
      expect(getToolAnimation("searchBoards")).toBe(searchingFrames);
      expect(getToolAnimation("findTask")).toBe(searchingFrames);
    });

    it("returns writingFrames for create/write/update operations", () => {
      expect(getToolAnimation("createTask")).toBe(writingFrames);
      expect(getToolAnimation("writeBoard")).toBe(writingFrames);
      expect(getToolAnimation("updateColumn")).toBe(writingFrames);
    });

    it("returns syncingFrames for git operations (git prefix takes precedence)", () => {
      expect(getToolAnimation("gitCommit")).toBe(syncingFrames);
      expect(getToolAnimation("gitBranch")).toBe(syncingFrames);
    });

    it("returns readingFrames for read/open/list operations", () => {
      expect(getToolAnimation("readFile")).toBe(readingFrames);
      expect(getToolAnimation("openDocument")).toBe(readingFrames);
      expect(getToolAnimation("listTasks")).toBe(readingFrames);
    });

    it("returns processingFrames for unknown operations", () => {
      expect(getToolAnimation("unknownAction")).toBe(processingFrames);
      expect(getToolAnimation("customTool")).toBe(processingFrames);
    });
  });
});
