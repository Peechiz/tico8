import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** What `writeProject` needs to make a project folder. */
export interface CreateOptions {
  /** The folder to write into. Created when missing. */
  dir: string
  /** The project's `package.json` name. */
  name: string
  /** The `tico8` dependency spec written into the project: `^0.0.0`. */
  tico8: string
}

/** The folder holding `package.json`, `template/` and `src/` or `dist/`. */
const PACKAGE_DIR = dirname(dirname(fileURLToPath(import.meta.url)))

/** The starter project, shipped beside `src/` and `dist/`. */
export const TEMPLATE_DIR = join(PACKAGE_DIR, 'template')

/** Whether npm would accept `name` for a new package. */
function isValidName(name: string): boolean {
  if (name.length === 0 || name.length > 214) return false
  const part = /^[a-z0-9~-][a-z0-9._~-]*$/
  const scoped = /^@([^/]+)\/([^/]+)$/.exec(name)
  if (scoped) return part.test(scoped[1] ?? '') && part.test(scoped[2] ?? '')
  return part.test(name)
}

/**
 * Copy the starter into `dir`, renaming `_gitignore` to `.gitignore` and
 * setting the project's name and tico8 dependency. Throws for a name npm
 * would not accept.
 */
export function writeProject(options: CreateOptions): void {
  writeProjectFrom(TEMPLATE_DIR, options)
}

/** `writeProject` from another template folder, for tests. */
export function writeProjectFrom(
  template: string,
  { dir, name, tico8 }: CreateOptions,
): void {
  if (!isValidName(name)) throw new Error(`"${name}" is not a valid npm name`)
  mkdirSync(dir, { recursive: true })
  cpSync(template, dir, { recursive: true })

  const ignore = join(dir, '_gitignore')
  if (existsSync(ignore)) renameSync(ignore, join(dir, '.gitignore'))

  const file = join(dir, 'package.json')
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  pkg.name = name
  pkg.dependencies = { ...pkg.dependencies, tico8 }
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
}

/** True for a missing folder or one holding nothing but `.git`. */
export function isEmptyDir(dir: string): boolean {
  if (!existsSync(dir)) return true
  return readdirSync(dir).every((entry) => entry === '.git')
}

/** `^` create-tico8's own version, which tico8 shares. */
export function defaultTico8Spec(): string {
  const pkg = JSON.parse(
    readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8'),
  )
  return `^${pkg.version}`
}
