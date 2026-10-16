# 26 — Cart import

Stub. Detail the tasks before starting (see `../AGENTS.md`, step 2).

Porting Celeste Classic pulled the sheet, flags and map out of the
`.p8.png` with a hand-written script (item 8 of slice 22). `tico8 import`
does that for any cart. A nice-to-have: it may not be taken up unless the
cart's code can be converted too, without an agent.

## Demo

`examples/26-<name>`: a project made by `tico8 import` from a small cart,
running with its sprites and map.

## Spec

`01-spec.md`: Sprites, Maps, and the CLI.

## Task areas

To write once "Decide first" is settled.

## Decide first

- Whether to take the slice at all, which hangs on the last point.
- Inputs: `.p8` text, `.p8.png` (data in the image's low bits), or both.
- Output: `sprites/<name>.png` in tico8's Pico-8 palette;
  `<name>.flags.json` with Pico-8's eight flag bits named `flag0` to
  `flag7`, or from a mapping passed in; `maps/<name>.json` with one layer,
  or one map per room with `--rooms 16x16`.
- Code: whether a mechanical Lua-to-TypeScript conversion is worth
  attempting (parse the Lua, emit TypeScript against a Pico-8 shim), and
  how much of a real cart it gets right unaided. Sound and music are out.

## Check

To write with the tasks.

## Decisions made

None yet.
