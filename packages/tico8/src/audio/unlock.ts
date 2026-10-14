/** The events that count as the player pressing something. */
export const UNLOCK_EVENTS = ['keydown', 'pointerdown', 'touchend'] as const

/**
 * Whether the browser lets sound through for this event. Escape never
 * does, and where the browser says (`navigator.userActivation`) its word
 * is taken, since a press it does not trust leaves sound locked.
 */
function trusted(event: Event): boolean {
  if ((event as KeyboardEvent).key === 'Escape') return false
  const activation = globalThis.navigator?.userActivation
  return activation === undefined || activation.isActive
}

/**
 * Call `unlock` once, on the first key press, click or tap on `target` that
 * the browser lets sound through for, then stop listening. Returns a
 * function that stops listening early.
 */
export function attachUnlock(
  target: EventTarget,
  unlock: () => void,
): () => void {
  const detach = () => {
    for (const type of UNLOCK_EVENTS) target.removeEventListener(type, onPress)
  }
  const onPress = (event: Event) => {
    if (!trusted(event)) return
    detach()
    unlock()
  }
  for (const type of UNLOCK_EVENTS) target.addEventListener(type, onPress)
  return detach
}
