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
| Package | Ships built: JavaScript and `.d.ts` files in `dist/`, one module per source file, for Node (CLI, Vite plugin) and the browser (engine) alike. The workspace runs the TypeScript source; `publishConfig` points `exports` and `bin` at `dist/` only in the packed copy. Every module has a `.d.ts`. `pnpm pack:check` installs the tarball into a copy of an example outside the workspace and runs it. |

## Project config

- **One optional file, `tico8.config.ts`,** in the project folder beside
  `main.ts`. It is typed, so settings autocomplete and a wrong one is an
  error in the editor. A project without the file is the standard console.
- **It holds the short list of overrides** and nothing else: screen size,
  update rate, the palette and the off-palette warning, input actions,
  extras, the mouse and the save's defaults.
- **`defineConfig` hands back the config with the game's typed names on
  it:** `COLOR` for its palette, `input` for its actions and `save` for
  its save. The config
  file exports them and game code imports them from there. Nothing is
  generated.
- **Saving it restarts the game** by reloading the page. Game state is
  lost.
- **A setting that cannot be used is refused** with a message naming it in
  the dev tool's terminal. The game does not start on a half-applied
  config.

```ts
import { defineConfig } from 'tico8/config'

const config = defineConfig({
  screen: '160x144',
  rate: 60,
  warnOffPalette: true,
  palette: { ink: '#1b1b2f', moss: '#3a5a40' },
  actions: { jump: ['a', 'Space'] },
})

export default config
export const { COLOR, input } = config
```

## Screen and colour

| | Decision |
|---|---|
| Resolution | 128x128 standard. Opt-in presets: 160x144 and 240x136, set once in project config as `screen: '160x144'`. Game code uses `SCREEN.width` and `SCREEN.height`, never a hardcoded 128. |
| Colour model | Indexed. The engine draws into its own pixel buffer of colour numbers, which is what makes palette swap possible. |
| Imported art | A PNG keeps the colours it was painted in. A colour outside the palette gets a number of its own after the palette's, with no name. The screen can show 255 colours at once; past that a new colour takes the nearest existing one, and the dev tool always warns. A PNG pixel belongs to the palette only if its colour matches exactly. A warning for any colour outside the palette is an opt-in config setting, `warnOffPalette`. |
| Palette | 16 colours by default, Pico-8's. A game replaces them, or defines more, with `palette: { name: '#hex', ... }` in its config. The colours are numbered in the order written, a colour is `#rrggbb` or `#rgb`, and a palette holds 1 to 255. The palette is what the built-in sprite editor offers and what `COLOR` names. |
| Colour names | Colours are passed by name (`COLOR.red`), not as bare numbers. Each name is a palette index, so a number still works and colour arithmetic stays possible. `tico8` exports `COLOR` with Pico-8's sixteen names. A game with its own palette gets its `COLOR` back from `defineConfig` and exports it from the config file; the names are typed from what was written, so one not in the palette is a compile error and nothing is generated. |

```ts
// tico8.config.ts
const config = defineConfig({
  palette: {
    ink: '#1b1b2f',
    moss: '#3a5a40',
    sand: '#e9c46a',
  },
})
export default config
export const { COLOR } = config

// main.ts
import { COLOR } from './tico8.config'

clear(COLOR.moss)
```

Saving a new palette reloads the page, as any config change does, and
sprites are matched to the new colours. The palette cannot be replaced
while the game runs; `screenSwap` and a sprite's recolouring cover fades
and flashes.

## Game loop

- A game exports `init`, `update` and `draw` from its main file, plus an
  optional `ui` (see "Text and UI").
- Update runs at a fixed rate: 30 per second by default, as Pico-8, with 60
  as a config alternative. No elapsed-time argument; movement is in whole
  pixels per update.
- If drawing falls behind, draws are skipped and updates keep their rate.
- After a long gap, such as a background tab, the game does not
  fast-forward: at most 5 updates run in one frame and the rest are dropped.
- **`clock`** is the engine's count of game time, read-only:
  `clock.ticks` is how many updates have run, and `clock.seconds` is that
  count divided by the update rate. A dropped update is not counted, so it
  is game time, not time on the wall. Both are 0 in `init` and through the
  first update, and go up by one update after each. A restart puts them
  back to 0. A tick is an update, not a drawn frame and not a sprite's
  `frame`.
