import { afterEach, beforeEach, mock } from "bun:test";

const originalDateNow = Date.now;
const originalRandomUUID = crypto.randomUUID;
const FIXED_TIMESTAMP = 1_700_000_000_000;
let timestampCounter = 0;

beforeEach(() => {
  timestampCounter = 0;

  Date.now = mock(() => FIXED_TIMESTAMP + timestampCounter);

  let uuidCounter = 0;
  crypto.randomUUID = mock(
    () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, "0")}`
  ) as typeof crypto.randomUUID;

  const runtime = globalThis as typeof globalThis & {
    Bun?: {
      gc?: (force?: boolean) => void;
    };
  };

  runtime.Bun?.gc?.(true);
});

afterEach(() => {
  Date.now = originalDateNow;
  crypto.randomUUID = originalRandomUUID;
});

export function freezeTime(timestamp: number = FIXED_TIMESTAMP) {
  timestampCounter = timestamp - FIXED_TIMESTAMP;
}

export function advanceTime(ms: number) {
  timestampCounter += ms;
}

export function deterministicUUID(seed: number) {
  return `00000000-0000-4000-8000-${String(seed).padStart(12, "0")}`;
}
