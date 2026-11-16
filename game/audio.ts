/**
 * Dungeon audio. Music and impact SFX come from the CC0 Ninja Adventure pack;
 * footsteps, doors, and other small cues stay procedural so there is no load
 * cost. HTMLAudio playback that browsers block is retried on the first gesture.
 */

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let ambience: { stop: () => void } | null = null;
let stepFlip = false;
let muted = false;

export type MusicTrack = "dungeon" | "fight" | "crypt";

const MUSIC_FILES: Record<MusicTrack, string> = {
  dungeon: "/assets/ninja-adventure/audio/music/dungeon.m4a",
  fight: "/assets/ninja-adventure/audio/music/fight.m4a",
  crypt: "/assets/ninja-adventure/audio/music/crypt.m4a",
};

const SFX_FILES: Partial<Record<Sfx, { src: string; volume: number }>> = {
  hit: { src: "/assets/ninja-adventure/audio/sfx/slash.wav", volume: 0.5 },
  miss: { src: "/assets/ninja-adventure/audio/sfx/whoosh.wav", volume: 0.35 },
  hurt: { src: "/assets/ninja-adventure/audio/sfx/hurt.wav", volume: 0.55 },
  win: { src: "/assets/ninja-adventure/audio/sfx/win.wav", volume: 0.45 },
  lose: { src: "/assets/ninja-adventure/audio/sfx/lose.wav", volume: 0.45 },
  pickup: { src: "/assets/ninja-adventure/audio/sfx/pickup.wav", volume: 0.4 },
};

let music: HTMLAudioElement | null = null;
let musicTrack: MusicTrack | null = null;
let musicUnlockBound = false;

try {
  muted = typeof localStorage !== "undefined" && localStorage.getItem("sa-muted") === "1";
} catch { /* storage blocked */ }

function playAudioFile(src: string, volume: number, loop = false): boolean {
  if (typeof window === "undefined") return false;
  try {
    const element = new Audio(src);
    element.volume = volume;
    element.loop = loop;
    void element.play().catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** Dungeon score. A blocked play() is retried on the first user gesture. */
export function startMusic(track: MusicTrack): void {
  if (typeof window === "undefined") return;
  if (muted) return;
  if (musicTrack === track && music && !music.paused) return;
  stopMusic();
  const element = new Audio(MUSIC_FILES[track]);
  element.loop = true;
  element.volume = 0.28;
  music = element;
  musicTrack = track;
  void element.play().catch(() => {
    if (musicUnlockBound) return;
    musicUnlockBound = true;
    const unlock = () => {
      musicUnlockBound = false;
      if (music && !muted) void music.play().catch(() => undefined);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  });
}

export function stopMusic(): void {
  if (!music) return;
  music.pause();
  music.currentTime = 0;
  music = null;
  musicTrack = null;
}

export function currentMusic(): MusicTrack | null {
  return musicTrack;
}

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

export type Sfx =
  | "step" | "doorOpen" | "doorLocked" | "encounter" | "win" | "lose" | "hit" | "pickup"
  | "miss" | "hurt";

export function playSfx(name: Sfx): void {
  if (muted) return;
  const file = SFX_FILES[name];
  if (file && playAudioFile(file.src, file.volume)) return;
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
    case "hit": // sharp slash, then the body of the blow
      burst(c, t, 0.05, 0.16, 5200, "highpass");
      burst(c, t + 0.02, 0.14, 0.24, 1500, "bandpass");
      tone(c, 150, t + 0.02, 0.12, 0.09, "square");
      tone(c, 75, t + 0.03, 0.16, 0.09, "sine");
      break;
    case "miss": // blade through air
      burst(c, t, 0.14, 0.09, 2600, "highpass");
      break;
    case "hurt": // low thud + falling tone
      burst(c, t, 0.16, 0.22, 500);
      tone(c, 220, t, 0.18, 0.08, "sawtooth");
      tone(c, 110, t + 0.06, 0.22, 0.08, "triangle");
      break;
    case "pickup":
      [880, 1320].forEach((f, i) => tone(c, f, t + i * 0.06, 0.12, 0.045, "sine"));
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
  if (muted) {
    stopAmbience();
    stopMusic();
  } else {
    startAmbience();
  }
  return muted;
}
