import "./style.css";
import { beep, buzz, canVibrate, keepAwake, unlockAudio, type Cue } from "./cues";
import { durationBounds, formatClock, parseDurations, type DurationOption } from "./logic/durations";
import { buildPlan, totalSeconds, type Segment } from "./logic/plan";
import { mulberry32, randomSeed } from "./logic/rng";
import {
  pauseTimer,
  resumeTimer,
  secondsLeft,
  skipSegment,
  startTimer,
  tick,
  type TimerState,
} from "./logic/timer";
import { load, save, type Stored } from "./storage";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const views = { setup: $("setup"), session: $("session"), done: $("done") };
const form = $<HTMLFormElement>("setup-form");
const inputs = {
  exercises: $<HTMLTextAreaElement>("exercises"),
  work: $<HTMLInputElement>("work"),
  rest: $<HTMLInputElement>("rest"),
  rounds: $<HTMLInputElement>("rounds"),
  sound: $<HTMLInputElement>("sound"),
  vibrate: $<HTMLInputElement>("vibrate"),
  ready: $<HTMLInputElement>("ready"),
};
const errors = {
  exercises: $("exercises-error"),
  work: $("work-error"),
  rest: $("rest-error"),
  rounds: $("rounds-error"),
};

let store: Stored = load();

// ---------- Setup screen ----------

function fillForm(): void {
  const s = store.settings;
  inputs.exercises.value = s.exercises;
  inputs.work.value = s.work;
  inputs.rest.value = s.rest;
  inputs.rounds.value = String(s.rounds);
  inputs.sound.checked = s.sound;
  inputs.vibrate.checked = s.vibrate;
  inputs.ready.checked = s.ready;
  $("vibrate-wrap").hidden = !canVibrate;
}

function exerciseList(): string[] {
  const seen = new Set<string>();
  return inputs.exercises.value
    .split("\n")
    .map((l) => l.trim().slice(0, 60))
    .filter((l) => l && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()));
}

function readForm(): Stored["settings"] {
  return {
    exercises: inputs.exercises.value,
    work: inputs.work.value,
    rest: inputs.rest.value,
    rounds: Number(inputs.rounds.value),
    sound: inputs.sound.checked,
    vibrate: inputs.vibrate.checked,
    ready: inputs.ready.checked,
  };
}

function persist(): void {
  store.settings = readForm();
  save(store);
}

interface Valid {
  exercises: string[];
  work: DurationOption[];
  rest: DurationOption[];
  rounds: number;
}

function validate(showErrors: boolean): Valid | null {
  const exercises = exerciseList();
  const work = parseDurations(inputs.work.value);
  const rest = parseDurations(inputs.rest.value, { allowZero: true });
  const rounds = Number(inputs.rounds.value);
  const msgs = {
    exercises: exercises.length ? "" : "Add at least one exercise, one per line.",
    work: work.ok ? "" : work.error,
    rest: rest.ok ? "" : rest.error,
    rounds:
      Number.isInteger(rounds) && rounds >= 1 && rounds <= 99
        ? ""
        : "Pick a whole number of rounds from 1 to 99.",
  };
  if (showErrors) {
    for (const k of Object.keys(msgs) as (keyof typeof msgs)[]) {
      errors[k].textContent = msgs[k];
      inputs[k].setAttribute("aria-invalid", String(!!msgs[k]));
    }
  }
  if (!work.ok || !rest.ok || Object.values(msgs).some(Boolean)) {
    if (showErrors) {
      const first = (Object.keys(msgs) as (keyof typeof msgs)[]).find((k) => msgs[k]);
      if (first) inputs[first].focus();
    }
    return null;
  }
  return { exercises, work: work.options, rest: rest.options, rounds };
}

function updateEstimate(): void {
  const v = validate(false);
  const el = $("estimate");
  if (!v) {
    el.textContent = "";
    return;
  }
  const w = durationBounds(v.work);
  const r = durationBounds(v.rest);
  const ready = inputs.ready.checked ? 5 : 0;
  const lo = ready + v.rounds * w.min + (v.rounds - 1) * r.min;
  const hi = ready + v.rounds * w.max + (v.rounds - 1) * r.max;
  const mins = (s: number) => Math.max(1, Math.round(s / 60));
  el.textContent =
    mins(lo) === mins(hi) ? `About ${mins(lo)} min` : `About ${mins(lo)} to ${mins(hi)} min`;
}

