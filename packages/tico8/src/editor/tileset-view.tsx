// The map editor's tileset: pick a tile or a block to paint with, swap two
// tiles with Arrange on; and the chosen tiles' flags beside it.
import { useEffect, useRef, useState } from 'preact/hooks'
import { PICO8 } from '../palette.ts'
import { paintChecker, paintGrid } from './canvas.tsx'
import { Icon } from './icons.tsx'
import type { MapEditorProps, Rect, Tileset, Vec } from './map-types.ts'
import { GRID, INK, useStyle } from './theme.ts'

/** Tiles are 8x8 pixels. */
const TILE = 8
/** How wide, in screen pixels, the tileset aims to be. */
const TILESET_TARGET = 200
/** The shown flag's tint over its tiles: k12, see-through. */
const TINT = (() => {
  const [r, g, b] = PICO8[12] ?? [41, 173, 255]
  return `rgb(${r} ${g} ${b} / 0.45)`
})()

const CSS = `
.t8e .t8e-tileset { display: grid; gap: 8px; justify-items: start; }
.t8e .t8e-tileset-head { display: flex; align-items: center; gap: 8px;
  align-self: stretch; color: var(--k13); }
.t8e .t8e-tileset-head button { margin-left: auto; display: flex; gap: 6px;
  align-items: center; padding: 4px 6px; background: var(--k1); color: var(--k13); }
.t8e .t8e-tileset-head button:hover { color: var(--k7); }
.t8e .t8e-tileset-head button[aria-pressed="true"] { background: var(--k10); color: var(--k0); }
.t8e .t8e-tileset canvas { display: block; cursor: pointer; margin: 2px;
  box-shadow: 0 0 0 2px var(--k5); touch-action: none; }

.t8e .t8e-flags { display: grid; gap: 6px; }
.t8e .t8e-flags-head { color: var(--k13); }
.t8e .t8e-flags ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.t8e .t8e-flags li { display: flex; align-items: center; gap: 6px; min-height: 22px; }
.t8e .t8e-flags input[type="checkbox"] { margin: 0; accent-color: var(--k10); }
.t8e .t8e-flags .t8e-flag-name { flex: 1; text-align: left; color: var(--k7); cursor: default;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t8e .t8e-flags li button:not(.t8e-flag-name) { width: 22px; height: 22px; flex: none; display: grid;
  place-items: center; color: var(--k13); }
.t8e .t8e-flags li button:not(.t8e-flag-name):hover { color: var(--k7); }
.t8e .t8e-flags li button:not(.t8e-flag-name)[aria-pressed="true"] { background: var(--k12); color: var(--k0); }
.t8e .t8e-flags input:not([type]), .t8e .t8e-flags input[type="text"] { flex: 1; min-width: 0;
  font: 14px var(--sans); color: var(--k7); background: var(--k1); border: 0; padding: 3px 6px; }
.t8e .t8e-flags form { display: flex; gap: 6px; align-items: center; }
.t8e .t8e-flags form button { width: 24px; height: 24px; flex: none; display: grid;
  place-items: center; background: var(--k1); color: var(--k7); }
.t8e .t8e-flags .t8e-error { color: var(--k8); font: 13px/1.3 var(--sans); }
`

const useCss = () => useStyle('tico8-editor-tileset-view', CSS)

/** Screen pixels per tileset pixel: 2 to 8, so it fits about 200px wide. */
export function tilesetScale(tileset: Tileset): number {
  const width = tileset.columns * TILE
  return Math.max(2, Math.min(8, Math.floor(TILESET_TARGET / width)))
}

/** How many rows of tiles the tileset has. */
function rowsOf(tileset: Tileset): number {
  return Math.ceil(tileset.frames / tileset.columns)
}

/** The block between two tiles, corners included. */
export function rectBetween(a: Vec, b: Vec): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.abs(a.x - b.x) + 1,
    height: Math.abs(a.y - b.y) + 1,
  }
}

/** The frames in `rect` of the tileset, row by row, skipping any past its end. */
export function framesIn(tileset: Tileset, rect: Rect): number[] {
  const frames: number[] = []
  for (let y = rect.y; y < rect.y + rect.height; y++)
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const frame = y * tileset.columns + x
      if (x >= 0 && x < tileset.columns && frame >= 0 && frame < tileset.frames)
        frames.push(frame)
    }
  return frames
}

/** A drag in the tileset, in tiles. */
interface Drag {
  from: Vec
  to: Vec
}

