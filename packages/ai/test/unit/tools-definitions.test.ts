import { describe, expect, it } from "bun:test";
import {
  actionTools,
  allTools,
  getSafeTools,
  getToolsByCategory,
  queryTools,
  requiresConfirmation,
  toolMetadata,
} from "../../src/tools/definitions";

describe("toolMetadata", () => {
  const allMetadataEntries = Object.entries(toolMetadata);

  it("every query tool has category 'query' and destructive 'none'", () => {
    for (const [_name, meta] of allMetadataEntries) {
      if (meta.category === "query") {
        expect(meta.destructive).toBe("none");
        expect(meta.requiresConfirmation).toBe(false);
      }
    }
  });

  it("every tool with destructive 'high' requires confirmation", () => {
    for (const [_name, meta] of allMetadataEntries) {
      if (meta.destructive === "high") {
        expect(meta.requiresConfirmation).toBe(true);
      }
    }
  });

  it("no destructive 'none' tool requires confirmation", () => {
    for (const [_name, meta] of allMetadataEntries) {
      if (meta.destructive === "none") {
        expect(meta.requiresConfirmation).toBe(false);
      }
    }
  });

  it("deleteTask, deleteBoard, and bulkDeleteTasks are high-destructive and require confirmation", () => {
    const destructive = ["deleteTask", "deleteBoard", "bulkDeleteTasks"];
    for (const name of destructive) {
      const meta = toolMetadata[name as keyof typeof toolMetadata];
      expect(meta.destructive).toBe("high");
      expect(meta.requiresConfirmation).toBe(true);
      expect(meta.category).toBe("action");
    }
  });

  it("all tools have non-empty descriptions", () => {
    for (const [_name, meta] of allMetadataEntries) {
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });
});

describe("queryTools and actionTools collections", () => {
  it("queryTools contains exactly 5 read-only tools", () => {
    const names = Object.keys(queryTools);
    expect(names).toHaveLength(5);
    expect(names).toContain("getWorkspaceOverview");
    expect(names).toContain("getBoardDetails");
    expect(names).toContain("getTaskDetails");
    expect(names).toContain("searchTasks");
    expect(names).toContain("getRecentActivity");
  });

  it("actionTools contains exactly 10 action tools", () => {
    const names = Object.keys(actionTools);
    expect(names).toHaveLength(10);
    expect(names).toContain("createTask");
    expect(names).toContain("updateTask");
    expect(names).toContain("deleteTask");
    expect(names).toContain("moveTask");
    expect(names).toContain("createBoard");
    expect(names).toContain("updateBoard");
    expect(names).toContain("deleteBoard");
    expect(names).toContain("createColumn");
    expect(names).toContain("bulkUpdateTasks");
    expect(names).toContain("bulkDeleteTasks");
  });

  it("allTools is the union of queryTools and actionTools with no overlap", () => {
    const queryNames = new Set(Object.keys(queryTools));
    const actionNames = new Set(Object.keys(actionTools));
    const allNames = new Set(Object.keys(allTools));
    expect(allNames.size).toBe(queryNames.size + actionNames.size);
    for (const name of queryNames) {
      expect(allNames).toContain(name);
    }
    for (const name of actionNames) {
      expect(allNames).toContain(name);
    }
  });
});

describe("requiresConfirmation", () => {
  it("returns true for high-destructive tools", () => {
    expect(requiresConfirmation("deleteTask")).toBe(true);
    expect(requiresConfirmation("deleteBoard")).toBe(true);
    expect(requiresConfirmation("bulkDeleteTasks")).toBe(true);
  });

  it("returns false for safe tools", () => {
    expect(requiresConfirmation("getWorkspaceOverview")).toBe(false);
    expect(requiresConfirmation("createTask")).toBe(false);
    expect(requiresConfirmation("updateTask")).toBe(false);
  });

  it("returns false for unknown tool names", () => {
    expect(requiresConfirmation("nonExistentTool")).toBe(false);
  });
});

describe("getToolsByCategory", () => {
  it("returns only query tools when filtering by 'query'", () => {
    const results = getToolsByCategory("query");
    expect(results).toHaveLength(5);
    for (const [name] of results) {
      const meta = toolMetadata[name as keyof typeof toolMetadata];
      expect(meta.category).toBe("query");
    }
  });

  it("returns only action tools when filtering by 'action'", () => {
    const results = getToolsByCategory("action");
    expect(results).toHaveLength(10);
    for (const [name] of results) {
      const meta = toolMetadata[name as keyof typeof toolMetadata];
      expect(meta.category).toBe("action");
    }
  });
});

describe("getSafeTools", () => {
  it("excludes all tools that require confirmation", () => {
    const safe = getSafeTools();
    const names = safe.map(([name]) => name);
    expect(names).not.toContain("deleteTask");
    expect(names).not.toContain("deleteBoard");
    expect(names).not.toContain("bulkDeleteTasks");
  });

  it("includes all query tools since none require confirmation", () => {
    const safe = getSafeTools();
    const names = safe.map(([name]) => name);
    expect(names).toContain("getWorkspaceOverview");
    expect(names).toContain("searchTasks");
    expect(names).toContain("getRecentActivity");
  });

  it("includes non-confirmation action tools", () => {
    const safe = getSafeTools();
    const names = safe.map(([name]) => name);
    expect(names).toContain("createTask");
    expect(names).toContain("updateTask");
    expect(names).toContain("moveTask");
  });
});
