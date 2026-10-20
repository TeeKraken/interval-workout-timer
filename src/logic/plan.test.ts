import { describe, expect, it } from "vitest";
import { buildPlan, pickExercise, totalSeconds, type PlanSettings } from "./plan";
import { mulberry32 } from "./rng";

const base: PlanSettings = {
  exercises: ["Jog", "Walk", "Sprint"],
  work: [{ min: 20, max: 60 }],
  rest: [{ min: 10, max: 15 }],
  rounds: 8,
  readySeconds: 5,
};

describe("buildPlan", () => {
  it("is identical for the same seed and differs for another", () => {
    expect(buildPlan(base, mulberry32(1))).toEqual(buildPlan(base, mulberry32(1)));
    expect(buildPlan(base, mulberry32(1))).not.toEqual(buildPlan(base, mulberry32(2)));
  });

  it("has a get-ready, one work per round, and rests only between rounds", () => {
    const plan = buildPlan(base, mulberry32(3));
    expect(plan[0]).toEqual({ kind: "ready", seconds: 5, round: 0 });
    const work = plan.filter((s) => s.kind === "work");
    const rest = plan.filter((s) => s.kind === "rest");
    expect(work.map((w) => w.round)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rest).toHaveLength(7);
    expect(plan.at(-1)?.kind).toBe("work");
  });

  it("respects work and rest ranges across many seeds", () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const s of buildPlan(base, mulberry32(seed))) {
        if (s.kind === "work") {
          expect(s.seconds).toBeGreaterThanOrEqual(20);
          expect(s.seconds).toBeLessThanOrEqual(60);
          expect(base.exercises).toContain(s.exercise);
        }
        if (s.kind === "rest") {
          expect(s.seconds).toBeGreaterThanOrEqual(10);
          expect(s.seconds).toBeLessThanOrEqual(15);
        }
      }
    }
  });

  it("only uses the fixed lengths it was given", () => {
    const plan = buildPlan(
      { ...base, work: [{ min: 30, max: 30 }, { min: 45, max: 45 }], rounds: 50 },
      mulberry32(11),
    );
    const lengths = new Set(plan.filter((s) => s.kind === "work").map((s) => s.seconds));
    expect([...lengths].sort()).toEqual([30, 45]);
  });

  it("never repeats an exercise twice in a row when there is a choice", () => {
    for (let seed = 0; seed < 100; seed++) {
      const work = buildPlan({ ...base, rounds: 20 }, mulberry32(seed)).filter((s) => s.kind === "work");
      for (let i = 1; i < work.length; i++) expect(work[i].exercise).not.toBe(work[i - 1].exercise);
    }
  });

  it("works with a single exercise, no get-ready and zero rest", () => {
    const plan = buildPlan(
      { ...base, exercises: ["Plank"], readySeconds: 0, rest: [{ min: 0, max: 0 }], rounds: 3 },
      mulberry32(4),
    );
    expect(plan.map((s) => s.kind)).toEqual(["work", "work", "work"]);
    expect(plan.every((s) => s.exercise === "Plank")).toBe(true);
  });

  it("adds up the total time", () => {
    const plan = buildPlan(base, mulberry32(8));
    expect(totalSeconds(plan)).toBe(plan.reduce((a, s) => a + s.seconds, 0));
  });
});

describe("pickExercise", () => {
  it("can pick every exercise", () => {
    const rng = mulberry32(17);
    const seen = new Set(Array.from({ length: 200 }, () => pickExercise(base.exercises, undefined, rng)));
    expect(seen).toEqual(new Set(base.exercises));
  });
});
