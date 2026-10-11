import { defineConfig } from 'tico8/config'

// The screen, the update rate and the colours.
const config = defineConfig({
  screen: '160x144',
  rate: 60,
  warnOffPalette: true,
  // A night market: lantern light, wet stone and the sea beyond the stalls.
  // The first colour is colour 0.
  palette: {
    night: '#14121f',
    dusk: '#2a2540',
    plum: '#4a3358',
    wine: '#7a3050',
    ember: '#c2452f',
    lantern: '#f08a2c',
    honey: '#f7c948',
    cream: '#fbf0c9',
    paper: '#fffaf0',
    rose: '#e58a9a',
    clay: '#a8644a',
    bark: '#5e3b2e',
    moss: '#3f5f3a',
    fern: '#6f9a4a',
    lime: '#b5d45c',
    teal: '#1f6f6b',
    jade: '#3fae93',
    mist: '#a6e0d0',
    deepSea: '#1d3a6b',
    sky: '#3f7fd0',
    ice: '#9ad0f5',
    slate: '#56607a',
    fog: '#a3acbf',
  },
})

export default config
export const { COLOR } = config
