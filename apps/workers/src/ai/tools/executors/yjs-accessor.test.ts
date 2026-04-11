import { describe, expect, it } from "bun:test";

describe("getWorkspaceYjsDoc", () => {
  it("is a function that returns a Promise", async () => {
    const { getWorkspaceYjsDoc } = await import("./yjs-accessor");
    expect(typeof getWorkspaceYjsDoc).toBe("function");
    const result = getWorkspaceYjsDoc("test-workspace");
    expect(result).toBeInstanceOf(Promise);
    await result;
  });
});
