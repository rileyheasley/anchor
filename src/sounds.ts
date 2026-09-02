let _ctx: AudioContext | null = null
let _noiseBuffer: AudioBuffer | null = null
let _soundsEnabled = true

export function setSoundsEnabled(enabled: boolean) {
  _soundsEnabled = enabled
}

export type SoundPackId = 'thocky' | 'retro' | 'soft' | 'marimba' | 'glass' | 'analogSynth' | 'typewriter' | 'nature' | 'minimal'

export const SOUND_PACKS: { id: SoundPackId, label: string, description: string }[] = [
  { id: 'thocky', label: 'Thocky', description: 'Deep, muffled mechanical-keyboard thock' },
  { id: 'retro', label: 'Retro', description: 'Bright 8-bit chiptune blips' },
  { id: 'soft', label: 'Soft', description: 'Gentle, mellow chimes' },
  { id: 'marimba', label: 'Marimba', description: 'Warm, plucky wooden mallet tones' },
  { id: 'glass', label: 'Glass', description: 'Bright, ringing glass taps' },
  { id: 'analogSynth', label: 'Analog Synth', description: 'Vintage synthesizer blips with a filter sweep' },
  { id: 'typewriter', label: 'Typewriter', description: 'Mechanical key clacks and a carriage-return bell' },
  { id: 'nature', label: 'Nature', description: 'Soft water-drop and wood-tap textures' },
  { id: 'minimal', label: 'Minimal', description: 'Near-silent, high-frequency ticks' },
]

let _pack: SoundPackId = 'thocky'

export function setSoundPack(pack: SoundPackId) {
  _pack = pack
}

const audioCtx = () => {
  if (!_ctx) _ctx = new AudioContext()
  return _ctx
}

// Small per-hit randomization so repeated presses of the same action never sound
// like an exact loop — real materials (switches, wood, glass) never ring identically twice.
const jitter = (value: number, amount: number) => value * (1 + (Math.random() * 2 - 1) * amount)

// Short burst of white noise, cached and reused as the raw material for every
// percussive transient (knocks, taps, clacks, drops) across every pack.
function noiseBuffer(ctx: AudioContext) {
  if (_noiseBuffer) return _noiseBuffer
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  _noiseBuffer = buffer
  return buffer
}

// Plays a short filtered-noise burst — the shared building block for every pack's
// percussive "attack" transient. `type`/`freq`/`q` shape which slice of the noise
// spectrum comes through (a low thock-knock vs. a bright glass-tick vs. a typewriter-clack).
function playNoiseBurst(ctx: AudioContext, now: number, duration: number, volume: number, filterType: BiquadFilterType, freq: number, q = 1) {
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx)

  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.frequency.setValueAtTime(freq, now)
  filter.Q.setValueAtTime(q, now)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + duration)
}

// ── Thocky: deep, muffled mechanical-keyboard "thock" — a pitch-dropping low-passed
// tone body (doubled with a slightly detuned unison layer for width, plus a quiet
// sub-octave layer for weight) topped with a filtered noise transient for the
// percussive attack. Frequency/cutoff/timing all jitter per hit.
function playThock(frequency: number, duration: number, volume = 0.2) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime
  const freq = jitter(frequency, 0.05)
  const dur = jitter(duration, 0.12)
  const cutoff = jitter(900, 0.25)

  const bodyFilter = ctx.createBiquadFilter()
  bodyFilter.type = 'lowpass'
  bodyFilter.frequency.setValueAtTime(cutoff, now)

  const bodyGain = ctx.createGain()
  bodyGain.gain.setValueAtTime(volume, now)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + dur)
  bodyFilter.connect(bodyGain)
  bodyGain.connect(ctx.destination)

  // Unison pair, detuned a few cents apart, for a fuller body than a single sine
  for (const detune of [-6, 6]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    const f = freq * Math.pow(2, detune / 1200)
    osc.frequency.setValueAtTime(f * 1.8, now)
    osc.frequency.exponentialRampToValueAtTime(f, now + 0.035)
    osc.connect(bodyFilter)
    osc.start(now)
    osc.stop(now + dur)
  }

  // Quiet sub-octave layer for low-end weight
  const sub = ctx.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(freq / 2, now)
  const subGain = ctx.createGain()
  subGain.gain.setValueAtTime(volume * 0.35, now)
  subGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.8)
  sub.connect(subGain)
  subGain.connect(ctx.destination)
  sub.start(now)
  sub.stop(now + dur * 0.8)

  playNoiseBurst(ctx, now, 0.03, volume * 0.5, 'lowpass', jitter(1800, 0.2))
}

