import { useEffect, useRef, useState } from 'preact/hooks'
import type { ShellProps } from './types.ts'

const KEY = 'tico8:shell'
const GAME = 'Game'

interface Choice {
  tab: string
  split: boolean
}

function load(): Choice {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (raw && typeof raw === 'object') {
      const { tab, split } = raw as Partial<Choice>
      return {
        tab: typeof tab === 'string' ? tab : GAME,
        split: split === true,
      }
    }
  } catch {
    // Storage may be missing or throw; start with the defaults.
  }
  return { tab: GAME, split: false }
}

function save(choice: Choice) {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice))
  } catch {
    // Remembering is a convenience only.
  }
}

const css = `
.tico8-shell{position:fixed;inset:0;display:flex;flex-direction:column;background:#111;color:#ddd;font:13px system-ui,sans-serif}
.tico8-shell-bar{display:flex;gap:2px;padding:4px 6px;background:#1c1c1c;border-bottom:1px solid #333}
.tico8-shell-bar button{background:none;border:0;border-radius:3px;color:#aaa;padding:3px 10px;font:inherit;cursor:pointer}
.tico8-shell-bar button:hover{background:#2a2a2a}
.tico8-shell-bar button[aria-pressed=true],.tico8-shell-bar button[aria-selected=true]{background:#3a3a3a;color:#fff}
.tico8-shell-bar .tico8-shell-split{margin-left:auto}
.tico8-shell-main{flex:1;display:flex;min-height:0}
.tico8-shell-game{flex:1;min-width:0;border:0;background:#000}
.tico8-shell-main.split .tico8-shell-game{flex:0 0 40%}
.tico8-shell-editors{flex:1;min-width:0;overflow:auto}
.tico8-shell-editor{height:100%}
.tico8-shell-game[hidden],.tico8-shell-editors[hidden],.tico8-shell-editor[hidden]{display:none}
`

/** Game and editor tabs, with a toggle to show the game beside an editor. */
export function Shell({ gameUrl, tabs }: ShellProps) {
  const [choice, setChoice] = useState(load)
  const frame = useRef<HTMLIFrameElement>(null)
  const names = tabs.map((t) => t.name)
  const tab =
    choice.tab === GAME || names.includes(choice.tab) ? choice.tab : GAME
  const onGame = tab === GAME
  const choose = (next: Partial<Choice>) => {
    const merged = { ...choice, tab, ...next }
    save(merged)
    setChoice(merged)
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
    <div class="tico8-shell">
      <style>{css}</style>
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
      <div class={`tico8-shell-main${choice.split ? ' split' : ''}`}>
        <iframe
          ref={frame}
          class="tico8-shell-game"
          title="Game"
          src={gameUrl}
          hidden={!onGame && !choice.split}
        />
        <div class="tico8-shell-editors" hidden={onGame}>
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
      </div>
    </div>
  )
}