function renderLists(): void {
  const wrap = $("lists");
  wrap.replaceChildren();
  if (store.lists.length === 0) return;
  const label = document.createElement("span");
  label.className = "lists-label";
  label.textContent = "Saved:";
  wrap.append(label);
  store.lists.forEach((list, i) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.className = "chip-load";
    loadBtn.textContent = list.name;
    loadBtn.setAttribute("aria-label", `Use list ${list.name}`);
    loadBtn.addEventListener("click", () => {
      inputs.exercises.value = list.exercises.join("\n");
      ($<HTMLInputElement>("list-name")).value = list.name;
      onChange();
      setStatus(`Loaded “${list.name}”.`);
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "chip-del";
    del.textContent = "×";
    del.setAttribute("aria-label", `Delete list ${list.name}`);
    del.addEventListener("click", () => {
      store.lists.splice(i, 1);
      save(store);
      renderLists();
      setStatus(`Deleted “${list.name}”.`);
      inputs.exercises.focus();
    });
    chip.append(loadBtn, del);
    wrap.append(chip);
  });
}

let statusTimer = 0;
function setStatus(msg: string): void {
  const el = $("list-status");
  el.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => (el.textContent = ""), 4000);
}

$("save-list").addEventListener("click", () => {
  const nameInput = $<HTMLInputElement>("list-name");
  const name = nameInput.value.trim();
  const exercises = exerciseList();
  if (!exercises.length) {
    errors.exercises.textContent = "Add at least one exercise before saving a list.";
    inputs.exercises.focus();
    return;
  }
  if (!name) {
    setStatus("Type a name for the list first.");
    nameInput.focus();
    return;
  }
  const existing = store.lists.findIndex((l) => l.name.toLowerCase() === name.toLowerCase());
  if (existing >= 0) store.lists[existing] = { name, exercises };
  else store.lists.push({ name, exercises });
  const ok = save(store);
  renderLists();
  setStatus(
    ok
      ? existing >= 0
        ? `Updated “${name}”.`
        : `Saved “${name}”.`
      : "Couldn't save. Your browser may be blocking storage (private mode?).",
  );
});

function onChange(): void {
  persist();
  updateEstimate();
}
form.addEventListener("input", onChange);
form.addEventListener("change", onChange);

document.querySelectorAll<HTMLButtonElement>(".step").forEach((b) =>
  b.addEventListener("click", () => {
    const n = (Number(inputs.rounds.value) || 0) + Number(b.dataset.step);
    inputs.rounds.value = String(Math.min(99, Math.max(1, n)));
    onChange();
  }),
);

// ---------- Workout ----------

let state: TimerState | null = null;
let loop = 0;
let lastIndex = -1;
let lastTickSecond = -1;
let lastPlanSettings: Valid | null = null;

function show(view: keyof typeof views): void {
  for (const [k, el] of Object.entries(views)) el.hidden = k !== view;
  document.body.dataset.view = view;
}

function cue(c: Cue): void {
  if (store.settings.sound) beep(c);
  if (store.settings.vibrate) buzz(c);
}

function flash(): void {
  const el = $("flash");
  el.classList.remove("on");
  void el.offsetWidth; // restart the animation
  el.classList.add("on");
}

function startWorkout(v: Valid): void {
  unlockAudio();
  lastPlanSettings = v;
  const plan = buildPlan(
    { ...v, readySeconds: inputs.ready.checked ? 5 : 0 },
    mulberry32(randomSeed()),
  );
  state = startTimer(plan, performance.now());
  lastIndex = -1;
  lastTickSecond = -1;
  $("pause").textContent = "Pause";
  show("session");
  updateMute();
  void keepAwake(true);
  clearInterval(loop);
  loop = window.setInterval(frame, 100);
  frame();
  $("pause").focus();
}

function describeNext(plan: Segment[], i: number): string {
  const n = plan[i + 1];
  if (!n) return "Last one. Finish strong.";
  if (n.kind === "rest") return `Then rest ${formatClock(n.seconds)}`;
  return `Next: ${n.exercise} · ${formatClock(n.seconds)}`;
}

