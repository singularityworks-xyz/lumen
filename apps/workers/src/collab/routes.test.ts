import { describe, expect, it } from "bun:test";

describe("collabRoutes", () => {
  it("exports an Elysia instance", async () => {
    const mod = await import("./routes");
    expect(mod.collabRoutes).toBeDefined();
  });
});
