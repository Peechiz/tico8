import type { Config } from './config.ts'

/**
 * The project's config as the engine sees it. On its own this is the empty
 * config, which is the standard console, and that is what tests get. The dev
 * tool serves the project's `tico8.config.ts` in this file's place.
 */
const project: Config = {}

export default project
