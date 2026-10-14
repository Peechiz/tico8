# 13 — Export

## Demo

`examples/13-export`, a new game copied from `examples/12-pause`: the star
catcher, with the stars and paddle drawn from a sprite sheet and a tiled
backdrop from a map, so the export carries every asset type (sheet, map,
flags, sound, the game's CSS, the UI font, the save). `pnpm export` in its
folder runs `tico8 export`, which writes `dist/13-export.html` and prints
its size. Double-clicking that file plays the game with no server: sprites,
map, music, pause menu and high score all work.

## Spec

`01-spec.md`: Export and sharing; Platform, "Limits".
`00-outline.md`: step 2, type-check before export.

## Decided

- **Assets as data URLs.** At export the generated `sprites.ts` and
  `sounds.ts` have each `'/sprites/…'` and `'/sounds/…'` address replaced
  by a base64 `data:` URL of the file. The loaders are unchanged: `fetch`
  reads `data:` URLs from a `file:` page. Maps and flags are JSON imports,
  so they are in the code already.
- **Type-check with tico8's TypeScript.** `typescript` moves into tico8's
  dependencies. A project's own `tsconfig.json` is used when it has one;
  otherwise tico8's settings. Errors are printed and stop the export;
  `--no-check` skips it.
- **Output:** `dist/<project>.html`, the project name being the save's
  (`projectName`). `--out <file>` overrides. The page's `<title>` is the
  project name.

## Layout

```
packages/tico8/package.json       + typescript dependency
packages/tico8/src/export/check.ts  typeCheck: tsc over the project
packages/tico8/src/vite/inline.ts   inlineAssets: sheet and sound addresses to data URLs at build
packages/tico8/src/export/build.ts  buildGame: one Vite build to one JS string and one CSS string
packages/tico8/src/export/page.ts   exportPage: the HTML around them; the page style shared with dev
packages/tico8/src/export/index.ts  exportGame: check, build, page, write, size
packages/tico8/src/cli.ts           + tico8 export [--out <file>] [--no-check]
packages/tico8/src/vite.ts          dev page uses PAGE_STYLE
```

One export, as `exportGame` drives it:

```
check !== false → typeCheck({ root })        errors → throw, output printed
buildGame({ root })                          vite build, tico8() + inlineAssets(), write: false
exportPage({ title, js, css })               inline <style> and <script type="module">
write out (default dist/<project>.html)      return { path, bytes }
```

A `file:` page cannot load `<script type="module" src>`, so the code goes
inline; inline module scripts do run from `file:`. The build is one chunk
(no dynamic imports split off) and every emitted asset, the UI font among
them, inlined (`assetsInlineLimit` always true).

## Tasks

- [x] **1. Contract** *(contract)*. Lead. `typescript` in tico8's
  dependencies. Signatures, each throwing "not yet":
  `typeCheck({ root }): Promise<{ errors: number; output: string }>`,
  `inlineAssets(): Plugin` and `dataUrl({ file, bytes }): string`,
  `buildGame({ root }): Promise<{ js: string; css: string }>`,
  `exportPage({ title, js, css }): string` and `PAGE_STYLE`,
  `exportGame({ root, out?, check? }): Promise<{ path: string; bytes: number }>`.
  Owns: `packages/tico8/package.json`, the declarations in every file
  below. Waits on: none.
- [x] **2. Type-check.** `typeCheck` runs the `tsc` from tico8's own
  `typescript` (resolved from tico8, spawned with `node`, `--noEmit`
  `--pretty`) in the project folder: `-p` the project's `tsconfig.json`
  when there is one, otherwise tico8's settings (strict, bundler
  resolution, JSX through `tico8/ui`, as the root `tsconfig.json`) over
  `main.tsx` or `main.ts`. Engine source it pulls in must check clean too
  (it uses `import.meta.hot` and `__TICO8_PROJECT__`). `errors` is the count
  of errors, `output` what tsc printed. Tested on a clean game and on a
  copy with a type error made at test time (a committed broken file would
  fail `pnpm typecheck`).
  Owns: `src/export/check.ts`, `src/export/check.test.ts`,
  `src/export/fixtures/check/`. Waits on: 1.
- [x] **3. Inline assets.** `inlineAssets()`, applied only at build:
  transforms the root's `sprites.ts` and `sounds.ts`, replacing each
  `'/sprites/<encoded name>'` or `'/sounds/<encoded name>'` string with a
  `data:` URL of the file on disk. `dataUrl` picks the type by extension
  (`.png` image/png, `.wav` audio/wav, `.ogg` audio/ogg, `.mp3`
  audio/mpeg) and base64-encodes. Tested by calling the hook on generated
  text with names that need encoding (spaces, `'`).
  Owns: `src/vite/inline.ts`, `src/vite/inline.test.ts`. Waits on: 1.
