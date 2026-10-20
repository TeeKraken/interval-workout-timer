import { describe, expect, it } from "vitest";
import type { Segment } from "./plan";
import { pauseTimer, resumeTimer, secondsLeft, skipSegment, startTimer, tick } from "./timer";

const plan: Segment[] = [
  { kind: "ready", seconds: 3, round: 0 },
  { kind: "work", seconds: 10, round: 1, exercise: "Jog" },
  { kind: "rest", seconds: 5, round: 1 },
  { kind: "work", seconds: 8, round: 2, exercise: "Sprint" },
];

describe("timer", () => {
  it("counts down and advances through segments", () => {
    let s = startTimer(plan, 0);
    expect(secondsLeft(s, 0)).toBe(3);
    expect(secondsLeft(s, 2001)).toBe(1);
    s = tick(s, 3000);
    expect(s.index).toBe(1);
    expect(secondsLeft(s, 3000)).toBe(10);
    s = tick(s, 13_500);
    expect(s.index).toBe(2);
    expect(secondsLeft(s, 13_500)).toBe(5);
  });

  it("catches up after a long gap without losing time", () => {
    const s = tick(startTimer(plan, 0), 19_000); // 3 + 10 + 5 = 18 -> 1s into last work
    expect(s.index).toBe(3);
    expect(secondsLeft(s, 19_000)).toBe(7);
  });

  it("finishes at the end", () => {
    const s = tick(startTimer(plan, 0), 26_000);
    expect(s.status).toBe("done");
    expect(secondsLeft(s, 26_000)).toBe(0);
  });

  it("pauses and resumes with the same time left", () => {
    let s = tick(startTimer(plan, 0), 5000); // 8s left in work
    s = pauseTimer(s, 5000);
    expect(s.status).toBe("paused");
    expect(tick(s, 60_000)).toBe(s);
    expect(secondsLeft(s, 60_000)).toBe(8);
    s = resumeTimer(s, 60_000);
    expect(secondsLeft(s, 60_000)).toBe(8);
    expect(tick(s, 68_000).index).toBe(2);
  });

  it("skips to the next segment and finishes when skipping the last", () => {
    let s = startTimer(plan, 0);
    s = skipSegment(s, 1000);
    expect(s.index).toBe(1);
    expect(secondsLeft(s, 1000)).toBe(10);
    s = skipSegment(skipSegment(s, 1000), 1000);
    expect(s.index).toBe(3);
    s = skipSegment(s, 1000);
    expect(s.status).toBe("done");
  });

  it("keeps a paused workout paused when skipping", () => {
    let s = pauseTimer(startTimer(plan, 0), 500);
    s = skipSegment(s, 500);
    expect(s.status).toBe("paused");
    expect(secondsLeft(s, 99_999)).toBe(10);
  });
});
