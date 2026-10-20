let ctx: AudioContext | null = null;

/** Must be called from a tap or key press so the browser lets us make sound. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, startIn: number, length: number, volume = 0.25): void {
  if (!ctx) return;
  const t = ctx.currentTime + startIn;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

export type Cue = "tick" | "work" | "rest" | "done";

export function beep(cue: Cue): void {
  switch (cue) {
    case "tick":
      tone(660, 0, 0.12, 0.18);
      break;
    case "work":
      tone(880, 0, 0.18);
      tone(1320, 0.2, 0.35);
      break;
    case "rest":
      tone(660, 0, 0.18);
      tone(440, 0.2, 0.4);
      break;
    case "done":
      tone(660, 0, 0.15);
      tone(880, 0.17, 0.15);
      tone(1320, 0.34, 0.6);
      break;
  }
}

export const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;

export function buzz(cue: Cue): void {
  if (!canVibrate) return;
  const pattern: Record<Cue, number[]> = {
    tick: [60],
    work: [250, 100, 250],
    rest: [500],
    done: [200, 100, 200, 100, 400],
  };
  try {
    navigator.vibrate(pattern[cue]);
  } catch {
    /* some browsers throw without a recent tap; cues are best-effort */
  }
}

let lock: WakeLockSentinel | null = null;

/** Keeps the screen on during a workout, where supported. */
export async function keepAwake(on: boolean): Promise<void> {
  try {
    if (on && "wakeLock" in navigator && document.visibilityState === "visible") {
      lock = await navigator.wakeLock.request("screen");
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  }
}
