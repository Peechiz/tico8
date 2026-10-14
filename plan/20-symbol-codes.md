# 20 — Symbol codes

Stub. Detail the tasks before starting (see `../AGENTS.md`, step 2).

## Demo

`examples/20-symbol-codes`: a title reading `Press :a: to start` and a
`:heart: :heart: :heart:` lives row, drawn with Ⓐ and ♥ in the pixel font and
in the UI layer, with no glyph typed by hand anywhere in the source.

## Spec

`01-spec.md`: Text and UI ("Characters", the UI layer's font).

## Decide first

- Slack-style `:name:` codes in strings, a typed constant
  (`` `${GLYPH.a} to start` ``, autocompleted and checked), or both.
- The names: `:a:` `:b:` `:x:` `:y:`, `:left:`…`:down:`, `:heart:`,
  `:dot:`, `:star:`, `:sparkle:`, `:note:`; and whether Slack's own names
  (`:arrow_left:`, `:musical_note:`) work as aliases.
- Where codes are read: `text()` and `label()` only, or the UI layer's
  JSX text too (button labels, the pause menu's game items).
- What happens to an unknown `:name:` (left as typed, or a dev warning),
  and how to write a literal `:heart:`.
- Whether a type can flag an unknown code in a string literal at edit
  time.

## Task areas

- Code table and replacing codes in a string
- `text` / `label` (and measuring) reading codes
- UI layer text reading codes, if decided
- Example and its pixel test

## Check

To write with the tasks.

## Decisions made

None yet.
