# tico8 — console spec

Output of step 0 in `00-outline.md`: a keep/toss walk through Pico-8's
features. Decisions only; file formats and exact function names belong to
later steps. Code samples are illustrative, not final signatures.

## Guiding rules

- **One standard console, few overrides.** tico8 has one spec that everything
  assumes. A short, explicit list of things can be overridden in the project
  config; everything else is fixed.
- **Pico-8 supplies capabilities, TypeScript supplies the API.** No signature
  is kept just because Pico-8 has it.
- **Nothing is drawn behind your back.** `draw` is a plain list of what gets
  drawn, in order. No scene graph, no depth sorting, no engine-owned objects.
- **The project is a folder of plain files.** Every tool reads and writes the
  same files; assets are editable in external tools and diff in git.
- **What keeps games small** is the screen and the palette, not a size limit.

## Platform

| | Decision |
|---|---|
| Runtime | Browser-only for now. Built so a native shell can wrap it later without changing game code; a desktop binary is wanted eventually. |
| Phones | Not a target, for games or editors. No touch controls. |
| Code | A normal TypeScript project: many files, npm packages allowed. |
| Engine access | Imported from `tico8`, like any library. No globals. |
| Boundaries | tico8 owns the screen, input, sound and save storage. Reaching into the browser directly is unsupported, apart from the UI layer below. |
| Limits | None beyond screen and palette: no token limit, no size cap, no per-frame CPU budget. Export reports the file size as information. |

## Screen and colour

| | Decision |
|---|---|
| Resolution | 128x128 standard. Opt-in presets: 160x144 and 240x136, set once in project config. Game code uses screen width/height values, never a hardcoded 128. |
| Colour model | Indexed, 16 colours on screen. The engine draws into its own pixel buffer. |
| Palette | A project may replace the 16 colours. New projects start with Pico-8's palette. |

## Game loop

- A game exports `init`, `update` and `draw` from its main file, plus an
  optional `ui` (see "Text and UI").
- Update runs at a fixed rate: 30 per second by default, as Pico-8, with 60
  as a config alternative. No elapsed-time argument; movement is in whole
  pixels per update.
- If drawing falls behind, draws are skipped and updates keep their rate.

## Sprites

- Any number of PNGs in a sprites folder. No single mandatory sheet.
- Every PNG is a **grid sheet**: 8x8 cells by default, with a per-sheet cell
  size allowed in multiples of 8. A 16x16 character sheet makes each frame one
  cell. Tilesets used by maps stay 8x8.
- Sheets are **typed references generated from the folder** by the dev tool, so
  a missing sheet is a compile error and names autocomplete.
- A **sprite instance** is made from a sheet and holds its own appearance
  (frame, flip). Position is passed when drawing. The engine never draws it
  for you.
- A stateless one-off draw stays available for tiles and particles.
- Transparency comes from the PNG itself.

```ts
import { player } from './sprites'

const hero = player.sprite()   // init

hero.flipX = facingLeft        // update
hero.frame = 3

hero.draw(x, y)                // draw
```

## Maps

- Built-in tile maps, **many per project, one file each**, exposed as typed
  references.
- A map is a grid of tile numbers saved as text, not a picture. Each map uses
  one 8x8 tileset.
- A map holds **named, stackable tile layers** of the same size. Each layer is
  drawn explicitly, so the player goes between layers by call order in `draw`.
- **Tile flags:** a small set of named booleans declared per tileset (`solid`,
  `ladder`, ...), typed, stored in a text file beside the tileset PNG.
- **Placing objects:** marker tiles on a layer that is never drawn, plus a
  helper to walk a layer and get each tile with its position.
- **Rearranging tiles** in a tileset is a job for tico8's editor, which can
  move flags and update maps together. External tools are for painting pixels.

```ts
import { room1 } from './maps'

room1.ground.draw(0, 0)
room1.walls.draw(0, 0)
hero.draw(x, y)
room1.front.draw(0, 0)

if (room1.walls.tile(tx, ty).solid) { /* blocked */ }
```

## Input

- Standard pad: **4 directions and 4 buttons**, working with no setup on
  keyboard and real controllers.
- Extras (shoulder buttons, sticks, start/select) are switched on in config.
- Games check **named actions** defined in config and bound to controller
  buttons or keyboard keys. Action names are typed. A game that defines none
  can use the four buttons directly.
- **Mouse** is off unless a game turns it on; then it reports position in game
  pixels plus buttons.
- **No input device is ever exclusive.** Pad, keyboard and mouse are always
  read together; tico8 never switches input modes or hides one device because
  another was touched.

```ts
// project config
actions: { jump: 'a', shoot: 'b', dash: 'r1' }

// game code
if (input.jump.pressed) { /* ... */ }
```

## Drawing

Kept from Pico-8: shapes (dots, lines, rectangles, circles, ovals, filled or
outlined), camera offset, clip rectangle, palette swap, pixel text.

Replaces Pico-8's memory tricks with ordinary typed functions: read a screen
pixel, change a sprite's pixels at run time, change a map cell.

## Text and UI

- **In-game text:** one built-in pixel font, with lower-case letters, drawn
  into the pixel screen.
- **UI layer (provisional):** an official HTML layer above the game screen
  where menus, dialogue and HUD are written in JSX and CSS. tico8 ships its
  font as a web font, the palette as CSS variables, and scales the layer so
  one CSS pixel equals one game pixel, so UI can match the console's look.
  - Screen effects (palette swap, camera, clip) do not reach this layer.
  - Matching the look is a convention, not something enforced.
  - May be reversed; pixel text stands alone if it is.

