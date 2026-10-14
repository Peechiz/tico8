import type {
  AudioOut,
  Clip,
  LoadableSound,
  Mixer,
  SoundOptions,
  Voice,
} from './types.ts'

/** A volume held to 0..1; anything that is not a number is silence. */
function clamp(volume: number): number {
  return Number.isNaN(volume) ? 0 : Math.min(1, Math.max(0, volume))
}

/** One copy of a one-off sounding, and the volume of the play that made it. */
interface Copy {
  voice: Voice
  volume: number
}

/** A sound's loop: wanted, and sounding once it is unlocked and has a clip. */
interface Loop {
  volume: number
  voice: Voice | null
  /** Whether the running game has played it since the last restart. */
  claimed: boolean
}

/** A console's sounds, played through `out`. Locked until `unlock`. */
export function createMixer(out: AudioOut): Mixer {
  let master = 1
  let unlocked = false
  const sounds = new Set<SoundState>()

  interface SoundState {
    sound: LoadableSound
    /** Set every gain again, after a volume changed. */
    regain(): void
    /** Start a loop that was waiting. */
    unlock(): void
    restarting(): void
    settle(): void
  }

  const mixer: Mixer = {
    sound() {
      let clip: Clip | null = null
      let volume = 1
      const copies = new Set<Copy>()
      let loop: Loop | null = null

      const gainOf = (playVolume: number) => master * volume * playVolume

      // A loop with a clip, once unlocked, gets its voice; until then it waits.
      function startLoop(): void {
        if (loop === null || loop.voice !== null || clip === null || !unlocked)
          return
        loop.voice = out.start(clip, {
          loop: true,
          gain: gainOf(loop.volume),
          onEnded() {},
        })
      }

      function stopLoop(): void {
        loop?.voice?.stop()
        loop = null
      }

      function stopCopies(): void {
        for (const copy of copies) copy.voice.stop()
        copies.clear()
      }

      function playOnce(playVolume: number): void {
        // Dropped, not queued: an effect that came late would sound wrong.
        if (clip === null || !unlocked) return
        const copy: Copy = {
          volume: playVolume,
          voice: out.start(clip, {
            loop: false,
            gain: gainOf(playVolume),
            onEnded() {
              copies.delete(copy)
            },
          }),
        }
        copies.add(copy)
      }

      function playLoop(playVolume: number): void {
        if (loop !== null) {
          loop.volume = playVolume
          loop.claimed = true
          loop.voice?.setGain(gainOf(playVolume))
          return
        }
        loop = { volume: playVolume, voice: null, claimed: true }
        startLoop()
      }

      const state: SoundState = {
        sound: {
          play(options: SoundOptions = {}) {
            const playVolume = clamp(options.volume ?? 1)
            if (options.loop) playLoop(playVolume)
            else playOnce(playVolume)
          },
          stop() {
            stopCopies()
            stopLoop()
          },
          get volume() {
            return volume
          },
          set volume(next: number) {
            volume = clamp(next)
            state.regain()
          },
          get playing() {
            return copies.size > 0 || loop !== null
          },
          setClip(next: Clip) {
            clip = next
            if (loop === null) return
            // A loop under way starts again with the new clip; a waiting one starts.
            loop.voice?.stop()
            loop.voice = null
            startLoop()
          },
        },
        regain() {
          for (const copy of copies) copy.voice.setGain(gainOf(copy.volume))
          loop?.voice?.setGain(gainOf(loop.volume))
        },
        unlock: startLoop,
        restarting() {
          stopCopies()
          if (loop !== null) loop.claimed = false
        },
        settle() {
          if (loop !== null && !loop.claimed) stopLoop()
        },
      }
      sounds.add(state)
      return state.sound
    },
    get volume() {
      return master
    },
    set volume(next: number) {
      master = clamp(next)
      for (const state of sounds) state.regain()
    },
    get unlocked() {
      return unlocked
    },
    unlock() {
      if (unlocked) return
      unlocked = true
      out.resume()
      for (const state of sounds) state.unlock()
    },
    restarting() {
      for (const state of sounds) state.restarting()
    },
    settle() {
      for (const state of sounds) state.settle()
    },
  }
  return mixer
}
