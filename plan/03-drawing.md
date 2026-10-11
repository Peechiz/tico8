# 03 — Drawing

## Demo

The demo draws a scene with every shape, scrolls it with the camera, cuts a window with the clip rectangle and flashes the sprite with a palette swap.

## Spec

`01-spec.md`: Drawing.

## Decided

- **Shapes are values.** `rect({ x, y, width, height })`,
  `circle({ x, y, radius })` and `oval({ x, y, radiusX, radiusY })` make
  plain data; `fill(shape, color)` and `outline(shape, color)` draw any of
  them; `line({ from, to, color })` stands alone.
  `rect.overlaps` and `rect.contains` test them.
- **Camera and clip are blocks:** `camera(cam, () => { ... })` and
  `clip(area, () => { ... })`. Nothing is set or reset.
- **Recolouring belongs to what is drawn.** A sprite has `swap` and `flash`;
  one-off sheet draws take them as options. There is no global draw-time
  palette swap.
- **Whole-frame swap:** `screenSwap(swap)`, called in `draw`, lasts for that
  frame only.

## Tasks

- [x] **1. Contract** *(contract)*. Lead. Shape types, the sprite `swap`,
  `flash`, `pixel` and `erase` signatures, the public drawing API in
  `src/index.ts`, and the screen's draw state: camera offset, clip bounds,
  whole-frame swap, `span`, `read`, and a clean start to every frame.
  Owns: `src/index.ts`, `src/screen.ts`, `src/loop.ts`, `src/run.ts`.
- [x] **2. Shapes.** Make rects, circles and ovals; fill and outline each;
  draw lines; `rect.overlaps` and `rect.contains`. All drawing goes through
  the screen's `pixel` and `span`, so camera and clip apply.
  Owns: `src/shapes.ts`, its test. Waits on: 1.
- [x] **3. Sprites through the draw state.** Blit follows the camera and the
  clip and takes a colour remap; sprites and one-off draws apply `swap` and
  `flash`; a sheet's pixels can be read, changed and erased.
  Owns: `src/blit.ts`, `src/sprites.ts`, their tests. Waits on: 1.
- [x] **4. Demo.** Lead. A scene with every shape, a camera that follows the
  sprite, a clipped window, a hit flash and a frame fade.
  Owns: `examples/demo/`. Waits on: 1.
- [x] **5. Wire up.** Lead only. Run the demo against the finished parts.
  Waits on: 2, 3, 4.

## Check

- `pnpm test` passes, including text pictures of each shape filled and
  outlined, a sprite cut by a clip under a camera, and a swapped and a
  flashed sprite.
- `pnpm lint` and `pnpm typecheck` pass.
- `pnpm dev` shows the Demo.

## Decisions made

- **Named fields, not long positional lists.** After the slice closed the
  user asked for options objects in place of runs of bare numbers. Shape
  makers, `line`, `clip`, and a sheet's `draw`, `pixel` and `erase` now take
  one object. The rule is in the spec's "Naming".
- **Shapes hold their look.** Later the user found `fill` then `outline`
  for every shape tedious. Makers now take `fill` and `stroke` colours and
  the shape has `draw()`, which fills and then strokes. `outline` was
  renamed `stroke` to match the field; `fill(shape, color)` and
  `stroke(shape, color)` stay for bare objects such as a hitbox. `draw` is
  not a field of the shape, so a spread copy is a bare shape.
- **One example per slice.** The game moved to `examples/03-drawing`, and
  the slice 01 and 02 games were brought back as `examples/01-dot` and
  `examples/02-sprite`.
- **Design direction:** the user wants the API modern and convenient, not
  Pico-8-shaped. Now a guiding rule in the spec.
- **Shape sizes:** a rect covers `x` to `x + width - 1`. A circle of radius
  `r` covers its centre plus `r` pixels each way, so radius 0 is one pixel.
  Positions, sizes and radii are floored.
- **Shapes are told apart by fields:** `radiusX` and `radiusY` is an oval,
  `radius` a circle, `width` and `height` a rect.
- **Circle and oval rounding** is tico8's own (radius 1 is a plus, radius 2
  a 5x5 ring with cut corners). It was not compared with Pico-8's output.
- **`rect.overlaps`:** rects that only touch do not overlap.
- **A clip is placed like a shape,** so a camera in force moves it.
- **`clear`** fills the whole screen whatever the camera and clip.
- **Reading a pixel** goes through the camera; off screen reads as 0.
- **`flash` wins** when a sprite has both `flash` and `swap`. A swap is not
  chained.
- **Sheet pixel edits** are replaced when the PNG is saved again.
- **Colour numbers** are kept as one byte, so colours added by imported art
  can be drawn by number. A number with no colour behind it shows as black.
- **Every frame starts clean:** the whole-frame swap is cleared before each
  `draw` (`beforeDraw` in the loop).
- **Demo keys:** Z flashes the hero, X held shows night, touching the crate
  recolours the hero.

## Not checked

- Shapes against real Pico-8 output.
- Very large or very thin ovals, beyond the invariants tested to radius 8.
- A real keyboard: key events were sent by script.