// ── Retro: bright square-wave 8-bit blip with a fast downward pitch-bend on release
// (the classic chiptune "coin/blip" swoop) and a second, slightly-detuned square
// layer for grit. Frequency and bend depth jitter per hit.
function playBlip(frequency: number, duration: number, volume = 0.15) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime
  const freq = jitter(frequency, 0.04)
  const dur = jitter(duration, 0.15)
  const bendTo = freq * (1 - jitter(0.35, 0.3))

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, now)
  gain.gain.setValueAtTime(volume, now + dur * 0.55)
  gain.gain.linearRampToValueAtTime(0.0001, now + dur)
  gain.connect(ctx.destination)

  for (const [detune, mix] of [[0, 1], [9, 0.4]] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'square'
    const f = freq * Math.pow(2, detune / 1200)
    osc.frequency.setValueAtTime(f, now)
    osc.frequency.linearRampToValueAtTime(bendTo * Math.pow(2, detune / 1200), now + dur)
    const oscGain = ctx.createGain()
    oscGain.gain.value = mix
    osc.connect(oscGain)
    oscGain.connect(gain)
    osc.start(now)
    osc.stop(now + dur)
  }
}

// ── Soft: a gentle two-voice chorus of detuned sine tones with slow vibrato and a
// smooth attack/release — no percussive transient, meant to feel unobtrusive and
// a little warm rather than robotic. Frequency and vibrato phase jitter per hit.
function playChime(frequency: number, duration: number, volume = 0.12) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime
  const freq = jitter(frequency, 0.03)
  const dur = jitter(duration, 0.15)

  const masterGain = ctx.createGain()
  masterGain.gain.setValueAtTime(0.0001, now)
  masterGain.gain.exponentialRampToValueAtTime(volume, now + 0.035)
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  masterGain.connect(ctx.destination)

  const vibrato = ctx.createOscillator()
  vibrato.type = 'sine'
  vibrato.frequency.value = jitter(5, 0.3)
  const vibratoGain = ctx.createGain()
  vibratoGain.gain.value = freq * 0.006
  vibrato.connect(vibratoGain)
  vibrato.start(now)
  vibrato.stop(now + dur)

  for (const detune of [-4, 4]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq * Math.pow(2, detune / 1200), now)
    vibratoGain.connect(osc.frequency)
    osc.connect(masterGain)
    osc.start(now)
    osc.stop(now + dur)
  }
}

// ── Marimba: a triangle-wave body pushed through a resonant bandpass filter (the
// hollow, woody resonance of a mallet bar) with a fast attack and quick exponential
// decay, plus a tiny filtered-noise "mallet strike" transient up front.
function playPluck(frequency: number, duration: number, volume = 0.2) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime
  const freq = jitter(frequency, 0.02)
  const dur = jitter(duration, 0.15)

  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, now)

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(freq * 2, now)
  bandpass.Q.setValueAtTime(3, now)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur)

  osc.connect(bandpass)
  bandpass.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + dur)

  playNoiseBurst(ctx, now, 0.02, volume * 0.3, 'bandpass', freq * 3, 2)
}

// ── Glass: a bright sine fundamental plus an inharmonic overtone (a non-integer
// ratio, the way real bells/glass ring) with a long decay, topped with a brief
// highpass noise "tink" on attack.
function playBell(frequency: number, duration: number, volume = 0.16) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime
  const freq = jitter(frequency, 0.02)
  const dur = jitter(duration, 0.1)

  for (const [ratio, mix, decay] of [[1, 1, dur], [2.76, 0.35, dur * 0.6]] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq * ratio, now)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume * mix, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + decay)
  }

  playNoiseBurst(ctx, now, 0.015, volume * 0.4, 'highpass', 4000)
}

// ── Analog Synth: a sawtooth run through a resonant lowpass filter whose cutoff
// sweeps downward (the classic subtractive-synth "pluck") with a slight pitch
// glide, evoking a vintage monosynth blip rather than a percussive hit.
function playSynth(frequency: number, duration: number, volume = 0.15) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime
  const freq = jitter(frequency, 0.03)
  const dur = jitter(duration, 0.15)

  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(freq * 1.02, now)
  osc.frequency.exponentialRampToValueAtTime(freq, now + dur * 0.5)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.setValueAtTime(8, now)
  filter.frequency.setValueAtTime(jitter(3200, 0.15), now)
  filter.frequency.exponentialRampToValueAtTime(300, now + dur)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur)

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + dur)
}

// ── Typewriter: mostly a sharp bandpassed noise clack (the lever/key strike) with
// only a whisper of pitched body underneath — deliberately noisy and mechanical
// rather than musical.
function playClack(frequency: number, duration: number, volume = 0.18) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime
  const dur = jitter(duration, 0.2)

  playNoiseBurst(ctx, now, dur, volume, 'bandpass', jitter(frequency, 0.1), 1.5)

  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.setValueAtTime(jitter(frequency * 0.6, 0.05), now)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume * 0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.5)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + dur * 0.5)
}

// ── Nature: a resonant bandpass filter sweeping quickly downward over a noise
// burst — the "plink" of a water drop — with a soft, filtered tail. No harsh
// transient, no pitched oscillator.
function playDrop(frequency: number, duration: number, volume = 0.14) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime
  const freq = jitter(frequency, 0.08)
  const dur = jitter(duration, 0.2)

  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx)
  noise.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.setValueAtTime(12, now)
  filter.frequency.setValueAtTime(freq * 2.5, now)
  filter.frequency.exponentialRampToValueAtTime(freq * 0.6, now + dur)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur)

  noise.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + dur)
}

