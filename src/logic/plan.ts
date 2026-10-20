import { pickDuration, type DurationOption } from "./durations";
import type { Rng } from "./rng";

export type SegmentKind = "ready" | "work" | "rest";

export interface Segment {
  kind: SegmentKind;
  seconds: number;
  /** 1-based round this segment belongs to (0 for the get-ready countdown). */
  round: number;
  exercise?: string;
}

export interface PlanSettings {
  exercises: string[];
  work: DurationOption[];
  rest: DurationOption[];
  rounds: number;
  readySeconds: number;
}

/** Picks an exercise at random, avoiding an immediate repeat when there is a choice. */
export function pickExercise(exercises: string[], previous: string | undefined, rng: Rng): string {
  if (exercises.length === 0) throw new Error("No exercises");
  const pool =
    exercises.length > 1 && previous !== undefined
      ? exercises.filter((e) => e !== previous)
      : exercises;
  const from = pool.length > 0 ? pool : exercises;
  return from[Math.floor(rng() * from.length)];
}

/**
 * Builds the whole workout up front: get ready, then work / rest pairs.
 * There is no rest after the last round, and a rest that rolls 0 seconds is skipped.
 */
export function buildPlan(settings: PlanSettings, rng: Rng): Segment[] {
  const segments: Segment[] = [];
  if (settings.readySeconds > 0) {
    segments.push({ kind: "ready", seconds: settings.readySeconds, round: 0 });
  }
  let previous: string | undefined;
  for (let round = 1; round <= settings.rounds; round++) {
    const exercise = pickExercise(settings.exercises, previous, rng);
    previous = exercise;
    segments.push({ kind: "work", seconds: pickDuration(settings.work, rng), round, exercise });
    if (round < settings.rounds) {
      const rest = pickDuration(settings.rest, rng);
      if (rest > 0) segments.push({ kind: "rest", seconds: rest, round });
    }
  }
  return segments;
}

export function totalSeconds(plan: Segment[]): number {
  return plan.reduce((sum, s) => sum + s.seconds, 0);
}
