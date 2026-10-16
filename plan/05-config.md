# 05 — Config

## Demo

`examples/05-config` has a `tico8.config.ts` that sets 160x144 and 60
updates per second, and a `palette.ts` that declares more than sixteen
named colours of its own. Its `main.ts` never mentions a size or a number
for a colour: it lays itself out from `SCREEN`, draws a swatch of every
colour in `COLOR` and moves a sprite painted in the palette. Changing the
screen preset in the config, or a colour in the palette, and saving
restarts the game with the new look, with no edit to `main.ts`.

## Spec

`01-spec.md`: Guiding rules ("few overrides"), Project config, Screen and
colour, Game loop.

## Decided

- **The config file is `tico8.config.ts`,** typed, with one default export
  made by `defineConfig` from `tico8/config`. It sets the screen, the
  update rate and the off-palette warning.
- **Saving it restarts the game,** as saving code does. Game state is lost.
- **A palette is declared in game code** with `palette({ name: '#hex' })`,
  which returns the game's `COLOR`. Nothing is generated.

## Layout

```
packages/tico8/src/config.ts        what a config may say, and what it comes to
packages/tico8/src/project.ts       the project's config as the engine sees it
packages/tico8/src/vite/config.ts   the dev tool's side: serve, check, reload
<project>/tico8.config.ts           the project's settings
<project>/palette.ts                the project's colours, if it has its own
```

How a config reaches a game: the engine's `console.ts` imports
`src/project.ts`, which on its own is the empty config. The dev tool serves
the project's `tico8.config.ts` in its place. `resolveConfig` turns either
into `Settings`, and the screen and the rate are built from that. Tests
that never touch a project get the standard console.

How a palette reaches a game: `palette()` reads the colours it is given,
hands them to the console with `setPalette`, and returns each name with its
place in the list. Sheets watch for the change and match their pictures to
the new colours.

## Tasks

- [x] **1. Contract** *(contract)*. Lead. `Config`, `Settings`,
  `defineConfig`, `resolveConfig` and `ConfigError`, with the rules for
  defaults and for what is refused; `palette()` and what it refuses; the
  console built from `Settings`, with a palette that can be replaced.
  Owns: `src/config.ts`, `src/config.test.ts`, `src/project.ts`,
  `src/palette.ts`, `src/palette.test.ts`, `src/console.ts`,
  `packages/tico8/package.json`, and `palette` and `COLOR` in
  `src/index.ts`. Waits on: none.
- [x] **2. Dev tool.** A Vite plugin, `config()`. It serves the project's
  `tico8.config.ts` in place of `src/project.ts`; reads the config in Node
  at start and on every change to check it, and reports one that cannot be
  used in the terminal, once; and reloads the page when the config file
  changes, is added or is removed.
  Owns: `src/vite/config.ts`, `src/vite/config.test.ts`. Waits on: 1.
- [x] **3. Engine follows the settings.** `createText` takes the default
  text colour instead of assuming white; `createSheets` takes
  `warnOffPalette`, and with it on says, each time a sheet loads, how many
  of its pixels are in colours outside the palette; sheets load again when
  the palette changes.
  Owns: `src/text/text.ts`, `src/text/text.test.ts`,
  `src/assets/sheets.ts`, `src/assets/sheets.test.ts`. Waits on: 1.
- [x] **4. Demo.** The scene under "Demo", with its config, its palette
  and its sprite.
  Owns: `examples/05-config/`. Waits on: 1.
- [x] **5. Wire up.** Lead only. Add the plugin to `tico8()`; pass the
  settings to text, sheets and the loop; a test that builds the console
  from a config, gives it a palette and checks the pixel buffer; run the
  demo.
  Owns: `src/index.ts`, `src/index.test.ts`, `src/console.test.ts`,
  `src/run.ts`, `src/vite.ts`. Waits on: 2, 3, 4.

## Check

