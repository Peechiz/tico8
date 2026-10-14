/** How to play a sound: `theme.play({ loop: true, volume: 0.5 })`. */
export interface SoundOptions {
  /**
   * Play it over and over until stopped. A loop has one copy: playing it
   * again while it is going does nothing but take the new `volume`.
   */
  loop?: boolean
  /** Scale this play's loudness, from 0 to 1. Defaults to 1. */
  volume?: number
}

/**
 * A file from the sounds folder: `import { swing, theme } from './sounds'`.
 * Music is a sound played with `loop: true`.
 */
export interface Sound {
  /**
   * Play it. Each play of a one-off sound is a new copy, layered on any
   * still sounding. Before the player's first key press, click or tap, a
   * one-off is dropped and a loop waits to start on that press.
   */
  play(options?: SoundOptions): void
  /** Stop every copy, and a loop waiting for the first press. */
  stop(): void
  /** Its loudness from 0 to 1, for every copy now and later. Defaults to 1. */
  volume: number
  /** Whether a copy is sounding, or a loop is waiting for the first press. */
  readonly playing: boolean
}

/** A decoded sound file, ready to play. What is inside is the output's own. */
export interface Clip {
  /** Its length in seconds. */
  readonly duration: number
}

/** One copy of a clip sounding. */
export interface Voice {
  /** Set its loudness, from 0 to 1. */
  setGain(gain: number): void
  /** Stop it. It does not call `onEnded` after this. */
  stop(): void
  /** Hold it where it is in its clip. Does nothing when already held. */
  pause(): void
  /** Carry on from where `pause` held it. Does nothing when not held. */
  resume(): void
}

/**
 * The part of the browser's Web Audio the mixer uses, so tests can give it
 * a fake one.
 */
export interface AudioOut {
  /** Turn a file's bytes into a clip. Rejects if they are not a sound. */
  decode(bytes: ArrayBuffer): Promise<Clip>
  /**
   * Start a copy of a clip at `gain`. `onEnded` is called when a copy that
   * does not loop plays out.
   */
  start(
    clip: Clip,
    options: { loop: boolean; gain: number; onEnded(): void },
  ): Voice
  /** Let sound through, once the player has pressed something. */
  resume(): void
}

/** A sound whose clip can be set, and set again when its file changes. */
export interface LoadableSound extends Sound {
  /**
   * Use this clip from now on. A loop under way starts again with it; a
   * one-off copy sounding plays out the old one.
   */
  setClip(clip: Clip): void
}

/** All of a console's sounds, and the controls the engine keeps to itself. */
export interface Mixer {
  /** A new sound, with no clip yet: it plays nothing until it has one. */
  sound(): LoadableSound
  /** Loudness over every sound, from 0 to 1, for the pause menu. */
  volume: number
  /**
   * Whether sound is heard, for the pause menu. Switched off, every sound
   * plays on silent, so it carries on where it is when switched back.
   */
  soundOn: boolean
  /** Whether the player has pressed something yet. */
  readonly unlocked: boolean
  /** The player has pressed something: let sound through, start waiting loops. */
  unlock(): void
  /**
   * The game is restarting with new code: stop every one-off copy, and
   * mark every loop as not yet played by the new game.
   */
  restarting(): void
  /** The new game has started: stop the loops it did not play again. */
  settle(): void
  /**
   * The game is paused: hold every one-off copy where it is. Loops play
   * on, so the volume can be heard as it changes.
   */
  hold(): void
  /** The game carries on: every held copy carries on from where it was. */
  release(): void
}

/** The pause menu's sound settings. */
export interface SoundSettings {
  /** The master volume, from 0 to 1. */
  volume: number
  /** Whether sound is heard at all. */
  sound: boolean
}

/** The sound settings, kept from one visit to the next. */
export interface RememberedSound {
  /** What is stored, each setting that is missing or bad as its default. */
  load(): SoundSettings
  /** Keep the settings for next time. */
  store(settings: SoundSettings): void
}
