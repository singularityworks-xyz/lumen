import { describe, expect, it } from "bun:test";
import { deepEquals, diffEntityMaps, shallowDiff } from "./deep-equals";

describe("deepEquals", () => {
  it("returns true for identical primitives", () => {
    expect(deepEquals(1, 1)).toBe(true);
    expect(deepEquals("a", "a")).toBe(true);
    expect(deepEquals(null, null)).toBe(true);
  });

  it("returns false for different primitives", () => {
    expect(deepEquals(1, 2)).toBe(false);
    expect(deepEquals("a", "b")).toBe(false);
  });

  it("returns true for deeply equal objects", () => {
    expect(deepEquals({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });

  it("returns false for objects with different values", () => {
    expect(deepEquals({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it("handles arrays", () => {
    expect(deepEquals([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEquals([1, 2], [1, 2, 3])).toBe(false);
  });

  it("handles key order differences", () => {
    expect(deepEquals({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });
});

describe("shallowDiff", () => {
  it("returns empty set for identical objects", () => {
    const result = shallowDiff({ a: 1, b: 2 }, { a: 1, b: 2 });
    expect(result.size).toBe(0);
  });

  it("returns changed keys", () => {
    const result = shallowDiff({ a: 1, b: 2 }, { a: 1, b: 3 });
    expect(result.has("b")).toBe(true);
    expect(result.has("a")).toBe(false);
  });

  it("detects added keys", () => {
    const result = shallowDiff({ a: 1 } as Record<string, unknown>, {
      a: 1,
      b: 2,
    });
    expect(result.has("b")).toBe(true);
  });

  it("detects removed keys", () => {
    const result = shallowDiff({ a: 1, b: 2 }, { a: 1 } as Record<
      string,
      unknown
    >);
    expect(result.has("b")).toBe(true);
  });
});

describe("diffEntityMaps", () => {
  it("detects added entities", () => {
    const prev = {};
    const next = { "1": { id: "1", name: "a" } };
    const result = diffEntityMaps(prev, next);
    expect(result.added).toEqual([{ id: "1", name: "a" }]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toEqual([]);
  });

  it("detects removed entities", () => {
    const prev = { "1": { id: "1", name: "a" } };
    const next = {};
    const result = diffEntityMaps(prev, next);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual(["1"]);
    expect(result.changed).toEqual([]);
  });

  it("detects changed entities", () => {
    const prev = { "1": { id: "1", name: "a" } };
    const next = { "1": { id: "1", name: "b" } };
    const result = diffEntityMaps(prev, next);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toEqual([{ id: "1", name: "b" }]);
  });

  it("handles mixed changes", () => {
    const prev = { "1": { id: "1", name: "a" }, "2": { id: "2", name: "b" } };
    const next = {
      "1": { id: "1", name: "changed" },
      "3": { id: "3", name: "c" },
    };
    const result = diffEntityMaps(prev, next);
    expect(result.added).toEqual([{ id: "3", name: "c" }]);
    expect(result.removed).toEqual(["2"]);
    expect(result.changed).toEqual([{ id: "1", name: "changed" }]);
  });

  it("returns empty diff for identical maps", () => {
    const prev = { "1": { id: "1", name: "a" } };
    const next = { "1": { id: "1", name: "a" } };
    const result = diffEntityMaps(prev, next);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toEqual([]);
  });
});
