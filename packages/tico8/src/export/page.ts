/** The style of the page a game runs in, in dev and exported. */
export const PAGE_STYLE = `html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: #111;
}`

export interface PageOptions {
  title: string
  js: string
  css: string
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** The exported page: one HTML file holding the game's code and CSS. */
export function exportPage({ title, js, css }: PageOptions): string {
  const safeCss = css.replace(/<\/(style)/gi, '<\\/$1')
  const safeJs = js
    .replace(/<\/(script)/gi, '<\\/$1')
    .replaceAll('<!--', '<\\!--')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
${PAGE_STYLE}
    </style>
    <style>
${safeCss}
    </style>
  </head>
  <body>
    <script type="module">
${safeJs}
    </script>
  </body>
</html>
`
}
