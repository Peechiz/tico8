# 04 — Text

## Demo

`examples/04-text` is a walk to collect five coins, two of them up where
only a jump reaches. It draws a HUD with a
coin count and a right-aligned score, a centred title in mixed case with a
plate behind it, a boxed two-line hint whose words change when every coin is
found, a sign in the world that scrolls with the camera, coins drawn with
the font's own symbol, and a ticker sliding through a clipped window.

## Spec

`01-spec.md`: Text and UI, "In-game text".

## Decided

- **The font is Tom Thumb,** by Robey Pointer after Brian Swetland: 3x5
  letters in a 4x6 cell, with lower case. Used under CC0, which its authors
  offer beside MIT and CC-BY 3.0, so no notice has to ship; it is credited
  anyway.
- **Characters:** ASCII plus game symbols, typed straight into strings:
  `♥ ● ★ ♪ ← ↑ → ↓` and the four pad buttons `Ⓐ Ⓑ Ⓧ Ⓨ`.
- **Two ways to draw:** `text(string, { x, y, color, align })` for a
  one-off, and `label({ x, y, text, color, align })` for a value that holds
  its place and look, with `draw()` and `bounds`.

## Layout

```
packages/tico8/font/        the font's source and its credit
packages/tico8/src/text/    types, the font as data, drawing
scripts/font.js             turns the source into data
```

## Tasks

- [x] **1. Contract** *(contract)*. Lead. The public text types, the font
  and glyph types, and the rules for width, height and alignment.
  Owns: `src/text/types.ts`. Waits on: none.
- [x] **2. Font.** The Tom Thumb source and its credit in the repo; a script
  that turns it into data; the game symbols drawn by hand; `FONT`, one font
  holding both. Its test draws letters and symbols as text pictures and
  checks every glyph fits its cell.
  Owns: `packages/tico8/font/`, `scripts/font.js`, `src/text/tom-thumb.ts`,
  `src/text/symbols.ts`, `src/text/font.ts`, `src/text/font.test.ts`.
  Waits on: 1.
- [x] **3. Drawing text.** `createText(screen, font)` gives `text`, with
  `text.measure`, and `label`. Everything is drawn through the screen's
  `pixel` and `span`, so camera and clip apply. Tested against a small font
  made in the test, so it does not wait on task 2.
  Owns: `src/text/text.ts`, `src/text/text.test.ts`. Waits on: 1.
- [x] **4. Demo.** Lead. The scene under "Demo".
  Owns: `examples/04-text/`. Waits on: 1.
- [x] **5. Wire up.** Lead only. Export `text` and `label` from the engine,
  drawn in `FONT` on the one screen; a test that draws real words through
  the public API; run the demo.
  Owns: `src/index.ts`, `src/index.test.ts`. Waits on: 2, 3, 4.

## Check

- `pnpm test` passes, including text pictures of a word in the real font,
  a symbol, a two-line text, each alignment, and text cut by a clip under a
  camera.
- `pnpm lint` and `pnpm typecheck` pass.
- `pnpm dev` shows the Demo.

## Decisions made

- **Accented letters come along.** Tom Thumb already has the Western
  European ones, so they are kept though only ASCII and symbols were asked
  for.
- **Default colour** is white.
- **Sizes:** the rules are at the foot of `src/text/types.ts`. A line's
  width leaves out the gap after its last letter; a text is 6 pixels tall
  per line, the sixth row being where `g` and `y` hang.
- **Alignment is per line** and about `x`: left starts there, centre
  straddles it, right ends just before it.
- **A label's `bounds`** is read, not stored, and is a rect, so it can be
  filled, stroked and hit-tested. A label is not itself a rect, since its
  `x` is not its left edge when centred.
- **The demo was reworked** after the user found the first one odd: its
  score rose on its own and its sign was cut mid-sentence to show the clip.
  Now the score comes from coins, the sign fits its words, and the clip is
  shown by a ticker.
- **No word wrap.** A line breaks only at `\n`.
- **Text drawing details.** A glyph's set pixels are drawn as `span`s along
  each row. A character with no row in a glyph (fewer rows than `height`)
  draws nothing there. A label's `bounds` is `{ x: left column of the widest
  line, y: floor(y), width, height }`, the same size `text.measure` gives.
- **Glyph width is the BDF advance less the gap.** Three Tom Thumb glyphs
  (`ĝ` and two stray Lao and Cherokee letters) advance 6, so they are 5
  wide with a 3-wide picture; every other one is 3.
- **Symbols are wider than letters:** heart, coin, star, note and arrows
  are 5 wide and keep the sixth row empty; the pad buttons are 7.
- **A pad button is a filled 7x6 button with a 3x4 letter cut out.** The
  first drawing was 5 rows with a 3x3 letter, and the user read its `A` as
  an up arrow. The buttons are the only glyphs besides descenders to use
  the sixth row. `Ⓑ` is a lower-case `b`: no capital B fits in four rows.
- **`●` is the coin,** drawn by hand; Tom Thumb's own small bullet `•`
  stays a separate character.
- **`tom-thumb.ts` is checked against the BDF** by the test, which runs
  `node scripts/font.js --print` and compares.

## Not checked

- A real keyboard: key events were sent by script.
- The symbols on a real screen at 1x.
