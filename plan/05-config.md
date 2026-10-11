# 05 — Config

Stub. Detail the tasks before starting (see `../AGENTS.md`, step 2).

## Demo

The demo's config file sets 160x144, a replaced palette with its own colour names and 60 updates per second, and the game follows without code changes.

## Spec

`01-spec.md`: Guiding rules ("few overrides"), Screen and colour, Game loop.

## Decide first

- The config file's name and form (a typed `.ts` file or JSON).
- Whether a config change swaps live or restarts the game.
- Where generated colour names are imported from (`tico8`, or a `colors.ts`
  in the project like sheets and maps).

## Task areas

- Config type and loader
- Screen presets
- Palette replacement, including how PNGs are matched against it
- Colour names declared with the palette and generated as typed references,
  replacing the fixed `COLOR` object the engine ships (see "Colour names" in
  the spec)
- Update rate
- Reload on config change
- A palette of more than 16 colours
- An opt-in warning for PNG colours outside the palette (the runtime already
  counts them; see `reportOffPalette` in `src/assets/sheets.ts`)

## Check

To write with the tasks.

## Decisions made

None yet.
