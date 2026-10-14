# 18 — CLI info commands

Stub. Detail the tasks before starting (see `../AGENTS.md`, step 2).

## Demo

`tico8 palette` run in an example prints each colour of its palette: a
swatch in the colour itself, its number, its `COLOR` name, its hex and its
CSS variable. Run in an example with its own palette, it prints that
palette's names.

```
$ tico8 palette
 ██  0  black       #000000   var(--black)
 ██  1  darkBlue    #1d2b53   var(--darkBlue)
```

## Spec

`01-spec.md`: Project config, Screen and colour, the UI layer's palette
variables.

## Decide first

- Which commands join `palette` in this slice. Candidates: `tico8 check`
  (the config and asset checks without a server, for CI or a commit hook),
  `tico8 actions` (each action and what triggers it, the table the pause
  menu's controls screen shows) and `tico8 assets` (the sprites, maps and
  sounds found, and what was left out with a warning).
- How a swatch is drawn on a terminal without 24-bit colour, or when
  output is not a terminal.

## Task areas

- `palette` command reading the project's config as `tico8 dev` does
- Swatches in the terminal's colours
- Any further commands chosen above

## Check

To write with the tasks.

## Decisions made

None yet.
