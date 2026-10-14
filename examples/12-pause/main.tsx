import {
  audio,
  COLOR,
  clear,
  clock,
  type Rect,
  rect,
  SCREEN,
  text,
} from 'tico8'
import { Menu } from 'tico8/ui'
import { swing, theme } from './sounds'
import { input, save } from './tico8.config'
import './ui.css'

// A round lasts this many seconds.
const ROUND = 15

// Stars are the font's own ★ symbol, so a star is as big as its text.
const starSize = text.measure('★')

const paddle = rect({
  x: 0,
  y: SCREEN.height - 10,
  width: 24,
  height: 3,
  fill: COLOR.orange,
})

// The title waits for a round, the round runs, and the result shows after it.
// Pausing is the engine's: it freezes update, draw and the clock.
let state: 'title' | 'play' | 'over' = 'title'
let stars: Rect[] = []
let score = 0
// Game time when the round began, and when the next star appears.
let began = 0
let nextStar = 0
let newBest = false
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
  cleared = false
  paddle.x = (SCREEN.width - paddle.width) / 2
}

function toTitle() {
  state = 'title'
  stars = []
}

function clearBest() {
  save.clear()
  cleared = true
}

export function init() {
  toTitle()
  cleared = false
  // The browser starts the theme on the first key press; playing a loop that
  // is already going does nothing.
  theme.volume = 0.4
  theme.play({ loop: true })
}

/** The pause menu's item, added to the built-in ones. */
export function pause() {
  return (
    <button type="button" onClick={toTitle}>
      Quit to title
    </button>
  )
}

export function update() {
  // While a menu is open the game's input reads idle.
  if (state !== 'play') return

  // Holding boost moves the paddle faster.
  const speed = input.boost.held ? 4 : 2
  paddle.x = Math.max(
    0,
    Math.min(SCREEN.width - paddle.width, paddle.x + input.dir.x * speed),
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
  const caught = stars.length - falling.length
  score += caught
  if (caught > 0) swing.play()
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
  if (state === 'title') return

  for (const star of stars) text('★', { ...star, color: COLOR.yellow })
  paddle.draw()
}

// The UI is drawn over the screen after every update, from the same
// variables the game keeps.
export function ui() {
  if (state === 'title') {
    return (
      <div class="screen title">
        <h1>Star Catcher</h1>
        <Menu key="title" class="menu">
          <button type="button" onClick={start}>
            Start
          </button>
          <button type="button" onClick={clearBest}>
            Clear best
          </button>
        </Menu>
        <p class="hint">
          <span>← → move</span>
          <span>Ⓑ boost</span>
          <span>Esc pause</span>
        </p>
        {!audio.unlocked && <p class="note">Press a key for sound</p>}
        <p class={cleared ? 'note cleared' : 'note'}>
          {cleared ? 'Best cleared' : `Best ${save.best}`}
        </p>
      </div>
    )
  }

  return (
    <div class="screen">
      <header class="hud">
        <span>Score {score}</span>
        <span>Time {Math.ceil(timeLeft())}</span>
        <span class="best">Best {save.best}</span>
      </header>

      {state === 'over' && (
        <div class="panel">
          <h2>{newBest ? 'New best!' : 'Time!'}</h2>
          <p>
            You caught <b>{score}</b>
          </p>
          <Menu key="over" class="menu" onBack={toTitle}>
            <button type="button" onClick={start}>
              Again
            </button>
            <button type="button" onClick={toTitle}>
              Title
            </button>
          </Menu>
        </div>
      )}
    </div>
  )
}
