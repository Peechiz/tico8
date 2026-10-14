# 14 — Sprite editor

## Demo

`examples/14-sprites`, copied from `examples/13-export`, with one new sheet,
`badge.16.png`, drawn in the HUD's corner. `pnpm dev` opens a page with
Game and Sprites tabs and a split toggle. In Sprites, pick `badge`, paint it
with each tool, and with the split on watch each stroke land in the game
without a restart. Make a new sheet and resize it; both appear as files in
`sprites/`. Repaint `star.png` in another program and the editor shows it.

## Spec

`01-spec.md`: Editors; Sprite editor; Sprites; Screen and colour.

## Decided

- **Page:** `/` is the shell: the tabs, the split toggle and the editor.
  The game runs in an `<iframe>` of `/@tico8/game`, the page `/` used to be,
  so keys pressed in the editor never reach it. The export's page is
  unchanged.
- **Files through a host.** The editor reads and writes only through a
  `FileHost` (list sheets, read one, write one, hear of changes). The dev
  host speaks HTTP to the dev server and listens on Vite's HMR channel;
  tests use one in memory.
- **The editor works on colour indices**, as the game does: a sheet is read
  through `indexPixels` with the palette first, so off-palette colours get
  indices after it and are written back exactly. A pixel less than half
  opaque is read as see-through and written fully transparent; a sheet is
  saved as the game shows it.
- **PNG out is tico8's own encoder** (8-bit RGBA, deflated with
  `CompressionStream`), so no canvas colour handling touches the pixels.
- **Saved when a stroke ends.** Each finished stroke, paste, flip, rotate,
  undo or redo writes the file. A change event whose bytes match the last
  write is the editor's own echo and is ignored; any other change replaces
  the sheet in the editor as one undoable step.
- **UI in Preact,** already a dependency, styled with plain CSS.

## Layout

```
packages/tico8/src/editor/types.ts        contract: every shared type
packages/tico8/src/editor/png.ts          encodePng
packages/tico8/src/editor/image.ts        sheet document: decode, encode, history
packages/tico8/src/editor/tools.ts        pencil, eraser, fill, line, rect, pick
packages/tico8/src/editor/selection.ts    select, move, copy, paste, flip, rotate
packages/tico8/src/editor/state.ts        the editor's store: what is open, tool, colour, saving
packages/tico8/src/editor/host.ts         the dev FileHost: fetch + HMR events
packages/tico8/src/vite/files.ts          dev server: list and write sheets, sheets-listed event
packages/tico8/src/editor/canvas.tsx      zoomed cells; pointer to tools
packages/tico8/src/editor/sheet-view.tsx  whole sheet; picks the cell
packages/tico8/src/editor/panels.tsx      toolbar, palette, sheet picker, new and resize
packages/tico8/src/editor/shell.tsx       tabs, split toggle, game iframe
packages/tico8/src/editor/sprite-editor.tsx  the Sprites tab: panels around the canvas
packages/tico8/src/editor/main.tsx        mounts the shell; the shell page's module
packages/tico8/src/vite.ts                + shell page at /, game page at /@tico8/game
```

## Tasks

- [x] **1. Contract** *(contract)*. Lead. In `editor/types.ts`:
  `SheetInfo` (`file`, `name`, `url`, `cellWidth`, `cellHeight`),
  `FileHost` (`list(): Promise<SheetInfo[]>`, `read(file): Promise<Pixels>`,
  `write(file, bytes: Uint8Array): Promise<void>`,
  `onChange(listener: (file) => void): () => void`,
  `onList(listener: (sheets) => void): () => void`), `Tool`, `ToolName`,
  `Selection`, `Clip`, `Point` (a `Vec`), `EditorState` and its actions,
  and the keyboard shortcuts as a table. Each other file below gets its
  exported signatures, each throwing "not yet", and the components their
  props types. Owns: `editor/types.ts`, the declarations in every file
  below. Waits on: none.
- [ ] **2. PNG encoder.** `encodePng({ width, height, data })` gives the
  bytes of an 8-bit RGBA PNG, one IDAT, no filters needed beyond 0, CRCs
  right. Tested by decoding its output (hand-written inflate check via
  `DecompressionStream`, or the dimensions and pixels read back through a
  small parser in the test) for a 3x2 image with a transparent pixel.
  Owns: `editor/png.ts`, `editor/png.test.ts`. Waits on: 1.
- [ ] **3. Sheet document.** `openSheet({ info, pixels, palette })` gives
  an indexed image and its colours (palette, then off-palette ones);
  `toRgba` turns it back, exact for every colour and transparent pixels
  0,0,0,0. `createHistory` holds snapshots for undo and redo, capped at 100
  steps; a new step clears redo. `resizeSheet` changes the size in whole
  cells, keeping the top left. `blankSheet({ cellWidth, cellHeight, cells })`
  is all transparent. Tested with off-palette colours round-tripping, half
  transparent pixels, undo past the cap, resize both ways.
  Owns: `editor/image.ts`, `editor/image.test.ts`. Waits on: 1.
- [ ] **4. Drawing tools.** On an indexed image, clipped to a rect (the
  zoomed cells or the selection): pencil and eraser as a stroke from point
  to point (Bresenham, so a fast drag leaves no gaps), fill (four-way, same
  index), line, rect outlined and filled, pick (the index under a point).
  Tested with text pictures for each tool and for clipping.
  Owns: `editor/tools.ts`, `editor/tools.test.ts`. Waits on: 1.
