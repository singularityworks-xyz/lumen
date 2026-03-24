import { describe, expect, it } from "bun:test";
import { toHeaders } from "./headers";

describe("toHeaders", () => {
  it("creates Headers from record", () => {
    const result = toHeaders({
      "Content-Type": "application/json",
      Authorization: "Bearer token",
    });

    expect(result).toBeInstanceOf(Headers);
    expect(result.get("content-type")).toBe("application/json");
    expect(result.get("authorization")).toBe("Bearer token");
  });

  it("skips null values", () => {
    const result = toHeaders({ "X-Valid": "yes", "X-Null": null });

    expect(result.get("x-valid")).toBe("yes");
    expect(result.has("x-null")).toBe(false);
  });

  it("skips undefined values", () => {
    const result = toHeaders({ "X-Valid": "yes", "X-Undefined": undefined });

    expect(result.get("x-valid")).toBe("yes");
    expect(result.has("x-undefined")).toBe(false);
  });

  it("handles empty record", () => {
    const result = toHeaders({});

    expect(result).toBeInstanceOf(Headers);
    expect([...result.entries()]).toEqual([]);
  });

  it("skips empty string values", () => {
    const result = toHeaders({ "X-Valid": "yes", "X-Empty": "" });

    expect(result.get("x-valid")).toBe("yes");
    expect(result.has("x-empty")).toBe(false);
  });
});
