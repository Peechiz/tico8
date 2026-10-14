# Font

`tom-thumb.bdf` is Tom Thumb, a 3x5 pixel font in a 4x6 cell, by Robey
Pointer after Brian Swetland's 4x6 font:
https://robey.lag.net/2010/01/23/tiny-monospace-font.html

The file is the unmodified download from
https://robey.lag.net/downloads/tom-thumb.bdf. Its authors offer it under
MIT, CC0 or CC-BY 3.0; tico8 uses it under CC0.

## Regenerating the data

The engine does not read the BDF. It draws from
`packages/tico8/src/text/tom-thumb.ts`, which is generated. After changing
the BDF or the script, run this from the repo root:

```
node scripts/font.js
```

The game symbols (`♥ ● ★ ♪ ← ↑ → ↓ Ⓐ Ⓑ Ⓧ Ⓨ`) are not part of Tom Thumb. They
are drawn by hand in `packages/tico8/src/text/symbols.ts`.

## Regenerating the web font

The UI layer draws HTML text in `packages/tico8/src/ui/tico8.otf`, the
console's `FONT` (Tom Thumb and the symbols) drawn as 100-unit squares. It
is generated too. After changing the font data or the script, run:

```
node scripts/webfont.js
```

`packages/tico8/src/ui/font.test.ts` reads the file back and fails if any
glyph no longer matches its pixels.
