import { useEffect, useState } from 'preact/hooks'
import { Canvas } from './canvas.tsx'
import { PalettePanel, SheetPicker, Toolbar } from './panels.tsx'
import { SheetView } from './sheet-view.tsx'
import { keyName } from './state.ts'
import type { Editor } from './types.ts'

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

/** The Sprites tab: the sheets, the tools and colours around the canvas. */
export function SpriteEditor({ editor }: { editor: Editor }) {
  const [state, setState] = useState(editor.get())

  useEffect(() => {
    setState(editor.get())
    return editor.subscribe(() => setState(editor.get()))
  }, [editor])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (typing(event.target)) return
      if (editor.key(keyName(event))) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor])

  const props = { editor, state }
  return (
    <div style={layout}>
      <div style={side}>
        <SheetPicker {...props} />
      </div>
      <div style={middle}>
        <Toolbar {...props} />
        <div style={paint}>
          <Canvas {...props} />
        </div>
      </div>
      <div style={side}>
        <PalettePanel {...props} />
        <SheetView {...props} />
      </div>
    </div>
  )
}

const layout = {
  display: 'flex',
  width: '100%',
  height: '100%',
  gap: '8px',
  padding: '8px',
  boxSizing: 'border-box',
  overflow: 'hidden',
} as const

const side = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  width: '220px',
  flexShrink: 0,
  overflow: 'auto',
} as const

const middle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  flex: '1',
  minWidth: 0,
} as const

const paint = { flex: '1', minHeight: 0, display: 'flex' } as const
