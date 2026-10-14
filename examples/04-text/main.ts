import {
  COLOR,
  camera,
  clear,
  clip,
  fill,
  input,
  label,
  type Rect,
  rect,
  SCREEN,
  stroke,
  text,
  vec,
} from 'tico8'
import { player } from './sprites'

// The world is two screens wide; the camera follows the hero across it.
const world = rect({
  x: 0,
  y: 0,
  width: SCREEN.width * 2,
  height: SCREEN.height,
})
const ground = rect({
  x: 0,
  y: 104,
  width: world.width,
  height: 24,
  fill: COLOR.darkGreen,
})

// Text that stays put is a label: it holds its place, colour and alignment.
const title = label({
  x: SCREEN.width / 2,
  y: 24,
  color: COLOR.yellow,
  align: 'center',
})
const hint = label({
  x: SCREEN.width / 2,
  y: 40,
  color: COLOR.lightGrey,
  align: 'center',
})

// A sign in the world, with a board made to fit its words.
const notice = label({
  x: 180,
  y: 76,
  text: 'Welcome to\nTiny Words ♥',
  color: COLOR.white,
})
const board = rect({
  ...around(notice.bounds),
  fill: COLOR.brown,
  stroke: COLOR.orange,
})
const post = rect({
  x: board.x + board.width / 2 - 2,
  y: board.y + board.height,
  width: 4,
  height: 104 - board.y - board.height,
  fill: COLOR.brown,
})

// Coins are the font's own ● symbol, so a coin is as big as its text.
const coinSize = text.measure('●')
const coinSpots = [
  vec(24, 97),
  vec(96, 82),
  vec(150, 97),
  vec(228, 97),
  vec(246, 82),
]
let coins: Rect[] = []

// A ticker: a long line slides through a window that the clip cuts.
const news = 'The quick brown fox jumps over the lazy dog ★ '
const ticker = rect({
  x: 8,
  y: 113,
  width: SCREEN.width - 16,
  height: 9,
  fill: COLOR.black,
})

const hud = rect({
  x: 0,
  y: 0,
  width: SCREEN.width,
  height: 9,
  fill: COLOR.black,
})

const hero = player.sprite()
const body = rect({ x: 0, y: 0, ...player.cell })
const cam = vec()
let score = 0
let frame = 0
let fall = 0

/** A box with a little room around another. */
function around(box: Rect): Rect {
  return {
    x: box.x - 3,
    y: box.y - 3,
    width: box.width + 6,
    height: box.height + 5,
  }
}

export function init() {
  body.x = 60
  body.y = ground.y - body.height
  score = 0
  fall = 0
  coins = coinSpots.map((spot) => ({ ...spot, ...coinSize }))
}

export function update() {
  frame++
  const dir = input.dir
  body.x = Math.max(0, Math.min(world.width - body.width, body.x + dir.x))
  if (dir.x !== 0) hero.flipX = dir.x < 0
  hero.frame = dir.x !== 0 ? Math.floor(body.x / 4) % player.frames : 0

  // Ⓐ jumps, which is how the high coins are reached.
  const floor = ground.y - body.height
  const won = coins.length === 0
  if (input.a.pressed && body.y === floor && !won) fall = -4
  fall += 0.5
  body.y = Math.min(floor, body.y + fall)
  if (body.y === floor) fall = 0

  // Touching a coin takes it.
  const left = coins.filter((coin) => !rect.overlaps(body, coin))
  score += (coins.length - left.length) * 10
  coins = left

  // A label's words can change; its box and alignment follow.
  title.text = won ? 'All found! ★' : 'Tiny Words'
  hint.text = won
    ? 'Ⓐ plays again\n(Ⓐ is the A key)'
    : '← → walk, Ⓐ jump\ncollect every ●\n(Ⓐ is the A key)'
  if (won && input.a.pressed) init()

  cam.x = body.x + body.width / 2 - SCREEN.width / 2
  cam.x = Math.max(0, Math.min(world.width - SCREEN.width, cam.x))
}

export function draw() {
  clear(COLOR.darkBlue)

  camera(cam, () => {
    ground.draw()
    post.draw()
    board.draw()
    notice.draw()
    for (const coin of coins) text('●', { ...coin, color: COLOR.yellow })
    hero.draw(body)
    // Text takes any position, so a name tag follows the hero.
    text('you', { x: body.x + 4, y: body.y - 7, align: 'center' })
  })

  // A label knows the box it covers, so a plate can sit behind it.
  fill(around(title.bounds), COLOR.darkPurple)
  title.draw()
  stroke(around(hint.bounds), COLOR.darkGrey)
  hint.draw()

  // The line is drawn twice, end to end, so it loops without a gap.
  ticker.draw()
  const lap = text.measure(news).width + 1
  const x = ticker.x - (frame % lap)
  clip(ticker, () => {
    text(news + news, { x, y: ticker.y + 2, color: COLOR.green })
  })

  // Text that changes every frame is a one-off.
  hud.draw()
  const found = coinSpots.length - coins.length
  text(`● ${found}/${coinSpots.length}`, { x: 2, y: 2, color: COLOR.yellow })
  text(`Score ${score}`, {
    x: SCREEN.width - 2,
    y: 2,
    color: COLOR.white,
    align: 'right',
  })
}
