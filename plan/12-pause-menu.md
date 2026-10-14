# 12 — Pause menu

Stub. Detail the tasks before starting (see `../AGENTS.md`, step 2).

## Demo

Pressing pause in the demo opens a built-in menu with resume, restart, volume and a controls screen listing the demo's actions and their bindings. The demo adds one item of its own.

## Spec

`01-spec.md`: Pause menu.

## Decide first

- Which button and key open it.
- Whether `update` stops while it is open.
- Whether games get a read-only `audio.unlocked`, so a game can show
  "press any key for sound" until the browser lets sound through. Raised
  after slice 09. The user asked for it to be explained from scratch when
  this slice is detailed: what the browser's first-press rule is, why a
  gamepad does not count, and what reading it would let a game do.

## Task areas

- Built-in menu on the UI layer
- Resume and restart
- Volume
- Controls screen generated from config
- Add items, restyle, replace

## Check

To write with the tasks.

## Decisions made

None yet.
