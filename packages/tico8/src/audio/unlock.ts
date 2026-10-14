/** The events that count as the player pressing something. */
export const UNLOCK_EVENTS = ['keydown', 'pointerdown', 'touchend'] as const

/**
 * Call `unlock` once, on the first key press, click or tap on `target`,
 * then stop listening. Returns a function that stops listening early.
 */
export function attachUnlock(
  target: EventTarget,
  unlock: () => void,
): () => void {
  const detach = () => {
    for (const type of UNLOCK_EVENTS) target.removeEventListener(type, onPress)
  }
  const onPress = () => {
    detach()
    unlock()
  }
  for (const type of UNLOCK_EVENTS) target.addEventListener(type, onPress)
  return detach
}
