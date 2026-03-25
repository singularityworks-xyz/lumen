import { describe, expect, it } from "bun:test";
import {
  generateLocalTitle,
  shouldGenerateLocalTitle,
} from "./local-title-generator";

describe("local-title-generator", () => {
  describe("stop-word handling", () => {
    it("filters out stop words from title", () => {
      const result = generateLocalTitle("the quick brown fox");
      expect(result).not.toContain("the");
      expect(result).toContain("Quick");
      expect(result).toContain("Brown");
      expect(result).toContain("Fox");
    });

    it("filters stop words from message content", () => {
      const result = generateLocalTitle("the task");
      expect(result).not.toContain("the");
    });

    it("filters common stop words in middle", () => {
      const result = generateLocalTitle("make a new task for project");
      expect(result).toContain("Making");
      expect(result).toContain("New");
      expect(result).toContain("Task");
      expect(result).toContain("Project");
      expect(result).not.toContain(" for ");
    });
  });

  describe("capitalization rules", () => {
    it("applies title case to non-stop-words", () => {
      const result = generateLocalTitle("create awesome feature");
      expect(result).toBe("Creating Awesome Feature");
    });

    it("capitalizes all extracted keywords", () => {
      const result = generateLocalTitle("project on the moon");
      expect(result).toBe("Project Moon");
    });

    it("capitalizes first word always", () => {
      const result = generateLocalTitle("make something");
      expect(result).toBe("Making Something");
    });
  });

  describe("assistant/system text handling", () => {
    it("extracts meaningful keywords from assistant responses", () => {
      const result = generateLocalTitle("Sure, I'll create a new feature");
      expect(result).toContain("Create");
      expect(result).toContain("New");
      expect(result).toContain("Feature");
    });

    it("extracts keywords from common patterns", () => {
      const result = generateLocalTitle("Here is a list of tasks");
      expect(result).toContain("List");
      expect(result).toContain("Tasks");
    });
  });

  describe("fallback handling", () => {
    it("returns default for empty input", () => {
      const result = generateLocalTitle("");
      expect(result).toBe("New Conversation");
    });

    it("returns default for whitespace-only input", () => {
      const result = generateLocalTitle("   ");
      expect(result).toBe("New Conversation");
    });

    it("falls back to original words when all are stop words", () => {
      const result = generateLocalTitle("the a an");
      expect(result).toBe("The a an");
    });

    it("truncates long titles", () => {
      const longInput =
        "abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz";
      const result = generateLocalTitle(longInput);
      expect(result.length).toBeLessThanOrEqual(43);
      expect(result.endsWith("...")).toBe(true);
    });
  });

  describe("action patterns", () => {
    it("applies create action prefix", () => {
      const result = generateLocalTitle("create a new dashboard");
      expect(result).toStartWith("Creating");
    });

    it("applies delete action prefix", () => {
      const result = generateLocalTitle("delete old files");
      expect(result).toStartWith("Deleting");
    });

    it("applies update action prefix", () => {
      const result = generateLocalTitle("update the settings");
      expect(result).toStartWith("Updating");
    });

    it("applies organize action prefix", () => {
      const result = generateLocalTitle("organize my tasks");
      expect(result).toStartWith("Organizing");
    });
  });

  describe("shouldGenerateLocalTitle", () => {
    it("returns false when title already exists", () => {
      expect(shouldGenerateLocalTitle(5, "Existing Title")).toBe(false);
    });

    it("returns false with only 1 message", () => {
      expect(shouldGenerateLocalTitle(1, null)).toBe(false);
    });

    it("returns true with 2+ messages and no title", () => {
      expect(shouldGenerateLocalTitle(2, null)).toBe(true);
      expect(shouldGenerateLocalTitle(5, null)).toBe(true);
    });
  });
});

declare global {
  interface String {
    toStartWith(prefix: string): boolean;
  }
}

String.prototype.toStartWith = function (prefix: string): boolean {
  return this.startsWith(prefix);
};
