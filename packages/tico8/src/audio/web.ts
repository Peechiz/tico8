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
      const source = context.createBufferSource()
      source.buffer = (clip as WebClip).buffer
      source.loop = loop
      const node = context.createGain()
      node.gain.value = gain
      source.connect(node).connect(context.destination)
      let stopped = false
      source.onended = () => {
        if (!stopped) onEnded()
      }
      source.start()
      return {
        setGain(value) {
          node.gain.value = value
        },
        stop() {
          stopped = true
          source.stop()
          source.disconnect()
          node.disconnect()
        },
      }
    },
    resume() {
      context.resume().catch(() => {})
    },
  }
}
