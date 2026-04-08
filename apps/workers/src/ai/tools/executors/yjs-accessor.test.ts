import { describe, expect, it } from "bun:test";

describe("getWorkspaceYjsDoc", () => {
  describe("function exists and is importable", () => {
    it("is a function", async () => {
      const { getWorkspaceYjsDoc } = await import("./yjs-accessor");
      expect(typeof getWorkspaceYjsDoc).toBe("function");
    });
  });
});
