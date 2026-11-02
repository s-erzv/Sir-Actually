/**
 * Procedural dungeon audio (WebAudio) — no sound files, so nothing to license or load.
 * The AudioContext is created lazily and resumed on the first call, which always
 * happens after a key press, satisfying browser autoplay rules.
 */

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let ambience: { stop: () => void } | null = null;
let stepFlip = false;
let muted = false;

try {
  muted = typeof localStorage !== "undefined" && localStorage.getItem("sa-muted") === "1";
} catch { /* storage blocked */ }

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

function tone(c: AudioContext, freq: number, start: number, dur: number, vol: number, type: OscillatorType = "square"): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function burst(c: AudioContext, start: number, dur: number, vol: number, freq: number, type: BiquadFilterType = "lowpass"): void {
  const src = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  src.buffer = noise(c);
  filter.type = type;
  filter.frequency.value = freq;
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(start, Math.random() * 0.5);
  src.stop(start + dur + 0.02);
}

export type Sfx = "step" | "doorOpen" | "doorLocked" | "encounter" | "win" | "lose" | "hit";

export function playSfx(name: Sfx): void {
  if (muted) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  switch (name) {
    case "step": // soft stone footfall, alternating pitch left/right
      stepFlip = !stepFlip;
      burst(c, t, 0.07, 0.16, stepFlip ? 520 : 420);
      tone(c, stepFlip ? 95 : 80, t, 0.06, 0.05, "sine");
      break;
    case "doorOpen": // grinding gate + rising chirp
      burst(c, t, 0.45, 0.14, 380);
      [440, 660, 880].forEach((f, i) => tone(c, f, t + 0.1 + i * 0.09, 0.14, 0.05));
      break;
    case "doorLocked": // dull clunk
      tone(c, 110, t, 0.12, 0.09, "triangle");
      burst(c, t, 0.08, 0.1, 900);
      break;
    case "encounter": // ominous sting
      tone(c, 196, t, 0.25, 0.06, "sawtooth");
      tone(c, 185, t + 0.12, 0.35, 0.06, "sawtooth");
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(c, f, t + i * 0.08, 0.16, 0.05));
      break;
    case "lose":
      [330, 247, 196].forEach((f, i) => tone(c, f, t + i * 0.12, 0.2, 0.05, "triangle"));
      break;
    case "hit":
      burst(c, t, 0.12, 0.2, 1800, "bandpass");
      tone(c, 140, t, 0.1, 0.07, "square");
      break;
  }
}

/** Low cave drone with slow wobble, plus an occasional distant drip. */
export function startAmbience(): void {
  if (ambience) return;
  const c = audio();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = muted ? 0 : 0.035;
  master.connect(c.destination);
  const oscs = [55, 82.4].map((f) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    osc.connect(master);
    osc.start();
    return osc;
  });
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = 0.015;
  lfo.connect(lfoGain).connect(master.gain);
  lfo.start();

  const drip = window.setInterval(() => {
    if (muted || !ctx) return;
    tone(ctx, 1400 + Math.random() * 600, ctx.currentTime, 0.09, 0.025, "sine");
  }, 5000 + Math.random() * 4000);

  ambience = {
    stop: () => {
      window.clearInterval(drip);
      oscs.forEach((o) => o.stop());
      lfo.stop();
      master.disconnect();
      ambience = null;
    },
  };
}

export function stopAmbience(): void {
  ambience?.stop();
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  try { localStorage.setItem("sa-muted", muted ? "1" : "0"); } catch { /* ignore */ }
  if (muted) stopAmbience();
  else startAmbience();
  return muted;
}