function frame(): void {
  if (!state) return;
  const now = performance.now();
  state = tick(state, now);
  if (state.status === "done") return finish();

  const seg = state.plan[state.index];
  const left = secondsLeft(state, now);
  const session = views.session;

  if (state.index !== lastIndex) {
    lastIndex = state.index;
    lastTickSecond = -1;
    session.dataset.kind = seg.kind;
    const workRounds = state.plan.filter((s) => s.kind === "work").length;
    $("round").textContent = seg.round === 0 ? `${workRounds} rounds` : `Round ${seg.round} of ${workRounds}`;
    $("phase").textContent = seg.kind === "ready" ? "Get ready" : seg.kind === "work" ? "Work" : "Rest";
    $("exercise").textContent =
      seg.kind === "work" ? seg.exercise! : seg.kind === "rest" ? "Breathe" : (state.plan[state.index + 1]?.exercise ?? "");
    $("next").textContent =
      seg.kind === "ready" ? `First up · ${formatClock(state.plan[state.index + 1]?.seconds ?? 0)}` : describeNext(state.plan, state.index);
    $("announce").textContent =
      seg.kind === "work"
        ? `Work: ${seg.exercise}, ${seg.seconds} seconds.`
        : seg.kind === "rest"
          ? `Rest, ${seg.seconds} seconds.`
          : `Get ready. First up: ${state.plan[state.index + 1]?.exercise ?? ""}.`;
    if (seg.kind !== "ready") {
      cue(seg.kind);
      flash();
    }
  }

  if (state.status === "running" && left <= 3 && left >= 1 && seg.seconds > 3 && left !== lastTickSecond) {
    lastTickSecond = left;
    cue("tick");
  }

  $("clock").textContent = seg.seconds >= 60 ? formatClock(left) : String(left);
  session.classList.toggle("final", left <= 3);
  session.classList.toggle("paused", state.status === "paused");
  const elapsed = 1 - (state.status === "running" ? state.endsAt - now : state.remainingMs) / (seg.seconds * 1000);
  $("bar").style.transform = `scaleX(${Math.min(1, Math.max(0, elapsed))})`;
}

function finish(): void {
  if (!state) return;
  clearInterval(loop);
  const plan = state.plan;
  state = null;
  void keepAwake(false);
  cue("done");
  const work = plan.filter((s) => s.kind === "work");
  $("done-summary").textContent = `${work.length} ${work.length === 1 ? "round" : "rounds"}, ${formatClock(
    totalSeconds(plan.filter((s) => s.kind !== "ready")),
  )} total.`;
  const log = $("done-log");
  log.replaceChildren(
    ...work.map((w) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = w.exercise!;
      const t = document.createElement("span");
      t.className = "mono";
      t.textContent = formatClock(w.seconds);
      li.append(name, t);
      return li;
    }),
  );
  show("done");
  $("done-title").focus();
}

function togglePause(): void {
  if (!state) return;
  unlockAudio();
  const now = performance.now();
  state = state.status === "paused" ? resumeTimer(state, now) : pauseTimer(state, now);
  const paused = state.status === "paused";
  $("pause").textContent = paused ? "Resume" : "Pause";
  $("announce").textContent = paused ? "Paused." : "Resumed.";
  void keepAwake(!paused);
  frame();
}

function skip(): void {
  if (!state) return;
  state = skipSegment(state, performance.now());
  frame();
}

let endArmed = 0;
function end(): void {
  const btn = $("stop");
  if (!endArmed) {
    btn.textContent = "Tap again to end";
    endArmed = window.setTimeout(() => {
      btn.textContent = "End";
      endArmed = 0;
    }, 3000);
    return;
  }
  clearTimeout(endArmed);
  endArmed = 0;
  btn.textContent = "End";
  clearInterval(loop);
  state = null;
  void keepAwake(false);
  show("setup");
  $("start").focus();
}

function updateMute(): void {
  const m = $("mute");
  m.textContent = store.settings.sound ? "Sound on" : "Sound off";
  m.setAttribute("aria-pressed", String(!store.settings.sound));
}

$("pause").addEventListener("click", togglePause);
$("skip").addEventListener("click", skip);
$("stop").addEventListener("click", end);
$("mute").addEventListener("click", () => {
  store.settings.sound = !store.settings.sound;
  inputs.sound.checked = store.settings.sound;
  save(store);
  updateMute();
});
$("again").addEventListener("click", () => {
  const v = validate(false) ?? lastPlanSettings;
  if (v) startWorkout(v);
});
$("edit").addEventListener("click", () => {
  show("setup");
  $("start").focus();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  persist();
  const v = validate(true);
  if (v) startWorkout(v);
});

document.addEventListener("keydown", (e) => {
  if (views.session.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
  const onButton = (e.target as HTMLElement)?.tagName === "BUTTON";
  if (e.key === " " && !onButton) {
    e.preventDefault();
    togglePause();
  } else if (e.key === "n" || e.key === "N") {
    skip();
  } else if (e.key === "Escape") {
    end();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state?.status === "running") {
    void keepAwake(true);
    frame();
  }
});

// ---------- Boot ----------

fillForm();
renderLists();
updateEstimate();
show("setup");

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is a bonus; the timer works without it */
    });
  });
}
