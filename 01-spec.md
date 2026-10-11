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
- **The API leans modern and convenient.** The goal is that writing a game is
  not a chore, not that the functions are as low-level as possible or teach
  how things work underneath. Where Pico-8 makes every game rebuild
  something (vectors, hitboxes, an entity class, palette juggling), tico8
  ships it. When a choice is between a primitive and the thing games
  actually want, take the second, and look to engines such as Godot for the
  pattern before copying Pico-8's.
- **Nothing is drawn behind your back.** `draw` is a plain list of what gets
  drawn, in order. No scene graph, no depth sorting, no engine-owned objects.
- **The project is a folder of plain files.** Every tool reads and writes the
  same files; assets are editable in external tools and diff in git.
- **What keeps games small** is the screen and the palette, not a size limit.
  The palette is held by the tools, not the runtime: tico8's editor paints
  in it, and art made elsewhere is shown as painted.

## Naming

These rules cover the API a game sees. Engine and tooling internals are
free to differ.

- **`UPPER_CASE` for fixed tables of values:** things that only hold values
  and never change while the game runs, such as `SCREEN.width` and
  `COLOR.red`. Their fields stay lower-case.
- **`lowerCase` for everything else:** functions (`clear`, `pixel`, `vec`),
  and anything with behaviour or live state, such as a sheet (`player`), a
  map (`room1`) or `input`.
- **`PascalCase` for types** (`Vec`, `Game`).
- **No long runs of bare numbers.** A call takes at most an `x, y` pair and
  one more argument: `vec(3, 4)`, `hero.draw(x, y)`, `pixel(x, y, color)`.
  Anything needing more is one object of named fields:
  `rect({ x, y, width, height })`, `line({ from, to, color })`,
  `tiles.draw({ frame, x, y })`. Optional settings always go in such an
  object, never in trailing positional arguments.

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
| Resolution | 128x128 standard. Opt-in presets: 160x144 and 240x136, set once in project config. Game code uses `SCREEN.width` and `SCREEN.height`, never a hardcoded 128. |
| Colour model | Indexed. The engine draws into its own pixel buffer of colour numbers, which is what makes palette swap possible. |
| Imported art | A PNG keeps the colours it was painted in. A colour outside the palette gets a number of its own after the palette's, with no name. The screen can show 255 colours at once; past that a new colour takes the nearest existing one, and the dev tool always warns. A warning for any colour outside the palette is an opt-in config setting. |
| Palette | 16 colours by default; a project may replace them, or define more, in config. New projects start with Pico-8's palette. The palette is what the built-in sprite editor offers and what `COLOR` names. |
| Colour names | Colours are passed by name (`COLOR.red`), not as bare numbers. Each name is a palette index, so a number still works and colour arithmetic stays possible. The names are declared with the palette in project config and generated as typed references; until config exists the engine ships Pico-8's sixteen names. |

## Game loop

- A game exports `init`, `update` and `draw` from its main file, plus an
  optional `ui` (see "Text and UI").
- Update runs at a fixed rate: 30 per second by default, as Pico-8, with 60
  as a config alternative. No elapsed-time argument; movement is in whole
  pixels per update.
- If drawing falls behind, draws are skipped and updates keep their rate.
- After a long gap, such as a background tab, the game does not
  fast-forward: at most 5 updates run in one frame and the rest are dropped.

## Sprites

- Any number of PNGs in a sprites folder. No single mandatory sheet.
- Every PNG is a **grid sheet**: 8x8 cells by default, with a per-sheet cell
  size allowed in multiples of 8, given in the file name: `player.16.png` is
  16x16, `player.16x24.png` is 16 wide and 24 tall. Both import as `player`. A 16x16 character sheet makes each frame one
  cell. Tilesets used by maps stay 8x8.
- Sheets are **typed references generated from the folder** by the dev tool, so
  a missing sheet is a compile error and names autocomplete.
- A **sprite instance** is made from a sheet and holds its own appearance
  (frame, flip, colour swap, flash). Position is passed when drawing. The engine never draws it
  for you.
- A stateless one-off draw stays available for tiles and particles:
  `tiles.draw({ frame: 3, x: 16, y: 8 })`.
- Transparency comes from the PNG itself: a pixel less than half opaque is
  see-through.

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

- **Shapes are values that hold their own look.** `rect({ x, y, width,
  height })`, `circle({ x, y, radius })` and `oval({ x, y, radiusX,
  radiusY })` also take `fill` and `stroke` colours, and `shape.draw()`
  draws the fill and then the one-pixel edge over it. Either colour can be
  left out, and both can be changed later, as a sprite's `flash` can.
