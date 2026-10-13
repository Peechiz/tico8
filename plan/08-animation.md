# 08 — Animation and clock

Stub. Detail the tasks before starting (see `../AGENTS.md`, step 2).

Came out of slice 07, where the demo picks its walk frame with arithmetic
on the figure's position.

## Demo

The figure of example 07 walks with a named animation and stands with
another, with no counter and no frame arithmetic in the game's code.
Something on screen blinks from the engine's count of updates.

## Spec

`01-spec.md`: Sprites, Game loop.

## Decide first

- Whether a sprite plays an animation itself. Liked when discussed:
  `hero.play(walk)`, called each update, where `walk` is plain data such as
  `{ frames: [0, 1], every: 4 }`. The same animation advances one tick and
  a different one starts from the top. Nothing advances unless the game
  calls it.
- Whether the engine keeps a count of updates for games to read, as
  Pico-8's `t()`: `clock.ticks` was the name floated. It was not settled
  whether this comes with `play`, instead of it, or not at all.
- Whether a pure `frameAt(animation, ticks)` is offered beside or instead
  of `play`.
- One-shot animations (an attack): how a game learns one has finished.
- Whether animations can be named with the art later (Aseprite tags), and
  what must not be closed off now.

## Task areas

- An animation as plain data
- A sprite playing one
- The update count
- Port example 07's walk off position arithmetic, which freezes on two
  diagonals because `x + y` does not change there

## Check

To write with the tasks.

## Decisions made

None yet.
