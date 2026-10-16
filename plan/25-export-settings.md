# 25 — Export settings

Stub. Detail the tasks before starting (see `../AGENTS.md`, step 2).

Slice 22 makes export warn about large wav files. This slice adds export
settings to `tico8.config.ts`, starting with transcoding sounds so a game
can keep wav sources and still ship a small page.

## Demo

`examples/25-<name>`: a game with wav sounds whose exported page is a
fraction of their size, with the setting on.

## Spec

`01-spec.md`: Project config, Export and sharing.

## Task areas

To write once "Decide first" is settled.

## Decide first

- The shape of export settings in `tico8.config.ts`, and which belong
  there beyond transcoding.
- Transcoding is off by default. The encoder: a pure-JS mp3 encoder so
  export never needs ffmpeg installed, or another. mp3 because older Safari
  cannot play ogg.
- Which files it touches (wav only, or any sound over a size) and the
  quality.

## Check

To write with the tasks.

## Decisions made

None yet.
