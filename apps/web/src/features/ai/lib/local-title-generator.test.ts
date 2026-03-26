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

    it("does not capitalize stop words in middle positions", () => {
      const result = generateLocalTitle("the quick brown fox");
      const words = result.split(" ");
      const theIndex = words.findIndex(
        (w) => w.toLowerCase() === "the" && words.indexOf(w) > 0
      );
      expect(theIndex).toBe(-1);
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

    it("does not capitalize stop words in middle positions", () => {
      const result = generateLocalTitle("the quick brown fox");
      const words = result.split(" ");
      const theIndex = words.findIndex(
        (w) => w.toLowerCase() === "the" && words.indexOf(w) > 0
      );
      expect(theIndex).toBe(-1);
    });
  });

  describe("noisy assistant/system text handling", () => {
    it("processes assistant prefix through keyword extraction", () => {
      const result = generateLocalTitle(
        "Assistant: Sure, I'll help you create a feature"
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toBe("New Conversation");
    });

    it("processes system prefix through keyword extraction", () => {
      const result = generateLocalTitle("System: User wants to add a task");
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toBe("New Conversation");
    });

    it("extracts keywords from noisy input", () => {
      const result = generateLocalTitle(
        "Assistant: I understand you want me to update the profile settings"
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toBe("New Conversation");
    });

    it("handles common assistant response patterns", () => {
      const result = generateLocalTitle(
        "Sure! I'd be happy to help you organize your tasks"
      );
      expect(result.length).toBeGreaterThan(0);
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
      expect(result).not.toBe("New Conversation");
      expect(result.length).toBeGreaterThan(0);
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
      expect(result.startsWith("Creating")).toBe(true);
    });

    it("applies delete action prefix", () => {
      const result = generateLocalTitle("delete old files");
      expect(result.startsWith("Deleting")).toBe(true);
    });

    it("applies update action prefix", () => {
      const result = generateLocalTitle("update the settings");
      expect(result.startsWith("Updating")).toBe(true);
    });

    it("applies organize action prefix", () => {
      const result = generateLocalTitle("organize my tasks");
      expect(result.startsWith("Organizing")).toBe(true);
    });

    it("applies add action prefix", () => {
      const result = generateLocalTitle("add a new column");
      expect(result.startsWith("Adding")).toBe(true);
    });

    it("applies move action prefix", () => {
      const result = generateLocalTitle("move item to trash");
      expect(result.startsWith("Moving")).toBe(true);
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

    it("returns false when title is empty string", () => {
      expect(shouldGenerateLocalTitle(2, "")).toBe(false);
    });
  });

  describe("title candidate quality", () => {
    it("returns consistent results for same input", () => {
      const input = "create a new feature request";
      const result1 = generateLocalTitle(input);
      const result2 = generateLocalTitle(input);
      expect(result1).toBe(result2);
    });

    it("limits keywords to reasonable count", () => {
      const result = generateLocalTitle(
        "update the project status for the team meeting notes document"
      );
      const wordCount = result.split(" ").length;
      expect(wordCount).toBeLessThanOrEqual(6);
    });
  });
});
