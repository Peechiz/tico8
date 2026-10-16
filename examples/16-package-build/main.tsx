import { audio, COLOR, clear, clock, rect, SCREEN, type Sprite } from 'tico8'
import { Menu } from 'tico8/ui'
import { night } from './maps'
import { swing, theme } from './sounds'
import { badge, paddle, star } from './sprites'
import { input, save } from './tico8.config'
import './ui.css'

// A round lasts this many seconds.
const ROUND = 15

// A star twinkles as it falls.
const twinkle = { frames: [0, 1], fps: 4 }

// The paddle sits on the grass, the map's bottom row. Its cell is its
// hitbox, and the walls at the sides stop it.
const bat = paddle.sprite({ y: night.height - 16 })

// The badge sits in the top right, just under the HUD text.
const mark = badge.sprite({ x: SCREEN.width - 18, y: 12 })

// The title waits for a round, the round runs, and the result shows after it.
// Pausing is the engine's: it freezes update, draw and the clock.
let state: 'title' | 'play' | 'over' = 'title'
let stars: Sprite[] = []
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
  bat.x = (SCREEN.width - bat.width) / 2
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

  // Holding boost moves the paddle faster. A step into a wall tile is taken
  // back a pixel at a time, so the paddle ends up flush against the wall.
  const speed = input.boost.held ? 4 : 2
  bat.x += input.dir.x * speed
  while (night.walls.overlaps(bat, 'wall')) bat.x -= input.dir.x

  // A new star from a random place at the top between the walls, about
  // every half second.
  if (clock.seconds >= nextStar) {
    nextStar += 0.5
    const left = 8
    const right = night.width - 8 - star.cell.width
    stars.push(
      star.sprite({
        x: left + Math.floor(Math.random() * (right - left + 1)),
        y: -star.cell.height,
      }),
    )
  }

  // Stars fall; a caught one scores, and one past the bottom is lost.
  for (const one of stars) {
    one.y += 1.5
    one.play(twinkle)
  }
  const falling = stars.filter((one) => !rect.overlaps(one, bat))
  const caught = stars.length - falling.length
  score += caught
  if (caught > 0) swing.play()
  stars = falling.filter((one) => one.y < SCREEN.height)

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
  night.sky.draw()
  if (state !== 'title') {
    for (const one of stars) one.draw()
    bat.draw()
  }
  // Drawn last, so a missed star falls behind the grass.
  night.walls.draw()
  mark.draw()
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
