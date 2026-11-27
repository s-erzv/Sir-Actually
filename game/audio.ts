/**
 * Game audio: two groups the player controls (music, sfx) plus mute.
 *
 * Music and file SFX come from the CC0 Ninja Adventure pack. Footsteps, doors
 * and other tiny cues stay procedural so there is no load cost. Slider values
 * are 0..1 and are squared before they become gain, so the whole travel is
 * audible. Browsers block playback until a gesture; blocked music is retried on
 * the first pointer or key press.
 */

export type MusicTrack =
  | "title"
  | "camp"
  | "dungeon"
  | "crypt"
  | "fight"
  | "boss"
  | "victory";

export type Sfx =
  | "step" | "doorOpen" | "doorLocked" | "encounter" | "win" | "lose" | "hit" | "pickup"
  | "miss" | "hurt"
  | "uiAccept" | "uiCancel" | "uiMove" | "uiOpen"
  | "coin" | "powerup" | "levelup" | "victory" | "gameover" | "alert";

export interface AudioSettings {
  music: number;
  sfx: number;
  muted: boolean;
}

const BASE = "/assets/ninja-adventure/audio";

/** Ogg first; m4a only where a transcode exists (older Safari). */
const MUSIC_FILES: Record<MusicTrack, { ogg: string; m4a: string; gain: number }> = {
  title: { ogg: `${BASE}/music/title.ogg`, m4a: `${BASE}/music/dungeon.m4a`, gain: 0.55 },
  camp: { ogg: `${BASE}/music/camp.ogg`, m4a: `${BASE}/music/dungeon.m4a`, gain: 0.5 },
  dungeon: { ogg: `${BASE}/music/dungeon.ogg`, m4a: `${BASE}/music/dungeon.m4a`, gain: 0.45 },
  crypt: { ogg: `${BASE}/music/crypt.ogg`, m4a: `${BASE}/music/crypt.m4a`, gain: 0.45 },
  fight: { ogg: `${BASE}/music/fight.ogg`, m4a: `${BASE}/music/fight.m4a`, gain: 0.45 },
  boss: { ogg: `${BASE}/music/boss.ogg`, m4a: `${BASE}/music/fight.m4a`, gain: 0.5 },
  victory: { ogg: `${BASE}/music/victory.ogg`, m4a: `${BASE}/music/dungeon.m4a`, gain: 0.5 },
};

const SFX_FILES: Partial<Record<Sfx, { src: string; volume: number }>> = {
  hit: { src: `${BASE}/sfx/slash.wav`, volume: 0.5 },
  miss: { src: `${BASE}/sfx/whoosh.wav`, volume: 0.35 },
  hurt: { src: `${BASE}/sfx/hurt.wav`, volume: 0.55 },
  win: { src: `${BASE}/sfx/win.wav`, volume: 0.45 },
  lose: { src: `${BASE}/sfx/lose.wav`, volume: 0.45 },
  pickup: { src: `${BASE}/sfx/pickup.wav`, volume: 0.4 },
  uiAccept: { src: `${BASE}/sfx/ui-accept.wav`, volume: 0.45 },
  uiCancel: { src: `${BASE}/sfx/ui-cancel.wav`, volume: 0.45 },
  uiMove: { src: `${BASE}/sfx/ui-move.wav`, volume: 0.3 },
  uiOpen: { src: `${BASE}/sfx/ui-open.wav`, volume: 0.4 },
  coin: { src: `${BASE}/sfx/coin.wav`, volume: 0.45 },
  powerup: { src: `${BASE}/sfx/powerup.wav`, volume: 0.45 },
  levelup: { src: `${BASE}/sfx/jingle-levelup.wav`, volume: 0.5 },
  victory: { src: `${BASE}/sfx/jingle-victory.wav`, volume: 0.5 },
  gameover: { src: `${BASE}/sfx/jingle-gameover.wav`, volume: 0.5 },
  alert: { src: `${BASE}/sfx/alert.wav`, volume: 0.4 },
};

