import { useContext, useLayoutEffect, useRef } from 'preact/hooks'
import { NavContext } from './context.ts'
import type { MenuProps } from './types.ts'

const BUTTON = 'button:not(:disabled)'

/**
 * A menu: while it is on screen its buttons have the pad, and the game's
 * input reads as idle. Directions move the highlight, Ⓐ presses, Ⓑ calls
 * `onBack`. It is a `div`, and takes what a `div` takes.
 */
export function Menu({ onBack, children, ...props }: MenuProps) {
  const nav = useContext(NavContext)
  if (!nav) throw new Error('A Menu must be inside the game’s ui')
  const element = useRef<HTMLDivElement>(null)
  // The entry reads this, so a new callback each render never reopens.
  const back = useRef(onBack)
  back.current = onBack

  useLayoutEffect(() => {
    const div = element.current
    if (!div) return
    // `onBack` is read when it is needed, so a menu given one later has it.
    const close = nav.open({
      element: div,
      get onBack() {
        const onBack = back.current
        return onBack && (() => onBack())
      },
    })
    if (!div.contains(div.ownerDocument.activeElement)) {
      div.querySelector<HTMLElement>(BUTTON)?.focus()
    }
    // The pointer over a button focuses it. This cannot tell whether this is
    // the top menu, so any menu under the pointer takes it.
    const hover = (event: Event) => {
      const button = (event.target as Element).closest<HTMLElement>(BUTTON)
      if (button && div.contains(button)) button.focus()
    }
    div.addEventListener('pointermove', hover)
    return () => {
      div.removeEventListener('pointermove', hover)
      close()
    }
  }, [nav])

  return (
    <div {...props} ref={element}>
      {children}
    </div>
  )
}
