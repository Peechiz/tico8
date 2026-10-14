import type { AudioOut, Clip } from './types.ts'

/** A decoded sound file: the buffer the browser made from it. */
interface WebClip extends Clip {
  readonly buffer: AudioBuffer
}

/** An `AudioOut` over one `AudioContext`. Call only in a browser. */
export function createWebAudio(): AudioOut {
  const context = new AudioContext()
  return {
    async decode(bytes) {
      const buffer = await context.decodeAudioData(bytes)
      return { duration: buffer.duration, buffer } as WebClip
    },
    start(clip, { loop, gain, onEnded }) {
      const { buffer } = clip as WebClip
      // One gain node for the whole voice, so `setGain` reaches every source.
      const node = context.createGain()
      node.gain.value = gain
      node.connect(context.destination)

      // A source node plays once and cannot be paused, so each stretch of
      // playing gets its own, started at `offset` seconds into the clip.
      let source: AudioBufferSourceNode | null = null
      let offset = 0
      let startedAt = 0
      let stopped = false

      function play(): void {
        const next = context.createBufferSource()
        next.buffer = buffer
        next.loop = loop
        next.connect(node)
        // Only the source now playing may end the voice: one stopped by
        // `pause` or `stop` stays quiet.
        next.onended = () => {
          if (source === next) {
            source = null
            stopped = true
            node.disconnect()
            onEnded()
          }
        }
        startedAt = context.currentTime
        next.start(0, offset)
        source = next
      }

      function halt(): void {
        if (source === null) return
        const old = source
        source = null
        old.stop()
        old.disconnect()
      }

      play()
      return {
        setGain(value) {
          node.gain.value = value
        },
        stop() {
          if (stopped) return
          stopped = true
          halt()
          node.disconnect()
        },
        pause() {
          if (stopped || source === null) return
          const played = offset + (context.currentTime - startedAt)
          offset = loop
            ? played % buffer.duration
            : Math.min(played, buffer.duration)
          halt()
        },
        resume() {
          if (stopped || source !== null) return
          play()
        },
      }
    },
    resume() {
      context.resume().catch(() => {})
    },
  }
}
