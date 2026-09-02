let _ctx: AudioContext | null = null
let _noiseBuffer: AudioBuffer | null = null
let _soundsEnabled = true

export function setSoundsEnabled(enabled: boolean) {
  _soundsEnabled = enabled
}

export type SoundPackId = 'thocky' | 'retro' | 'soft'

export const SOUND_PACKS: { id: SoundPackId, label: string, description: string }[] = [
  { id: 'thocky', label: 'Thocky', description: 'Deep, muffled mechanical-keyboard thock' },
  { id: 'retro', label: 'Retro', description: 'Bright 8-bit chiptune blips' },
  { id: 'soft', label: 'Soft', description: 'Gentle, mellow chimes' },
]

let _pack: SoundPackId = 'thocky'

export function setSoundPack(pack: SoundPackId) {
  _pack = pack
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

// ── Thocky: deep, muffled "thock" — a pitch-dropping low-passed tone body plus a
// filtered noise transient, modeled after a mechanical keyboard switch bottoming out.
function playThock(frequency: number, duration: number, volume = 0.2) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime

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

// ── Retro: bright, square-wave 8-bit blip — no filtering, sharp on/off, evokes
// old console UI sounds.
function playBlip(frequency: number, duration: number, volume = 0.15) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(frequency, now)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, now)
  gain.gain.setValueAtTime(volume, now + duration * 0.6)
  gain.gain.linearRampToValueAtTime(0.0001, now + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration)
}

// ── Soft: gentle sine chime with a smooth attack/release — no percussive
// transient, meant to be unobtrusive.
function playChime(frequency: number, duration: number, volume = 0.12) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(frequency, now)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration)
}

type SoundName = 'click' | 'create' | 'delete' | 'complete' | 'move' | 'error'

const PACK_IMPLS: Record<SoundPackId, Record<SoundName, () => void>> = {
  thocky: {
    click: () => playThock(240, 0.07, 0.18),
    create: () => {
      playThock(170, 0.09, 0.18)
      setTimeout(() => playThock(230, 0.09, 0.18), 60)
    },
    delete: () => playThock(120, 0.16, 0.2),
    complete: () => {
      playThock(190, 0.1, 0.2)
      setTimeout(() => playThock(240, 0.1, 0.2), 80)
      setTimeout(() => playThock(300, 0.14, 0.2), 160)
    },
    move: () => {
      playThock(160, 0.07, 0.16)
      setTimeout(() => playThock(200, 0.08, 0.16), 50)
    },
    error: () => {
      playThock(220, 0.1, 0.14)
      setTimeout(() => playThock(160, 0.14, 0.14), 70)
    },
  },
  retro: {
    click: () => playBlip(660, 0.05, 0.14),
    create: () => {
      playBlip(520, 0.05, 0.14)
      setTimeout(() => playBlip(780, 0.06, 0.14), 55)
    },
    delete: () => {
      playBlip(300, 0.08, 0.15)
      setTimeout(() => playBlip(200, 0.1, 0.15), 60)
    },
    complete: () => {
      playBlip(523, 0.06, 0.15)
      setTimeout(() => playBlip(659, 0.06, 0.15), 70)
      setTimeout(() => playBlip(880, 0.09, 0.15), 140)
    },
    move: () => {
      playBlip(440, 0.04, 0.13)
      setTimeout(() => playBlip(550, 0.05, 0.13), 40)
    },
    error: () => {
      playBlip(220, 0.08, 0.14)
      setTimeout(() => playBlip(180, 0.12, 0.14), 65)
    },
  },
  soft: {
    click: () => playChime(500, 0.1, 0.11),
    create: () => {
      playChime(440, 0.12, 0.11)
      setTimeout(() => playChime(600, 0.14, 0.11), 70)
    },
    delete: () => playChime(320, 0.18, 0.11),
    complete: () => {
      playChime(523, 0.14, 0.12)
      setTimeout(() => playChime(659, 0.14, 0.12), 90)
      setTimeout(() => playChime(784, 0.2, 0.12), 180)
    },
    move: () => {
      playChime(420, 0.1, 0.1)
      setTimeout(() => playChime(500, 0.12, 0.1), 55)
    },
    error: () => {
      playChime(300, 0.16, 0.1)
      setTimeout(() => playChime(240, 0.2, 0.1), 90)
    },
  },
}

export function clickSound() {
  PACK_IMPLS[_pack].click()
}

export function createSound() {
  PACK_IMPLS[_pack].create()
}

export function deleteSound() {
  PACK_IMPLS[_pack].delete()
}

export function completeSound() {
  PACK_IMPLS[_pack].complete()
}

export function moveSound() {
  PACK_IMPLS[_pack].move()
}

export function errorSound() {
  PACK_IMPLS[_pack].error()
}
