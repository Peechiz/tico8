import { defineConfig } from 'tico8/config'

// The save's defaults are written here, and its type comes from them:
// `save.best` is a number, and `save.best = 1` or an unknown field is an error.
const config = defineConfig({ save: { best: 0 } })
export default config

// The game imports this.
export const { save } = config
