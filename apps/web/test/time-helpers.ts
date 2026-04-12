const FIXED_TIMESTAMP = 1_700_000_000_000;
let timestampCounter = 0;

export function advanceTime(ms: number) {
  timestampCounter += ms;
}

export function getMockDateNow() {
  return FIXED_TIMESTAMP + timestampCounter;
}

export function resetTime() {
  timestampCounter = 0;
}
