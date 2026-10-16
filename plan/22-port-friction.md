# 22 — Port friction

Stub. Detail the tasks before starting (see `../AGENTS.md`, step 2).

Celeste Classic was ported from its Pico-8 cart into `../celeste-test`, a
sibling project outside this repo. Below is what the engine made hard. Each
item is a candidate, not a decision: settle which ones this slice takes.
Things that turned out to be porting mistakes (Lua shapes carried over, a
linked install) are left out.

## Demo

`examples/22-<name>`: a small game of rooms on one map, showing whichever
items are taken. `../celeste-test` is moved onto the changes as the real
check, and its own helpers for them deleted.

## Spec

`01-spec.md`: Maps, Positions and vectors, Text and UI, Sound, Export.

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

## Decide first

- Which of the items above this slice takes, and which go to the spec's
  optional enhancements or are dropped.
- 1 and 2: an area argument on `draw`, `tile`, `overlaps` and `tiles`, a
  view of a layer limited to an area (`world.cells.area(room)`), or rooms
  as a map concept.
- 4 and 5: where helpers live (`vec`, a `math` export, the sprite) and
  their names.

## Task areas

To write once the list is settled.

## Check

To write with the tasks.

## Decisions made

None yet.
