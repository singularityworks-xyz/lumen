import { describe, expect, it } from "bun:test";

describe("authRoutes", () => {
  it("exports an Elysia instance", async () => {
    const mod = await import("./index");
    expect(mod.authRoutes).toBeDefined();
  });
});
