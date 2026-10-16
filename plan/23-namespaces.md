# 23 — Namespaces

Stub. Detail the tasks before starting (see `../AGENTS.md`, step 2).

A game imports one name for every function it uses: `03-drawing` already
imports fifteen. Group the API into a few namespaces so a game imports a
handful, and give the maths helpers slice 22 found missing a home in them.

## Demo

`examples/23-<name>`: a small game written against the namespaces, and every
earlier example ported to them.

## Spec

`01-spec.md`: Naming, Positions and vectors, and every section whose names
move.

## Task areas

To write once "Decide first" is settled.

## Decide first

- Which namespaces, and what goes in each: a core one (`T8`: clear,
  camera, clip, input, clock, `SCREEN`), `RAND`, the shapes, `vec`.
- Whether namespaces are written in capitals (`RAND.pick(list)`), which
  extends the Naming rule from fixed tables to namespaces, and what that
  makes `vec`.
- Whether the flat exports stay beside the namespaces or go.
- Item 4 of slice 22, deferred to here. The helpers proposed there:
  `approach(value, target, step)` (Godot's `move_toward`), `clamp(value,
  min, max)`, `vec.approach`, and a random namespace with `int(min, max)`,
  `range(min, max)`, `pick(list)` and `chance(p)`, made one object so it can
  be seeded later for replays. `sign` is left to `Math.sign`. `clamp` and
  `approach` take three numbers, which the Naming rule does not allow yet.

## Check

To write with the tasks.

## Decisions made

None yet.