/** Paint the tileset's RGBA at `scale`; alpha under 128 shows the checker. */
function paintTiles(
  ctx: CanvasRenderingContext2D,
  tileset: Tileset,
  scale: number,
) {
  const { data, width, height } = tileset.pixels
  paintChecker(ctx, width * scale, height * scale)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if ((data[i + 3] ?? 0) < 128) continue
      ctx.fillStyle = `rgb(${data[i]} ${data[i + 1]} ${data[i + 2]})`
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
}

/** A tile-sized outline around `rect`, in tiles. */
function outline(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  scale: number,
  color: string,
) {
  const s = TILE * scale
  ctx.lineWidth = 2
  ctx.strokeStyle = color
  ctx.strokeRect(
    rect.x * s + 1,
    rect.y * s + 1,
    rect.width * s - 2,
    rect.height * s - 2,
  )
}

/**
 * The open map's tileset: click picks a tile, drag picks a block; with
 * Arrange on, a drag from one tile onto another swaps them.
 */
export function TilesetView({ editor, state }: MapEditorProps) {
  useCss()
  const ref = useRef<HTMLCanvasElement>(null)
  const [drag, setDrag] = useState<Drag | undefined>(undefined)
  const { tileset, shownFlag, chosen, arrange } = state

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx || !tileset) return
    const scale = tilesetScale(tileset)
    const { width, height } = tileset.pixels
    paintTiles(ctx, tileset, scale)
    const shown = shownFlag === undefined ? undefined : tileset.flags[shownFlag]
    if (shown) {
      ctx.fillStyle = TINT
      const s = TILE * scale
      for (const frame of shown) {
        if (frame >= tileset.frames) continue
        const x = frame % tileset.columns
        const y = Math.floor(frame / tileset.columns)
        ctx.fillRect(x * s, y * s, s, s)
      }
    }
    paintGrid(
      ctx,
      { width, height },
      scale,
      { x: TILE, y: TILE },
      { x: 0, y: 0 },
      GRID.cell,
    )
    if (arrange && drag) {
      outline(ctx, { ...drag.from, width: 1, height: 1 }, scale, INK.active)
      outline(ctx, { ...drag.to, width: 1, height: 1 }, scale, INK.bright)
    } else outline(ctx, chosen, scale, INK.active)
  })

  if (!tileset) return null

  const scale = tilesetScale(tileset)
  const { width, height } = tileset.pixels
  const rows = rowsOf(tileset)
  const tileAt = (e: PointerEvent): Vec => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const s = TILE * scale
    const clamp = (v: number, count: number) =>
      Math.max(0, Math.min(count - 1, v))
    return {
      x: clamp(Math.floor((e.clientX - box.left) / s), tileset.columns),
      y: clamp(Math.floor((e.clientY - box.top) / s), rows),
    }
  }
  const frameOf = (tile: Vec) => tile.y * tileset.columns + tile.x
  const same = (a: Vec, b: Vec) => a.x === b.x && a.y === b.y

  return (
    <div class="t8e-tileset">
      <div class="t8e-tileset-head">
        <span>tiles</span>
        <button
          type="button"
          title="Arrange: drag a tile onto another to swap them"
          aria-pressed={arrange ? 'true' : 'false'}
          onClick={() => editor.setArrange(!arrange)}
        >
          <Icon name="swap" />
          <span>arrange</span>
        </button>
      </div>
      <canvas
        ref={ref}
        width={width * scale}
        height={height * scale}
        style={{ width: `${width * scale}px`, height: `${height * scale}px` }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          const at = tileAt(e)
          if (frameOf(at) >= tileset.frames) return
          const canvas = e.currentTarget as HTMLCanvasElement
          canvas.setPointerCapture?.(e.pointerId)
          setDrag({ from: at, to: at })
          if (!arrange) editor.chooseTiles(rectBetween(at, at))
        }}
        onPointerMove={(e) => {
          const at = tileAt(e)
          const frame = frameOf(at)
          ;(e.currentTarget as HTMLCanvasElement).title =
            frame < tileset.frames ? `frame ${frame}` : ''
          if (!drag || same(drag.to, at)) return
          setDrag({ from: drag.from, to: at })
          if (!arrange) editor.chooseTiles(rectBetween(drag.from, at))
        }}
        onPointerUp={(e) => {
          if (!drag) return
          setDrag(undefined)
          const at = tileAt(e)
          if (arrange) {
            const a = frameOf(drag.from)
            const b = frameOf(at)
            if (a !== b && b < tileset.frames) void editor.swapTiles(a, b)
          } else if (!same(drag.to, at))
            editor.chooseTiles(rectBetween(drag.from, at))
        }}
        onPointerCancel={() => setDrag(undefined)}
      />
    </div>
  )
}

