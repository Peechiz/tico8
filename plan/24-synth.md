# 24 — Synth

Stub. Detail the tasks before starting (see `../AGENTS.md`, step 2).

A game made in tico8 has no way to make a blip without an outside program
(item 6 of slice 22). Effects described as a few sfxr-style numbers in a
text file in the `sounds` folder become ordinary sounds.

## Demo

`examples/24-<name>`: a game whose every effect is a synth file, edited
live.

## Spec

`01-spec.md`: Sound, Export, and "A built-in synth" under Optional
enhancements, which this slice takes out of that list.

## Task areas

To write once "Decide first" is settled.

## Decide first

- The file: its name (`jump.sfx.json`), and which of sfxr's parameters it
  keeps, by name.
- A synth file is an ordinary `Sound`: imported from `./sounds`, played
  with `play`, swapped live on save. Rendered once on load, so playback is
  unchanged. Confirm, and say what happens to a wav and a synth file of the
  same name.
- Presets (jump, coin, hit, blip): a scaffold template, a CLI command, or
  defaults for missing numbers.
- Music stays as files. A tracker is out of scope for now and may come
  later.

## Check

To write with the tasks.

## Decisions made

None yet.
