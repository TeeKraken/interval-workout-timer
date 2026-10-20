> **This is a 100% AI-generated project.** It was designed, written, tested and deployed by the Somebody Build This steward (Claude, by Anthropic), from this idea on the board: [A random-interval workout timer you can load with your own exercises](https://somebodybuildthis.dev/ideas/20-a-random-interval-workout-timer-you-can-load-with-your-own-e).

<a href="https://somebodybuildthis.dev/ideas/20-a-random-interval-workout-timer-you-can-load-with-your-own-e"><img src="https://somebodybuildthis.dev/badge/20-a-random-interval-workout-timer-you-can-load-with-your-own-e.svg" alt="Built from an idea on Somebody Build This"></a>

# Shuffle Timer

A random-interval workout timer you load with your own exercises. Type in what you want to do (jog, walk, sprint, or anything else), say how long work and rest can be, and the timer picks each round for you. No planning, and no two workouts the same.

**Use it:** https://interval-workout-timer-gilt.vercel.app

## What it does

- **Your own exercises.** One per line. Each round picks one at random, and never the same one twice in a row.
- **Random lengths.** Give a list (`30, 45, 60`), a range (`20-90`), or a mix. `1:30` and `2m` work too. Rest works the same way; use `0` to skip rests.
- **Rounds and an estimate.** Pick how many rounds and see roughly how long the workout will take.
- **Saved lists.** Save exercise lists by name and switch between them with one tap.
- **Hard to miss cues.** A big countdown, the color changes between work (orange) and rest (green), beeps for the last 3 seconds and at each switch, and vibration on phones that support it.
- **Start, pause, skip, end.** Keyboard too: Space pauses, N skips, Esc ends.
- **Keeps the screen on** during a workout, where the browser allows it.
- **Works offline.** Install it to your home screen and use it with no signal.
- **Private.** Everything is saved on your device only. No account, no tracking, no analytics, no third-party scripts.

Works on phones from 375px wide, follows your system's light or dark mode, respects "reduce motion", and announces each new round to screen readers.

## Develop

Needs Node 22+ and pnpm.

```sh
pnpm install
pnpm dev       # local dev server
pnpm test      # unit tests (vitest)
pnpm check     # typecheck + tests
pnpm build     # production build into dist/
```

The interesting logic is small and pure, in `src/logic/`:

- `rng.ts` is a seedable random number generator (mulberry32), so plans are testable.
- `durations.ts` parses what people type into the length boxes and picks a length.
- `plan.ts` builds the whole workout up front from the settings.
- `timer.ts` is a timestamp-based state machine (start, tick, pause, resume, skip), so the clock stays accurate even when the browser slows down background tabs.

It is a static site (Vite + vanilla TypeScript) with no environment variables or secrets, hosted on Vercel.

## License

MIT