- Anything that should last a set time is timed in `seconds`, so it is the
  same at 30 or 60 updates a second; `ticks` is for whole-update effects
  such as a flicker every few updates.

```ts
if (clock.seconds % 1 < 0.5) prompt.draw()        // blink once a second
hero.flash = clock.ticks % 4 < 2 ? COLOR.white : undefined
```

## Sprites

- Any number of PNGs in a sprites folder. No single mandatory sheet.
- Every PNG is a **grid sheet**: 8x8 cells by default, with a per-sheet cell
  size allowed in multiples of 8, given in the file name: `player.16.png` is
  16x16, `player.16x24.png` is 16 wide and 24 tall. Both import as `player`. A 16x16 character sheet makes each frame one
  cell. Tilesets used by maps stay 8x8.
- Sheets are **typed references generated from the folder** by the dev tool, so
  a missing sheet is a compile error and names autocomplete.
- A **sprite instance** is made from a sheet and holds its own place (`x`,
  `y`) and appearance (frame, flip, colour swap, flash), as a shape or a
  label does. `hero.draw()` draws it where it is. The engine never draws it
  for you.
- **A sprite is a rect:** it has `width` and `height`, its cell's size, so it
  can be handed to anything that takes a rect or a position, such as
  `walls.overlaps(hero, 'solid')` or `stroke(hero, COLOR.green)`.
  `hero.draw(x, y)` draws it somewhere else without moving it.
- A stateless one-off draw stays available for tiles and particles:
  `tiles.draw({ frame: 3, x: 16, y: 8 })`.
- Transparency comes from the PNG itself: a pixel less than half opaque is
  see-through.

```ts
import { player } from './sprites'

const hero = player.sprite({ x: 20, y: 60 })   // init

hero.x += input.dir.x                          // update
hero.flipX = facingLeft
hero.frame = 3

hero.draw()                                    // draw
```

### Animation

- **An animation is plain data:** `{ frames: [0, 1], fps: 8 }`, with
  `loop: false` for one that plays once. Speed is in frames per second, so
  it is the same at either update rate, and an animation imported from art
  later (Aseprite tags) can take the same shape.
- **A sprite plays one:** `hero.play(walk)`, called once each update, moves
  it on one update and sets `hero.frame`. Nothing moves on unless the game
  calls `play`; the engine never animates behind your back.
- **The same animation carries on; a different one starts from its first
  frame.** Same means the same frames, fps and loop, so an animation written
  in place inside `update` carries on as well as a named one.
  `hero.play(attack, { restart: true })` starts it over even when it is the
  one already playing.
- **A one-shot ends on its last frame,** and from the update its last frame
  has shown its full time `hero.finished` is true. It is false for a
  looping animation, and goes back to false when another starts.
- An animation with no frames, or an fps that is not above 0, is refused:
  `play` throws, saying which.
- Not offered yet: a helper for animating tiles and particles drawn with
  `tiles.draw` (a game works the frame out from `clock`), and animations
  named in the art.

```ts
const walk = { frames: [0, 1], fps: 8 }
const stand = { frames: [0], fps: 1 }
const attack = { frames: [2, 3, 4], fps: 12, loop: false }

if (input.a.pressed) {
  attacking = true
  hero.play(attack, { restart: true })
} else if (attacking) {
  hero.play(attack)
  if (hero.finished) attacking = false
} else {
  hero.play(moving ? walk : stand)
}
```

## Maps

- Built-in tile maps, **many per project, one file each**, exposed as typed
  references.
- A map is a grid of tile numbers saved as text, not a picture. Each map uses
  one 8x8 tileset.
- **A map file is JSON, `maps/<name>.json`,** in tico8's own shape, not
  Tiled's. It names its tileset and holds its layers by name. A layer is a
  list of rows and a row is one line of text: tile numbers apart by spaces,
  `.` for an empty cell. A tile's number is its frame in the tileset, counted
  from 0.
