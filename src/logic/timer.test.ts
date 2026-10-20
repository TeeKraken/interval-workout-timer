import { describe, expect, it } from "vitest";
import type { Segment } from "./plan";
import { pauseTimer, resumeTimer, secondsLeft, skipSegment, startTimer, summarize, tick } from "./timer";

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

describe("skip near a segment boundary", () => {
  const tiny: Segment[] = [
    { kind: "work", seconds: 1, round: 1, exercise: "A" },
    { kind: "rest", seconds: 1, round: 1 },
    { kind: "work", seconds: 1, round: 2, exercise: "B" },
  ];

  it("catches up before skipping, so it skips the segment that is really on screen", () => {
    // At 2.5s the rest has already ended and the last work is half done.
    const s = skipSegment(startTimer(tiny, 0), 2500);
    expect(s.status).toBe("done");
    expect(s.doneMs).toEqual([1000, 1000, 500]);
    expect(s.skipped).toEqual([false, false, true]);
  });

  it("still skips the current segment when paused", () => {
    const s = skipSegment(pauseTimer(startTimer(tiny, 0), 300), 5000);
    expect(s.index).toBe(1);
    expect(s.status).toBe("paused");
    expect(s.doneMs[0]).toBe(300);
  });
});

describe("summarize: actual time, not planned time", () => {
  const long: Segment[] = [
    { kind: "work", seconds: 600, round: 1, exercise: "Row" },
    { kind: "work", seconds: 600, round: 2, exercise: "Bike" },
  ];

  it("reports almost nothing done when every round is skipped straight away", () => {
    let s = startTimer(long, 0);
    s = skipSegment(s, 2000);
    s = skipSegment(s, 3000);
    expect(s.status).toBe("done");
    const sum = summarize(s);
    expect(sum.plannedSeconds).toBe(1200);
    expect(sum.activeSeconds).toBe(3);
    expect(sum.skippedRounds).toBe(2);
    expect(sum.rounds).toEqual([
      { round: 1, exercise: "Row", plannedSeconds: 600, doneSeconds: 2, skipped: true },
      { round: 2, exercise: "Bike", plannedSeconds: 600, doneSeconds: 1, skipped: true },
    ]);
  });

  it("counts a full round plus part of a skipped one, ignoring get-ready", () => {
    let s = tick(startTimer(plan, 0), 13_000); // ready 3s + work 10s done
    s = skipSegment(s, 15_000); // 2s of rest, skipped
    s = tick(s, 15_000 + 8000); // last work done in full
    expect(s.status).toBe("done");
    const sum = summarize(s);
    expect(sum.activeSeconds).toBe(10 + 2 + 8);
    expect(sum.workSeconds).toBe(18);
    expect(sum.plannedSeconds).toBe(23);
    expect(sum.skippedRounds).toBe(0);
  });

  it("counts time spent before a pause and skip", () => {
    let s = startTimer(long, 0);
    s = pauseTimer(s, 90_000);
    s = skipSegment(s, 500_000);
    expect(summarize(s).rounds[0]).toMatchObject({ doneSeconds: 90, skipped: true });
  });
});
