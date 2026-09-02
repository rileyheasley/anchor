let _ctx: AudioContext | null = null
let _noiseBuffer: AudioBuffer | null = null
let _soundsEnabled = true

export function setSoundsEnabled(enabled: boolean) {
  _soundsEnabled = enabled
}

const audioCtx = () => {
  if (!_ctx) _ctx = new AudioContext()
  return _ctx
}

// Short burst of white noise, cached and reused — the percussive "knock" transient
function noiseBuffer(ctx: AudioContext) {
  if (_noiseBuffer) return _noiseBuffer
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  _noiseBuffer = buffer
  return buffer
}

// Deep, muffled "thock": a pitch-dropping low-passed tone body plus a filtered noise
// transient, modeled after a mechanical keyboard switch bottoming out.
function playThock(frequency: number, duration: number, volume = 0.2) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime

  // Body — sine that drops in pitch and is dulled by a lowpass so it thumps instead of beeps
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency * 1.8, now)
  osc.frequency.exponentialRampToValueAtTime(frequency, now + 0.035)

  const bodyFilter = ctx.createBiquadFilter()
  bodyFilter.type = 'lowpass'
  bodyFilter.frequency.setValueAtTime(900, now)

  const bodyGain = ctx.createGain()
  bodyGain.gain.setValueAtTime(volume, now)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  osc.connect(bodyFilter)
  bodyFilter.connect(bodyGain)
  bodyGain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration)

  // Transient — brief filtered noise burst for the percussive attack
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx)

  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = 'lowpass'
  noiseFilter.frequency.setValueAtTime(1800, now)

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(volume * 0.5, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)

  noise.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + 0.03)
}

export function clickSound() {
  playThock(240, 0.07, 0.18)
}

export function createSound() {
  playThock(170, 0.09, 0.18)
  setTimeout(() => playThock(230, 0.09, 0.18), 60)
}

export function deleteSound() {
  playThock(120, 0.16, 0.2)
}

export function completeSound() {
  playThock(190, 0.1, 0.2)
  setTimeout(() => playThock(240, 0.1, 0.2), 80)
  setTimeout(() => playThock(300, 0.14, 0.2), 160)
}

export function moveSound() {
  playThock(160, 0.07, 0.16)
  setTimeout(() => playThock(200, 0.08, 0.16), 50)
}

// A soft downward two-note motif — distinct from the rest of the "thocky" family but
// deliberately muted (lower volume, no bright high notes) so it reads as "something
// didn't work" rather than an alarming or punitive tone.
export function errorSound() {
  playThock(220, 0.1, 0.14)
  setTimeout(() => playThock(160, 0.14, 0.14), 70)
}
