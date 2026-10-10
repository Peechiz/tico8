import { parseArgs } from 'node:util'
import { createServer } from 'vite'
import { tico8 } from './vite.ts'

const usage = `Usage: tico8 <command>

Commands:
  dev [--port <number>]   Run the game in this folder, restarting it on save
`

/** Serve the project in the current folder until the process is stopped. */
async function dev(args: string[]) {
  const { values } = parseArgs({
    args,
    options: { port: { type: 'string' } },
  })
  const port = values.port === undefined ? undefined : Number(values.port)
  if (port !== undefined && !Number.isInteger(port)) {
    throw new Error(`--port must be a number, got "${values.port}"`)
  }

  const server = await createServer({
    root: process.cwd(),
    configFile: false,
    plugins: [tico8()],
    server: { port },
  })
  await server.listen()
  server.printUrls()

  process.once('SIGINT', async () => {
    await server.close()
    process.exit(0)
  })
}

const [command, ...args] = process.argv.slice(2)

if (command === 'dev') {
  try {
    await dev(args)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
} else {
  if (command !== undefined) console.error(`Unknown command: ${command}\n`)
  console.error(usage)
  process.exit(1)
}
