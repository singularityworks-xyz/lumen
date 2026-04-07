import { describe, expect, it } from "bun:test";

describe("aiRoutes", () => {
  it("exports an Elysia instance with routes", async () => {
    const mod = await import("./routes");
    expect(mod.aiRoutes).toBeDefined();
  });
});
