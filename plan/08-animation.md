# 08 — Animation and clock

Came out of slice 07, where the demo picks its walk frame with arithmetic
on the figure's position.

## Demo

`examples/08-animation` is the room of example 07 with a player sheet that
has standing, walking and attacking frames. The figure walks on a `walk`
animation and stands on a `stand` one, and the action button plays a
one-shot `attack` that hands back to walking or standing when `finished`.
A prompt on the HUD blinks once a second from `clock.seconds`. The game's
code has no counter and no frame arithmetic. Example 07 walks on `play`
too, and no longer freezes on the two diagonals.

## Spec

`01-spec.md`: Game loop, Sprites (Animation).

## Decided

- **Speed is frames per second,** `{ frames: [0, 1], fps: 8 }`, so an
  animation runs the same at 30 or 60 updates a second.
- **`clock`** has read-only `ticks` and `seconds`.
- **One-shots:** `loop: false` in the data, `hero.finished` to learn it
  ended, `play(animation, { restart: true })` to start it over.
- **Not in this slice:** a `frameAt` helper for tiles and particles, and
  animations named in the art (Aseprite tags). Animations stay plain data
  so the second can generate them later.
- **A new example,** and example 07 ported.

## Layout

```
packages/tico8/src/clock.ts     the count of updates and the time it makes
packages/tico8/src/loop.ts      gains a hook after each update, for the clock
packages/tico8/src/sprites.ts   Animation, PlayOptions, Sprite.play and finished
```

Which frame shows: an animation that has been played `n` times since it
started (0 on the first call) shows the frame at index
`Math.floor(n * fps / rate)`. A looping one wraps that index round its
frames; a one-shot stays on its last frame once the index passes the end,
and from that call `finished` is true.

## Tasks

- [x] **1. Contract** *(contract)*. Lead. `Animation`, `PlayOptions`,
  `Sprite.play` and `Sprite.finished`; `Clock` and `createClock`; the
  `afterUpdate` hook in `LoopOptions`; `createSheet` taking the update
  rate; `clock` and the new types exported from `tico8`.
  Owns: `src/clock.ts`, `src/index.ts`, the declarations in `src/loop.ts`
  and `src/sprites.ts`. Waits on: none.
- [x] **2. Clock.** `createClock(rate)`: `ticks` and `seconds` start at 0,
  `step` adds one update, `reset` puts both back; neither can be assigned
  by a game. The loop calls `afterUpdate` after every update it runs and
  not for one it drops, and not after `init`.
  Owns: `src/clock.ts` (body), `src/clock.test.ts`, `src/loop.ts` (body),
  `src/loop.test.ts`. Waits on: 1.
- [x] **3. Playing.** `sprite.play`: the frame by the rule under "Layout"
  at 30 and 60 updates a second; the same animation (same frames, fps and
  loop, even as a new object) carries on and a different one starts from
  its first frame; `restart` starts over; a one-shot holds its last frame
  and sets `finished`, which goes back to false when another animation
  starts; an animation with no frames, or an fps that is not above 0, is
  refused with a message naming why.
  Owns: `src/sprites.ts` (body), `src/animation.test.ts`. Waits on: 1.
- [x] **4. Demo.** The scene under "Demo": a copy of example 07's room
  and tiles, a player sheet with stand, walk and attack frames, and
  `main.ts`.
  Owns: `examples/08-animation/`. Waits on: 1.
- [x] **5. Port example 07.** Its walk frame comes from `play` instead of
  the figure's position.
  Owns: `examples/07-maps/main.ts`. Waits on: 1.
- [x] **6. Wire up.** Lead only. The console keeps one clock at the
  project's rate; `run` resets it before `init` and steps it after each
  update; sheets are made with the project's rate; a test that plays an
  animation on a sprite on the console's screen through several updates
  and checks the pixel buffer; run the demo.
  Owns: `src/console.ts`, `src/run.ts`, `src/assets/sheets.ts`,
  `src/animation.console.test.ts`. Waits on: 2, 3, 4, 5.

## Check

- `pnpm test` passes, including: `ticks` and `seconds` after a run of
  updates at 30 and at 60, with dropped updates not counted; a walk
  showing each frame for the right number of updates at both rates; the
  same animation written as a new object carrying on; `restart`; a
  one-shot holding its last frame with `finished` true; and a sprite
  animating on the console's screen, seen in the buffer.
- `pnpm lint` and `pnpm typecheck` pass, and `clock.ticks = 3` is a
  compile error.
- `pnpm dev` shows the Demo: walking, standing, the attack handing back,
  and the blinking prompt. `pnpm dev 07-maps` walks diagonally with its
  legs moving.

## Decisions made

- **Demo: the hero cannot move while attacking.** Walking is skipped
  until `hero.finished`, so the swing plays in place.
- **Refusals:** `play` throws `tico8: an animation needs at least one
  frame` and `tico8: an animation needs an fps above 0, got <fps>`.
- **The clock counts after each update,** through a new `afterUpdate` hook
  in the loop, so an update dropped after a long gap is never counted.
- **Sheets take the update rate** (`createSheet(screen, w, h, rate)`), since
  a sprite turns `fps` into updates itself.