- [ ] **5. Selection.** Select a rect; lift it (the hole becomes
  transparent) and move it; drop it; copy to a `Clip` and paste as a lifted
  selection at a point; flip horizontally and vertically and rotate a
  quarter turn clockwise, the selection or, with none, the zoomed cells.
  Rotating a selection that is not square is refused. Tested with text
  pictures.
  Owns: `editor/selection.ts`, `editor/selection.test.ts`. Waits on: 1.
- [ ] **6. Files.** The dev server side, a plugin in `vite/files.ts`:
  `GET /@tico8/sheets` lists the sprites folder as `SheetInfo[]` (through
  `scanSprites`); `PUT /@tico8/sheets/<file>` writes the body there, only
  for a name `parseSheetFile` accepts, no folders, `..` or hidden files,
  anything else 400; the sprites folder is made if missing. When the
  folder's list of files changes it sends `tico8:sheets-listed` with the new
  list. The page side, `editor/host.ts`: `devHost()` implements `FileHost`
  with `fetch` and `import.meta.hot` (`SHEET_CHANGED` and the list event),
  reading through `loadPixels`. Tested on a temp folder through the
  middleware: listing, writing, refusing bad names, the list event.
  Owns: `vite/files.ts`, `vite/files.test.ts`, `editor/host.ts`,
  `assets/event.ts` (+ `SHEETS_LISTED`). Waits on: 1.
- [ ] **7. Editor state.** `createEditor({ host, palette })`: the open
  sheet, the zoomed cell and how many cells wide the zoom is (1, 2 or 4),
  tool, colour, selection, clip, history; actions for each tool's pointer
  down, move and up, keyboard shortcuts, new sheet, resize, open. Writes the
  file when a stroke ends, ignores the echo, takes in other changes as an
  undoable step, follows the list event (a removed open sheet closes).
  Subscribable for the UI. Tested with an in-memory `FileHost`: a stroke
  writes once, undo writes the old pixels, an outside change is undoable,
  the echo is ignored. Owns: `editor/state.ts`, `editor/state.test.ts`.
  Waits on: 1 (runs against 3–5's stubs until they land; finish after them).
- [ ] **8. Canvas and sheet view.** `Canvas` draws the zoomed cells big
  with a pixel grid and cell lines, the selection's marching outline and a
  line or rect while dragged, and turns pointer events into the state's
  tool actions in image pixels. `SheetView` draws the whole sheet small with
  a cell grid, the zoomed cells outlined; a click picks the cell. Both draw
  transparent as a checkerboard. Tested in happy-dom: pointer at a
  screen point reaches the right pixel; a click picks the right cell.
  Owns: `editor/canvas.tsx`, `editor/sheet-view.tsx`, their tests.
  Waits on: 1.
- [ ] **9. Panels.** `Toolbar` (a button per tool with its shortcut,
  undo, redo, flip, rotate, zoom 1/2/4), `PalettePanel` (palette swatches,
  then the sheet's off-palette colours after a gap; the chosen one marked),
  `SheetPicker` (the sheets by name with cell size; New: name and cell
  size, refused as the file name rules refuse it; Resize: width and height
  in cells). Tested in happy-dom: a click calls the right action, a bad
  name shows the reason. Owns: `editor/panels.tsx`,
  `editor/panels.test.tsx`. Waits on: 1.
- [ ] **10. Shell.** `Shell` shows Game and Sprites tabs and a split
  toggle; the game is an `<iframe src="/@tico8/game">` kept alive across tab
  switches (hidden, not removed); switching to Game focuses it. The tab and
  split are remembered in `localStorage` (wrapped, it may throw). Tested in
  happy-dom. Owns: `editor/shell.tsx`, `editor/shell.test.tsx`.
  Waits on: 1.
- [ ] **11. Demo.** `examples/14-sprites` copied from `examples/13-export`,
  package renamed, plus `sprites/badge.16.png` (a simple 16x16 badge) drawn
  in the HUD's top right. Owns: `examples/14-sprites/`. Waits on: 1.
- [ ] **12. Wire up.** Lead only. `sprite-editor.tsx` composing the
  panels, canvas and sheet view over the state; `main.tsx` mounting the
  shell; `vite.ts` serving the shell page at `/` and the game page at
  `/@tico8/game`, adding `files()`. Run the demo in the browser.
  Owns: `editor/sprite-editor.tsx`, `editor/main.tsx`, `vite.ts`,
  `vite.test.ts`. Waits on: 2–11.

## Check

- `pnpm test` passes, including: a PNG that reads back as written; off-palette
  colours surviving a round trip; each tool and selection action as text
  pictures; a stroke writing once and its echo ignored; the server refusing
  a bad name.
- `pnpm lint` and `pnpm typecheck` pass.
- In the browser, on `examples/14-sprites`: every tool works on `badge`;
  with the split on, each stroke shows in the game without a restart; New
  and Resize make files in `sprites/`; a PNG changed by another program
  shows up; keys pressed in the editor do not move the paddle.
- `tico8 export` in `examples/14-sprites` still works; `pnpm dev 13-export`
  still runs.

## Decisions made

None yet.
