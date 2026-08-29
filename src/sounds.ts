const audioCtx = () => {
  if (!_ctx) _ctx = new AudioContext()
  return _ctx
}
let _ctx: AudioContext | null = null

function playTone(frequency: number, duration: number, volume = 0.15, type: OscillatorType = 'sine') {
  const ctx = audioCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime)
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

export function clickSound() {
  playTone(800, 0.06, 0.1, 'square')
}

export function createSound() {
  playTone(520, 0.08, 0.12)
  setTimeout(() => playTone(780, 0.1, 0.12), 60)
}

export function deleteSound() {
  playTone(300, 0.12, 0.1, 'triangle')
}

export function completeSound() {
  playTone(523, 0.1, 0.15)
  setTimeout(() => playTone(659, 0.1, 0.15), 80)
  setTimeout(() => playTone(784, 0.15, 0.15), 160)
}

export function moveSound() {
  playTone(440, 0.06, 0.08)
  setTimeout(() => playTone(560, 0.08, 0.08), 50)
}
