export interface SavedList {
  name: string;
  exercises: string[];
}

export interface Settings {
  exercises: string;
  work: string;
  rest: string;
  rounds: number;
  sound: boolean;
  vibrate: boolean;
  ready: boolean;
}

export interface Stored {
  settings: Settings;
  lists: SavedList[];
}

const KEY = "shuffle-timer:v1";

export const defaults: Stored = {
  settings: {
    exercises: "Jog\nWalk\nSprint",
    work: "30, 45, 60",
    rest: "15-30",
    rounds: 8,
    sound: true,
    vibrate: true,
    ready: true,
  },
  lists: [
    { name: "Run / walk", exercises: ["Jog", "Walk", "Sprint"] },
    {
      name: "No equipment",
      exercises: ["Squats", "Push-ups", "Lunges", "Plank", "Jumping jacks", "Mountain climbers"],
    },
  ],
};

/** Reads saved data, falling back to defaults if storage is empty, blocked or corrupt. */
export function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaults);
    const parsed = JSON.parse(raw) as Partial<Stored>;
    const settings = { ...defaults.settings, ...(parsed.settings ?? {}) };
    const lists = Array.isArray(parsed.lists)
      ? parsed.lists.filter(
          (l): l is SavedList =>
            !!l && typeof l.name === "string" && Array.isArray(l.exercises),
        )
      : structuredClone(defaults.lists);
    return { settings, lists };
  } catch {
    return structuredClone(defaults);
  }
}

export function save(data: Stored): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
