# 22 — Port friction

Celeste Classic was ported from its Pico-8 cart into `../celeste-test`, a
sibling project outside this repo. Below is what the engine made hard; "Taken"
says which ones this slice fixes. Things that turned out to be porting mistakes (Lua shapes carried over, a
linked install) are left out.

## Demo

`examples/22-rooms` has one map, `maps/world.json`, of four rooms in a 2 by 2
grid, each one screen. The figure walks and falls in whole pixels with
`vec.step`, against the current room's walls only, and walking off a room's
edge shows the next room. Only the current room is drawn, with
`world.ground.area(room).draw()` and no `clip` or offset in the game. A
helper takes `LayerOf<typeof world>`. Exporting it with a wav in `sounds`
prints the warning.

`../celeste-test` is moved onto the changes as the real check, and its own
`drawRoom`, `tileFlagAt` and `Entity.move` deleted.

## Spec

`01-spec.md`: Maps, Positions and vectors, Input, Export and sharing.

## What got in the way

1. **A layer draws whole.** A map of many rooms, one screen each, has no
   way to draw one room: the port wraps every `layer.draw` in a `clip` and
   offsets it by the room's position (`drawRoom` in `main.ts`).
2. **Tile queries cover the whole layer.** `overlaps` and `tile` cannot be
   limited to an area, so a hitbox at a room's edge hits the next room's
   wall. The port clamps every box to the room by hand (`tileFlagAt` in
   `game.ts`).
3. **No way to name a layer's type.** A function that takes "a layer of
   this map" writes `typeof world.back`; `Layer<F>` needs the flags'
   names, which a game has no handle on.
