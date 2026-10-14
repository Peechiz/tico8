import { describe, expect, it, vi } from 'vitest'
import { TRANSPARENT } from '../sprites.ts'
import { toRgba } from './image.ts'
import { createEditor, keyName, sheetFile } from './state.ts'
import type { Editor, FileHost, Pixels, Rgb, SheetInfo } from './types.ts'

const palette: Rgb[] = [
  [0, 0, 0],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
]
const RED = 1
const GREEN = 2

function info(file: string, name: string, cell = 8): SheetInfo {
  return {
    file,
    name,
    url: `/sprites/${file}`,
    cellWidth: cell,
    cellHeight: cell,
  }
}

function blank(width: number, height: number): Pixels {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) }
}

/** A FileHost in memory. `read` gives what `files` holds; writes are logged. */
function memoryHost(sheets: SheetInfo[], files: Record<string, Pixels>) {
  const changes = new Set<(file: string) => void>()
  const lists = new Set<(sheets: SheetInfo[]) => void>()
  const writes: { file: string; bytes: Uint8Array }[] = []
  let refuse: string | undefined
  const host: FileHost = {
    list: async () => sheets,
    read: async (file) => {
      const pixels = files[file]
      if (!pixels) throw new Error(`no ${file}`)
      return pixels
    },
    write: async (file, bytes) => {
      if (refuse) throw new Error(refuse)
      writes.push({ file, bytes })
    },
    onChange(listener) {
      changes.add(listener)
      return () => changes.delete(listener)
    },
    onList(listener) {
      lists.add(listener)
      return () => lists.delete(listener)
    },
  }
  return {
    host,
    files,
    writes,
    refuseWith(reason: string) {
      refuse = reason
    },
    change(file: string) {
      for (const listener of changes) listener(file)
    },
    list(next: SheetInfo[]) {
      for (const listener of lists) listener(next)
    },
  }
}

