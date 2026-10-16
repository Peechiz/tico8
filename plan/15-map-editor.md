# 15 — Map editor

## Demo

`examples/15-map-editor`, copied from `examples/21-editor-look`, run with
`pnpm dev 15-map-editor`. The shell gains a Map tab. Open `night`, paint the
sky with the 2x2 moon picked as a block from the tileset, fill and
rectangle with grass, select a block of wall and move it, hide and show
layers, add and rename one. With the split on, each step lands in the game
without a restart. Tick `wall` on another tile and show the flag: the tiles
tint in the tileset and on the map, and the paddle stops at them. Turn on
Arrange and drag the brick onto an empty tile: the PNG, `tiles.flags.json`
and `night.json` all follow, the game looks the same, and one undo puts it
back. Make a new map and resize it; both show as files in `maps/`.

## Spec

`01-spec.md`: Editors; Map editor; Maps, "Rearranging tiles".

## Decided

- **Tools:** brush, eraser, fill, rectangle (filled), pick, select with
  move, cut, copy and paste, undo and redo, on the current layer only.
- **The brush is a block of tiles,** a single tile or a block dragged out in
  the tileset. Brush strokes, fill and rectangle lay it down as a pattern:
  a stroke anchored at the cell pressed, a rectangle at its top left, a fill
  at the cell clicked. Pick takes one tile from the current layer.
- **Arrange swaps.** With Arrange on, a drag in the tileset from tile A onto
  tile B swaps the two: their 8x8 pixels in the PNG, their flags, and A and
  B in every layer of every map on the tileset. Self-inverse, so undo swaps
  again. Off, a drag picks a block.
- **Flags:** a checkbox per flag for the chosen tiles, mixed when they
  differ; add, rename and remove flags. One flag at a time can be shown,
  tinting its tiles. A tileset with no flags file gets one on its first flag,
  named after the sheet: `tiles.png` gets `tiles.flags.json`.
- **View:** the whole map at a whole scale that fits, until zoomed; `=` and
  `-` step the zoom through 1, 2, 3, 4, 6 and 8, `0` fits again, the wheel
  zooms about the pointer. Space-drag or middle-drag pans. Faint cell lines
  from 3x, firm lines every screen's width and height.
- **Layers:** a list in file order, drawn bottom to top in the editor. Click
  makes current, an eye shows and hides (editor only), double-click renames;
  add, remove (not the last), move up and down. `[` and `]` change the
  current layer.
- **Maps:** tabs over the maps folder with name, tileset and size; New is a
  dialog (name, an 8x8 tileset, size in cells defaulting to one screen,
  first layer `ground`), writing `maps/<name>.json`; Resize keeps the top
  left and says how many cells with a tile a shrink cuts.
- **History:** one per open map, 100 steps. Painting, layer changes, resize,
  flag changes and swaps are each one step; undo and redo write every file
  they change. Opening another map starts fresh.
- **Files through a `MapHost`:** `GET /@tico8/maps` lists the maps as
  `MapInfo[]`, `GET` and `PUT /@tico8/maps/<file>` read and write a map,
  `GET` and `PUT /@tico8/flags/<file>` a flags file (a missing one is 404).
  `tico8:maps-listed` is sent when the list changes. Changes arrive on the
  existing `tico8:map-changed` and `tico8:flags-changed` events; the
  tileset's PNG through the sprite host.
- **Echoes,** as in the sprite editor: a change that matches what the
  editor shows, or one of its recent writes, is ignored; anything else is
  taken in as one undoable step. A change during a drag is ignored.
- **Tiles are drawn from the PNG's RGBA,** a pixel less than half opaque
  see-through, so the map editor needs no palette.

## Layout

```
packages/tico8/src/editor/map-types.ts      contract: every shared type, shortcuts, props
packages/tico8/src/editor/map-doc.ts        map and flags data: new, resize, layers, flags, names
packages/tico8/src/editor/map-tools.ts      brush, eraser, fill, rect, pick, selection on a layer
packages/tico8/src/editor/rearrange.ts      swap two tiles across PNG, flags and maps
packages/tico8/src/editor/map-state.ts      the map editor's store
packages/tico8/src/editor/map-host.ts       the dev MapHost: fetch + HMR events
packages/tico8/src/vite/map-files.ts        dev server: list, read and write maps and flags
packages/tico8/src/assets/event.ts          + MAPS_LISTED
packages/tico8/src/editor/map-canvas.tsx    the map: layers, grid, flag tint, brush ghost, pan, zoom
packages/tico8/src/editor/tileset-view.tsx  TilesetView (pick, block, arrange) and FlagsPanel
packages/tico8/src/editor/map-panels.tsx    MapToolRail, LayerList, MapStatusLine, MapShortcutSheet
packages/tico8/src/editor/map-tabs.tsx      MapTabs, NewMapDialog, ResizeMapDialog
packages/tico8/src/editor/map-editor.tsx    the Map tab: panels around the canvas
packages/tico8/src/editor/main.tsx          + the Map tab
packages/tico8/src/vite.ts                  + mapFiles()
examples/15-map-editor/                     the demo
```

