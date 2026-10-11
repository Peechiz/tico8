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

## Decide first

- Where a sheet declares its cell size: file name, config entry, or a file
  beside the PNG. Listed under "Still to decide" in the spec.
- What happens to a PNG colour that is not in the palette: nearest palette
  colour, or an error naming the file and pixel.

## Tasks

- [ ] **1. Contract** *(contract)*. Types for a sheet, a sprite instance and
  the stateless one-off draw; the standard pad's directions and four buttons
  with held and just-pressed; the shape of the generated `sprites.ts`.
  Owns: `src/index.ts`, `src/sprites.ts` (types only), `src/input.ts` (types
  only). Waits on: "Decide first".
- [ ] **2. PNG to indexed.** Decode a PNG into palette indices plus a
  transparency mask taken from the PNG's alpha, split into cells of the
  sheet's size. Runs in the browser and in tests.
  Owns: `src/assets/png.ts`, its test and fixture PNGs. Waits on: 1.
- [ ] **3. Blit.** Copy one cell into the pixel buffer at a position, with
  flip on each axis, transparent pixels skipped, and cells partly off screen
  cut at the edge.
  Owns: `src/blit.ts`, its test. Waits on: 1.
- [ ] **4. Sheets and sprites.** A sheet built from decoded cells; `sprite()`
  returns an instance holding frame and flips, drawn at a position passed in;
  the one-off draw.
  Owns: `src/sprites.ts`, its test. Waits on: 1.
- [ ] **5. Generated references.** The Vite plugin watches the project's
  `sprites/` folder and writes a real `sprites.ts` into the project whenever
  a PNG is added, removed or renamed.
  Owns: `src/vite/sprites.ts`, its test. Waits on: 1.
- [ ] **6. Live swap.** Saving a PNG replaces that sheet's pixels in the
  running game; `init` does not run again and existing sprite instances show
  the new art.
  Owns: `src/vite/assets-hmr.ts`, `src/assets/reload.ts`. Waits on: 1.
- [ ] **7. Keyboard pad.** Arrow keys and four button keys, sampled once per
  update so held and just-pressed are stable within an update.
  Owns: `src/input.ts`, its test. Waits on: 1.
- [ ] **8. Demo.** Add `player.png` and move it in `main.ts`.
  Owns: `examples/demo/`. Waits on: 1.
- [ ] **9. Wire up.** Lead only. Register the plugin parts in `src/vite.ts`,
  feed input into the loop, run the demo.
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

None yet.
