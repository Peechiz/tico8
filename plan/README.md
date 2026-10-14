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
| 07 | [Maps](07-maps.md) | 02 | medium | done | A room with layers the sprite walks between and solid walls |
| 08 | [Animation and clock](08-animation.md) | 07 | small | done | The figure walking on a named animation, with no frame arithmetic in the game |
| 09 | [Audio](09-audio.md) | 02 | small | done | A sound played on a button press |
| 10 | [Save](10-save.md) | 02 | small | done | A high score that survives a page reload |
| 11 | [UI layer](11-ui.md) | 04, 06 | medium | done | A JSX HUD and a menu driven by the pad |
| 12 | [Pause menu](12-pause-menu.md) | 09, 11 | medium | done | Built-in pause with volume and a controls screen |
| 13 | [Export](13-export.md) | 02 | medium | todo | One HTML file that plays the demo on double-click |
| 14 | [Sprite editor](14-sprite-editor.md) | 02 | large | todo | A Sprites tab that paints into the PNG the game is showing |
| 15 | [Map editor](15-map-editor.md) | 07, 14 | large | todo | A Map tab that edits the room the game is showing |
| 16 | [Package build](16-package-build.md) | 05 | small | todo | The demo run from an installed copy of the package, not the workspace source |
| 17 | [Scaffold](17-scaffold.md) | 05, 16 | small | todo | `npm create tico8` makes a project that runs |
| 18 | [CLI info commands](18-cli-info.md) | 05 | small | todo | `tico8 palette` prints the palette with colour swatches in the terminal |
| 19 | [Input tester](19-input-tester.md) | 12 | small | todo | The controls screen lights up each row while its button is held |

## Lanes after slice 02

- Drawing: 03, 04, 08
- Input: 05, 06
- World: 07
- Sound and storage: 09, 10
- UI: 11, 12, 19
- Shipping: 13, 16, 17
- Tooling: 18
- Editors: 14, 15

Export (13) packs every asset type that exists when it is built. A slice that
adds an asset type after that also adds it to the export.

## Not yet sliced

Error overlay, docs, templates, and everything under "Optional enhancements"
in `../01-spec.md`.
