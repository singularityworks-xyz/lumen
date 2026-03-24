import { mock } from "bun:test";

const FIXED_TIMESTAMP = 1_700_000_000_000;

export function freezeTime(timestamp: number = FIXED_TIMESTAMP) {
  Date.now = mock(() => timestamp);
}

export function advanceTime(ms: number) {
  const current = Date.now();
  Date.now = mock(() => current + ms);
}

export function deterministicUUID(seed: number) {
  return `00000000-0000-4000-8000-${String(seed).padStart(12, "0")}`;
}

type TimerCallback = () => void;

export function mockTimers() {
  const originalSetInterval = globalThis.setInterval;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearInterval = globalThis.clearInterval;
  const originalClearTimeout = globalThis.clearTimeout;

  const intervals: Map<number, { callback: TimerCallback; ms: number }> =
    new Map();
  const timeouts: Map<number, { callback: TimerCallback; ms: number }> =
    new Map();
  let nextId = 1;

  globalThis.setInterval = ((callback: TimerCallback, ms?: number) => {
    const id = nextId++;
    intervals.set(id, { callback, ms: ms ?? 0 });
    return id;
  }) as typeof setInterval;

  globalThis.setTimeout = ((callback: TimerCallback, ms?: number) => {
    const id = nextId++;
    timeouts.set(id, { callback, ms: ms ?? 0 });
    return id;
  }) as typeof setTimeout;

  globalThis.clearInterval = ((id: number | undefined) => {
    if (id !== undefined) {
      intervals.delete(id);
    }
  }) as typeof clearInterval;

  globalThis.clearTimeout = ((id: number | undefined) => {
    if (id !== undefined) {
      timeouts.delete(id);
    }
  }) as typeof clearTimeout;

  return {
    flushInterval(id: number) {
      const entry = intervals.get(id);
      if (entry) {
        entry.callback();
      }
    },
    flushTimeout(id: number) {
      const entry = timeouts.get(id);
      if (entry) {
        entry.callback();
        timeouts.delete(id);
      }
    },
    runAllIntervals() {
      for (const [, entry] of intervals) {
        entry.callback();
      }
    },
    runAllTimeouts() {
      const entries = [...timeouts.entries()];
      for (const [id, entry] of entries) {
        entry.callback();
        timeouts.delete(id);
      }
    },
    restore() {
      globalThis.setInterval = originalSetInterval;
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearInterval = originalClearInterval;
      globalThis.clearTimeout = originalClearTimeout;
      intervals.clear();
      timeouts.clear();
    },
  };
}
