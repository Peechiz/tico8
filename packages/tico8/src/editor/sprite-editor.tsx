import { useEffect, useState } from 'preact/hooks'
import { Canvas } from './canvas.tsx'
import {
  PalettePanel,
  ShortcutSheet,
  StatusLine,
  ToolRail,
  ZoomPicker,
} from './panels.tsx'
import { FrameStrip, SheetView } from './sheet-view.tsx'
import { SheetTabs } from './sheets.tsx'
import { keyName } from './state.ts'
import { useStyle } from './theme.ts'
import type { Editor, Hover } from './types.ts'

/** Whether a key went to a text field, where shortcuts must not fire. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

const CSS = `
.t8e-sprites-box { height: 100%; container-type: inline-size; }
.t8e-sprites { height: 100%; display: grid; background: var(--k1);
  grid-template:
    "tabs tabs tabs" auto
    "rail paint side" minmax(0, 1fr)
    "frames frames frames" auto
    "status status status" auto / 52px minmax(0, 1fr) 232px; }
.t8e-sprites > .tabs { grid-area: tabs; min-width: 0; }
.t8e-sprites > .rail { grid-area: rail; background: var(--k0); }
.t8e-sprites > .paint { grid-area: paint; display: flex; min-width: 0; min-height: 0; }
.t8e-sprites > .side { grid-area: side; background: var(--k0); padding: 12px;
  display: flex; flex-direction: column; gap: 14px; overflow: auto; }
.t8e-sprites > .frames { grid-area: frames; min-width: 0; }
.t8e-sprites > .status { grid-area: status; }
.t8e-sprites .t8e-empty { margin: auto; color: var(--k13); font-size: 18px; }
@container (max-width: 760px) {
  .t8e-sprites { grid-template:
      "tabs tabs" auto
      "rail paint" minmax(0, 1fr)
      "rail side" auto
      "frames frames" auto
      "status status" auto / 52px minmax(0, 1fr); }
  .t8e-sprites > .side { flex-direction: row; flex-wrap: wrap; align-items: flex-start; }
}
`

/** The Sprites tab: sheet tabs, tools, the canvas, colours and the sheet. */
export function SpriteEditor({ editor }: { editor: Editor }) {
  useStyle('tico8-sprite-editor', CSS)
  const [state, setState] = useState(editor.get())
  const [hover, setHover] = useState<Hover | undefined>()
  const [help, setHelp] = useState(false)

  useEffect(() => {
    setState(editor.get())
    return editor.subscribe(() => setState(editor.get()))
  }, [editor])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (typing(event.target)) return
      if (event.key === '?') {
        event.preventDefault()
        setHelp((open) => !open)
        return
      }
      // The shortcut sheet is a dialog: keys behind it do nothing.
      if (help) return
      if (editor.key(keyName(event))) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor, help])

  const props = { editor, state }
  return (
    <div class="t8e t8e-sprites-box">
      <div class="t8e-sprites">
        <div class="tabs">
          <SheetTabs {...props} />
        </div>
        <div class="rail">
          <ToolRail {...props} />
        </div>
        <div class="paint">
          {state.doc ? (
            <Canvas {...props} onHover={setHover} />
          ) : (
            <p class="t8e-empty">Make a sheet with + to start painting</p>
          )}
        </div>
        <div class="side">
          <PalettePanel {...props} />
          <div>
            <SheetView {...props} />
            <ZoomPicker {...props} />
          </div>
        </div>
        <div class="frames">
          <FrameStrip {...props} />
        </div>
        <div class="status">
          <StatusLine {...props} hover={hover} onHelp={() => setHelp(true)} />
        </div>
      </div>
      {help && <ShortcutSheet onClose={() => setHelp(false)} />}
    </div>
  )
}
