/** What a save can hold: plain data that survives being stored as JSON. */
export type SaveValue =
  | number
  | string
  | boolean
  | null
  | readonly SaveValue[]
  | { readonly [field: string]: SaveValue }

/** A save's fields by name, as the config's `save` setting writes them. */
export type SaveData = { readonly [field: string]: SaveValue }

/**
 * A save's type as written, with its values widened: `{ best: 0 }` is
 * `{ best: number }` and `[1, 2]` is `number[]`.
 */
export type Widen<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends boolean
      ? boolean
      : T extends null
        ? null
        : T extends readonly (infer Item)[]
          ? Widen<Item>[]
          : { -readonly [Field in keyof T]: Widen<T[Field]> }

/** A value that cannot be changed in place, however deep. */
export type Frozen<T> = T extends readonly (infer Item)[]
  ? readonly Frozen<Item>[]
  : T extends object
    ? { readonly [Field in keyof T]: Frozen<T[Field]> }
    : T

/**
 * A game's save: its fields read straight off it, `save.best`, and
 * changed only through `write` and `clear`.
 */
export type Save<D> = Frozen<Widen<D>> & {
  /**
   * Merge these fields into the save and store it at once:
   * `save.write({ best: score })`. Fields left out keep their values.
   */
  write(fields: Partial<Frozen<Widen<D>>>): void
  /** Forget what was stored, so every field is its default again. */
  clear(): void
}

/** The `save` a config gives its game: typed from its `save` setting. */
export type SaveOf<C> = C extends { save: infer D extends SaveData }
  ? Save<D>
  : Save<Record<never, never>>

/**
 * Where a save is kept, as text. The browser's `localStorage` now; a file
 * in a later desktop build. Any of these may throw.
 */
export interface SaveStore {
  /** The text last stored, or undefined when there is none. */
  load(): string | undefined
  /** Keep this text, in place of any before it. */
  store(text: string): void
  /** Forget the stored text. */
  remove(): void
}
