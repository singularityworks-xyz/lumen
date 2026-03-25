export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = Math.imul(s, 1_664_525) + 1_013_904_223;
    s %= 2 ** 31;
    return (s < 0 ? s + 2 ** 31 : s) / 2 ** 31;
  };
}

export function deterministicShuffle<T>(arr: T[], seed: number): T[] {
  const rng = seededRandom(seed);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