- A map holds **named, stackable tile layers** of the same size. Each layer is
  drawn explicitly, so the player goes between layers by call order in `draw`.
- **Tile flags:** a small set of named booleans declared per tileset (`solid`,
  `ladder`, ...), stored beside the tileset PNG as `<tileset>.flags.json`.
  Each flag lists the tiles that have it, so every map using the tileset
  shares one list.
- **Layer and flag names are typed by inference** from the two JSON files.
  The generated `maps.ts` only lists the map files, as `sprites.ts` lists
  the PNGs; renaming a layer or a flag rewrites nothing.
- **Placing objects:** marker tiles on a layer that is never drawn, and
  `layer.tiles()`, which gives each tile with its position, or only those
  with one flag: `room1.markers.tiles('spawn')`.
- **A cell is a column and a row; a position is pixels.** `tile(column,
  row)` and `set(column, row, frame)` take a cell. `tileAt`, `overlaps` and
  `draw` take pixels, as `x, y` or one value, counted from the layer's top
  left: reading a layer takes it to be drawn at 0, 0.
- **A tile is its frame and its flags,** `{ frame, solid, ... }`. An empty
  cell, and one outside the layer, has `frame: undefined` and every flag
  false.
- **`layer.overlaps(rect, flag)`** says whether a hitbox touches a tile
  with a flag, which is how a game is stopped by walls. It only answers yes
  or no: moving and stopping are the game's own code, built from small
  pieces. Nothing like Godot's move-and-slide is built in.
- **A view of part of a layer:** `layer.area(rect)` is a layer over the
  cells a rectangle in pixels covers, grown to whole cells, counted from
  its top left. Drawing it draws only that area; `tile`, `tileAt`,
  `overlaps` and `tiles` see only that area, and outside it reads as empty;
  `set` writes to the layer under it. A view's size is fixed when it is
  made, and a view of a view stays inside the first. A map of rooms, one screen each, draws
  and collides one room with `world.ground.area(room)`.
- **`LayerOf<typeof world>`** names a layer of a map, for a function that
  takes one.
- **A map and its layers know their size:** `columns` and `rows` in cells,
  `width` and `height` in pixels. A layer or a flag cannot take one of
  those names, or a tile's own (`frame`, `x`, `y`, `column`, `row`).
- **Changing a cell lasts until the game restarts** or the map file is
  saved: both put the map back as its file has it.
- **Saving a map or flags file swaps it into the running game** without a
  restart. A file that cannot be read as one is reported in the browser
  console and the map keeps what it had.
- **`maps.ts` is written only for a project with a `maps` folder.** A map
  whose name, JSON or tileset cannot be used is left out of it with a
  warning in the dev tool's terminal.
- **Rearranging tiles** in a tileset is a job for tico8's editor, which can
  move flags and update maps together. External tools are for painting pixels.

```json
// maps/room1.json
{
  "tiles": "tiles",
  "layers": {
    "ground": [
      " 1  1  1  1  1",
      " 1  2  2  2  1",
      " 1  1  1  1  1"
    ],
    "walls": [
      " 4  4  4  4  4",
      " 4  .  .  .  4",
      " 4  4  .  4  4"
    ]
  }
}

// sprites/tiles.flags.json
{ "solid": [4, 5, 6, 12], "ladder": [7], "spawn": [32] }
```

```ts
import { room1 } from './maps'

room1.ground.draw()
room1.walls.draw()
hero.draw()
room1.front.draw()

if (room1.walls.tile(column, row).solid) { /* blocked */ }
if (room1.walls.overlaps(hero, 'solid')) { /* blocked */ }

const [start] = room1.markers.tiles('spawn')
```

## Input

- Standard pad: **4 directions and 4 buttons**, working with no setup on
  keyboard and real controllers. On the keyboard the arrows are the
  directions and A, S, W and D are `a`, `b`, `x` and `y`. On a controller
  `a` is the bottom face button and `b` the right one, by position, not by
  the letter printed on it; the d-pad and the left stick both give the
  directions.
- Extras (shoulder buttons, triggers, sticks, start/select) are switched on
  in config with `extras: true`.
