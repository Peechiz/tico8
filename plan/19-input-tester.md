# 19 — Input tester

Stub. Detail the tasks before starting (see `../AGENTS.md`, step 2).

## Demo

`examples/19-input-tester`: open the pause menu's Controls screen and press
things. Each row lights up while its button or action is held, from the
keyboard or a controller, so a player can tell whether their input is being
read at all, as Pico-8's controls screen does.

## Spec

`01-spec.md`: Pause menu (Controls), Input.

## Decide first

- What lights up: the row, the row's label, or the one binding that was
  pressed (so a player sees which key or button the console read).
- Whether the screen goes back to listing every binding of each pad button,
  not only the keys still free (slice 12 cut it down to those).
- Whether a connected controller is named on the screen, and whether
  sticks and triggers show how far they are pushed.
- How the screen is left when Ⓑ is the thing being tested: Back only, or Ⓑ
  held for a moment.

## Task areas

- Pad state reaching the controls screen each frame while paused
- Row highlight in the default CSS (`@layer tico8`), restyleable by a game
- Example and its pixel or DOM test

## Check

To write with the tasks.

## Decisions made

None yet.
