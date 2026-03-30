import { afterEach, describe, expect, it } from "bun:test";
import {
  advanceTime,
  deterministicUUID,
  freezeTime,
  mockTimers,
} from "../helpers/time";

const UUID_PATTERN = /^00000000-0000-4000-8000-\d{12}$/;
const FIXED_TIMESTAMP = 1_700_000_000_000;

describe("freezeTime", () => {
  afterEach(() => {
    // Restore real Date.now
    Date.now = () => Date.now.call(Date);
  });

  it("freezes Date.now to the given timestamp", () => {
    freezeTime(1_234_567_890_000);
    expect(Date.now()).toBe(1_234_567_890_000);
  });

  it("freezes Date.now to default timestamp when no arg", () => {
    freezeTime();
    expect(Date.now()).toBe(FIXED_TIMESTAMP);
  });

  it("Date.now returns same value on repeated calls", () => {
    freezeTime(1_000_000_000_000);
    expect(Date.now()).toBe(1_000_000_000_000);
    expect(Date.now()).toBe(1_000_000_000_000);
    expect(Date.now()).toBe(1_000_000_000_000);
  });
});

describe("advanceTime", () => {
  afterEach(() => {
    Date.now = () => Date.now.call(Date);
  });

  it("advances the frozen time by the given milliseconds", () => {
    freezeTime(1_000_000);
    advanceTime(5000);
    expect(Date.now()).toBe(1_005_000);
  });

  it("advances multiple times accumulates", () => {
    freezeTime(0);
    advanceTime(100);
    advanceTime(200);
    advanceTime(300);
    expect(Date.now()).toBe(600);
  });

  it("advancing by 0 keeps the same time", () => {
    freezeTime(5000);
    advanceTime(0);
    expect(Date.now()).toBe(5000);
  });

  it("can advance by negative values to go backwards", () => {
    freezeTime(10_000);
    advanceTime(-5000);
    expect(Date.now()).toBe(5000);
  });

  it("advancing without prior freeze uses default", () => {
    freezeTime(100);
    advanceTime(50);
    expect(Date.now()).toBe(150);
  });
});

describe("deterministicUUID", () => {
  it("returns a UUID-like string", () => {
    const uuid = deterministicUUID(1);
    expect(uuid).toMatch(UUID_PATTERN);
  });

  it("pads seed with zeros to 12 digits", () => {
    expect(deterministicUUID(1)).toBe("00000000-0000-4000-8000-000000000001");
    expect(deterministicUUID(42)).toBe("00000000-0000-4000-8000-000000000042");
    expect(deterministicUUID(999)).toBe("00000000-0000-4000-8000-000000000999");
  });

  it("produces different UUIDs for different seeds", () => {
    const uuid1 = deterministicUUID(1);
    const uuid2 = deterministicUUID(2);
    expect(uuid1).not.toBe(uuid2);
  });

  it("produces same UUID for same seed", () => {
    expect(deterministicUUID(77)).toBe(deterministicUUID(77));
  });

  it("is valid UUID v4 format (has 4 in version nibble)", () => {
    const uuid = deterministicUUID(1);
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(uuid.charAt(14)).toBe("4");
    expect(uuid.charAt(19)).toBe("8");
  });
});

describe("mockTimers", () => {
  it("replaces setInterval and setTimeout", () => {
    const timers = mockTimers();

    expect(typeof globalThis.setInterval).toBe("function");
    expect(typeof globalThis.setTimeout).toBe("function");

    timers.restore();
  });

  it("setTimeout callback is not called immediately", () => {
    const timers = mockTimers();
    let called = false;

    globalThis.setTimeout(() => {
      called = true;
    }, 1000);

    expect(called).toBe(false);

    timers.restore();
  });

  it("flushTimeout fires the callback", () => {
    const timers = mockTimers();
    let called = false;

    const id = globalThis.setTimeout(() => {
      called = true;
    }, 1000) as unknown as number;

    timers.flushTimeout(id);
    expect(called).toBe(true);

    timers.restore();
  });

  it("flushTimeout removes the timeout so it won't fire again", () => {
    const timers = mockTimers();
    let count = 0;

    const id = globalThis.setTimeout(() => {
      count++;
    }, 1000) as unknown as number;

    timers.flushTimeout(id);
    timers.runAllTimeouts();
    expect(count).toBe(1);

    timers.restore();
  });

  it("flushInterval fires a specific interval callback", () => {
    const timers = mockTimers();
    let count = 0;

    const id = globalThis.setInterval(() => {
      count++;
    }, 500) as unknown as number;

    timers.flushInterval(id);
    expect(count).toBe(1);

    timers.flushInterval(id);
    expect(count).toBe(2);

    timers.restore();
  });

  it("runAllIntervals fires all registered intervals", () => {
    const timers = mockTimers();
    const results: number[] = [];

    globalThis.setInterval(() => results.push(1), 100);
    globalThis.setInterval(() => results.push(2), 200);
    globalThis.setInterval(() => results.push(3), 300);

    timers.runAllIntervals();
    expect(results.sort()).toEqual([1, 2, 3]);

    timers.restore();
  });

  it("runAllTimeouts fires all registered timeouts", () => {
    const timers = mockTimers();
    const results: number[] = [];

    globalThis.setTimeout(() => results.push(1), 100);
    globalThis.setTimeout(() => results.push(2), 200);
    globalThis.setTimeout(() => results.push(3), 300);

    timers.runAllTimeouts();
    expect(results.sort()).toEqual([1, 2, 3]);

    timers.restore();
  });

  it("clearInterval stops interval from firing", () => {
    const timers = mockTimers();
    let count = 0;

    const id = globalThis.setInterval(() => {
      count++;
    }, 100);

    globalThis.clearInterval(id);
    timers.runAllIntervals();
    expect(count).toBe(0);

    timers.restore();
  });

  it("clearTimeout stops timeout from firing", () => {
    const timers = mockTimers();
    let called = false;

    const id = globalThis.setTimeout(() => {
      called = true;
    }, 100);

    globalThis.clearTimeout(id);
    timers.runAllTimeouts();
    expect(called).toBe(false);

    timers.restore();
  });

  it("restore puts back original timer functions", () => {
    const originalSetInterval = globalThis.setInterval;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearInterval = globalThis.clearInterval;
    const originalClearTimeout = globalThis.clearTimeout;

    const timers = mockTimers();
    timers.restore();

    expect(globalThis.setInterval).toBe(originalSetInterval);
    expect(globalThis.setTimeout).toBe(originalSetTimeout);
    expect(globalThis.clearInterval).toBe(originalClearInterval);
    expect(globalThis.clearTimeout).toBe(originalClearTimeout);
  });

  it("returns incrementing IDs for timers", () => {
    const timers = mockTimers();

    const id1 = globalThis.setTimeout(() => {
      /* no-op */
    }, 0) as unknown as number;
    const id2 = globalThis.setTimeout(() => {
      /* no-op */
    }, 0) as unknown as number;
    const id3 = globalThis.setInterval(() => {
      /* no-op */
    }, 0) as unknown as number;

    expect(id2).toBeGreaterThan(id1);
    expect(id3).toBeGreaterThan(id2);

    timers.restore();
  });
});