- [x] **4. Build.** `buildGame` runs Vite's `build` on the project with
  `configFile: false`, `tico8()` and `inlineAssets()`, the tico8 entry
  (`/@tico8/entry.js`) as input, `write: false`, one chunk, every asset
  inlined, minified. Returns the chunk's code and the emitted CSS joined.
  Tested on a fixture game with a sheet, a sound and a CSS import: the JS
  holds a `data:image/png` and `data:audio/` URL, no `/sprites/` or
  `/sounds/` address, no `import(`; the CSS holds the game's rule.
  Owns: `src/export/build.ts`, `src/export/build.test.ts`,
  `src/export/fixtures/game/`. Waits on: 1.
- [x] **5. Page.** `exportPage` writes the page: the same head as dev's
  (charset, viewport, `PAGE_STYLE`) with the title escaped, the CSS in a
  `<style>`, the JS in `<script type="module">` with every `</script`
  written `<\/script`. `PAGE_STYLE` is the dev page's `html, body` rule,
  moved here. Tested on a JS string holding `</script>` and a title
  holding `<`.
  Owns: `src/export/page.ts`, `src/export/page.test.ts`. Waits on: 1.
- [x] **6. Demo.** The game under "Demo": `examples/13-export` copied from
  `examples/12-pause`, a sprite sheet for stars and paddle, a backdrop
  map with a tile flag read somewhere (the paddle stops at flagged
  walls, say), and `"export": "tico8 export"` in its `package.json`.
  Owns: `examples/13-export/`. Waits on: 1.
- [x] **7. Wire up.** Lead only. `exportGame` as under "Layout", the
  `export` command and its size line (`Wrote dist/13-export.html
  (212.4 KB)`), the dev page on `PAGE_STYLE`, `dist` in `.gitignore`. A
  test exporting the fixture game into a temp file. Export the demo and
  play it from `file:`.
  Owns: `src/export/index.ts`, `src/export/index.test.ts`, `src/cli.ts`,
  `src/vite.ts`, `.gitignore`. Waits on: 2–6.

## Check

- `pnpm test` passes, including: a clean game checking with no errors and
  a broken one counted and printed; sheet and sound addresses replaced by
  data URLs; a build with no asset addresses or split chunks left; a page
  that escapes `</script` and the title; an export writing one file.
- `pnpm lint` and `pnpm typecheck` pass.
- `tico8 export` in `examples/13-export` writes `dist/13-export.html` and
  prints its size; a type error in `main.tsx` stops it, `--no-check` lets
  it through.
- The exported file, opened from `file:`, plays the Demo: sprites, map,
  music after the first key, pause menu, high score kept after a reload.
- `pnpm dev` still runs `examples/12-pause`.

## Decisions made

- Type-check: TypeScript 7 refuses files on the command line when it finds
  any `tsconfig.json`, including the workspace's above the project, so
  without one in the project folder itself tsc runs with `--ignoreConfig`,
  tico8's settings as flags, `--types ""` and tico8's own
  `vite/client.d.ts` passed as a file (a pnpm game folder cannot resolve
  `vite/client`). A `tsconfig.json` counts only in the project folder.
  Errors are counted from `error TS…` lines; a tsc that fails with none
  counted still counts as one, so a crash stops the export. The output is
  printed as tsc gave it, colour kept.
- `inlineAssets` runs `enforce: 'pre'`: after Vite's own transform the
  generated files have double quotes and the match missed (found by the
  build task; the hook's unit test could not see it). A missing file stops
  the build naming it.
- Build: `rolldownOptions.output.codeSplitting: false` (Vite 8's name for
  one chunk), every asset inlined (the UI font too), CSS not split,
  minified, no sourcemaps, `.env` files not read, warnings shown. Anything
  emitted besides the one chunk and CSS is an error naming it.
- Page: `PAGE_STYLE` and the game's CSS in two `<style>` blocks; `</script`
  and `</style` escaped keeping their case, `<!--` in the code too; the
  title escapes `& < > "`. The dev page uses `PAGE_STYLE`.
- CLI: a `commands` table; the size line shows the path relative to the
  project, or absolute when the file is outside it. `formatSize` gives B,
  KB or MB to one decimal. `TypeCheckError` carries tsc's output.
- Demo: the paddle is one 24x8 cell (`paddle.24x8.png`), stars twinkle on
  a two-frame `star.png`, the map is `night` with layers `sky` and `walls`
  and the `wall` flag on the brick only; the paddle backs out of a
  flagged tile after each step. Exported it is 235 KB.
- Seen from `file:` in Chrome: sprites, map, font, pause menu, no sound
  load warnings, `localStorage` working.
