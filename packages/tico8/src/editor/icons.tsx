// The editors' icons: 7x7 pixel pictures, drawn as SVG in the text colour.

const PICTURES = {
  pencil: [
    '.....##',
    '....###',
    '...###.',
    '..###..',
    '.###...',
    '#.#....',
    '##.....',
  ],
  eraser: [
    '...###.',
    '..#####',
    '.#.####',
    '#...##.',
    '.#.##..',
    '..##...',
    '.......',
  ],
  fill: [
    '..#....',
    '.#.#...',
    '#...#..',
    '.#...#.',
    '..#.###',
    '...#.##',
    '......#',
  ],
  pick: [
    '.....##',
    '....###',
    '...###.',
    '..#.#..',
    '.#.#...',
    '#.#....',
    '.#.....',
  ],
  line: [
    '......#',
    '.....#.',
    '....#..',
    '...#...',
    '..#....',
    '.#.....',
    '#......',
  ],
  rect: [
    '#######',
    '#.....#',
    '#.....#',
    '#.....#',
    '#.....#',
    '#.....#',
    '#######',
  ],
  rectFilled: [
    '#######',
    '#######',
    '#######',
    '#######',
    '#######',
    '#######',
    '#######',
  ],
  select: [
    '##.#.##',
    '#.....#',
    '.......',
    '#.....#',
    '.......',
    '#.....#',
    '##.#.##',
  ],
  undo: [
    '..#....',
    '.##....',
    '#######',
    '.##...#',
    '..#...#',
    '......#',
    '..#####',
  ],
  redo: [
    '....#..',
    '....##.',
    '#######',
    '#...##.',
    '#...#..',
    '#......',
    '#####..',
  ],
  flipX: [
    '...#...',
    '#..#..#',
    '##.#.##',
    '###.###',
    '##.#.##',
    '#..#..#',
    '...#...',
  ],
  flipY: [
    '###.###',
    '.##.##.',
    '..#.#..',
    '.......',
    '..#.#..',
    '.##.##.',
    '###.###',
  ],
  rotate: [
    '.####..',
    '#....#.',
    '#...###',
    '#....#.',
    '#......',
    '#....#.',
    '.####..',
  ],
  plus: [
    '.......',
    '...#...',
    '...#...',
    '.#####.',
    '...#...',
    '...#...',
    '.......',
  ],
  close: [
    '.......',
    '.#...#.',
    '..#.#..',
    '...#...',
    '..#.#..',
    '.#...#.',
    '.......',
  ],
  resize: [
    '####...',
    '#......',
    '#......',
    '#..#..#',
    '......#',
    '......#',
    '...####',
  ],
} as const

export type IconName = keyof typeof PICTURES

export const ICON_NAMES = Object.keys(PICTURES) as IconName[]

/** The SVG path of a picture: one unit square per lit pixel. */
export function iconPath(name: IconName): string {
  let d = ''
  PICTURES[name].forEach((row, y) => {
    for (let x = 0; x < row.length; x++)
      if (row[x] === '#') d += `M${x} ${y}h1v1h-1z`
  })
  return d
}

/** An icon at `size` screen pixels (14 by default, 2x), in the text colour. */
export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg
      class="t8e-icon"
      width={size}
      height={size}
      viewBox="0 0 7 7"
      shape-rendering="crispEdges"
      aria-hidden="true"
    >
      <path fill="currentColor" d={iconPath(name)} />
    </svg>
  )
}
