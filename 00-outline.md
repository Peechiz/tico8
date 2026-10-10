# tico8 — rough outline

A Pico-8-inspired fantasy console where the project is a folder of plain files,
the game is written in TypeScript, and VSCode is the primary editor.

## Premise (from the first conversation)

Keep from Pico-8:
- Small, opinionated, fixed-spec feel (low res, 16 colours, tiny API)
- Built-in sprite and map editing, no plugins needed
- Dead-simple export and sharing

Change:
- TypeScript instead of Lua
- One copy of the project, on disk, watched: saving in VSCode is the whole
  reload step (see "How Pico-8 handles external editors" below)
- Audio authored in external tools and imported, no built-in tracker
- No token limit; the screen and palette are what keep games small
- UI can be written in JSX and CSS (provisional)

The full set of decisions is in `01-spec.md`.

## How Pico-8 handles external editors

From the v0.2.7 manual (`/Applications/pico-8/pico-8_manual.txt`, sections
"Using an External Text Editor" and "#INCLUDE").

What it supports:
- A `.p8` cart is already a plaintext file and can be edited directly in any
  editor.
- Ctrl-R in Pico-8 re-reads the file from disk, but only if Pico-8's own
  editors have no unsaved changes and the file content differs. If both sides
  changed, it refuses: `DIDN'T RELOAD; UNSAVED CHANGES`.
- `#include file.lua` pulls an external Lua file into the cart each time it
  runs. Paths are relative to the cart (which must be saved first), includes
  are not recursive, and token/character limits still apply. Includes are
  flattened into the cart on `.p8.png` or binary export.
- Carts live in `~/Library/Application Support/pico-8/carts` by default;
  `root_path` in `config.txt` or `-root_path` on the command line moves that.

So nothing is "ejected". The friction is elsewhere:
- There are two copies of the cart, one in Pico-8's memory and one on disk,
  and the user keeps them in sync by hand (Ctrl-S on one side, Ctrl-R on the
  other).
- The manual describes no file watching: reload means switching to the
  Pico-8 window and pressing Ctrl-R.
- A `.p8` holds code, sprites, map and audio in one file, so editing code in
  VSCode while drawing a sprite in Pico-8 sets up the unsaved-changes
  conflict. `#include` sidesteps it by moving code out of the cart, at the
  cost of a stub cart plus loose `.lua` files. (My reading of the two
  sections together, not something the manual states.)
- The project folder is hidden in Application Support unless reconfigured.

What tico8 does differently: the runtime and editors hold no private copy.
Every tool reads and writes the project folder, and a watcher reloads on change.

## Steps

Sizes are effort, not duration.

### 0. Keep/toss walk through Pico-8 — done
Output: `01-spec.md`, the console spec, including optional enhancements and
what is still to decide.

### 1. Runtime core — medium
The TS API and the thing that runs it: game loop (`init`/`update`/`draw` at a
fixed rate), an indexed-colour pixel buffer scaled up crisp, shapes, camera,
clip, palette swap, pixel text, sprite instances, input actions.
Ships with types so autocomplete *is* the manual.

### 2. Dev loop — small/medium
A CLI: `tico8 dev` watches the project folder, serves the game, hot-reloads on
save (code and assets), and generates the typed references for sheets, maps,
flags, sounds and actions. `npm create tico8` scaffolds a project.
This is the piece that fixes the "syncing with the IDE" complaint, so it
comes before any editors.

### 3. Asset formats — small, but decision-heavy
What a project looks like on disk: sprite sheets as indexed PNGs with a
per-sheet cell size, maps with named layers as diffable text, tile flags
beside the tileset, a config file for screen preset, palette, update rate and
actions. Open questions are listed under "Still to decide" in the spec,
chiefly whether the map and tileset files should be openable in Tiled.

### 4. Built-in editors — large
Sprite editor first, map editor second (layers, flags, tile rearranging that
keeps flags and maps in step). They live in the browser tab beside the game
and are written so VSCode can host them later.

### 5. Audio — small
Play ordinary audio files from a folder by name. No editor, no synth.

### 6. UI layer, save and pause menu — medium
The HTML layer: a `ui` function returning JSX each frame, Preact behind
`tico8/ui`, automatic pad navigation, the `<Menu>` wrapper, and tico8's font
and palette as CSS. Plus the typed save and the built-in pause menu with its
generated controls screen.

### 7. Export — small/medium
`tico8 export` produces one self-contained web page file.

### 8. Dogfood + polish — ongoing
Build one small real game on it as early as step 2 is usable, and let that
drive priorities. Docs, examples, error overlay, templates.

## First milestone

A vertical slice of 1 + 2: a `.ts` file that moves a PNG sprite with the
arrow keys, hot-reloading from VSCode. Small, and it proves the core premise
before any editor work starts.

## Later

Native desktop build, editors inside VSCode, and the other items under
"Optional enhancements" in the spec.

## Prior art to check before committing

- **TIC-80**: open-source fantasy console, supports JS among other languages.
  Closest existing thing; worth knowing exactly where it falls short for you.
- **TypeScriptToLua + Pico-8**: write TS, compile to a real Pico-8 cart.
  Solves the language complaint only, not the editor/audio ones.
- **WASM-4, microStudio, Pixel Vision 8**: other takes on the same idea,
  useful for stealing decisions on file layout and export.
