import { describe, expect, it } from "bun:test";

describe("authMacro", () => {
  it("exports an Elysia instance with auth macro", async () => {
    const { authMacro } = await import("./auth-macro");
    expect(authMacro).toBeDefined();
    expect(typeof authMacro).toBe("object");
  });

  it("has macro property that is a function", async () => {
    const { authMacro } = await import("./auth-macro");
    expect(authMacro.macro).toBeDefined();
    expect(typeof authMacro.macro).toBe("function");
  });
});