/** What the flags panel's header says of the chosen tiles. */
export function chosenLabel(tileset: Tileset, chosen: Rect): string {
  const frames = framesIn(tileset, chosen)
  const first = frames[0]
  const last = frames[frames.length - 1]
  if (first === undefined || last === undefined) return 'no tiles'
  if (frames.length === 1) return `tile ${first}`
  if (chosen.height === 1) return `tiles ${first}–${last}`
  return `${frames.length} tiles`
}

/** A name being edited inline, and why the last try was refused. */
interface Renaming {
  flag: string
  text: string
  reason?: string
}

/** The chosen tiles' flags: a checkbox and a show toggle per flag; add, rename, remove. */
export function FlagsPanel({ editor, state }: MapEditorProps) {
  useCss()
  const [renaming, setRenaming] = useState<Renaming | undefined>(undefined)
  const [name, setName] = useState('')
  const [refused, setRefused] = useState<string | undefined>(undefined)
  const { tileset } = state
  if (!tileset) return null

  const frames = framesIn(tileset, state.chosen)
  const commitRename = () => {
    if (!renaming) return
    const to = renaming.text.trim()
    if (to === renaming.flag) return setRenaming(undefined)
    const reason = editor.renameFlag(renaming.flag, to)
    if (reason) setRenaming({ ...renaming, reason })
    else setRenaming(undefined)
  }

  return (
    <div class="t8e-flags">
      <span class="t8e-flags-head">
        flags of {chosenLabel(tileset, state.chosen)}
      </span>
      <ul>
        {Object.keys(tileset.flags).map((flag) => {
          const set = tileset.flags[flag]
          const count = frames.filter((f) => set?.has(f)).length
          const all = frames.length > 0 && count === frames.length
          const mixed = count > 0 && !all
          const shown = state.shownFlag === flag
          const editing = renaming?.flag === flag ? renaming : undefined
          return (
            <li key={flag} data-flag={flag}>
              <input
                type="checkbox"
                aria-label={flag}
                checked={all}
                indeterminate={mixed}
                disabled={frames.length === 0}
                onClick={(e) => {
                  e.preventDefault()
                  editor.setFlag(flag, !all)
                }}
              />
              {editing ? (
                <input
                  type="text"
                  aria-label={`Rename ${flag}`}
                  value={editing.text}
                  spellcheck={false}
                  autocomplete="off"
                  ref={(el) => el?.focus()}
                  onInput={(e) =>
                    setRenaming({ flag, text: e.currentTarget.value })
                  }
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') commitRename()
                    else if (e.key === 'Escape') setRenaming(undefined)
                  }}
                />
              ) : (
                <button
                  type="button"
                  class="t8e-flag-name"
                  title="Double-click to rename"
                  onDblClick={() => setRenaming({ flag, text: flag })}
                >
                  {flag}
                </button>
              )}
              <button
                type="button"
                class="t8e-flag-show"
                title={shown ? `Stop showing ${flag}` : `Show ${flag}`}
                aria-label={`Show ${flag}`}
                aria-pressed={shown ? 'true' : 'false'}
                onClick={() => editor.showFlag(shown ? undefined : flag)}
              >
                <Icon name={shown ? 'eye' : 'hidden'} />
              </button>
              <button
                type="button"
                class="t8e-flag-remove"
                title={`Remove ${flag}`}
                aria-label={`Remove ${flag}`}
                onClick={() => editor.removeFlag(flag)}
              >
                <Icon name="close" />
              </button>
            </li>
          )
        })}
      </ul>
      {renaming?.reason && <span class="t8e-error">{renaming.reason}</span>}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const trimmed = name.trim()
          if (!trimmed) return
          const reason = editor.addFlag(trimmed)
          setRefused(reason)
          if (!reason) setName('')
        }}
      >
        <input
          type="text"
          aria-label="New flag"
          placeholder="new flag"
          spellcheck={false}
          autocomplete="off"
          value={name}
          onInput={(e) => {
            setName(e.currentTarget.value)
            setRefused(undefined)
          }}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button type="submit" title="Add flag" aria-label="Add flag">
          <Icon name="plus" />
        </button>
      </form>
      {refused && <span class="t8e-error">{refused}</span>}
    </div>
  )
}
