import type { SaveData, SaveValue } from './types.ts'

const TAKEN = ['write', 'clear']

/**
 * Check a config's `save` setting. Undefined gives an empty save. Throws
 * an `Error` naming the field, by its path, that holds something a save
 * cannot.
 */
export function readSave(written: unknown): SaveData {
  if (written === undefined) return {}
  if (!isPlain(written)) {
    throw new Error(
      `save must be an object of fields, such as { best: 0 }, got ${show(written)}`,
    )
  }
  for (const name of Object.keys(written)) {
    if (TAKEN.includes(name)) {
      throw new Error(
        `a save cannot have a field called "${name}": save.${name} is already taken`,
      )
    }
  }
  checkValue(written, 'save', [])
  return written as SaveData
}

function isPlain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Throw unless the value is plain data, naming the path it sits at. */
function checkValue(
  value: unknown,
  path: string,
  parents: readonly object[],
): asserts value is SaveValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return
    throw refuse(path, String(value), 'a save holds only finite numbers')
  }
  if (typeof value === 'object') {
    if (parents.includes(value)) {
      throw refuse(path, 'itself', 'a save cannot hold a loop')
    }
    const inside = [...parents, value]
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        checkValue(item, `${path}[${index}]`, inside)
      })
      return
    }
    if (isPlain(value)) {
      for (const [name, field] of Object.entries(value)) {
        checkValue(field, `${path}.${name}`, inside)
      }
      return
    }
    const name = (value as object).constructor?.name
    const what = name ? `a ${name} instance` : 'a class instance'
    throw refuse(path, what, 'a save holds only plain objects')
  }
  throw refuse(path, show(value), 'a save holds only plain data')
}

function refuse(path: string, held: string, why: string): Error {
  return new Error(`${path} holds ${held}: ${why}`)
}

function show(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`
  if (typeof value === 'function') return 'a function'
  if (typeof value === 'symbol') return `a symbol, ${String(value)}`
  if (typeof value === 'bigint') return `a bigint, ${value}n`
  if (Array.isArray(value)) return 'an array'
  if (typeof value === 'object' && value !== null) {
    const name = value.constructor?.name
    return name ? `a ${name} instance` : 'a class instance'
  }
  return String(value)
}
