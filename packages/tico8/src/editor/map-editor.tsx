import { useEffect, useRef, useState } from 'preact/hooks'
import { MapCanvas } from './map-canvas.tsx'
import {
  LayerList,
  MapShortcutSheet,
  MapStatusLine,
  MapToolRail,
} from './map-panels.tsx'
import { MapTabs } from './map-tabs.tsx'
import type { MapEditor, MapHover } from './map-types.ts'
import { keyName } from './state.ts'
import { useStyle } from './theme.ts'
import { FlagsPanel, TilesetView } from './tileset-view.tsx'

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
.t8e-map-box { height: 100%; container-type: inline-size; }
.t8e-map { height: 100%; display: grid; background: var(--k1);
  grid-template:
    "tabs tabs tabs" auto
    "rail map side" minmax(0, 1fr)
    "status status status" auto / 52px minmax(0, 1fr) 260px; }
.t8e-map > .tabs { grid-area: tabs; min-width: 0; }
.t8e-map > .rail { grid-area: rail; background: var(--k0); }
.t8e-map > .map { grid-area: map; display: flex; min-width: 0; min-height: 0; }
.t8e-map > .side { grid-area: side; background: var(--k0); padding: 12px;
  display: flex; flex-direction: column; gap: 14px; overflow: auto; }
.t8e-map > .status { grid-area: status; }
.t8e-map .t8e-empty { margin: auto; color: var(--k13); font-size: 18px; }
@container (max-width: 760px) {
  .t8e-map { grid-template:
      "tabs tabs" auto
      "rail map" minmax(0, 1fr)
      "rail side" auto
      "status status" auto / 52px minmax(0, 1fr); }
  .t8e-map > .side { flex-direction: row; flex-wrap: wrap; align-items: flex-start; }
}
`

/** The Map tab: map tabs, tools, the map, tileset, flags, layers and status. */
export function MapEditorTab({
  editor,
  screen,
}: {
  editor: MapEditor
  screen: { width: number; height: number }
}) {
  useStyle('tico8-map-editor', CSS)
  const [state, setState] = useState(editor.get())
  const [hover, setHover] = useState<MapHover | undefined>()
  const [help, setHelp] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setState(editor.get())
    return editor.subscribe(() => setState(editor.get()))
  }, [editor])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Every editor tab stays mounted, hidden while another shows.
      if (root.current?.closest('[hidden]')) return
      if (typing(event.target)) return
      if (event.key === '?') {
        event.preventDefault()
        setHelp((open) => !open)
        return
      }
      if (help) return
      if (editor.key(keyName(event))) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor, help])

  const props = { editor, state }
  const start = {
    columns: Math.ceil(screen.width / 8),
    rows: Math.ceil(screen.height / 8),
  }
  return (
    <div class="t8e t8e-map-box" ref={root}>
      <div class="t8e-map">
        <div class="tabs">
          <MapTabs {...props} start={start} />
        </div>
        <div class="rail">
          <MapToolRail {...props} />
        </div>
        <div class="map">
          {state.doc ? (
            <MapCanvas {...props} screen={screen} onHover={setHover} />
          ) : (
            <p class="t8e-empty">Make a map with + to start</p>
          )}
        </div>
        <div class="side">
          <TilesetView {...props} />
          <FlagsPanel {...props} />
          <LayerList {...props} />
        </div>
        <div class="status">
          <MapStatusLine
            {...props}
            hover={hover}
            onHelp={() => setHelp(true)}
          />
        </div>
      </div>
      {help && <MapShortcutSheet onClose={() => setHelp(false)} />}
    </div>
  )
}
