// @vitest-environment happy-dom
import { render } from 'preact'
import { expect, it } from 'vitest'
import { useState } from './index.ts'

it('compiles JSX through tico8/ui and renders it', () => {
  function Hud({ hp }: { hp: number }) {
    const [label] = useState('♥')
    return (
      <div class="hud">
        {label} {hp}
      </div>
    )
  }
  const root = document.createElement('div')
  render(<Hud hp={3} />, root)
  expect(root.innerHTML).toBe('<div class="hud">♥ 3</div>')
})
