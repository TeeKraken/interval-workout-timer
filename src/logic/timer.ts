import type { Segment } from "./plan";

/**
 * The timer is a pure state machine driven by wall-clock timestamps, so it stays
 * accurate even when the browser throttles timers in a background tab.
 */
export interface TimerState {
  plan: Segment[];
  index: number;
  status: "running" | "paused" | "done";
  /** When the current segment ends (ms), while running. */
  endsAt: number;
  /** Time left in the current segment (ms), while paused. */
  remainingMs: number;
  /** Time actually spent in each segment (ms). */
  doneMs: number[];
  /** Which segments were cut short with Skip. */
  skipped: boolean[];
}

export function startTimer(plan: Segment[], now: number): TimerState {
  const doneMs = plan.map(() => 0);
  const skipped = plan.map(() => false);
  if (plan.length === 0) {
    return { plan, index: 0, status: "done", endsAt: now, remainingMs: 0, doneMs, skipped };
  }
  const ms = plan[0].seconds * 1000;
  return { plan, index: 0, status: "running", endsAt: now + ms, remainingMs: ms, doneMs, skipped };
}

/** Moves forward past any segments that have finished. Carries leftover time over. */
export function tick(state: TimerState, now: number): TimerState {
  if (state.status !== "running" || now < state.endsAt) {
    return state.status === "running" ? { ...state, remainingMs: state.endsAt - now } : state;
  }
  let { index, endsAt } = state;
  const doneMs = [...state.doneMs];
  while (now >= endsAt) {
    doneMs[index] = state.plan[index].seconds * 1000;
    index++;
    if (index >= state.plan.length) {
      return { ...state, index: state.plan.length - 1, status: "done", endsAt, remainingMs: 0, doneMs };
    }
    endsAt += state.plan[index].seconds * 1000;
  }
  return { ...state, index, endsAt, remainingMs: endsAt - now, doneMs };
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.status !== "running") return state;
  const t = tick(state, now);
  if (t.status === "done") return t;
  return { ...t, status: "paused", remainingMs: t.endsAt - now };
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.status !== "paused") return state;
  return { ...state, status: "running", endsAt: now + state.remainingMs };
}

/**
 * Ends the current segment early and starts the next. Records only the time
 * actually spent. Keeps paused workouts paused.
 */
export function skipSegment(state: TimerState, now: number): TimerState {
  // Catch up first, so a late tick can't make Skip jump over a segment that already ended.
  const s = state.status === "running" ? tick(state, now) : state;
  if (s.status === "done") return s;
  const seg = s.plan[s.index];
  const left = s.status === "running" ? s.endsAt - now : s.remainingMs;
  const doneMs = [...s.doneMs];
  const skipped = [...s.skipped];
  doneMs[s.index] = Math.max(0, Math.min(seg.seconds * 1000, seg.seconds * 1000 - left));
  skipped[s.index] = true;
  const index = s.index + 1;
  if (index >= s.plan.length) {
    return { ...s, status: "done", remainingMs: 0, doneMs, skipped };
  }
  const ms = s.plan[index].seconds * 1000;
  return { ...s, index, endsAt: now + ms, remainingMs: ms, doneMs, skipped };
}

/** Whole seconds left in the current segment, rounded up (so it shows 1 until it hits 0). */
export function secondsLeft(state: TimerState, now: number): number {
  if (state.status === "done") return 0;
  const ms = state.status === "running" ? state.endsAt - now : state.remainingMs;
  return Math.max(0, Math.ceil(ms / 1000));
}

export interface RoundResult {
  round: number;
  exercise: string;
  plannedSeconds: number;
  doneSeconds: number;
  skipped: boolean;
}

export interface Summary {
  rounds: RoundResult[];
  /** Work and rest actually done, in whole seconds (the get-ready countdown isn't counted). */
  activeSeconds: number;
  workSeconds: number;
  plannedSeconds: number;
  skippedRounds: number;
}

/** What actually happened, as opposed to what was planned. */
export function summarize(state: TimerState): Summary {
  let activeMs = 0;
  let workMs = 0;
  let plannedSeconds = 0;
  const rounds: RoundResult[] = [];
  state.plan.forEach((seg, i) => {
    if (seg.kind === "ready") return;
    plannedSeconds += seg.seconds;
    activeMs += state.doneMs[i];
    if (seg.kind === "work") {
      workMs += state.doneMs[i];
      rounds.push({
        round: seg.round,
        exercise: seg.exercise ?? "",
        plannedSeconds: seg.seconds,
        doneSeconds: Math.floor(state.doneMs[i] / 1000),
        skipped: state.skipped[i],
      });
    }
  });
  return {
    rounds,
    activeSeconds: Math.floor(activeMs / 1000),
    workSeconds: Math.floor(workMs / 1000),
    plannedSeconds,
    skippedRounds: rounds.filter((r) => r.skipped).length,
  };
}
