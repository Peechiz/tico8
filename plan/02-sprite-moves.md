# 02 — Sprite moves

The first milestone in `00-outline.md`: a PNG on disk becomes a typed sprite
the game moves with the arrow keys, and the folder is the only copy.

## Demo

`examples/demo/sprites/player.png` is drawn by `main.ts` through
`import { player } from './sprites'`. The arrow keys move it and flip it to
face its direction. Repainting the PNG in any editor and saving changes the
sprite in the running game without a restart. Deleting the PNG makes the
import a type error in VSCode.

## Spec

`01-spec.md`: Sprites; Input (the standard pad on keyboard only); Positions
and vectors.
`00-outline.md`: step 2, "What reload means".

Left for later slices: named actions, controllers and mouse (06); changing a
sprite's pixels at run time (03).

## Decided

- **Cell size:** in the file name. `player.png` is 8x8, `player.16.png` is
  16x16, `player.16x24.png` is 16 wide and 24 tall. All import as `player`.
- **Off-palette colours:** rendered as painted. Each gets a colour number
  of its own after the palette's. See "Imported art" in the spec.

## Tasks

- [x] **1. Contract** *(contract)*. Types for a sheet, a sprite instance and
  the stateless one-off draw; the standard pad with held, pressed and
  released plus a direction vector; signatures for every file below. The lead
  also pre-wires `run.ts`, `console.ts`, `index.ts`, `vite.ts` and the loop's
  before-update hook.
  Owns: `src/index.ts`, type declarations in every file below.
- [x] **2. Pixels to indexed.** Turn RGBA pixels into palette indices with a
  transparent marker, counting off-palette pixels; fetch and decode a PNG to
  RGBA in the browser, exactly as stored.
  Owns: `src/assets/png.ts`, its test. Waits on: 1.
- [x] **3. Blit.** Copy a rectangle of an indexed image into the pixel buffer,
  with flip on each axis, transparent pixels skipped, and anything off screen
  cut at the edge.
  Owns: `src/blit.ts`, its test. Waits on: 1.
- [x] **4. Sheets and sprites.** A sheet over an indexed image; `sprite()`
  returns an instance holding frame and flips, drawn at a position passed in
  as `x, y` or one value; the one-off draw.
  Owns: `src/sprites.ts`, its test. Waits on: 1.
- [x] **5. Generated references.** The Vite plugin reads the project's
  `sprites/` folder and writes a real `sprites.ts` into the project at start
  and whenever a PNG is added, removed or renamed.
  Owns: `src/vite/sprites.ts`, its test. Waits on: 1.
- [x] **6. Loading and live swap.** Sheets load before `init`. Saving a PNG
  replaces that sheet's pixels in the running game; `init` does not run again
  and existing sprite instances show the new art.
  Owns: `src/assets/sheets.ts`, `src/vite/assets-hmr.ts`. Waits on: 1.
- [x] **7. Keyboard pad.** Arrow keys and four button keys, sampled once per
  update so held and pressed are stable within an update.
  Owns: `src/input.ts`, its test. Waits on: 1.
- [x] **8. Demo.** Lead. Add `player.png` and move it in `main.ts`.
  Owns: `examples/demo/`. Waits on: 1.
- [x] **9. Wire up.** Lead only. Run the demo against the finished parts.
  Waits on: 2 to 8.

## Check

- `pnpm test` passes, including: a flipped, edge-cut blit against a text
  picture; just-pressed true for exactly one update; generated `sprites.ts`
  matching a folder of fixture PNGs.
- `pnpm lint` passes.
- `pnpm typecheck` passes, and fails after `player.png` is renamed.
- `pnpm dev` shows the Demo; repainting `player.png` shows up with the
  sprite still where it was.

## Decisions made

- **Names:** `sheet.sprite()`, `sheet.draw(frame, x, y, { flipX, flipY })`,
  `sheet.cell.width`, `sheet.frames`; a sprite has `frame`, `flipX`, `flipY`
  and `draw`. `input.left.held`, `.pressed`, `.released` for the four
  directions and `a`, `b`, `x`, `y`; `input.dir` is the held directions as a
  vector.
- **Frames** count from 0, left to right, then down. A frame outside the
  sheet draws nothing.
- **Sheet names** are the file name in camelCase (`big-boss.png` is
  `bigBoss`). Two files giving one name, a bad cell size or an unusable name
  are skipped with a warning.
- **Generated `sprites.ts`** is written at dev start and when the folder's
  file list changes. The demo's copy is checked in so `pnpm typecheck` works
  without the dev server.
- **PNG paths:** the generated file refers to `/sprites/<file>`, which the
  dev server serves. Export (slice 12) has to pack them.
- **Loading:** every sheet loads before `init`. A PNG that fails to load or
  does not fit its cell size is reported in the browser console and the
  sheet stays empty, or keeps its old picture on a live swap.
- **Colours:** at most 255 at once; the colour table only grows during a
  dev session, so many repaints in new off-palette colours can fill it
  until the page is reloaded.
- **Keys:** arrows, and Z, X, A, S for a, b, x, y, as a stand-in until
  slice 06.
- **Typecheck fix:** the root `tsconfig` did not cover `examples/` until
  this slice; it does now.

## Not checked

- A real keyboard: key events were sent by script.
- Editors that save by writing a temporary file and renaming it over the PNG.
- Sheets in subfolders of `sprites/` (ignored for now), and any browser
  other than Chromium.
- `player.16.png` style names in the running demo; they are covered by tests
  only.