How the UI layer works:

- **A fourth function, `ui`,** sits beside `init`, `update` and `draw`. It
  reads plain game state and returns JSX. tico8 calls it after every update
  and patches only what changed. Game state needs no store, wrapper or
  subscription.
- **Components and hooks** work as in React. Hooks are for UI-only state
  (highlighted item, open panel, typed text); game data stays in plain
  variables.
- **Library:** Preact, imported through `tico8/ui` and never by name, so what
  runs underneath can be swapped (React is the fallback).
- **Controller support is automatic.** Ordinary buttons with `onClick` work
  with pad, keyboard and mouse: directions move a highlight, one button
  presses, another goes back.
- **`<Menu>` hands the pad to the UI.** While a `<Menu>` is on screen its
  buttons have the controller and the game's actions read as not pressed.
  Anything outside a `<Menu>` is display, or mouse-only. `update` keeps
  running; the game decides whether to freeze its own logic.

```tsx
import { Menu } from 'tico8/ui'

let hp = 3, coins = 0, paused = false

export function ui() {
  return (
    <>
      <div class="hud">♥ {hp}  ● {coins}</div>
      {paused && (
        <Menu onBack={resume}>
          <button onClick={resume}>Resume</button>
          <button onClick={restart}>Restart</button>
        </Menu>
      )}
    </>
  )
}
```

## Sound

- Ordinary audio files (wav, ogg) in a folder, played by name. Made in any
  external program.
- No built-in sound or music editor.

## Saving

- A built-in save that stores a typed object: `save.write({ level: 3 })`.
- tico8 decides where it is kept, so the same game code works in the browser
  now and against a file in a later desktop build.

## Pause menu

- Built in: resume, restart, volume, and a controls screen generated from the
  game's actions and bindings.
- Games can add items, restyle it or replace it.

## Editors

- Sprite editor and map editor, built in.
- They live in the browser tab beside the running game (Game / Sprites / Map),
  and are written so the same code can be hosted inside VSCode later.
- They edit the project's files directly, so there is nothing to sync.

## Export and sharing

- `tico8 export` produces **one self-contained web page file** with code,
  sprites, maps and sound packed in. Double-click to play, host anywhere, or
  upload to itch.io.
- Export is play-only. Source is shared as a normal folder or repo.

## Name

"tico8" is a working name. It is close to TIC-80, an existing fantasy console,
in both sound and search results. Settle it before the first npm publish,
since it ends up in the package name, import line, CLI command and config file.

## Tossed from Pico-8

- Token limit, cartridge size cap, per-frame CPU budget
- Pretend memory (`peek` / `poke`)
- Sound and music editors
- The single sprite sheet and single map, and their shared space
- Cartridge image files (`.p8.png`)
- Splore
- Positional-argument function signatures
- Phone and touch support

## Optional enhancements

Things discussed and deliberately left out of the first version. None is
blocked by a decision above.

**Platform and sharing**
- Native desktop build (a shell around the web runtime). Wanted, not optional
  in the long run; listed here because it comes after the web version works.
- Steam Deck check: confirm trackpad-as-mouse plus controller buttons work
  together on real hardware once a desktop build exists.
- A splore-style online gallery of exported games.
- Exports that carry the project inside them, so tico8 can open a shared game
  back into an editable folder.

**Dev loop**
- A dev-only start setting ("start in level 3 with the key"), so a restart
  lands where you are working. The cheapest of these; try it first.
- `keep`: game state that survives a code change. One call per concern, in
  the same file as the logic that uses it:
  `const player = keep({ x: 20, y: 60, hp: 3 })`.
  After a code change `keep` returns the previous object. A wrapper over
  Vite's per-module hot data; the plugin labels each kept object from its
  file and variable name, so renaming either resets that one object.
  - `init` always runs, and `keep` owns its own starting values: initial
    values go in the `keep(...)` call and kept state is never set inside
    `init`, so re-running `init` only rebuilds what was not kept.
  - Kept state must be plain data, since class instances keep pointing at
    old code.
  - Fields added by an edit are filled from the new defaults; renamed fields
    reset.
  - A key forces a clean restart.
- Data-only files already survive edits to other files with no API, since
  Vite re-runs an edited file and its importers but not what it imports.
- Input replay on reload: record button presses since start and fast-forward
  through them with the new code, so plain variables anywhere survive a code
  change. Needs engine-supplied random numbers so replays repeat exactly.

**Editors**
- Hosting the sprite and map editors inside VSCode (click a PNG, get the
  pixel editor in a tab).
- A real object layer in the map editor: named objects at pixel positions,
  with properties.
- Reading `.aseprite` files directly, including its tileset data.

**Drawing and text**
- Fill patterns (two-colour dither fills).
- Custom fonts as sprite sheets: a PNG grid where each cell is a letter.

**Sound**
- A built-in synth, with effects described as a few numbers in a text file.

## Still to decide

**In the asset-format step**
- Whether map and tileset files should be openable in Tiled.
- Where a sheet declares its cell size (file name, config entry, or a file
  beside the PNG).
- The flags file format, which may follow from the Tiled answer.

**Before public release**
- The final default palette, after checking Lexaloffle's terms for reusing
  Pico-8's and deciding how much tico8 should look like its inspiration.
- The name.

**When the UI layer is built**
- Whether the UI layer stays at all.
