import type { AddFont } from './types.ts'

const added = new WeakSet<Document>()

/**
 * Add the console font to a page as the `tico8` FontFace and start loading
 * it. Once per document; nothing where `FontFace` does not exist.
 */
export const addFont: AddFont = (document) => {
  if (typeof FontFace === 'undefined' || added.has(document)) return
  added.add(document)
  const url = new URL('./tico8.otf', import.meta.url).href
  const face = new FontFace('tico8', `url(${url})`)
  document.fonts.add(face)
  face.load().catch(() => {})
}
