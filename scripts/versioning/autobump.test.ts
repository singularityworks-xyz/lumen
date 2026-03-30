import { describe, expect, test } from "bun:test";

import { incrementVersion, normalizeVersion } from "./autobump";

describe("normalizeVersion", () => {
  test("keeps canonical versions unchanged", () => {
    expect(normalizeVersion("0.5.19")).toBe("0.5.19");
  });

  test("carries patch overflow into the minor version", () => {
    expect(normalizeVersion("0.4.119")).toBe("0.5.19");
    expect(normalizeVersion("0.5.135")).toBe("0.6.35");
  });
});

describe("incrementVersion", () => {
  test("increments a canonical version by one patch", () => {
    expect(incrementVersion("0.5.19")).toBe("0.5.20");
  });

  test("normalizes legacy patch-overflow versions before incrementing", () => {
    expect(incrementVersion("0.4.119")).toBe("0.5.20");
  });

  test("rolls patch 99 into the next minor", () => {
    expect(incrementVersion("0.5.99")).toBe("0.6.0");
  });
});
