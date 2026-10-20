/** A random number source: returns a float in [0, 1). */
export type Rng = () => number;

/**
 * Mulberry32: a tiny, fast, seedable generator. The same seed always gives the
 * same sequence, which is what makes the workout plans testable.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seed from the browser's secure random source (falls back to Math.random). */
export function randomSeed(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 2 ** 32);
}

/** Integer in [min, max], both inclusive. */
export function randomInt(rng: Rng, min: number, max: number): number {
  if (max < min) [min, max] = [max, min];
  return min + Math.floor(rng() * (max - min + 1));
}