// ── Minimal: a single short, quiet sine tick — no harmonics, no transient, meant
// to be felt more than heard.
function playTick(frequency: number, duration: number, volume = 0.07) {
  if (!_soundsEnabled) return
  const ctx = audioCtx()
  const now = ctx.currentTime
  const freq = jitter(frequency, 0.02)
  const dur = jitter(duration, 0.1)

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, now)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, now)
  gain.gain.linearRampToValueAtTime(0.0001, now + dur)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + dur)
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
  marimba: {
    click: () => playPluck(392, 0.14, 0.18),
    create: () => {
      playPluck(330, 0.16, 0.18)
      setTimeout(() => playPluck(440, 0.16, 0.18), 65)
    },
    delete: () => playPluck(220, 0.22, 0.18),
    complete: () => {
      playPluck(392, 0.16, 0.19)
      setTimeout(() => playPluck(494, 0.16, 0.19), 85)
      setTimeout(() => playPluck(587, 0.2, 0.19), 170)
    },
    move: () => {
      playPluck(349, 0.12, 0.16)
      setTimeout(() => playPluck(415, 0.14, 0.16), 50)
    },
    error: () => {
      playPluck(294, 0.16, 0.15)
      setTimeout(() => playPluck(247, 0.2, 0.15), 75)
    },
  },
  glass: {
    click: () => playBell(880, 0.18, 0.14),
    create: () => {
      playBell(660, 0.2, 0.14)
      setTimeout(() => playBell(990, 0.22, 0.14), 60)
    },
    delete: () => playBell(440, 0.3, 0.14),
    complete: () => {
      playBell(784, 0.2, 0.15)
      setTimeout(() => playBell(988, 0.22, 0.15), 80)
      setTimeout(() => playBell(1175, 0.28, 0.15), 160)
    },
    move: () => {
      playBell(660, 0.16, 0.13)
      setTimeout(() => playBell(770, 0.18, 0.13), 45)
    },
    error: () => {
      playBell(500, 0.2, 0.13)
      setTimeout(() => playBell(400, 0.26, 0.13), 70)
    },
  },
  analogSynth: {
    click: () => playSynth(220, 0.1, 0.15),
    create: () => {
      playSynth(196, 0.12, 0.15)
      setTimeout(() => playSynth(262, 0.12, 0.15), 60)
    },
    delete: () => playSynth(130, 0.2, 0.16),
    complete: () => {
      playSynth(220, 0.12, 0.16)
      setTimeout(() => playSynth(277, 0.12, 0.16), 80)
      setTimeout(() => playSynth(330, 0.18, 0.16), 160)
    },
    move: () => {
      playSynth(174, 0.09, 0.14)
      setTimeout(() => playSynth(220, 0.1, 0.14), 45)
    },
    error: () => {
      playSynth(165, 0.14, 0.15)
      setTimeout(() => playSynth(123, 0.18, 0.15), 70)
    },
  },
  typewriter: {
    click: () => playClack(2200, 0.05, 0.16),
    create: () => {
      playClack(2000, 0.05, 0.16)
      setTimeout(() => playClack(2400, 0.06, 0.16), 55)
    },
    delete: () => {
      playClack(1400, 0.08, 0.17)
      setTimeout(() => playClack(1000, 0.1, 0.17), 60)
    },
    complete: () => {
      // The carriage-return bell — a real bell tone, not a clack, for the one moment worth celebrating
      playBell(1400, 0.3, 0.16)
    },
    move: () => {
      playClack(1800, 0.05, 0.14)
      setTimeout(() => playClack(2100, 0.05, 0.14), 40)
    },
    error: () => {
      playClack(900, 0.09, 0.16)
      setTimeout(() => playClack(700, 0.12, 0.16), 55)
    },
  },
  nature: {
    click: () => playDrop(600, 0.12, 0.13),
    create: () => {
      playDrop(500, 0.14, 0.13)
      setTimeout(() => playDrop(700, 0.15, 0.13), 70)
    },
    delete: () => playDrop(300, 0.22, 0.13),
    complete: () => {
      playDrop(500, 0.14, 0.14)
      setTimeout(() => playDrop(650, 0.16, 0.14), 90)
      setTimeout(() => playDrop(800, 0.2, 0.14), 180)
    },
    move: () => {
      playDrop(450, 0.11, 0.12)
      setTimeout(() => playDrop(550, 0.12, 0.12), 55)
    },
    error: () => {
      playDrop(350, 0.16, 0.12)
      setTimeout(() => playDrop(280, 0.2, 0.12), 80)
    },
  },
  minimal: {
    click: () => playTick(1200, 0.03),
    create: () => {
      playTick(1000, 0.03)
      setTimeout(() => playTick(1400, 0.03), 45)
    },
    delete: () => playTick(600, 0.05),
    complete: () => {
      playTick(1200, 0.03)
      setTimeout(() => playTick(1500, 0.03), 60)
      setTimeout(() => playTick(1800, 0.04), 120)
    },
    move: () => {
      playTick(900, 0.03)
      setTimeout(() => playTick(1100, 0.03), 35)
    },
    error: () => {
      playTick(700, 0.04)
      setTimeout(() => playTick(550, 0.05), 50)
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