- **A bare object is a shape too.** `fill(shape, color)` and
  `stroke(shape, color)` draw anything with the right fields, so
  `stroke(player, COLOR.green)` draws the player's bounds.
  `line({ from, to, color })` stands alone.
- **The same values test for hits:** `rect.overlaps(a, b)` and
  `rect.contains(r, point)`.
- **Camera and clip are blocks.** `camera(cam, () => { ... })` draws the
  block through a camera; what is drawn outside it, such as a HUD, is
  untouched. `clip(area, () => { ... })` limits the block to a rectangle.
  Nothing is set, so nothing needs resetting. Blocks nest: cameras add up
  and clips narrow.
- **Recolouring belongs to what is drawn.** A sprite has `swap`, a plain
  object naming which colours are drawn as which, and `flash`, one colour
  for every pixel. One-off sheet draws take both as options. There is no
  global draw-time palette swap.
- **Whole-frame swap:** `screenSwap(swap)` shows some colours as others
  across the finished frame, for fades. It lasts for the frame it is called
  in.
- **Pixels:** `pixel(x, y, color)` sets one and `pixel(x, y)` reads one.
  `sheet.pixel({ frame, x, y })` reads a sprite sheet's pixel at run time,
  adding `color` writes it, and `sheet.erase` makes one see-through.
- Pixel text is in "Text and UI".

```ts
const cam = vec()
const hud = rect({ x: 0, y: 0, width: SCREEN.width, height: 9 })
const sun = circle({
  x: 200,
  y: 30,
  radius: 12,
  fill: COLOR.yellow,
  stroke: COLOR.orange,
})
const icy = { [COLOR.red]: COLOR.blue }

export function draw() {
  clear(COLOR.darkBlue)
  camera(cam, () => {
    sun.draw()
    hero.swap = frozen ? icy : undefined
    hero.draw(pos)
  })
  fill(hud, COLOR.black)
}
```

## Positions and vectors

- **Every position can be one value.** Wherever a function takes `x, y` as
  arguments it also takes one object with `x` and `y` fields: `hero.draw(player.pos)`, or
  `hero.draw(player)` if `player` is `{ x, y, hp }`. The `x, y` form stays.
- **The engine reports positions the same way:** mouse position, marker tiles
  on a map layer and the like come back as `{ x, y }`.
- **A vector is plain data,** `{ x, y }`, made with `vec(x, y)`. It has no
  methods, so it saves, compares and survives a code reload like any other
  game state.
- **The maths is functions on `vec`:** `add`, `sub`, `scale`, `len`,
  `distance`, `normalize`, each returning a new value, and `move`, which adds
  in place.

```ts
const player = { pos: vec(20, 60), vel: vec(1, 0) }

vec.move(player.pos, player.vel)   // update
hero.draw(player.pos)              // draw
```

## Text and UI

- **In-game text:** one built-in pixel font, with lower-case letters, drawn
  into the pixel screen. The font is Tom Thumb: 3x5 letters in a 4x6 cell,
  so 32 characters fit across the standard screen.
  - **Characters:** ASCII, the Western European accented letters the font
    comes with, and game symbols typed straight into a string:
    `♥ ● ★ ♪ ← ↑ → ↓` and the pad buttons `Ⓐ Ⓑ Ⓧ Ⓨ`.
  - **A one-off:** `text(string, { x, y, color, align })` draws it now.
    `text.measure(string)` gives its width and height.
  - **A value:** `label({ x, y, text, color, align })` holds its place and
    look as a shape does, with `draw()` and `bounds`, a rect that can be
    filled behind it or tested for a hit.
  - `align` is `'left'`, `'center'` or `'right'` about `x`, line by line;
    `\n` starts a new line, and nothing wraps on its own. Text is white
    unless given a colour, and obeys camera and clip like anything else
    drawn.
  - A line is 6 pixels tall, the sixth row being where `g` and `y` hang.
    Most characters are 3 wide with a 1 pixel gap; symbols are 5 or 7.

```ts
const title = label({
  x: SCREEN.width / 2,
  y: 40,
  text: 'Game Over',
  color: COLOR.red,
  align: 'center',
})

export function draw() {
  text(`♥ ${hp}  ● ${coins}`, { x: 2, y: 2 })
  fill(title.bounds, COLOR.black)
  title.draw()
}
```

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
- The flags file format, which may follow from the Tiled answer.

**Before public release**
- The final default palette, after checking Lexaloffle's terms for reusing
  Pico-8's and deciding how much tico8 should look like its inspiration.
- The name.

**When the UI layer is built**
- Whether the UI layer stays at all.
