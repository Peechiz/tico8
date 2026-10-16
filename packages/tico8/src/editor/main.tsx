// The dev page's module: the tabs, with the game in its frame and the
// editors beside it.
import { render } from 'preact'
import { resolveConfig } from '../config.ts'
import project from '../project.ts'
import { devHost } from './host.ts'
import { MapEditorTab } from './map-editor.tsx'
import { devMapHost } from './map-host.ts'
import { createMapEditor } from './map-state.ts'
import { Shell } from './shell.tsx'
import { SpriteEditor } from './sprite-editor.tsx'
import { createEditor } from './state.ts'

/** The page the game runs in, inside the dev page. */
export const GAME_URL = '/@tico8/game'

const { palette, width, height } = resolveConfig(project)
const host = devHost()
const sprites = createEditor({ host, palette })
const maps = createMapEditor({ host: devMapHost(host) })

render(
  <Shell
    gameUrl={GAME_URL}
    tabs={[
      { name: 'Sprites', content: <SpriteEditor editor={sprites} /> },
      {
        name: 'Map',
        content: <MapEditorTab editor={maps} screen={{ width, height }} />,
      },
    ]}
  />,
  document.body,
)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sprites.destroy()
    maps.destroy()
    render(null, document.body)
  })
}
