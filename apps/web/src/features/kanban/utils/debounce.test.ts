import { describe, expect, it } from "bun:test";

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

globalThis.setTimeout = ((cb: () => void, ms: number) => {
  return originalSetTimeout(cb, ms);
}) as unknown as typeof setTimeout;

globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => {
  return originalClearTimeout(id);
}) as unknown as typeof clearTimeout;

import { debounce } from "./debounce";

describe("debounce", () => {
  it("executes function after wait period", async () => {
    let count = 0;
    const fn = debounce(() => count++, 50);
    fn();
    expect(count).toBe(0);
    await new Promise((r) => setTimeout(r, 60));
    expect(count).toBe(1);
  });

  it("collapses multiple rapid calls into single execution", async () => {
    let count = 0;
    const fn = debounce(() => count++, 50);
    fn();
    fn();
    fn();
    await new Promise((r) => setTimeout(r, 60));
    expect(count).toBe(1);
  });

  it("preserves latest arguments in final execution", async () => {
    let lastArg = 0;
    const fn = debounce((arg: unknown) => {
      lastArg = arg as number;
    }, 50);
    fn(1);
    fn(2);
    fn(3);
    await new Promise((r) => setTimeout(r, 60));
    expect(lastArg).toBe(3);
  });

  it("resets timer on each call", async () => {
    let count = 0;
    const fn = debounce(() => count++, 50);
    fn();
    await new Promise((r) => setTimeout(r, 30));
    fn();
    await new Promise((r) => setTimeout(r, 40));
    expect(count).toBe(0);
    await new Promise((r) => setTimeout(r, 20));
    expect(count).toBe(1);
  });

  it("cancellation prevents pending invocation", async () => {
    let count = 0;
    const fn = debounce(() => count++, 50);
    fn();
    await new Promise((r) => setTimeout(r, 30));
    fn();
    await new Promise((r) => setTimeout(r, 60));
    expect(count).toBe(1);
  });
});