4. **The maths every game rebuilds.** Move toward a target by a step
   (Godot's `move_toward`), sign, clamp, a random number in a range, a
   random pick: all written again in `pico.ts`.
5. **Moving in whole pixels.** A body that keeps the fraction of its speed
   for next update and steps a pixel at a time until a wall stops it
   (`Entity.move`, `moveX`, `moveY` in `entity.ts`) is what most platformers
   need. Weigh against "composable over baked-in": a small helper, not
   move-and-slide.
6. **Sound comes only as files.** Every effect and the music had to be
   rendered in Pico-8 and mixed by a script; a game made in tico8 has no
   way to make a blip. The spec's optional "built-in synth" is where this
   points.
7. **Export size.** The music as wav makes a 12 MB page, since every file
   goes in as base64. Options: warn on wav at export, transcode, or leave
   it to the game.
8. **No importer for Pico-8 carts.** Sheet, flags and map were pulled out
   of the `.p8.png` by a hand-written script (`tools/extract.py`). A
   `tico8 import` for carts (sprites, flags, map; not code) would make
   ports a step.
9. **Lower-case text.** Pico-8 shows lower case as small capitals; tico8's
   font has real lower case, so a port upper-cases its strings by hand.
   Possibly nothing to do; possibly a text option.
10. **Keys read only by `code`.** A key event with an empty `code` (as some
    test drivers send) is ignored, so driving the game from a browser
    automation tool needed hand-made events. Possibly fall back to `key`.

## Taken

Items 1, 2, 3, 5, 7 (the warning) and 10. The rest went elsewhere; see
"Decisions made".

## Layout

```
packages/tico8/src/maps/types.ts      Layer.area, LayerOf
packages/tico8/src/maps/layers.ts     area views over a layer
packages/tico8/src/vec.ts             vec.step
packages/tico8/src/export/build.ts    the inlined assets and their sizes
packages/tico8/src/export/index.ts    ExportResult.assets, the warnings
packages/tico8/src/cli.ts             printing the largest assets and warnings
packages/tico8/src/input/keyboard.ts  `key` when `code` is empty
examples/22-rooms/                    the demo
```

## Tasks

- [ ] **1. Contract** *(contract)*. Lead. `Layer.area(rect): Layer<F>` and
  `LayerOf<M>` in the maps types; `vec.step(pos, vel, blocked)` and its
  result type declared on `vec`; `ExportResult` gains the inlined assets
  with their sizes and the warnings to print. Empty bodies that throw.
  Owns: `src/maps/types.ts`, the declarations in `src/vec.ts`,
  `src/export/index.ts` (types only). Waits on: none.
- [ ] **2. Area views.** `layer.area(rect)` gives a layer over the cells the
  rectangle covers, grown to whole cells, counted from its top left:
  `columns`, `rows`, `width`, `height` are the area's; `draw`, `tile`,
  `tileAt`, `overlaps` and `tiles` see only the area, and outside it reads as
  empty; `set` writes to the layer under it. A view of a view works. A view
  stays live when the map file is swapped.
  Owns: `src/maps/layers.ts`, `src/maps/layers.test.ts`. Waits on: 1.
- [ ] **3. Stepping.** `vec.step` moves `pos` by `vel`, x then y, one whole
  pixel at a time, asking `blocked` with the floored position at each pixel.
  On a hit it leaves `pos` on the last free whole pixel on that axis and
  reports it; otherwise `pos` keeps its fraction. Returns `{ x, y }`
  booleans. A step of less than a pixel asks nothing unless it crosses one.
  Owns: `src/vec.ts` (body), `src/vec.test.ts`. Waits on: 1.
- [ ] **4. Export warning.** The build records each asset it inlines and its
  size. `exportGame` returns them largest first, and a warning for each wav:
  its path, its size and that an ogg or mp3 is about a tenth of it. The CLI
  prints the page's size, then the largest assets, then the warnings.
  Owns: `src/export/build.ts`, `src/export/index.ts` (body),
  `src/export/*.test.ts`, `src/cli.ts`. Waits on: 1.
- [ ] **5. Key fallback.** A key event whose `code` is empty is read by
  `key` as the `code` it has on a US layout: letters, digits, space, arrows,
  Enter, Escape, Tab, Backspace and the modifiers. An event with a `code`
  is read as now.
  Owns: `src/input/keyboard.ts`, `src/input/keyboard.test.ts`.
  Waits on: none.
- [ ] **6. Demo.** The game under "Demo": tileset, flags, `world.json` and
  `main.ts`, with `sprites.ts` and `maps.ts` as the dev tool writes them.
  Owns: `examples/22-rooms/`. Waits on: 1.
- [ ] **7. Wire up.** Lead only. `index.ts` exports `LayerOf`; a test that
  draws one room of a map through `area` on the console's screen and checks
  the pixel buffer; the spec's Maps, Positions and vectors, Input and Export
  sections; run the demo; move `../celeste-test` onto the changes.
  Owns: `src/index.ts`, `src/rooms.test.ts`, `01-spec.md`.
  Waits on: 2, 3, 4, 5, 6.

## Check

- `pnpm test` passes, including: one room of a four-room map drawn through
  `area` with nothing of its neighbours in the buffer; `overlaps` on a view
  false for a wall just past its edge; `set` through a view seen on the
  layer; `vec.step` stopping flush against a wall from either side and
  keeping its fraction in the open; the export of a fixture with a wav
  warning about it, and one without a wav not; a keydown with an empty
  `code` and `key: 'z'` pressing a button bound to `KeyZ`.
- `pnpm lint` and `pnpm typecheck` pass, and in example 22 a function taking
  `LayerOf<typeof world>` accepts `world.ground` and `world.ground.area(r)`.
- `pnpm dev` shows the Demo: only the current room is drawn, the figure
  stops at its walls and not at the next room's, and walking off an edge
  shows the next room.
- `../celeste-test` runs with its own room clipping, tile clamping and
  pixel stepping deleted.

## Decisions made

- **Items 1 and 2: an area view.** `layer.area(rect)` returns a plain
  `Layer<F>` limited to a rectangle in pixels, counted from the rectangle's
  top left: `world.back.area(room).draw()`. Chosen over an area argument on
  every method (Pico-8's `map` window) and over rooms as a map concept.
- **Edges of a view.** Outside a view reads as empty, as outside a layer
  does. `set` through a view writes to the layer under it. A rectangle off
  the cell lines grows to whole cells.
- **Item 3: `LayerOf<typeof world>`,** a helper type that reads the layer
  type off a map. Nothing new is generated in `maps.ts`.
- **Item 4 moves to slice 23,** which settles namespaces for the whole
  API; the maths helpers get their home there.
- **Item 5: `vec.step(pos, vel, blocked)`.** Moves `pos` by `vel` a whole
  pixel at a time, x then y, asking `blocked(at)` at each pixel; on a hit it
  stops flush and drops that axis's fraction. The fraction stays in `pos`,
  which sprites draw floored. Returns `{ x, y }` booleans for the axes that
  hit. Its final home may move with slice 23.
- **Item 6 moves to slice 24, Synth:** effects as a few sfxr-style numbers
  in a file, played as ordinary sounds. Music stays as files; a tracker is
  not planned yet.
- **Item 7: export warns.** It lists the largest assets and flags each wav
  with its size and a hint to convert it. Transcoding, as an export setting
  in `tico8.config.ts` off by default, moves to slice 25.
- **Item 8 moves to slice 26, Cart import,** a nice-to-have that may not
  be taken up unless a cart's code can be converted without an agent.
- **Item 9 is punted.** A port wanting Pico-8's small-capital lower case
  waits for custom fonts in the spec's optional enhancements.
- **Item 10: `key` when `code` is empty.** Read as the code it has on a US
  layout. Real keyboards always send a `code`, so players see no change;
  test drivers that send only `key` work.
