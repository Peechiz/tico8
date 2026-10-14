import { Window } from 'happy-dom'
import { expect, it } from 'vitest'
import { exportPage, PAGE_STYLE } from './page.ts'

function parse(html: string) {
  const window = new Window()
  window.document.write(html)
  return window.document
}

const options = { title: 'game', js: 'run()', css: 'body{color:red}' }

it('keeps </script> in the code from ending the script early', () => {
  const js =
    'const a = "</script><p>x</p>"; const b = "</SCRIPT >"; const c = "<!--"'
  const doc = parse(exportPage({ ...options, js }))
  const scripts = [...doc.querySelectorAll('script')]
  expect(scripts).toHaveLength(1)
  expect(doc.querySelectorAll('p')).toHaveLength(0)
  const text = scripts[0]?.textContent ?? ''
  expect(text).not.toMatch(/<\/script/i)
  expect(text).not.toContain('<!--')
  // The escapes are no-ops inside string literals.
  const run = (code: string) => new Function(`${code}; return [a, b, c]`)()
  expect(run(text)).toEqual(run(js))
  expect(scripts[0]?.getAttribute('type')).toBe('module')
  expect(scripts[0]?.hasAttribute('src')).toBe(false)
})

it('escapes the title', () => {
  const html = exportPage({ ...options, title: 'a < b & <c>' })
  expect(html).toContain('<title>a &lt; b &amp; &lt;c&gt;</title>')
  expect(parse(html).title).toBe('a < b & <c>')
})

it('holds the page style and the game css', () => {
  const html = exportPage({ ...options, css: 'p{} </style><b>' })
  expect(html.startsWith('<!doctype html>')).toBe(true)
  expect(html).toContain('<html lang="en">')
  expect(html).toContain('charset="utf-8"')
  expect(html).toContain('name="viewport"')
  const styles = [...parse(html).querySelectorAll('style')].map(
    (s) => s.textContent,
  )
  expect(styles).toHaveLength(2)
  expect(styles[0]).toContain(PAGE_STYLE)
  expect(styles[1]).toContain('p{}')
  expect(parse(html).querySelectorAll('b')).toHaveLength(0)
})
