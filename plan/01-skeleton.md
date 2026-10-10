# 01 — Skeleton

The thinnest path from a game file to pixels on screen, with the test and dev
tooling every later slice builds on.

## Demo

`examples/demo/main.ts` exports `init`, `update` and `draw`. `tico8 dev` opens
it in the browser: a 128x128 screen, scaled up crisp, with one dot moving
across a cleared background at 30 updates per second. Saving `main.ts` restarts
the game with the new code.

## Spec

`01-spec.md`: Platform, Screen and colour, Game loop.
`00-outline.md`: step 2, "Tooling" and "What reload means".

Fixed in this slice and made configurable in slice 05: 128x128, 30 updates per
second, Pico-8's palette.

## Layout

A pnpm workspace:

```
packages/tico8/     the engine, the CLI and the Vite plugin
examples/demo/      the game every slice adds to
```

## Tasks

- [x] **1. Workspace.** Root `package.json`, `pnpm-workspace.yaml` and the scripts
  `test`, `typecheck` and `dev`; shared `tsconfig`; Vitest set up; empty
  `packages/tico8` and `examples/demo` packages.
  Owns: root config files, both `package.json` files. Waits on: none.
- [x] **2. Contract** *(contract)*. The exported types and empty functions:
  the screen size values, clear screen, set one pixel, and the shape of a
  game's main file.
  Owns: `packages/tico8/src/index.ts`. Waits on: 1.
- [x] **3. Pixel buffer.** One palette index per pixel; clear and set-pixel
  write into it; out-of-range writes are ignored; a function turns the buffer
  into RGBA through the palette. Also a test helper that compares a buffer to
  a small text picture, for every later slice to use.
  Owns: `src/screen.ts`, `src/palette.ts`, `src/testing.ts`, their tests.
  Waits on: 2.
- [x] **4. Loop.** Fixed-rate updates driven by a clock passed in, so tests
  step it by hand. `init` once, then updates at the set rate; when drawing
  falls behind, draws are skipped and updates keep their rate.
  Owns: `src/loop.ts`, its test. Waits on: 2.
- [x] **5. Browser host.** Mounts a canvas, scales it by whole numbers to fit
  the window with no smoothing, and shows the buffer after each draw.
  Owns: `src/host.ts`. Waits on: 2.
- [x] **6. Dev command.** `tico8 dev` run in a project folder serves that
  project's `main.ts` through Vite with no config file in the project. A code
  change restarts the game: `init` runs again on a cleared screen.
  Owns: `src/cli.ts`, `src/vite.ts`, the page template. Waits on: 2.
- [x] **7. Demo game.** The moving dot.
  Owns: `examples/demo/`. Waits on: 2.
- [x] **8. Wire up.** Lead only. Connect loop, buffer, host and dev command;
  run the demo.
  Waits on: 3, 4, 5, 6, 7.

## Check

- `pnpm test` passes, including: a buffer test using the text-picture helper,
  and a loop test showing updates keep their rate while draws are skipped.
- `pnpm lint` passes.
- `pnpm typecheck` passes.
- `pnpm dev` shows the Demo; editing the dot's colour in `main.ts` and
  saving restarts it without touching the browser.

## Decisions made

- **Package manager:** pnpm.
- **Lint and format:** Biome, added after the slice closed. `pnpm lint`
  reports, `pnpm check` fixes. The non-null `!` rule is off, since strict
  index checks make `!` routine in pixel loops.
- **Names:** `screen.width` / `screen.height`, `clear(color = 0)`,
  `pixel(x, y, color)`. A game's exports are typed by `Game`.
- **Drawing off screen:** ignored. Fractional positions are floored. A colour
  outside 0-15 wraps.
- **Catching up:** after a long gap the loop runs at most 5 updates in one
  frame and drops the rest. Folded into the spec's "Game loop".
- **No build step yet:** the engine is TypeScript source. Node runs the CLI by
  type stripping and Vite serves the rest, so engine code uses erasable
  syntax only (the `tsconfig` enforces it) and `.ts` import extensions.
- **Restart on save:** the page is not reloaded. The entry module is re-run:
  the old game is stopped and its canvas removed, the screen cleared, `init`
  run again. Files the edit did not touch keep their module state.
- **Wiring:** `src/run.ts` joins screen, loop and host; `src/console.ts`
  holds the one screen and the fixed size, rate and palette.
- **`tico8 dev --port <n>`** was added.

## Not checked

- An edit to a file that `main.ts` imports (the demo has none).
- Screens with a fractional device pixel ratio, where scaled pixels may come
  out uneven.
