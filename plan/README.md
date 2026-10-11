# tico8 — plan

Slices in build order. How to work one is in `../AGENTS.md`.

Status is `todo`, `doing` or `done`. Only the lead session edits this table.
Slices whose "needs" are all `done` can run in parallel.

| # | Slice | Needs | Size | Status | You can see |
|---|---|---|---|---|---|
| 01 | [Skeleton](01-skeleton.md) | none | medium | done | `tico8 dev` shows a dot moving on a 128x128 screen; saving the file restarts it |
| 02 | [Sprite moves](02-sprite-moves.md) | 01 | medium | done | A PNG sprite moved with the arrow keys; repainting the PNG shows up live |
| 03 | [Drawing](03-drawing.md) | 02 | medium | done | Shapes, camera, clip and palette swap in the demo |
| 04 | [Text](04-text.md) | 02 | small | done | A score drawn in the pixel font |
| 05 | [Config](05-config.md) | 02 | small | done | The demo switched to 160x144 with its own palette |
| 06 | [Input](06-input.md) | 05 | medium | done | Jump on a named action, from keyboard and controller |
| 07 | [Maps](07-maps.md) | 02 | medium | todo | A room with layers the sprite walks between and solid walls |
| 08 | [Audio](08-audio.md) | 02 | small | todo | A sound played on a button press |
| 09 | [Save](09-save.md) | 02 | small | todo | A high score that survives a page reload |
| 10 | [UI layer](10-ui.md) | 04, 06 | medium | todo | A JSX HUD and a menu driven by the pad |
| 11 | [Pause menu](11-pause-menu.md) | 08, 10 | small | todo | Built-in pause with volume and a controls screen |
| 12 | [Export](12-export.md) | 02 | medium | todo | One HTML file that plays the demo on double-click |
| 13 | [Sprite editor](13-sprite-editor.md) | 02 | large | todo | A Sprites tab that paints into the PNG the game is showing |
| 14 | [Map editor](14-map-editor.md) | 07, 13 | large | todo | A Map tab that edits the room the game is showing |
| 15 | [Package build](15-package-build.md) | 05 | small | todo | The demo run from an installed copy of the package, not the workspace source |
| 16 | [Scaffold](16-scaffold.md) | 05, 15 | small | todo | `npm create tico8` makes a project that runs |

## Lanes after slice 02

- Drawing: 03, 04
- Input: 05, 06
- World: 07
- Sound and storage: 08, 09
- UI: 10, 11
- Shipping: 12, 15, 16
- Editors: 13, 14

Export (12) packs every asset type that exists when it is built. A slice that
adds an asset type after that also adds it to the export.

## Not yet sliced

Error overlay, docs, templates, and everything under "Optional enhancements"
in `../01-spec.md`.
