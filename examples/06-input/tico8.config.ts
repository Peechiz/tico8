import { defineConfig } from 'tico8/config'

// Actions are named here and bound to a pad button, a key, or both. A pad
// button brings its default key; 'r1' is an extra, so it needs extras: true.
const config = defineConfig({
  screen: '240x136',
  rate: 60,
  extras: true,
  mouse: true,
  actions: {
    jump: ['a', 'Space'],
    dash: ['r1', 'ShiftLeft'],
  },
})
export default config

// The game imports this, so `input.jump` is known and `input.fly` is an error.
export const { input } = config
