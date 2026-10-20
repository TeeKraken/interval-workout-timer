import { describe, expect, it } from "vitest";
import { mulberry32, randomInt } from "./rng";

describe("mulberry32", () => {
  it("gives the same sequence for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, a);
    const seqB = Array.from({ length: 20 }, b);
    expect(seqA).toEqual(seqB);
  });

  it("gives different sequences for different seeds", () => {
    const a = Array.from({ length: 5 }, mulberry32(1));
    const b = Array.from({ length: 5 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it("stays within [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 10_000; i++) {
      const x = r();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe("randomInt", () => {
  it("covers both ends of the range and nothing outside it", () => {
    const r = mulberry32(99);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const n = randomInt(r, 3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      expect(Number.isInteger(n)).toBe(true);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it("handles a single value and reversed bounds", () => {
    const r = mulberry32(1);
    expect(randomInt(r, 5, 5)).toBe(5);
    const n = randomInt(r, 10, 8);
    expect(n).toBeGreaterThanOrEqual(8);
    expect(n).toBeLessThanOrEqual(10);
  });
});