/** Long enough for any queued write to finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 30))

async function setup() {
  const fake = memoryHost([info('a.png', 'a'), info('b.16.png', 'b', 16)], {
    'a.png': blank(16, 16),
    'b.16.png': blank(16, 16),
  })
  const editor = createEditor({ host: fake.host, palette })
  await vi.waitFor(() => expect(editor.get().doc?.info.file).toBe('a.png'))
  editor.setColor(RED)
  return { ...fake, editor }
}

function at(editor: Editor, x: number, y: number): number {
  const image = editor.get().doc!.image
  return image.pixels[y * image.width + x]!
}

describe('keyName', () => {
  it('spells keys as SHORTCUTS does', () => {
    const plain = { ctrlKey: false, metaKey: false, shiftKey: false }
    expect(keyName({ ...plain, key: 'p' })).toBe('p')
    expect(keyName({ ...plain, key: 'Delete' })).toBe('delete')
    expect(keyName({ ...plain, key: 'Z', shiftKey: true })).toBe('shift+z')
    expect(keyName({ ...plain, key: 'z', metaKey: true })).toBe('mod+z')
    expect(keyName({ ...plain, key: 'Z', ctrlKey: true, shiftKey: true })).toBe(
      'mod+shift+z',
    )
  })
})

describe('sheetFile', () => {
  it('names files by cell size', () => {
    expect(sheetFile({ name: 'wall', cellWidth: 8, cellHeight: 8 })).toBe(
      'wall.png',
    )
    expect(sheetFile({ name: 'hero', cellWidth: 16, cellHeight: 16 })).toBe(
      'hero.16.png',
    )
    expect(sheetFile({ name: 'tall', cellWidth: 16, cellHeight: 24 })).toBe(
      'tall.16x24.png',
    )
  })
})

describe('createEditor', () => {
  it('lists the sheets and opens the first with sensible defaults', async () => {
    const { editor } = await setup()
    const state = editor.get()
    expect(state.sheets.map((s) => s.name)).toEqual(['a', 'b'])
    expect(state.tool).toBe('pencil')
    expect(state.zoom).toBe(1)
    expect(state.cell).toEqual({ x: 0, y: 0 })
    expect(state.doc!.image.width).toBe(16)
  })

  it('writes a stroke once, when it ends', async () => {
    const { editor, writes } = await setup()
    const version = editor.get().version
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerMove({ x: 3, y: 0 })
    editor.pointerMove({ x: 7, y: 0 })
    await settle()
    expect(writes).toHaveLength(0)
    editor.pointerUp({ x: 7, y: 0 })
    await vi.waitFor(() => expect(writes).toHaveLength(1))
    await settle()
    expect(writes).toHaveLength(1)
    expect(writes[0]!.file).toBe('a.png')
    for (let x = 0; x < 8; x++) expect(at(editor, x, 0)).toBe(RED)
    expect(editor.get().version).toBeGreaterThan(version)
    expect(editor.get().canUndo).toBe(true)
  })

  it('ignores moves with no button down and clips to the painting area', async () => {
    const { editor } = await setup()
    editor.pointerMove({ x: 1, y: 1 })
    expect(at(editor, 1, 1)).toBe(TRANSPARENT)
    editor.pointerDown({ x: 6, y: 2 })
    editor.pointerUp({ x: 12, y: 2 })
    expect(at(editor, 7, 2)).toBe(RED)
    expect(at(editor, 8, 2)).toBe(TRANSPARENT)
  })

  it('undo writes the old pixels and redo the new', async () => {
    const { editor, writes } = await setup()
    editor.pointerDown({ x: 1, y: 1 })
    editor.pointerUp({ x: 1, y: 1 })
    await settle()
    expect(editor.key('mod+z')).toBe(true)
    expect(at(editor, 1, 1)).toBe(TRANSPARENT)
    await settle()
    expect(writes).toHaveLength(2)
    editor.act('redo')
    expect(at(editor, 1, 1)).toBe(RED)
    await settle()
    expect(writes).toHaveLength(3)
  })

  it('ignores the echo of its own write', async () => {
    const { editor, files, change } = await setup()
    editor.pointerDown({ x: 1, y: 1 })
    editor.pointerUp({ x: 1, y: 1 })
    await settle()
    files['a.png'] = toRgba(editor.get().doc!)
    const before = editor.get()
    change('a.png')
    await settle()
    expect(editor.get()).toBe(before)
  })

  it('takes in an outside change as an undoable step', async () => {
    const { editor, files, change } = await setup()
    const outside = blank(16, 16)
    // A green pixel, and one in a colour off the palette.
    outside.data.set([0, 255, 0, 255], 0)
    outside.data.set([10, 20, 30, 255], 4)
    files['a.png'] = outside
    change('a.png')
    await vi.waitFor(() => expect(at(editor, 0, 0)).toBe(GREEN))
    expect(at(editor, 1, 0)).toBe(palette.length)
    expect(editor.get().doc!.colors).toHaveLength(palette.length + 1)
    editor.act('undo')
    expect(at(editor, 0, 0)).toBe(TRANSPARENT)
    // The colours never shrink.
    expect(editor.get().doc!.colors).toHaveLength(palette.length + 1)
  })

  it('takes in a file put back to content it held before', async () => {
    const { editor, files, change, writes } = await setup()
    const before = blank(16, 16)
    // The editor writes a stroke and hears its echo.
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerUp({ x: 0, y: 0 })
    await vi.waitFor(() => expect(writes).toHaveLength(1))
    files['a.png'] = toRgba(editor.get().doc!)
    change('a.png')
    await settle()
    // Another tool puts the file back as it was before the stroke, then
    // repaints the stroke, then puts it back again.
    const stroke = files['a.png']
    for (const [pixels, shown] of [
      [before, TRANSPARENT],
      [stroke, RED],
      [before, TRANSPARENT],
    ] as const) {
      files['a.png'] = pixels
      change('a.png')
      await settle()
      expect(at(editor, 0, 0)).toBe(shown)
    }
    // Painting the same pixel again is written, since the file changed.
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerUp({ x: 0, y: 0 })
    await vi.waitFor(() => expect(writes).toHaveLength(2))
  })

  it('closes the open sheet when its file goes', async () => {
    const { editor, list } = await setup()
    list([info('b.16.png', 'b', 16)])
    expect(editor.get().doc).toBeUndefined()
    expect(editor.get().sheets).toHaveLength(1)
  })

  it('pastes, moves and drops a selection', async () => {
    const { editor, writes } = await setup()
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerUp({ x: 1, y: 0 })
    editor.setTool('select')
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerMove({ x: 1, y: 0 })
    editor.pointerUp({ x: 1, y: 0 })
    expect(editor.get().selection?.rect).toEqual({
      x: 0,
      y: 0,
      width: 2,
      height: 1,
    })
    editor.act('copy')
    editor.act('deselect')
    editor.act('paste')
    expect(editor.get().tool).toBe('select')
    expect(editor.get().selection?.lifted).toBeDefined()
    // Drag the pasted pixels down to row 10, outside the painting area.
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerMove({ x: 4, y: 10 })
    editor.pointerUp({ x: 4, y: 10 })
    editor.act('deselect')
    expect(editor.get().selection).toBeUndefined()
    expect(at(editor, 4, 10)).toBe(RED)
    expect(at(editor, 5, 10)).toBe(RED)
    expect(at(editor, 0, 0)).toBe(RED)
    await settle()
    const count = writes.length
    editor.act('undo')
    expect(at(editor, 4, 10)).toBe(TRANSPARENT)
    expect(at(editor, 0, 0)).toBe(RED)
    await settle()
    expect(writes.length).toBe(count + 1)
  })

  it('flips the painting area with no selection, and refuses to rotate a non-square one', async () => {
    const { editor } = await setup()
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerUp({ x: 0, y: 0 })
    editor.act('flipX')
    expect(at(editor, 7, 0)).toBe(RED)
    expect(at(editor, 0, 0)).toBe(TRANSPARENT)
    editor.setTool('select')
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerUp({ x: 2, y: 0 })
    editor.act('rotate')
    expect(editor.get().error).toMatch(/square/)
  })

  it('refuses a new sheet whose name is taken, and passes on the host refusal', async () => {
    const { editor, refuseWith } = await setup()
    const sheet = {
      name: 'a',
      cellWidth: 8,
      cellHeight: 8,
      columns: 1,
      rows: 1,
    }
    expect(await editor.newSheet(sheet)).toMatch(/already exists/)
    refuseWith('a bad name')
    expect(await editor.newSheet({ ...sheet, name: 'c' })).toBe('a bad name')
  })

  it('makes and opens a new sheet, then resizes it as one step', async () => {
    const { editor, writes } = await setup()
    const reason = await editor.newSheet({
      name: 'hero',
      cellWidth: 16,
      cellHeight: 16,
      columns: 2,
      rows: 1,
    })
    expect(reason).toBeUndefined()
    expect(writes.at(-1)!.file).toBe('hero.16.png')
    expect(editor.get().doc!.info.file).toBe('hero.16.png')
    await editor.resize({ columns: 1, rows: 2 })
    expect(editor.get().doc!.image.width).toBe(16)
    expect(editor.get().doc!.image.height).toBe(32)
    editor.act('undo')
    expect(editor.get().doc!.image.width).toBe(32)
  })

  it('reports a failed write', async () => {
    const { editor, refuseWith } = await setup()
    refuseWith('disk full')
    editor.pointerDown({ x: 0, y: 0 })
    editor.pointerUp({ x: 0, y: 0 })
    await vi.waitFor(() => expect(editor.get().error).toMatch(/disk full/))
  })

  it('keeps the painting area inside the sheet', async () => {
    const { editor } = await setup()
    editor.setZoom(2)
    editor.pickCell({ x: 1, y: 1 })
    expect(editor.get().cell).toEqual({ x: 0, y: 0 })
    editor.setZoom(1)
    editor.pickCell({ x: 5, y: 1 })
    expect(editor.get().cell).toEqual({ x: 1, y: 1 })
  })
})