## Tasks

- [x] **1. Contract** *(contract)*. Lead. `map-types.ts`: `MapInfo`,
  `MapHost`, `Cells`, `LayerSelection`, `MapDoc`, `Tileset`, `MapToolName`,
  `MapActionName`, `MAP_SHORTCUTS`, `MapEditorState`, `MapEditor`, `NewMap`,
  the components' props. `event.ts` gets `MAPS_LISTED`; `icons.tsx` gets the
  new icons. Every file below gets its exported signatures, each throwing
  "not yet", and each component its props. Owns: `map-types.ts`,
  `event.ts`, `icons.tsx`, the stubs. Waits on: none.
- [x] **2. Map document.** `map-doc.ts`: `newMapData`, `resizeMap` (top
  left kept), `tilesCut`, `cloneMap`, `sameMap`, layer add, rename, remove
  and move with `layerNameProblem`, flag add, rename, remove and `setFlag`
  with `flagNameProblem`, `writeFlags` (one flag a line, frames sorted,
  `parseFlags(JSON.parse(writeFlags(f)))` gives `f` back), `flagsFileFor`,
  `mapFile`. Tested with small maps and flag sets. Owns: `map-doc.ts`,
  `map-doc.test.ts`. Waits on: 1.
- [x] **3. Map tools.** `map-tools.ts` on `Cells`: `layerCells`,
  `stampLine` (brush pattern along a Bresenham line, anchored at the
  press), `eraseLine`, `fillCells` (four-way, same frame, pattern anchored
  at the click; nothing when it would change nothing), `rectCells`,
  `pickCell`, `cellsBetween`, and `liftCells`, `moveCellSelection`,
  `dropCells` (lifted empty cells leave what is under), `copyCells`,
  `pasteCells`. Everything clips to the layer. Tested with text pictures.
  Owns: `map-tools.ts`, `map-tools.test.ts`. Waits on: 1.
- [x] **4. Rearrange.** `rearrange.ts`: `swapTiles({ a, b, pixels, flags,
  maps })` gives new pixels, flags and maps with A and B swapped; the inputs
  are untouched; swapping twice gives the start back; a tile past the
  sheet's end is refused. Tested on a 2x2-tile sheet with two maps. Owns:
  `rearrange.ts`, `rearrange.test.ts`. Waits on: 1.
- [x] **5. Files.** `vite/map-files.ts`, a plugin: the routes in "Decided";
  a map file must be a `.json` directly in `maps/`, not a flags file, whose
  name camel-cases to a usable name; a flags file a `.flags.json` directly
  in `sprites/`; no folders, `..` or hidden files, else 400 with the
  reason; writes through a hidden temp file and a rename, making the folder
  if missing; `tico8:maps-listed` sent only when `scanMaps`'s list changes.
  `editor/map-host.ts`: `devMapHost(sheets, hot)` implements `MapHost` with
  `fetch` and the HMR events. Tested on a temp folder through the
  middleware. Owns: `vite/map-files.ts`, `vite/map-files.test.ts`,
  `editor/map-host.ts`. Waits on: 1.