- Games check **named actions** defined in config. An action is bound to a
  pad button, a keyboard key, a mouse button, or a list of them. A pad
  button brings its default key with it. Keys are named as the browser
  names them, by place on the keyboard: `'Space'`, `'KeyK'`.
  A key event with no `code`, as some test drivers send, is read by its
  `key` as the place it has on a US keyboard (Meta aside).
- **Action names are typed by inference.** `defineConfig` hands back the
  config with the game's `input` on it; the config file exports that and
  the game imports it from there. Nothing is generated. A game that
  defines no actions imports the plain pad from `tico8`.
- **A key named in an action stops being a default key of the pad,** so a
  game can take A, S, W and D for its own use.
- **Mouse** is off unless the config says `mouse: true`; then `input.mouse`
  is its position in game pixels plus its buttons.
- **A button is down while anything holds it.** Letting go of a key does
  not release a button a controller still holds. `pressed` and `released`
  are each true for one update, and a tap that starts and ends between
  two updates is still seen.
- **An action is named in letters and digits** and cannot take a name
  `input` already has. One bound to something unknown, or to an extra or
  a mouse button whose switch is off, is refused by name like any other
  bad setting.
- **Sticks** are `input.leftStick` and `input.rightStick`, each a vector no
  longer than 1 with a round dead zone. A controller is read through the
  browser's standard layout, or through a layout tico8 keeps for it when
  the browser gives none (a PS5 controller in Firefox). One with neither
  is ignored, with a warning in the console.
- **`input.mouse` is itself the position,** with `left`, `right`, `middle`
  and `inside` beside `x` and `y`. It keeps counting past the screen's
  edges, so check `inside`. The system pointer stays visible.
- **No input device is ever exclusive.** Pad, keyboard and mouse are always
  read together, every connected controller included; tico8 never switches
  input modes or hides one device because another was touched.

```ts
// tico8.config.ts
const config = defineConfig({
  extras: true,
  actions: { jump: 'a', shoot: ['b', 'Space'], dash: 'r1' },
})
export default config
export const { input } = config

// game code
import { input } from './tico8.config'

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

- **`vec.step(pos, vel, blocked)` moves in whole pixels,** x then y, one
  pixel at a time, asking `blocked(at)` at each floored position. On a hit
  `pos` stops flush on that axis and loses its fraction; otherwise it keeps
  the fraction for the next step. It returns `{ x, y }`, which axes hit.
  What a hit means (stop, bounce) is the game's. It never asks about the
  pixel it starts on, so a body already in a wall is not pushed out.

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
    `♥ ● ★ ✧ ♪ ← ↑ → ↓` and the pad buttons `Ⓐ Ⓑ Ⓧ Ⓨ`.
  - **A one-off:** `text(string, { x, y, color, align })` draws it now.
    `text.measure(string)` gives its width and height.
  - **A value:** `label({ x, y, text, color, align })` holds its place and
    look as a shape does, with `draw()` and `bounds`, a rect that can be
    filled behind it or tested for a hit.
  - `align` is `'left'`, `'center'` or `'right'` about `x`, line by line;
    `\n` starts a new line, and nothing wraps on its own. Text given no
    colour takes the palette's lightest, white in the standard palette,
    and obeys camera and clip like anything else drawn.
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
- **CSS is imported** from game code, as in any Vite project:
  `import './ui.css'`. An edit to it shows without a restart.
- **The main file is `main.ts` or `main.tsx`;** a game with a UI uses the
  second.
- **Each palette colour is a CSS variable named as in `COLOR`:**
  `var(--darkBlue)`.
- **The layer's own CSS is a default the game always beats:** it sits in
  `@layer tico8`, so any game rule wins whatever its specificity. It sets
  the font at `6px/6px tico8` (one font pixel a CSS pixel), the text in the
  palette's lightest colour, buttons with no border, background or padding,
  and the highlight as a 1 px outline.
- **The highlight is the browser's focus,** so `button:focus` styles it. A
  menu highlights its first enabled button when it opens; directions move
  to the nearest button that way on screen, one wholly past the highlighted
  one's edge, so ← and → do nothing in a single column. A direction held
  does not repeat. The pointer over a menu button highlights it.
- **Ⓐ clicks; Ⓑ calls the top menu's `onBack`.** On the keyboard Enter
  clicks and Escape goes back too, in any menu and whatever the game bound
  them to; in play Enter is free for the game. Menus stack: the last one
  opened has the pad. The update that opens a menu does not act on the
  press that opened it, and a button still held when a menu closes reads
  `held` but not `pressed`, so the Ⓐ that chose Resume never reaches the
  game.
- **The layer ignores the pointer** except on what can be pressed, so the
  game's mouse still reads the screen through a HUD. UI buttons take the
  mouse whether or not the config turns the game's mouse on.
- **The web font is drawn from the pixel font,** so it has the same
  letters and symbols.

```tsx
import { Menu } from 'tico8/ui'

