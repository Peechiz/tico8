import { defineConfig } from 'tico8/config'

// Empty is the standard console: a 128x128 screen, 30 updates a second and
// Pico-8's sixteen colours. Settings go here to change it, such as
// screen: '160x144', rate: 60, palette: { ink: '#1b1b2f', ... } or
// actions: { jump: ['a', 'Space'] }. They autocomplete.
const config = defineConfig({})

export default config
export const { COLOR, input } = config