- [x] **6. Map editor state.** `map-state.ts`: `createMapEditor({ host })`
  as `MapEditor` describes: open (first map on start, its tileset and
  flags), tools on the current layer, the brush from the tileset, layers,
  flags, swaps across every map on the tileset (reading the ones not open),
  zoom, history, saving, echoes, outside changes, the list event (a removed
  open map closes). Tested with an in-memory `MapHost`: a stroke writes the
  map once, a flag toggle writes the flags file, a swap writes PNG, flags
  and both maps and undo puts them back, an outside change is undoable, the
  echo is ignored. Owns: `map-state.ts`, `map-state.test.ts`. Waits on: 1
  (runs against 2–4's stubs; finish after them).
- [x] **7. Map canvas.** `map-canvas.tsx`: `MapCanvas` draws visible layers
  in order over the checker, cell and screen lines, the shown flag's tint,
  the brush ghost at the hovered cell, a rect while dragged, the selection's
  outline; pointer to the editor's actions in cells; right- or Alt-click
  picks; wheel zoom about the pointer, space- and middle-drag pan.
  `tileImage` turns a tileset's RGBA into something drawable once per
  version. Tested in happy-dom: a pointer reaches the right cell at a
  zoom; right-click picks; hover reports the cell and its frame. Owns:
  `map-canvas.tsx`, `map-canvas.test.tsx`. Waits on: 1.
- [x] **8. Tileset view and flags.** `tileset-view.tsx`: `TilesetView`, the
  tileset at 2x or more with a cell grid, frame numbers on hover, the
  chosen block outlined, the shown flag's tint; click picks, drag picks a
  block; with Arrange on, a drag from one tile onto another calls
  `swapTiles`. `FlagsPanel`: a checkbox per flag for the chosen tiles
  (mixed shown as such), a show toggle per flag, add, rename and remove with
  the reason a name is refused. Tested in happy-dom. Owns:
  `tileset-view.tsx`, `tileset-view.test.tsx`. Waits on: 1.
- [x] **9. Panels.** `map-panels.tsx`: `MapToolRail` (tools, then undo and
  redo, keys in titles), `LayerList` (as in "Decided", the reason a name is
  refused), `MapStatusLine` (column, row, frame under the pointer, map size,
  or the error), `MapShortcutSheet` (every key in `MAP_SHORTCUTS`, plus
  right-click, space-drag, wheel and ?). Tested in happy-dom. Owns:
  `map-panels.tsx`, `map-panels.test.tsx`. Waits on: 1.
- [x] **10. Map tabs.** `map-tabs.tsx`: `MapTabs` (name, tileset and size
  per map; Resize on the open one; New; save state), `NewMapDialog`
  (refuses a bad or taken name with the reason, previews the file),
  `ResizeMapDialog` (the cut count in red). Tested in happy-dom. Owns:
  `map-tabs.tsx`, `map-tabs.test.tsx`. Waits on: 1.
- [x] **11. Demo.** `examples/15-map-editor` copied from
  `examples/21-editor-look`, package renamed. Owns:
  `examples/15-map-editor/`. Waits on: none.
- [x] **12. Wire up.** Lead. `map-editor.tsx` composing tabs, rail, canvas,
  tileset, flags, layers and status over the state, with ? for the shortcut
  sheet; `main.tsx` adds the Map tab; `vite.ts` adds `mapFiles()`. Run the
  demo in the browser. Owns: `map-editor.tsx`, `main.tsx`, `vite.ts`,
  `vite.test.ts`. Waits on: 2–11.

## Check

- `pnpm test`, `pnpm lint` and `pnpm typecheck` pass, including: a swap and
  its undo across PNG, flags and two maps; a stroke written once with its
  echo ignored; `writeFlags` round-tripping; the server refusing a bad name.
- In the browser on `examples/15-map-editor`: everything in the Demo, with
  the split on; keys pressed in the Map tab do not move the paddle; a map
  changed in a text editor shows up.
- `pnpm dev 21-editor-look` still runs and its Sprites tab still works.

## Decisions made

- **Names:** a layer or flag is letters and digits from a letter, not one of
  the map's or a tile's own names, not taken; the reason says which. A map's
  name follows a sheet's (letter, then letters, digits, dashes) and must
  camel-case to a name `maps.ts` can export, the server sharing that check
  with `maps.ts`. New offers only 8x8 sheets as tilesets.
- **Flags file:** named from the sheet with `.png` and any size suffix
  dropped (`big.16x24.png` gives `big.flags.json`), or the one other maps on
  the tileset already use. A flag on no tiles stays as `"name": []`. A swap
  writes it only when flags change.
- **Tools:** a stroke's pattern is anchored at the press, a rectangle's at
  its top left even where the layer cuts it; fill finds its region before
  painting, so a brush holding the clicked tile cannot run on. Copy needs a
  selection; paste lands at the map's top left. Choosing tiles while on the
  eraser or pick goes back to the brush.
- **Layers:** listed in file order, "drawn in this order". A new layer
  becomes current; removing the current one makes its neighbour current;
  moving past either end does nothing.
- **Swaps** read every map on the tileset first and are cancelled whole if
  one cannot be read, so files are never half swapped.
- **Opening:** the brush is kept when the tileset is the same. A map whose
  tileset is missing or not 8x8 still opens, with the error, so it can be
  seen. An outside change that names another tileset reopens the map with a
  fresh history.
- **View:** a readout in the canvas's corner shows the zoom as a percentage
  (100% is one screen pixel a game pixel) with -, + and a Fit button, lit
  while fitted. The canvas tells the store the scale that fits, so `=` and
  `-` step from what is shown. A plain scroll, such as a two-finger drag,
  pans; a pinch, or a scroll with Ctrl or ⌘, zooms a step for every 32
  pixels scrolled, so a long pinch goes several levels; a mouse notch is
  one. A 150ms pause or a turn starts a new gesture. The
  checker lays two squares to a tile, so it follows the cells at every
  zoom. A pan keeps 32 screen
  pixels of the map in view; zooming by key or opening a map re-centres it.
  The shown flag tints its tiles on every shown layer, k12 at 35% with an
  outline. The status line follows a stroke under a still pointer. The
  tileset draws at 200px wide by whole scales from 2 to 8.
- **Files:** a missing map is an error, a missing flags file reads as none;
  refused names are refused for reading too.
- **Focus:** a press anywhere in an editor takes focus back from the game
  frame (canvases cancel their presses, which left the focus in the game,
  so arrow keys moved its menu). Each editor answers keys only while its tab
  shows, since tabs stay mounted.
- Seen in Chrome on `examples/15-map-editor` with the split on: a 2x2 moon
  stamped and undone, a flag set and shown on tileset and map, brick and
  star swapped across PNG, flags and map and undone to identical pixels,
  a wall block moved, layers added, renamed, refused, hidden and removed,
  `cave` made with fill and rectangle, resized with its cut count, then
  deleted from disk and gone from the tabs, an edit to `night.json` from
  outside shown and undone, the shortcut sheet, the game following each
  step. `pnpm dev 21-editor-look` still serves.