let hp = 3, coins = 0, paused = false

import './ui.css'

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

- Ordinary audio files (wav, ogg, mp3) in a `sounds` folder, played by
  name. Made in any external program. mp3 is there because older Safari
  cannot play ogg, and most free sound packs come as mp3.
- No built-in sound or music editor.
- **Sounds are typed references generated from the folder,** as sheets are:
  `import { swing, theme } from './sounds'`. Two files that would take the
  same name (`jump.wav` and `jump.ogg`) are both left out, with a warning.
- **Music is a sound that loops.** There is one kind of thing: `swing.play()`,
  `theme.play({ loop: true })`, `theme.stop()`. Switching tracks is stopping
  one and playing the other.
- **Effects overlap:** each `play` of a one-off sound is a new copy, layered
  on any still sounding. **A loop has one copy:** playing a loop that is
  already going does nothing, so a game can play its music from `init`
  without checking. `stop` stops every copy.
- **Volume is per sound,** from 0 to 1: `theme.volume = 0.4` sets it for
  every copy, now and later, and `swing.play({ volume: 0.5 })` scales one
  play. A master volume sits over everything for the pause menu; games
  cannot reach it.
- `theme.playing` says whether any copy is sounding, or a loop is waiting
  for the first key press.
- **Before the player's first key press, click or tap,** browsers play no
  sound. Effects played before then are dropped; a loop played before then
  starts on that press, so title music needs no extra code.
  A controller does not count: browsers read it by polling, not as a
  press they trust. Nor does Escape; sound waits for a press that does. `audio.unlocked`, read-only from `tico8`, says whether
  sound is let through yet, so a game can show "press any key for sound".
- **Saving code restarts the game, not the music.** On that restart every
  effect stops, and a loop the new game plays again from `init` or its
  first update carries on where it was. A loop it no longer plays falls
  silent. Reloading the page starts everything from nothing.
- Saving a sound file swaps it live: new plays use the new file, and a loop
  under way starts again with it.
- A volume outside 0 to 1 is held to it. A sound file that will not load
  plays nothing, with a warning in the browser console.

```ts
import { swing, theme } from './sounds'

theme.volume = 0.4
theme.play({ loop: true })            // init: starts on the first key press

if (input.a.pressed) swing.play()     // update
```

## Saving

- A built-in save that stores a typed object: `save.write({ level: 3 })`.
- tico8 decides where it is kept, so the same game code works in the browser
  now and against a file in a later desktop build.
- **The save's shape is a setting in the config:** `save: { best: 0 }`
  gives the defaults, and its type is inferred from them, widened (`best`
  is a `number`, not `0`). `defineConfig` hands back `save`, which the
  config file exports beside `COLOR` and `input`. Nothing is generated.
- **Fields are read straight off it:** `save.best`. They are readonly, so
  assigning one is a compile error, and the save only changes through:
  - `save.write({ best: score })`, which merges the fields given into the
    save and stores it at once. A field not in the defaults is a compile
    error.
  - `save.clear()`, which forgets what was stored, so every field is its
    default again.
- **A read never gives undefined.** Before anything is written the save is
  its defaults. A stored save from an older shape is laid over the
  defaults: missing fields take their default, fields the defaults no
  longer have are dropped, and a field whose kind changed (a number that
  is now a string) takes its default. Objects inside are laid over the
  same way, field by field.
- A save holds plain data: numbers, strings, true and false, null, arrays
  and plain objects. A config whose `save` holds anything else, or a field
  called `write` or `clear`, is refused by name.
