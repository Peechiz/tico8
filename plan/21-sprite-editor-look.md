# 21 — Sprite editor look

## Demo

`examples/21-editor-look`, copied from `examples/14-sprites`. `pnpm dev`
opens the Sprites tab in the console's own colours and font. Paint `badge`
and watch the brush outline and the x, y and frame readout follow the
pointer; right-click a pixel to pick its colour. Drag a selection and flip it
from the bar that appears above it. Turn the split on at 1024 wide and the
canvas still has most of the room; drag the divider. Make a sheet from the
New sheet dialog and see the file name it will write before making it.

## Spec

`01-spec.md`: Editors; Sprite editor. The direction is "Cartridge, with
Darkroom's interaction model" from the design pitch
(https://claude.ai/artifact/6fHh4qqtLCRTgUKWKFektq).

## Decided

- **Chrome in the console's colours.** The editor and shell use only
  tico8's sixteen default colours (`PICO8`), whatever the project's palette:
  1 ground, 0 wells and panels, 13 lines and quiet text, 6 text, 7 bright
  text, 10 the chosen tool. The art keeps the project's palette.
- **The tico8 font for numbers and short labels**, at 12px (2x) and 18px
  (3x). Dialogs, errors and the shortcut sheet use the system face, since
  the 3x5 glyphs are hard to read in sentences.
- **Layout:** sheet tabs along the top with New and save state; a tool rail
  on the left; the canvas centred; colour, palette and sheet view on the
  right; a strip of frames and a status line at the bottom. Below 760px of
  editor width the right column folds under the canvas.
- **See-through pixels** show over one faint checker of 16 screen pixels,
  drawn behind the whole canvas, not one per sheet pixel. Pixel lines are
  faint, cell lines firm.
- **Feedback:** the pixel under the pointer is outlined in the brush colour;
  the status line shows x, y and the frame number. The current colour shows
  as a large chip with its index. "Saving" and "Saved" sit by the tabs;
  errors show in the status line in red (8).
- **Selection bar:** while there is a selection, Flip ↔, Flip ↕, Rotate and
  Done float above it.
- **Rectangles:** the rail has Rectangle and Filled rectangle; R picks the
  rectangle, and R again switches between outline and filled.
- **Keys:** arrows move the zoomed cells by one; 1, 2 and 4 set the zoom;
  ? opens the shortcut sheet. Labels show ⌘ and ⇧ on a Mac, Ctrl elsewhere.
  Right-click or Alt-click picks a colour with any tool.
- **Sheets:** each tab shows a thumbnail, the name and the cell size. New is
  a dialog with labelled fields and a preview of the file and its size.
  Resize is a dialog from the open sheet's tab and says how many cells with
  art a shrink would cut.
- **Split:** the divider between game and editor can be dragged; its place
  is kept with the tab and split.

## Layout

```
packages/tico8/src/editor/types.ts          contract: state, actions, shortcuts, props
packages/tico8/src/editor/theme.ts          contract: colours, fonts, base CSS, useStyle, key labels
packages/tico8/src/editor/icons.tsx         contract: 7x7 tool icons as SVG
packages/tico8/src/editor/state.ts          + saving, moveCell, zoom keys, R toggle, pickAt
packages/tico8/src/editor/canvas.tsx        checker, grid weights, brush outline, hover, selection bar
packages/tico8/src/editor/sheet-view.tsx    sheet view in the new look + FrameStrip
packages/tico8/src/editor/panels.tsx        ToolRail, PalettePanel, StatusLine, ShortcutSheet
packages/tico8/src/editor/sheets.tsx        SheetTabs, NewSheetDialog, ResizeDialog
packages/tico8/src/editor/shell.tsx         tab bar in the new look, draggable divider
packages/tico8/src/editor/sprite-editor.tsx the grid and the narrow layout
examples/21-editor-look/                    the demo
```

## Tasks

- [x] **1. Contract** *(contract)*. Lead. `types.ts`: `EditorState.saving`;
  actions `cellLeft`, `cellRight`, `cellUp`, `cellDown`, `zoom1`, `zoom2`,
  `zoom4`; `Editor.pickAt`; `ToolName` gains nothing (Filled rectangle is
  `rect` with `filled`). `theme.ts`, `icons.tsx` written in full. New
  component props in `types.ts`; each component stubbed. Owns: `types.ts`,
  `theme.ts`, `icons.tsx`, the stubs. Waits on: none.
- [x] **2. State.** `saving` true from a write's start until the queue is
  empty; the cell and zoom actions; R on the rectangle switches `filled`;
  `pickAt` sets the colour from a pixel, leaving it on see-through. Tested
  in `state.test.ts`. Owns: `state.ts`, `state.test.ts`. Waits on: 1.
- [x] **3. Canvas.** The checker, grid weights, centring, the brush outline,
  `onHover`, right- and Alt-click to `pickAt`, the selection bar. Tested in
  happy-dom: hover reports the pixel; right-click calls `pickAt`; the bar
  shows only with a selection and its buttons act. Owns: `canvas.tsx`,
  `canvas.test.tsx`. Waits on: 1.
- [x] **4. Sheet view and frames.** `SheetView` in the theme, frame number
  in its title on hover; `FrameStrip`, one button per cell with a small
  picture and its frame number, the zoomed ones marked, a click picks the
  cell. Tested in happy-dom. Owns: `sheet-view.tsx`, `sheet-view.test.tsx`.
  Waits on: 1.
- [x] **5. Panels.** `ToolRail` (icons in groups: draw, shapes, select,
  then undo and redo; keys in titles), `PalettePanel` (chip and index, 4x4
  palette, "From this sheet" colours), `ZoomPicker`, `StatusLine` (x, y,
  frame, or the error), `ShortcutSheet` (every key in `SHORTCUTS` with its
  label, plus right-click and ?). Tested in happy-dom. Owns: `panels.tsx`,
  `panels.test.tsx`. Waits on: 1.
- [x] **6. Sheets.** `SheetTabs` (thumbnail, name, cell size; the open
  sheet's tab has a Resize button; New; save state), `NewSheetDialog`,
  `ResizeDialog` with the crop count. Tested in happy-dom: a bad name shows
  the reason; the preview names the file; the crop count. Owns:
  `sheets.tsx`, `sheets.test.tsx`. Waits on: 1.
- [x] **7. Shell.** The tab bar in the theme; a divider dragged with the
  pointer or arrow keys, between 20% and 80%, kept in `tico8:shell`. Tested
  in happy-dom. Owns: `shell.tsx`, `shell.test.tsx`. Waits on: 1.
- [x] **8. Demo.** `examples/21-editor-look` copied from
  `examples/14-sprites`, package renamed. Owns: `examples/21-editor-look/`.
  Waits on: none.
- [x] **9. Wire up.** Lead. `sprite-editor.tsx`: the grid, the narrow
  layout, ? for the shortcut sheet, hover passed from canvas to status.
  Seen in the browser at 1440 and split at 1024. Owns: `sprite-editor.tsx`.
  Waits on: 2–8.

## Check

- `pnpm test`, `pnpm lint` and `pnpm typecheck` pass.
- In the browser on `examples/21-editor-look`: everything in the Demo, at
  1440 wide and split at 1024; slice 14's browser checks still hold.
- `pnpm dev 14-sprites` still runs.

## Decisions made

- **Look:** the editors' chrome takes tico8's own sixteen colours (`PICO8`)
  whatever the project's palette, set up in `editor/theme.ts` as `--k0` to
  `--k15` under `.t8e`. The tico8 font is for numbers and short labels;
  dialogs, errors and key names in the shortcut sheet use the system face,
  since the tico8 font has no ⌘, ⇧ or ⌫. The selection bar says Flip H and
  Flip V, after their keys, as it has no ↔ or ↕ either.
- **Shell:** the divider shows while split with an editor tab open; the
  game's width is 20–80%, default 40, moved by dragging or by ←/→ in 5%
  steps, kept in `tico8:shell` with tab and split (an old value without it
  loads as 40). A cover goes over the game while dragging.
- **Canvas:** one checker of 16 screen pixels behind the whole canvas; the
  sheet view and frame pictures use 4px squares. The brush outline is in the
  brush colour, or k7 for eraser, pick, select and colours too dark to see
  (brightness under 60: 0 and 1). It stays during pencil and eraser strokes
  and hides during line, rect and select drags. The selection bar sits 6px
  above the selection, below it when there is no room, and hides while the
  pointer is held. A right-click or Alt-click only picks; its release is not
  passed on. The pointer stays a crosshair over the outline; hiding it
  lost the pointer.
- **Keys:** arrows move the zoomed cells one cell, clamped; 1, 2, 4 zoom;
  R on the rectangle toggles filled; ? opens the shortcut sheet, and keys
  behind it do nothing until it closes. Labels use ⌘ and ⇧ on a Mac.
- **Panels:** swatch numbers are k7 on colours of luminance under 0.17,
  k0 otherwise. The shortcut sheet lists Tools, Editing, Selection and View,
  and every action must have a description there or the typecheck fails.
  The palette and zoom are plain divs, not `role="group"`.
- **Sheets:** the tab bar owns the New and Resize dialogs. A new sheet's
  name is a letter then letters, digits and dashes; cell sizes 8×8, 16×16,
  32×32, 24×8 and 8×16; 16×16 cells by default. Tab thumbnails show the
  whole sheet. Save state reads "saving" and "saved" in lower case, like
  the rest of the pixel-font labels. Resize warns in red how many cells with
  art a shrink cuts, and closes without waiting for the write.
- **Narrow layout:** below 760px of editor width the right column folds
  under the canvas, beside the tool rail.
- **Demo's tiles:** the moon is laid out as a 2x2 block at frames 0, 1, 4
  and 5, so 2x2 zoom shows it whole; the star tiles moved to 6 and 7 and the
  map's sky layer follows. Bricks and grass stay at 2 and 3.
- **Fit:** the canvas fits what the zoom shows, so a sheet smaller than the
  zoom (badge at 2x2) stays full size.
- Seen in Chrome on `examples/21-editor-look`: 1440 wide and split at 1024;
  hover readout, a stroke, a selection with its bar, right-click picking,
  the New sheet dialog making `coin.png` (removed after), the shortcut
  sheet. `pnpm dev 14-sprites` still runs.

