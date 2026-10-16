import { useEffect, useRef, useState } from 'preact/hooks'
import { useStyle } from './theme.ts'
import type { ShellProps } from './types.ts'

const KEY = 'tico8:shell'
const GAME = 'Game'

interface Choice {
  tab: string
  split: boolean
  /** The game's share of the width while split, in percent. */
  width: number
}

function load(): Choice {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (raw && typeof raw === 'object') {
      const { tab, split, width } = raw as Partial<Choice>
      return {
        tab: typeof tab === 'string' ? tab : GAME,
        split: split === true,
        width: typeof width === 'number' ? clamp(width) : 40,
      }
    }
  } catch {
    // Storage may be missing or throw; start with the defaults.
  }
  return { tab: GAME, split: false, width: 40 }
}

function save(choice: Choice) {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice))
  } catch {
    // Remembering is a convenience only.
  }
}

const MIN = 20
const MAX = 80
const STEP = 5
const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n)))

const CSS = `
.tico8-shell { position: fixed; inset: 0; display: flex; flex-direction: column;
  background: var(--k0); }
.tico8-shell-bar { display: flex; gap: 2px; height: 32px; flex: none;
  background: var(--k0); }
.tico8-shell-bar button { padding: 0 14px; color: var(--k13); }
.tico8-shell-bar button:hover { color: var(--k7); }
.tico8-shell-bar button[aria-selected=true] { background: var(--k1); color: var(--k7); }
.tico8-shell-bar .tico8-shell-split { margin-left: auto; }
.tico8-shell-bar .tico8-shell-split[aria-pressed=true] { background: var(--k10); color: var(--k0); }
.tico8-shell-main { position: relative; flex: 1; display: flex; min-height: 0; }
.tico8-shell-game { flex: 1; min-width: 0; border: 0; background: var(--k0); }
.tico8-shell-editors { flex: 1; min-width: 0; overflow: auto; background: var(--k1); }
.tico8-shell-editor { height: 100%; }
.tico8-shell-game[hidden], .tico8-shell-editors[hidden], .tico8-shell-editor[hidden] { display: none; }
.tico8-shell-divider { flex: none; width: 6px; background: var(--k0); cursor: col-resize;
  touch-action: none; }
.tico8-shell-divider:hover, .tico8-shell-divider.dragging { box-shadow: inset 0 0 0 1px var(--k13);
  background: var(--k13); }
.tico8-shell-cover { position: absolute; inset: 0; }
`

/** Game and editor tabs, with a toggle to show the game beside an editor. */
export function Shell({ gameUrl, tabs }: ShellProps) {
  const [choice, setChoice] = useState(load)
  const [dragging, setDragging] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const main = useRef<HTMLDivElement>(null)
  useStyle('tico8-editor-shell', CSS)
  const names = tabs.map((t) => t.name)
  const tab =
    choice.tab === GAME || names.includes(choice.tab) ? choice.tab : GAME
  const onGame = tab === GAME
  const choose = (next: Partial<Choice>) => {
    const merged = { ...choice, tab, ...next }
    save(merged)
    setChoice(merged)
  }

  const dragTo = (clientX: number) => {
    const box = main.current?.getBoundingClientRect()
    if (box && box.width > 0) {
      choose({ width: clamp(((clientX - box.left) / box.width) * 100) })
    }
  }
  const onKey = (e: KeyboardEvent) => {
    const dir = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (dir) {
      e.preventDefault()
      choose({ width: clamp(choice.width + dir * STEP) })
    }
  }

  useEffect(() => {
    if (onGame) {
      frame.current?.focus()
      frame.current?.contentWindow?.focus()
    } else if (document.activeElement === frame.current) {
      // Keys pressed in an editor must not reach the game beside it.
      frame.current?.blur()
      window.focus()
    }
  }, [onGame])

  return (
    <div class="tico8-shell t8e">
      <div class="tico8-shell-bar" role="tablist">
        {[GAME, ...names].map((name) => (
          <button
            type="button"
            role="tab"
            key={name}
            aria-selected={name === tab}
            onClick={() => choose({ tab: name })}
          >
            {name}
          </button>
        ))}
        <button
          type="button"
          class="tico8-shell-split"
          aria-pressed={choice.split}
          onClick={() => choose({ split: !choice.split })}
        >
          Split
        </button>
      </div>
      <div class="tico8-shell-main" ref={main}>
        <iframe
          ref={frame}
          class="tico8-shell-game"
          title="Game"
          src={gameUrl}
          style={
            choice.split && !onGame
              ? { flex: `0 0 ${choice.width}%` }
              : undefined
          }
          hidden={!onGame && !choice.split}
        />
        {choice.split && !onGame && (
          // biome-ignore lint/a11y/useSemanticElements: a focusable, draggable splitter is not an <hr>
          <div
            class={`tico8-shell-divider${dragging ? ' dragging' : ''}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Game width"
            aria-valuemin={MIN}
            aria-valuemax={MAX}
            aria-valuenow={choice.width}
            tabIndex={0}
            onKeyDown={onKey}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId)
              setDragging(true)
            }}
            onPointerMove={(e) => dragging && dragTo(e.clientX)}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
          />
        )}
        <div
          class="tico8-shell-editors"
          hidden={onGame}
          // A canvas that cancels its press keeps the focus where it was,
          // which may be the game beside it: take it back.
          onPointerDownCapture={() => {
            if (document.activeElement !== frame.current) return
            frame.current?.blur()
            window.focus()
          }}
        >
          {tabs.map((t) => (
            <div
              class="tico8-shell-editor"
              key={t.name}
              data-tab={t.name}
              hidden={t.name !== tab}
            >
              {t.content}
            </div>
          ))}
        </div>
        {dragging && <div class="tico8-shell-cover" />}
      </div>
    </div>
  )
}