- In the browser each project keeps its own save, named by its
  `package.json` name, or its folder's when it has none.
- A default of `null` only accepts a stored `null`. An array is taken
  whole when the stored value is an array; its items are not checked.
- Fields are frozen, however deep, and `write` copies what it is given, so
  a game cannot change the save in place.
- A stored save that is not JSON gives the defaults, with a warning in the
  browser console. Storage that cannot be read or written is warned about
  once, and the save carries on until the page closes.
- Two tabs of one game share a save; the last write wins.

```ts
// tico8.config.ts
const config = defineConfig({ save: { best: 0 } })
export default config
export const { save } = config

// main.ts
import { save } from './tico8.config'

if (score > save.best) save.write({ best: score })
text(`Best ${save.best}`, { x: 2, y: 2 })
```

## Pause menu

Pico-8's: one built-in menu, the same in every game, that a game can add
to. A pause screen of the game's own, such as an inventory, is a `<Menu>`
in its `ui`.

- **Built in:** Resume, the game's items, Options (volume and sound on or
  off) and Controls (the pad and the game's actions). No Restart:
  a whole-game reset is the browser's reload, and what games want
  ("Restart level", "Quit to title") is theirs to add.
- **Start on a controller or Escape on the keyboard opens it,** one key
  each. Start closes it again from anywhere. In the menu Escape is Ⓑ:
  it backs out of Options or Controls, and from the menu itself resumes.
  Over a game's own `<Menu>` that has an `onBack`, Escape is that menu's Ⓑ;
  over one without, such as a title menu, it pauses.
  An action that names `start` or `Escape` keeps it for the game, which
  then pauses by the other only.
- **The game freezes, the same in every game:** `update` and `draw` are
  not called and `clock` does not count. The last frame stays on screen,
  dimmed by a CSS backdrop in `@layer tico8` that a game can restyle.
  Timers outside the engine (`setTimeout`, `Date.now`) do not stop; time
  things with `clock`.
- **Sound:** loops keep playing, so the volume can be heard as it moves;
  one-off effects hold where they are and carry on at resume. One played
  while the menu is open, such as an item's click, sounds as usual.
- **Options** replaces the menu with Volume, Sound and Back. Volume shows
  as 0 to 10: ← and → step it, Ⓐ or a click steps it up and wraps from 10
  to 0. Sound switches every sound on and off, music and effects alike;
  ←, →, Ⓐ or a click flips it. Switched off, sounds play on silent:
  `playing` does not change and music switched back on carries on where
  it is. Until the first key press it says "Press a key for sound". Both
  are remembered per game in the browser, apart from the save, so
  `save.clear()` leaves them. Ⓑ or Back goes back.
- **Controls** replaces the menu with a list: the directions and Ⓐ Ⓑ Ⓧ Ⓨ
  with the keys still theirs (a row stays with no keys, since a controller
  still presses it), then each action with its bindings. Pausing is not
  listed: whoever is reading it found the way in. Ⓑ or Back goes back.
- **A game adds items** by exporting `pause` beside `ui`, returning
  buttons. They show between Resume and Options. Choosing one runs its
  `onClick` and closes the menu, unless the click calls
  `event.preventDefault()`, as a toggle that shows its state would.
- **Restyled with CSS:** the menu's elements have `tico8-` classes, and its
  default CSS is in `@layer tico8` like the rest of the layer's:
  `.tico8-pause` the backdrop, `.tico8-pause-menu`, `.tico8-options` and
  `.tico8-controls` the panels, each with an `h2`, `.tico8-pause-items`
  around a game's items, `.tico8-pause-options`, `.tico8-pause-controls`,
  `.tico8-pause-volume`, `.tico8-pause-sound`,
  `.tico8-pause-unlock`, and `.tico8-control`
  rows of `.tico8-control-label` and `.tico8-control-bindings`.

```tsx
export function pause() {
  return (
    <>
      <button onClick={restartLevel}>Restart level</button>
      <button onClick={toTitle}>Quit to title</button>
    </>
  )
}
```

## Editors

- Sprite editor and map editor, built in.
- They live in the browser tab beside the running game (Game / Sprites / Map).
  The browser is their only home; hosting them in an IDE is not a goal.
- **Tabs with a split toggle.** One tab shows at a time; the toggle shows the
  game beside the open editor, so a stroke can be watched landing in the game.
- **The game runs in its own frame** inside the dev page, so keys pressed in
  an editor never reach the game.
- They edit the project's files directly, so there is nothing to sync.
  Each stroke is written to disk when it ends, and a change made to the file
  by another tool shows up in the editor.

### Sprite editor

- **View:** a few cells zoomed large for painting, with the whole sheet small
  beside it to pick cells from.
- **Tools:** pencil, eraser (paints see-through), fill, pick colour, line,
  rectangle (outline or filled), select with move, copy and paste, flip and
  rotate, undo and redo.
- **Colours:** the palette, then any colours the sheet uses from outside it,
  which can be picked and painted but are not added to the palette.
- **Sheets:** a picker over the sprites folder; a new sheet is made with a
  name and a cell size, and a sheet is resized in whole cells.
- **Saving:** each finished step writes the PNG. The editor's own writes
  coming back are ignored; any other change to the file, a revert included,
  is taken in as one undoable step. A stroke in progress wins.
- **Selections** float over the sheet until dropped, and are saved as if
  dropped. Moving, flipping and rotating one is a single undo step with the
  lift; its see-through pixels leave what is under them.
- **Focus:** the game's menus take focus only while its page has it, so the
  game never pulls keys away from an editor beside it.
- **Look:** the editors are drawn in tico8's own sixteen colours and its
  font, whatever palette the project paints with, so the editors and the
  console read as one machine. Sentences use the system face.
- **Feedback:** the pixel under the pointer is outlined in the brush colour,
  a status line shows x, y and the frame number, the current colour shows
  large with its index, and "saving" and "saved" sit by the sheet tabs.
- **Layout:** sheet tabs on top, a tool rail on the left, the canvas in the
  middle, colour and sheet view on the right, frames and status below. Narrow
  (beside the game) the right column folds under the canvas. The split's
  divider can be dragged.
- **Keys:** arrows step the zoomed cells, 1, 2 and 4 zoom, R twice for a
  filled rectangle, ? lists every shortcut; right-click or Alt-click picks a
  colour. A selection shows Flip, Rotate and Done above it.
- **Sheets:** New and Resize are dialogs; New shows the file and size it
  will write, Resize how many cells with art a shrink cuts.

### Map editor

- **View:** the whole map, fitted to its space at a whole scale, zoomed and
  panned; lines mark each screen's worth of map. The zoom shows as a
  percentage beside a Fit button. Scrolling, or a two-finger drag, pans; a
  pinch, or Ctrl or ⌘ with the wheel, zooms, a long pinch
  going several steps.
  The see-through checker is two squares to a tile. The tileset sits beside it
  to pick tiles from.
- **Tools:** brush, eraser, fill, rectangle (filled), pick tile, select with
  move, copy and paste, undo and redo. They work on one layer, the current
  one.
- **Brush:** a click in the tileset picks a tile, a drag picks a block (a 2x2
  moon), and every tool paints with the block as a pattern.
- **Layers:** a list to choose the current layer, show and hide layers in the
  editor (never in the file), add, rename, remove and reorder them.
- **Maps:** a picker over the maps folder; a new map is made with a name, a
  tileset, a size and its first layer, and a map is resized in whole cells.
- **Flags:** the chosen tiles show a checkbox per flag of the tileset; flags
  are added, renamed and removed there. One flag at a time can be shown,
  tinting its tiles in the tileset and on the map.
- **Rearranging tiles:** with Arrange on, dragging a tile in the tileset onto
  another swaps the two: their pixels in the PNG, their flags, and their
  numbers in every map on the tileset. One undo step.
- **Saving:** each finished step writes the files it changed, as the sprite
  editor does; a map or flags file changed by another tool is taken in as
  one undoable step. A swap reads every map on the tileset first and is
  cancelled whole if one cannot be read.
- **Flags file:** a tileset's first flag makes one named after the sheet,
  `tiles.png` giving `tiles.flags.json`.
- **Names:** a layer or flag is letters and digits from a letter; a map's
  name follows a sheet's and must make a name `maps.ts` can export. New
  offers only 8x8 sheets as tilesets.
- **Keys:** B, E, F, R, I and S pick the tools; `[` and `]` change layer;
  `=`, `-` and `0` zoom and fit; space- or middle-drag pans; right- or
  Alt-click picks; ? lists them all.
- **Focus:** a press in an editor takes the keys back from the game beside
  it, and each editor answers keys only while its tab shows.

## Export and sharing

- `tico8 export` produces **one self-contained web page file** with code,
  sprites, maps and sound packed in. Double-click to play, host anywhere, or
  upload to itch.io.
- Export is play-only. Source is shared as a normal folder or repo.
- **It writes `dist/<project>.html`**, named like the save's key (the
  `package.json` name, else the folder's), and prints its size. `--out
  <file>` writes elsewhere.
- **Assets go in as data URLs.** Each sheet and sound file becomes a
  base64 `data:` URL in the code, so the loaders fetch them as they do in
  dev. Maps and flags are already part of the code.
- **It warns about size.** Under the page's size it lists the five
  largest sheets and sounds, and warns about every wav, on stderr:
  `sounds/music.wav is 10.8 MB of uncompressed audio: an ogg or mp3 is
  about a tenth of that`.
- **It type-checks first** and stops on an error; `--no-check` skips the
  check. TypeScript comes with tico8. A `tsconfig.json` in the project
  folder is used when there is one, tico8's own settings otherwise (one
  in a folder above is ignored).
- **The page holds one module** inline, with the CSS and the UI font, so
  it runs from `file:`; the dev page and the exported one share a style.

## New projects

- **`npm create tico8 my-game`** makes a folder with a starter game in it:
  `package.json`, `tsconfig.json`, `tico8.config.ts`, `main.ts`, one sprite
  sheet and its `sprites.ts`, and a `.gitignore`. The game is a sprite moved
  with the arrow keys.
- **It installs**, with whichever package manager ran it (npm, pnpm, yarn or
  bun), then prints the next step: `cd my-game` and `npm run dev` (or that
  manager's own command). It does not run `git init`.
- **With no folder name it asks for one** in the terminal. A folder that
  exists and is not empty is written into only after a yes.
- **The editor settings come from tico8:** the starter's `tsconfig.json` is
  `{ "extends": "tico8/tsconfig" }`, so they move with the engine. `tico8
  export` type-checks with that file.
- **`create-tico8` and `tico8` share a version number,** and a project is
  made depending on `^` that version.
- **Prompts:** `Project name: (my-game)`; `<dir> is not empty. Write into
  it anyway? (y/N)`. Without a terminal, either is an error naming what to
  pass. A failed install keeps the project and prints the steps to run.
- **Vite's client types** (CSS imports, `import.meta.hot`) come through
  `tico8/client`, which the base config names in `types`, so they resolve
  from tico8's folder under pnpm as well as npm.
- **`pnpm create:check`** packs both packages, makes a project with the
  packed `create-tico8` against the packed `tico8`, and exports and serves
  it, then serves a copy with no config file.

## Name

"tico8" is a working name. It is close to TIC-80, an existing fantasy console,
in both sound and search results. Settle it before the first npm publish,
since it ends up in the package name, import line, CLI command and config file.
Kept through slice 17, which publishes nothing. On 2026-10-16 both `tico8`
and `create-tico8` were free on npm.

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
- A real object layer in the map editor: named objects at pixel positions,
  with properties.
- Reading `.aseprite` files directly, including its tileset data.
- Importing maps made in Tiled.

**Drawing and text**
- Fill patterns (two-colour dither fills).
- Custom fonts as sprite sheets: a PNG grid where each cell is a letter.

**Sound**
- A built-in synth, with effects described as a few numbers in a text file.

## Still to decide

**Before public release**
- The final default palette, after checking Lexaloffle's terms for reusing
  Pico-8's and deciding how much tico8 should look like its inspiration.
- The name.

**When the UI layer is built**
- Whether the UI layer stays at all.
