import { randomInt, type Rng } from "./rng";

/** One choice the timer can pick. A fixed length has min === max. */
export interface DurationOption {
  min: number;
  max: number;
}

export type ParseResult =
  | { ok: true; options: DurationOption[] }
  | { ok: false; error: string };

export const MAX_SECONDS = 60 * 60;

/** Reads "45", "45s", "2m", "1:30" as seconds. Returns null if it can't. */
export function parseTime(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  let m = /^(\d{1,4})\s*(s|sec|secs|seconds?)?$/.exec(s);
  if (m) return Number(m[1]);
  m = /^(\d{1,3})\s*(m|min|mins|minutes?)$/.exec(s);
  if (m) return Number(m[1]) * 60;
  m = /^(\d{1,3}):([0-5]\d)$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return null;
}

/**
 * Parses what people type into a lengths box, for example
 * "30, 45, 60" (pick one of these) or "20-90" (anything in between) or a mix.
 */
export function parseDurations(
  input: string,
  opts: { allowZero?: boolean } = {},
): ParseResult {
  const parts = input
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { ok: false, error: "Add at least one length, like 30 or 20-60." };
  }
  const minAllowed = opts.allowZero ? 0 : 1;
  const options: DurationOption[] = [];
  for (const part of parts) {
    const range = part.split(/\s*(?:-|–|—|\bto\b)\s*/);
    if (range.length > 2) {
      return { ok: false, error: `"${part}" doesn't look like a length. Try 30 or 20-60.` };
    }
    const nums = range.map(parseTime);
    if (nums.some((n) => n === null)) {
      return { ok: false, error: `"${part}" doesn't look like a length. Try 30, 1:30 or 20-60.` };
    }
    let [min, max] = nums.length === 2 ? (nums as number[]) : [nums[0]!, nums[0]!];
    if (min > max) [min, max] = [max, min];
    if (min < minAllowed) {
      return { ok: false, error: "Work lengths need to be at least 1 second." };
    }
    if (max > MAX_SECONDS) {
      return { ok: false, error: "Keep each length under an hour." };
    }
    options.push({ min, max });
  }
  return { ok: true, options };
}

/** Picks one option at random, then a whole number of seconds inside it. */
export function pickDuration(options: DurationOption[], rng: Rng): number {
  if (options.length === 0) throw new Error("No duration options");
  const o = options[Math.floor(rng() * options.length)];
  return randomInt(rng, o.min, o.max);
}

export function durationBounds(options: DurationOption[]): { min: number; max: number } {
  return {
    min: Math.min(...options.map((o) => o.min)),
    max: Math.max(...options.map((o) => o.max)),
  };
}

/** 75 -> "1:15", 9 -> "0:09" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** 75 -> "1 minute 15 seconds", for screen readers. */
export function spokenDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (m === 0) return part(r, "second");
  if (r === 0) return part(m, "minute");
  return `${part(m, "minute")} ${part(r, "second")}`;
}
