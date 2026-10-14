import {
  COLOR,
  clear,
  clock,
  input,
  label,
  type Rect,
  rect,
  SCREEN,
  text,
} from 'tico8'
import { save } from './tico8.config'

// A round lasts this many seconds, and Ⓑ is held this long to clear the best.
const ROUND = 15
const HOLD = 1

// Stars are the font's own ★ symbol, so a star is as big as its text.
const starSize = text.measure('★')

const paddle = rect({
  x: 0,
  y: SCREEN.height - 10,
  width: 24,
  height: 3,
  fill: COLOR.orange,
})
const hud = rect({
  x: 0,
  y: 0,
  width: SCREEN.width,
  height: 9,
  fill: COLOR.black,
})

const title = label({
  x: SCREEN.width / 2,
  y: 36,
  text: 'Star Catcher',
  color: COLOR.yellow,
  align: 'center',
})
const hint = label({
  x: SCREEN.width / 2,
  y: 56,
  color: COLOR.lightGrey,
  align: 'center',
})

// The title waits for a round, the round runs, and the result shows after it.
let state: 'title' | 'play' | 'over' = 'title'
let stars: Rect[] = []
let score = 0
// Game time when the round began, and when the next star appears.
let began = 0
let nextStar = 0
let newBest = false
// Game time when Ⓑ went down on the title, or undefined while it is not held.
let holdStart: number | undefined
let cleared = false

/** Seconds left in the round. */
function timeLeft(): number {
  return Math.max(0, ROUND - (clock.seconds - began))
}

function start() {
  state = 'play'
  stars = []
  score = 0
  began = clock.seconds
  nextStar = clock.seconds
  newBest = false
  paddle.x = (SCREEN.width - paddle.width) / 2
}

export function init() {
  state = 'title'
  stars = []
  holdStart = undefined
  cleared = false
}

export function update() {
  if (state === 'title') {
    if (input.a.pressed) {
      cleared = false
      start()
      return
    }

    // Holding Ⓑ for a second forgets the best. Time it in seconds, so it
    // takes the same at 30 or 60 updates a second.
    if (input.b.pressed) holdStart = clock.seconds
    if (!input.b.held) holdStart = undefined
    if (holdStart !== undefined && clock.seconds - holdStart >= HOLD) {
      save.clear()
      cleared = true
      holdStart = undefined
    }
    return
  }

  if (state === 'over') {
    if (input.a.pressed) state = 'title'
    return
  }

  paddle.x = Math.max(
    0,
    Math.min(SCREEN.width - paddle.width, paddle.x + input.dir.x * 2),
  )

  // A new star from a random place at the top, about every half second.
  if (clock.seconds >= nextStar) {
    nextStar += 0.5
    stars.push({
      x: Math.floor(Math.random() * (SCREEN.width - starSize.width)),
      y: -starSize.height,
      ...starSize,
    })
  }

  // Stars fall; a caught one scores, and one past the bottom is lost.
  for (const star of stars) star.y += 1.5
  const falling = stars.filter((star) => !rect.overlaps(star, paddle))
  score += stars.length - falling.length
  stars = falling.filter((star) => star.y < SCREEN.height)

  // The round is over: a score above the best is kept for next time.
  if (timeLeft() === 0) {
    state = 'over'
    if (score > save.best) {
      save.write({ best: score })
      newBest = true
    }
  }
}

export function draw() {
  clear(COLOR.darkBlue)

  if (state === 'title') {
    title.text = 'Star Catcher'
    title.draw()
    hint.text = `Ⓐ starts a round\n(Ⓐ is the A key)\n\n← → move\nBest ${save.best}`
    hint.draw()

    // A bar fills while Ⓑ is held.
    const held = holdStart === undefined ? 0 : clock.seconds - holdStart
    text(cleared ? 'Best cleared' : 'Hold Ⓑ (S) to clear', {
      x: SCREEN.width / 2,
      y: 100,
      color: cleared ? COLOR.green : COLOR.darkGrey,
      align: 'center',
    })
    rect({
      x: 34,
      y: 110,
      width: Math.floor(Math.min(1, held / HOLD) * 60),
      height: 3,
      fill: COLOR.red,
    }).draw()
    return
  }

  for (const star of stars) text('★', { ...star, color: COLOR.yellow })
  paddle.draw()

  hud.draw()
  text(`Score ${score}`, { x: 2, y: 2, color: COLOR.white })
  text(`Time ${Math.ceil(timeLeft())}`, {
    x: SCREEN.width / 2,
    y: 2,
    color: COLOR.white,
    align: 'center',
  })
  text(`Best ${save.best}`, {
    x: SCREEN.width - 2,
    y: 2,
    color: COLOR.yellow,
    align: 'right',
  })

  if (state === 'over') {
    title.text = newBest ? 'New best!' : 'Time!'
    title.draw()
    text('Ⓐ for the title', {
      x: SCREEN.width / 2,
      y: 56,
      color: COLOR.lightGrey,
      align: 'center',
    })
  }
}
