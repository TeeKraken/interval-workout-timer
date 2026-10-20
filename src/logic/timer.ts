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
}

export function startTimer(plan: Segment[], now: number): TimerState {
  if (plan.length === 0) return { plan, index: 0, status: "done", endsAt: now, remainingMs: 0 };
  const ms = plan[0].seconds * 1000;
  return { plan, index: 0, status: "running", endsAt: now + ms, remainingMs: ms };
}

/** Moves forward past any segments that have finished. Carries leftover time over. */
export function tick(state: TimerState, now: number): TimerState {
  if (state.status !== "running") return state;
  let { index, endsAt } = state;
  while (now >= endsAt) {
    index++;
    if (index >= state.plan.length) {
      return { ...state, index: state.plan.length - 1, status: "done", endsAt, remainingMs: 0 };
    }
    endsAt += state.plan[index].seconds * 1000;
  }
  return { ...state, index, endsAt, remainingMs: endsAt - now };
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

/** Jumps to the start of the next segment. Keeps paused workouts paused. */
export function skipSegment(state: TimerState, now: number): TimerState {
  if (state.status === "done") return state;
  const index = state.index + 1;
  if (index >= state.plan.length) return { ...state, status: "done", remainingMs: 0 };
  const ms = state.plan[index].seconds * 1000;
  return { ...state, index, endsAt: now + ms, remainingMs: ms };
}

/** Whole seconds left in the current segment, rounded up (so it shows 1 until it hits 0). */
export function secondsLeft(state: TimerState, now: number): number {
  if (state.status === "done") return 0;
  const ms = state.status === "running" ? state.endsAt - now : state.remainingMs;
  return Math.max(0, Math.ceil(ms / 1000));
}
