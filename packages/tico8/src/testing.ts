import type { Screen } from './screen.ts'

/**
 * The screen as text: one hex digit (0-f) per pixel, one line per row.
 * Compare against `picture` in tests.
 */
export function toPicture(screen: Screen): string {
  const rows: string[] = []
  for (let y = 0; y < screen.height; y++) {
    let row = ''
    for (let x = 0; x < screen.width; x++) {
      row += screen.pixels[y * screen.width + x]!.toString(16)
    }
    rows.push(row)
  }
  return rows.join('\n')
}

/**
 * Tidy a hand-written picture so it compares equal to `toPicture`: drops
 * the indentation and the blank first and last lines of a template literal.
 * `.` may be written for colour 0.
 */
export function picture(text: string): string {
  const lines = text.split('\n').map((line) => line.trim().replaceAll('.', '0'))
  if (lines.length > 0 && lines[0] === '') lines.shift()
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}
