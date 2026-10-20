import { describe, expect, it } from "vitest";
import { durationBounds, formatClock, parseDurations, parseTime, pickDuration } from "./durations";
import { mulberry32 } from "./rng";

describe("parseTime", () => {
  it.each([
    ["45", 45],
    ["45s", 45],
    ["2m", 120],
    ["1:30", 90],
    [" 0:05 ", 5],
    ["0", 0],
  ])("reads %s as %i seconds", (input, out) => {
    expect(parseTime(input)).toBe(out);
  });

  it.each(["", "abc", "1:75", "-3", "1.5"])("rejects %s", (input) => {
    expect(parseTime(input)).toBeNull();
  });
});

describe("parseDurations", () => {
  it("reads a list of fixed lengths", () => {
    expect(parseDurations("30, 45, 60")).toEqual({
      ok: true,
      options: [
        { min: 30, max: 30 },
        { min: 45, max: 45 },
        { min: 60, max: 60 },
      ],
    });
  });

  it("reads ranges in several spellings and mixes", () => {
    const r = parseDurations("20-40, 1:00 to 1:30, 90–60, 15");
    expect(r).toEqual({
      ok: true,
      options: [
        { min: 20, max: 40 },
        { min: 60, max: 90 },
        { min: 60, max: 90 },
        { min: 15, max: 15 },
      ],
    });
  });

  it("only allows zero when asked (for rest)", () => {
    expect(parseDurations("0").ok).toBe(false);
    expect(parseDurations("0-10", { allowZero: true }).ok).toBe(true);
  });

  it("explains what went wrong", () => {
    const empty = parseDurations("  ");
    expect(empty.ok).toBe(false);
    const bad = parseDurations("30, banana");
    expect(bad).toMatchObject({ ok: false });
    if (!bad.ok) expect(bad.error).toContain("banana");
    expect(parseDurations("2:00:00").ok).toBe(false);
    expect(parseDurations("10-20-30").ok).toBe(false);
  });
});

describe("pickDuration", () => {
  it("always lands inside one of the options", () => {
    const parsed = parseDurations("10-20, 45, 60-65");
    if (!parsed.ok) throw new Error("parse failed");
    const rng = mulberry32(2024);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const d = pickDuration(parsed.options, rng);
      seen.add(d);
      const inside = parsed.options.some((o) => d >= o.min && d <= o.max);
      expect(inside).toBe(true);
    }
    expect(seen.has(10)).toBe(true);
    expect(seen.has(20)).toBe(true);
    expect(seen.has(45)).toBe(true);
    expect(seen.has(65)).toBe(true);
  });

  it("is repeatable with the same seed", () => {
    const opts = [{ min: 5, max: 500 }];
    const a = Array.from({ length: 10 }, ((r) => () => pickDuration(opts, r))(mulberry32(5)));
    const b = Array.from({ length: 10 }, ((r) => () => pickDuration(opts, r))(mulberry32(5)));
    expect(a).toEqual(b);
  });
});

describe("helpers", () => {
  it("finds overall bounds", () => {
    expect(durationBounds([{ min: 10, max: 20 }, { min: 5, max: 5 }, { min: 30, max: 40 }])).toEqual({
      min: 5,
      max: 40,
    });
  });

  it("formats clocks", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(600)).toBe("10:00");
  });
});