const STORAGE_KEY = "sa-audio";
const DEFAULTS: AudioSettings = { music: 0.6, sfx: 0.8, muted: false };

let settings: AudioSettings = { ...DEFAULTS };
const listeners = new Set<(value: AudioSettings) => void>();

try {
  if (typeof localStorage !== "undefined") {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<AudioSettings> | null;
    if (saved) settings = { ...DEFAULTS, ...saved };
    else if (localStorage.getItem("sa-muted") === "1") settings.muted = true;
  }
} catch {
  /* storage blocked or corrupt: keep defaults */
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** Slider 0..1 to linear gain; 0 or muted is silence. */
function groupGain(group: "music" | "sfx"): number {
  if (settings.muted) return 0;
  const value = clamp01(settings[group]);
  return value * value;
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  const snapshot = { ...settings };
  listeners.forEach((listener) => listener(snapshot));
}

export function getAudioSettings(): AudioSettings {
  return { ...settings };
}

export function subscribeAudio(listener: (value: AudioSettings) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setMusicVolume(value: number): void {
  settings = { ...settings, music: clamp01(value) };
  applyMusicVolume();
  ensureMusicPlaying();
  if (ambienceGain) ambienceGain.gain.value = groupGain("music") * 0.06;
  save();
}

export function setSfxVolume(value: number): void {
  settings = { ...settings, sfx: clamp01(value) };
  if (sfxBus) sfxBus.gain.value = groupGain("sfx");
  save();
}

export function setMuted(next: boolean): void {
  settings = { ...settings, muted: next };
  applyMusicVolume();
  if (sfxBus) sfxBus.gain.value = groupGain("sfx");
  if (ambienceGain) ambienceGain.gain.value = groupGain("music") * 0.06;
  ensureMusicPlaying();
  save();
}

export function isMuted(): boolean {
  return settings.muted;
}

export function toggleMute(): boolean {
  setMuted(!settings.muted);
  return settings.muted;
}

// ---------------------------------------------------------------------------
// Music
// ---------------------------------------------------------------------------

let music: HTMLAudioElement | null = null;
let musicTrack: MusicTrack | null = null;
let fadeTimer: number | null = null;
let unlockBound = false;
let oggSupport: boolean | null = null;

function canPlayOgg(): boolean {
  if (oggSupport === null) {
    try {
      oggSupport = new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== "";
    } catch {
      oggSupport = false;
    }
  }
  return oggSupport;
}

function trackVolume(track: MusicTrack): number {
  return MUSIC_FILES[track].gain * groupGain("music");
}

function applyMusicVolume(): void {
  if (music && musicTrack) music.volume = trackVolume(musicTrack);
}

function bindUnlock(): void {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const unlock = () => {
    unlockBound = false;
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    void audioContext()?.resume().catch(() => undefined);
    if (music && music.paused && groupGain("music") > 0) void music.play().catch(() => undefined);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

function ensureMusicPlaying(): void {
  if (!music) return;
  if (groupGain("music") === 0) {
    music.pause();
    return;
  }
  if (music.paused) void music.play().catch(() => bindUnlock());
}

/** Switch the score. The same track keeps playing; a new one fades in. */
export function startMusic(track: MusicTrack): void {
  if (typeof window === "undefined") return;
  if (musicTrack === track && music) {
    ensureMusicPlaying();
    return;
  }
  stopMusic();
  const file = MUSIC_FILES[track];
  const element = new Audio(canPlayOgg() ? file.ogg : file.m4a);
  element.loop = true;
  element.preload = "auto";
  element.volume = 0;
  music = element;
  musicTrack = track;
  if (groupGain("music") === 0) return;
  // Short fade-in so a track change never pops.
  let step = 0;
  fadeTimer = window.setInterval(() => {
    step += 1;
    if (music !== element) return;
    element.volume = Math.min(trackVolume(track), (trackVolume(track) * step) / 8);
    if (step >= 8 && fadeTimer !== null) {
      window.clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }, 40);
  void element.play().catch(() => bindUnlock());
}

export function stopMusic(): void {
  if (fadeTimer !== null) {
    window.clearInterval(fadeTimer);
    fadeTimer = null;
  }
  if (!music) return;
  music.pause();
  music.removeAttribute("src");
  music = null;
  musicTrack = null;
}

export function currentMusic(): MusicTrack | null {
  return musicTrack;
}

// ---------------------------------------------------------------------------
// SFX: decoded buffers through one gain node (low latency, overlap-safe)
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
const buffers = new Map<string, AudioBuffer | "loading" | "failed">();
let stepFlip = false;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioContext();
      sfxBus = ctx.createGain();
      sfxBus.gain.value = groupGain("sfx");
      sfxBus.connect(ctx.destination);
      noiseBuffer = null;
      buffers.clear();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

function loadBuffer(c: AudioContext, src: string): void {
  if (buffers.has(src)) return;
  buffers.set(src, "loading");
  fetch(src)
    .then((response) => response.arrayBuffer())
    .then((data) => c.decodeAudioData(data))
    .then((buffer) => buffers.set(src, buffer))
    .catch(() => buffers.set(src, "failed"));
}

/** Fetch and decode file SFX ahead of the first click. */
export function preloadSfx(): void {
  const c = audioContext();
  if (!c) return;
  Object.values(SFX_FILES).forEach((file) => {
    if (file) loadBuffer(c, file.src);
  });
}

function playFile(file: { src: string; volume: number }): boolean {
  const c = audioContext();
  if (!c || !sfxBus) return false;
  const buffer = buffers.get(file.src);
  if (buffer instanceof AudioBuffer) {
    const source = c.createBufferSource();
    const gain = c.createGain();
    source.buffer = buffer;
    gain.gain.value = file.volume;
    source.connect(gain).connect(sfxBus);
    source.start();
    return true;
  }
  if (buffer === undefined) loadBuffer(c, file.src);
  // Not decoded yet: a one-off element so the first click still sounds.
  try {
    const element = new Audio(file.src);
    element.volume = file.volume * groupGain("sfx");
    void element.play().catch(() => undefined);
    return true;
  } catch {
    return false;
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
  if (!sfxBus) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(sfxBus);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function burst(c: AudioContext, start: number, dur: number, vol: number, freq: number, type: BiquadFilterType = "lowpass"): void {
  if (!sfxBus) return;
  const src = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  src.buffer = noise(c);
  filter.type = type;
  filter.frequency.value = freq;
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(gain).connect(sfxBus);
  src.start(start, Math.random() * 0.5);
  src.stop(start + dur + 0.02);
}

export function playSfx(name: Sfx): void {
  if (groupGain("sfx") === 0) return;
  const file = SFX_FILES[name];
  if (file && playFile(file)) return;
  const c = audioContext();
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
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Ambience: low cave drone under the dungeon music (music group)
// ---------------------------------------------------------------------------

let ambience: { stop: () => void } | null = null;
let ambienceGain: GainNode | null = null;

export function startAmbience(): void {
  if (ambience) return;
  const c = audioContext();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = groupGain("music") * 0.06;
  master.connect(c.destination);
  ambienceGain = master;
  const oscs = [55, 82.4].map((f) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    osc.connect(master);
    osc.start();
    return osc;
  });
  const drip = window.setInterval(() => {
    if (!ctx || groupGain("sfx") === 0) return;
    tone(ctx, 1400 + Math.random() * 600, ctx.currentTime, 0.09, 0.025, "sine");
  }, 5000 + Math.random() * 4000);

  ambience = {
    stop: () => {
      window.clearInterval(drip);
      oscs.forEach((o) => o.stop());
      master.disconnect();
      ambience = null;
      ambienceGain = null;
    },
  };
}

export function stopAmbience(): void {
  ambience?.stop();
}