- `pnpm test` passes, including: a config resolved to its settings and a
  bad one refused with a message that names the setting; a palette read
  into colours and names; a sheet matched again after the palette changes;
  and a console built from a 160x144 config whose `clear(COLOR.<name>)`
  fills a 160x144 buffer that comes out in that colour's RGB.
- `pnpm lint` and `pnpm typecheck` pass, and a colour name not in example
  05's palette is a compile error there.
- `pnpm dev` shows the Demo; changing `screen` in its `tico8.config.ts`, or
  a colour in its `palette.ts`, and saving restarts it with the change.
- `pnpm dev 04-text` still runs as before.

## Decisions made

- **The demo's palette is a night market,** 23 colours: a dark `night` as
  colour 0, lantern reds and yellows, stall woods, greens, and the sea's
  blues and greys. `paper` is its lightest, so that is the text colour.
- **The demo's sprite is `wisp`,** a two-frame 8x8 lantern creature painted
  in `night`, `ember`, `lantern`, `honey` and `cream`.
- **The swatch grid sizes itself from the longest colour name:** as many
  columns as fit that name across the screen, then rows to hold the
  palette. That gives 3, 4 and 7 columns on the three screens. Names are
  left out when the rows come out shorter than a line of text.
- **Each name sits on a plate of the first colour,** since a game cannot ask how
  light a colour is to pick a readable text colour.
- **The demo counts its own update rate** against the clock, since a game
  is not told the rate. It shows `--` for the first second.
- **The wisp names the swatch under it** in the bottom line, as
  `COLOR.lime = 14`, and that swatch gets an outline.
- **A config change reloads the whole page,** not the game alone, because the
  screen is built once when the engine loads. The page reloads for a refused
  config too.
- **The dev tool reads the config with Node's own `import()`,** under a new
  address each time, only to check it. Files the config imports are read
  once per run of the dev tool, so a mistake in one of those is reported in
  the terminal only after a restart.
- **A config with no default export is reported** rather than taken as the
  empty config.
- **A warning is repeated only when it changes or comes back** after a save
  that fixed it, as with sprites.
- **A colour name is letters and digits starting with a letter,** so it
  reads as `COLOR.name` and the palette keeps the order it is written in.
- **Text given no colour takes the palette's lightest colour,** which is
  white in Pico-8's palette. A replaced palette has no colour called white
  to assume.
- **A PNG is matched to the palette by exact colour,** as before. A pixel
  one shade off a palette colour is a colour outside the palette.
- **The off-palette warning** reads `tico8: <url> has N pixels in colours
  that are not in the palette`, and is said each time the sheet is loaded
  or reloaded with any, so repainting a sheet says it again.
- **Settings and their forms:** `screen` is a preset written as its size,
  `'160x144'`; `rate` is 30 or 60; `warnOffPalette` is true or false. A
  config with an unknown setting or value is refused whole, with a message
  naming it.
- **The palette is declared in game code, not in the config.** The user
  first chose a palette in the config with `COLOR` imported from `tico8`
  and typed by a generated `tico8.d.ts`. That was built and then dropped:
  the generated file, a command to write it outside the dev server, and a
  tsconfig per example were a lot of machinery to save writing one object.
  `palette({...})` gives the same autocomplete from plain inference.
- **`palette()` may be called again with new colours.** That is what a save
  of the palette file does. Colours found in art are dropped and every
  sheet is loaded and matched again before the game restarts. Calling it
  with the colours it already has does nothing.
- **A palette that cannot be used throws where it is declared,** naming the
  colour: a name that is not letters and digits, a colour that is not hex,
  none at all, or more than 255.
- **Where the sprite editor will store a palette is left to its slice.** If
  it needs a data file to write, the palette file can import one, and game
  code does not change.

## Not checked

- A real keyboard: key events were sent by script.
- ~~A project outside this repo with no config file.~~ Checked in slice
  17: `pnpm create:check` serves the engine's `project.js` to one.
- What the page shows for a refused config, beyond the terminal's warning.
- Windows paths.
