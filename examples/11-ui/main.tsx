import {
  COLOR,
  clear,
  clock,
  input,
  type Rect,
  rect,
  SCREEN,
  text,
} from 'tico8'
import { Menu } from 'tico8/ui'
import { save } from './tico8.config'
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

// The title waits for a round, the round runs or is paused, and the result
// shows after it.
let state: 'title' | 'play' | 'paused' | 'over' = 'title'
let stars: Rect[] = []
let score = 0
// Game time when the round began, and when the next star appears.
let began = 0
let nextStar = 0
// Game time when the pause began. The clock keeps counting while paused, so
// resuming moves the round's times on by the pause.
let pausedAt = 0
let newBest = false
let cleared = false

/** Seconds left in the round. */
function timeLeft(): number {
  const now = state === 'paused' ? pausedAt : clock.seconds
  return Math.max(0, ROUND - (now - began))
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

function pause() {
  state = 'paused'
  pausedAt = clock.seconds
}

function resume() {
  const gap = clock.seconds - pausedAt
  began += gap
  nextStar += gap
  state = 'play'
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
}

export function update() {
  // While a menu is open the game's input reads idle; the game also stops
  // its own clock-driven logic.
  if (state !== 'play') return

  if (input.x.pressed) {
    pause()
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
          <span>Ⓧ pause</span>
        </p>
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

      {state === 'paused' && (
        <div class="panel">
          <h2>Paused</h2>
          <Menu key="pause" class="menu" onBack={resume}>
            <button type="button" onClick={resume}>
              Resume
            </button>
            <button type="button" onClick={toTitle}>
              Quit
            </button>
          </Menu>
        </div>
      )}

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
