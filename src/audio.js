// Звук: реалистичный синтез через Web Audio (шум, фильтры, реверберация)
// плюс свои записи. Если в public/sounds/<имя>.mp3 лежит настоящий звук,
// а в public/voices/<id>.mp3 — озвучка реплики, игра проиграет их вместо синтеза.
// Список найденных файлов собирается при сборке в manifest.json (см. scripts/prepare-assets.mjs).

let ctx = null;
let master = null;
let fxBus = null; // шина с реверберацией
let musicBus = null; // музыка (приглушается под голос)
let ambBus = null; // фон места: ветер, птицы, угли
let voiceBus = null;
let enabled = true;
const MASTER_GAIN = 0.6;
const MUSIC_GAIN = 0.32;
const NOISE = {}; // готовые буферы шума: генерировать их на каждый звук дорого
let manifest = { sounds: [], voices: [] };
const buffers = new Map(); // url -> AudioBuffer | null | Promise

function ensureContext() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return null;
  }
  master = ctx.createGain();
  master.gain.value = enabled ? MASTER_GAIN : 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  // Реверберация из сгенерированного импульса: «зал додзё».
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse(2.2, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  fxBus = ctx.createGain();
  fxBus.connect(master);
  fxBus.connect(convolver).connect(wet).connect(master);
  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.18;
  reverbSend.connect(convolver);
  musicBus = ctx.createGain();
  musicBus.gain.value = MUSIC_GAIN;
  musicBus.connect(master);
  musicBus.connect(reverbSend);
  ambBus = ctx.createGain();
  ambBus.gain.value = 0.22;
  ambBus.connect(master);
  voiceBus = ctx.createGain();
  voiceBus.gain.value = 1.25;
  voiceBus.connect(master);
  for (const color of ['white', 'brown', 'pink']) NOISE[color] = makeNoise(4, color);
  return ctx;
}

function makeNoise(seconds, color) {
  const len = Math.ceil(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else if (color === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    } else {
      d[i] = w;
    }
  }
  return buf;
}

/** Общий аудиограф для музыки и фона (см. music.js). null — звук ещё не разрешён. */
export function audioGraph() {
  if (!ctx || ctx.state !== 'running') return null;
  return { ctx, musicBus, ambBus, fxBus, master, noise: NOISE, enabled };
}

/** Приглушить музыку на время реплики, чтобы голос было слышно. */
export function duckMusic(seconds) {
  if (!ctx || !musicBus) return;
  const t = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setTargetAtTime(MUSIC_GAIN * 0.35, t, 0.08);
  musicBus.gain.setTargetAtTime(MUSIC_GAIN, t + seconds, 0.4);
}

function impulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function unlockAudio() {
  if (!ensureContext()) return;
  if (ctx.state === 'suspended') ctx.resume();
}

/** Браузер ещё не разрешил звук (нужен клик или клавиша на странице). */
export function audioLocked() {
  return !ctx || ctx.state !== 'running';
}

export function setSound(on) {
  enabled = on;
  if (ctx && master) master.gain.setTargetAtTime(on ? MASTER_GAIN : 0, ctx.currentTime, 0.05);
}

export function isSoundOn() {
  return enabled;
}

function ready() {
  return enabled && ctx && ctx.state === 'running';
}

// ---------- свои файлы ----------

/** Загружает manifest.json со списком записанных звуков и реплик. */
export async function loadAudioManifest() {
  try {
    const res = await fetch('./audio-manifest.json', { cache: 'no-cache' });
    if (res.ok) manifest = await res.json();
  } catch {
    /* нет манифеста — только синтез */
  }
  // Заранее подгружаем звуки и всю озвучку (~1.5 МБ), чтобы реплика звучала ровно в момент появления текста.
  for (const name of manifest.sounds ?? []) loadBuffer(`./sounds/${name}`);
  for (const name of manifest.voices ?? []) loadBuffer(`./voices/${name}`);
  return manifest;
}

export function hasVoice(id) {
  return (manifest.voices ?? []).some((f) => f.replace(/\.[a-z0-9]+$/i, '') === id);
}

function fileFor(list, base) {
  return (list ?? []).find((f) => f.replace(/\.[a-z0-9]+$/i, '') === base) ?? null;
}

function loadBuffer(url) {
  if (buffers.has(url)) return buffers.get(url);
  if (!ensureContext()) return Promise.resolve(null);
  const p = fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((ab) => (ab ? ctx.decodeAudioData(ab) : null))
    .catch(() => null)
    .then((buf) => {
      buffers.set(url, buf);
      return buf;
    });
  buffers.set(url, p);
  return p;
}

function playBuffer(buf, { gain = 1, reverb = false, bus = null } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(bus ?? (reverb ? fxBus : master));
  src.start();
  return buf.duration;
}

/** Проиграть записанный файл звука, если он есть. true — сыграли файл. */
function trySoundFile(name) {
  const file = fileFor(manifest.sounds, name);
  if (!file || !ready()) return false;
  const url = `./sounds/${file}`;
  const buf = buffers.get(url);
  if (buf && !(buf instanceof Promise)) {
    playBuffer(buf, { reverb: true });
    return true;
  }
  loadBuffer(url);
  return false;
}

let voiceSeq = 0;
let currentVoice = null;
/** Журнал запусков озвучки — для автотеста синхронизации. */
export const voiceLog = [];

/** Остановить звучащую реплику (мягко, без щелчка). */
export function stopVoice() {
  voiceSeq += 1;
  if (!currentVoice || !ctx) return;
  const { src, gain } = currentVoice;
  const t = ctx.currentTime;
  gain.gain.setTargetAtTime(0, t, 0.03);
  try {
    src.stop(t + 0.15);
  } catch {
    /* уже остановлена */
  }
  currentVoice = null;
}

/**
 * Озвучка реплики или выкрика. Предыдущая реплика обрывается, чтобы голоса не наслаивались.
 * Возвращает Promise с длительностью в секундах (0 — записи нет или её перебила более новая).
 */
export async function playVoice(id) {
  const file = fileFor(manifest.voices, id);
  if (!file || !enabled) return 0;
  if (!ensureContext()) return 0;
  stopVoice();
  const seq = voiceSeq;
  const buf = await loadBuffer(`./voices/${file}`);
  // пока файл грузился, началась другая реплика — эту уже не играем
  if (seq !== voiceSeq || !buf || !ready()) return 0;
  duckMusic(buf.duration + 0.2);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  src.connect(gain).connect(voiceBus);
  src.start();
  currentVoice = { src, gain };
  src.onended = () => {
    if (currentVoice?.src === src) currentVoice = null;
  };
  voiceLog.push({ id, at: performance.now(), dur: buf.duration });
  return buf.duration;
}

/** Заранее подгрузить озвучку (например, всех реплик сцены). */
export function preloadVoices(ids) {
  for (const id of ids) {
    const file = fileFor(manifest.voices, id);
    if (file) loadBuffer(`./voices/${file}`);
  }
}

// ---------- синтез ----------


function tone({ freq = 440, type = 'sine', dur = 0.15, gain = 0.5, slide = 0, delay = 0, bus = null, attack = 0.01 }) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(bus ?? fxBus);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise({ dur = 0.3, gain = 0.4, from = 2000, to = 300, type = 'bandpass', q = 1, delay = 0, color = 'white', attack = 0.005, bus = null }) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = NOISE[color] ?? NOISE.white;
  const offset = Math.random() * Math.max(0, src.buffer.duration - dur - 0.1);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(bus ?? fxBus);
  src.start(t, offset, dur + 0.05);
}

/** Треск огня: множество коротких щелчков. */
function crackle(dur, density = 40, gain = 0.25) {
  for (let i = 0; i < dur * density; i++) {
    noise({ dur: 0.02 + Math.random() * 0.03, gain: gain * Math.random(), from: 3000 + Math.random() * 3000, to: 1500, type: 'bandpass', q: 3, delay: Math.random() * dur });
  }
}

/** Раскат грома: низкий бурый шум с «волнами» громкости. */
function rumble(delay = 0, dur = 2.2, gain = 0.8) {
  for (let i = 0; i < 4; i++) {
    noise({ dur: dur * (0.5 + Math.random() * 0.5), gain: gain * (0.6 + Math.random() * 0.4), from: 180, to: 60, type: 'lowpass', color: 'brown', delay: delay + i * 0.18 + Math.random() * 0.1, attack: 0.05 });
  }
}

function whoosh(delay = 0, dur = 0.35, gain = 0.35, up = true) {
  noise({ dur, gain, from: up ? 400 : 3000, to: up ? 3500 : 300, type: 'bandpass', q: 1.5, delay, attack: dur * 0.4 });
}

const synth = {
  seal: () => {
    // деревянный щелчок + звон
    noise({ dur: 0.05, gain: 0.5, from: 2500, to: 1200, type: 'bandpass', q: 6 });
    tone({ freq: 1320, type: 'sine', dur: 0.25, gain: 0.18, delay: 0.02 });
    tone({ freq: 1980, type: 'sine', dur: 0.2, gain: 0.08, delay: 0.02 });
  },
  hint: () => tone({ freq: 240, type: 'triangle', dur: 0.2, gain: 0.12, slide: -60 }),
  cast: () => whoosh(0, 0.4, 0.4),
  fire: () => {
    whoosh(0, 0.3, 0.4);
    noise({ dur: 1.1, gain: 0.7, from: 900, to: 150, type: 'lowpass', color: 'brown', attack: 0.15 });
    noise({ dur: 0.9, gain: 0.3, from: 1800, to: 500, type: 'bandpass', attack: 0.1 });
    crackle(1.0, 45, 0.3);
    tone({ freq: 90, type: 'sine', dur: 0.6, gain: 0.35, slide: -40, delay: 0.5 });
  },
  lightning: () => {
    // треск разряда → удар → раскат
    noise({ dur: 0.35, gain: 0.3, from: 5000, to: 3000, type: 'highpass', delay: 0, attack: 0.2 });
    noise({ dur: 0.12, gain: 1.0, from: 8000, to: 1200, type: 'highpass', delay: 0.35, attack: 0.002 });
    noise({ dur: 0.25, gain: 0.9, from: 2500, to: 200, type: 'lowpass', delay: 0.36, attack: 0.002 });
    tone({ freq: 60, type: 'sine', dur: 0.5, gain: 0.6, slide: -25, delay: 0.36 });
    rumble(0.5, 2.4, 0.7);
  },
  shield: () => {
    // всплеск воды + звон купола
    noise({ dur: 0.5, gain: 0.45, from: 600, to: 2500, type: 'bandpass', q: 2, attack: 0.05 });
    noise({ dur: 0.35, gain: 0.3, from: 3000, to: 900, type: 'bandpass', q: 4, delay: 0.1 });
    [523, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.9, gain: 0.12, delay: 0.05 + i * 0.04 }));
  },
  sphere: () => {
    // нарастающий вихрь → взрыв
    const t0 = 0;
    tone({ freq: 120, type: 'sawtooth', dur: 0.9, gain: 0.15, slide: 700, delay: t0, attack: 0.5 });
    noise({ dur: 0.9, gain: 0.5, from: 300, to: 4000, type: 'bandpass', q: 2, delay: t0, attack: 0.6 });
    noise({ dur: 1.2, gain: 1.0, from: 1500, to: 60, type: 'lowpass', color: 'brown', delay: 0.9, attack: 0.005 });
    tone({ freq: 55, type: 'sine', dur: 1.0, gain: 0.7, slide: -25, delay: 0.9 });
    crackle(0.8, 30, 0.3);
  },
  hit: () => {
    noise({ dur: 0.25, gain: 0.9, from: 1200, to: 80, type: 'lowpass', attack: 0.002 });
    tone({ freq: 80, type: 'sine', dur: 0.35, gain: 0.7, slide: -45 });
  },
  hurt: () => {
    noise({ dur: 0.3, gain: 0.9, from: 900, to: 90, type: 'lowpass', attack: 0.002 });
    tone({ freq: 110, type: 'square', dur: 0.25, gain: 0.15, slide: -60 });
    tone({ freq: 60, type: 'sine', dur: 0.4, gain: 0.6, slide: -30 });
  },
  blocked: () => {
    noise({ dur: 0.08, gain: 0.6, from: 5000, to: 2000, type: 'bandpass', q: 3, attack: 0.002 });
    [1200, 1800, 2700].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.7, gain: 0.12 / (i + 1) }));
    noise({ dur: 0.4, gain: 0.3, from: 800, to: 2500, type: 'bandpass', q: 2, delay: 0.05 });
  },
  charge: () => {
    tone({ freq: 70, type: 'sawtooth', dur: 1.2, gain: 0.12, slide: 50, attack: 0.6 });
    noise({ dur: 1.2, gain: 0.2, from: 200, to: 800, type: 'bandpass', attack: 0.8 });
  },
  combo: (n = 2) => {
    const base = 520 * Math.pow(1.12, Math.min(8, n));
    [0, 4, 7, 12].forEach((st, i) => tone({ freq: base * Math.pow(2, st / 12), type: 'triangle', dur: 0.25, gain: 0.2, delay: i * 0.06 }));
  },
  smoke: () => {
    noise({ dur: 0.5, gain: 0.8, from: 700, to: 120, type: 'lowpass', attack: 0.005 });
    whoosh(0.05, 0.6, 0.25, false);
  },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.5, gain: 0.25, delay: i * 0.12 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.6, gain: 0.22, delay: i * 0.2 })),
  select: () => tone({ freq: 660, type: 'triangle', dur: 0.1, gain: 0.2 }),
  // печать текста в диалоге — тихий деревянный щелчок
  type: () => noise({ dur: 0.025, gain: 0.12, from: 2600 + Math.random() * 900, to: 1800, type: 'bandpass', q: 5 }),
  // перелистывание реплики — шорох бумаги
  page: () => noise({ dur: 0.18, gain: 0.25, from: 1500, to: 5000, type: 'bandpass', q: 0.8, attack: 0.04 }),
  countdown: (fight = false) => {
    if (fight) {
      taiko(0, 1.2);
      taiko(0.12, 1);
      tone({ freq: 196, type: 'triangle', dur: 1.4, gain: 0.25 });
      tone({ freq: 293, type: 'triangle', dur: 1.4, gain: 0.18 });
      noise({ dur: 1.2, gain: 0.25, from: 4000, to: 1500, type: 'bandpass', q: 3, attack: 0.005 });
    } else {
      taiko(0, 0.7);
      tone({ freq: 880, type: 'sine', dur: 0.12, gain: 0.12 });
    }
  },
  // большой удар барабана с гонгом — титры этапа
  title: () => {
    taiko(0, 1.3);
    taiko(0.18, 0.9);
    taiko(0.36, 1.4);
    [110, 164.8, 220].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 2.6, gain: 0.22 / (i + 1), delay: 0.36 }));
    noise({ dur: 2.2, gain: 0.3, from: 3000, to: 700, type: 'bandpass', q: 2, delay: 0.36, attack: 0.01 });
  },
  // выход врага: свист + удар
  enemy: () => {
    whoosh(0, 0.45, 0.4, false);
    taiko(0.4, 1.1);
    noise({ dur: 0.5, gain: 0.3, from: 400, to: 90, type: 'lowpass', delay: 0.4 });
  },
  stun: () => [1800, 2400, 2000, 2700].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.14, gain: 0.08, delay: i * 0.08, slide: -300 })),
  ultimate: () => {
    tone({ freq: 220, type: 'sawtooth', dur: 1.2, gain: 0.08, slide: 660, attack: 0.8 });
    [880, 1109, 1319, 1760].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.6, gain: 0.1, delay: 0.3 + i * 0.09 }));
    noise({ dur: 1.2, gain: 0.25, from: 500, to: 6000, type: 'bandpass', q: 1.5, attack: 0.9 });
  },
  // рёв главного злодея во второй фазе
  roar: () => {
    tone({ freq: 70, type: 'sawtooth', dur: 1.6, gain: 0.25, slide: -25, attack: 0.1 });
    tone({ freq: 104, type: 'square', dur: 1.4, gain: 0.08, slide: -40, attack: 0.1 });
    noise({ dur: 1.6, gain: 0.7, from: 700, to: 150, type: 'lowpass', color: 'brown', attack: 0.15 });
    rumble(0.3, 1.8, 0.5);
  },
  heartbeat: () => {
    tone({ freq: 55, type: 'sine', dur: 0.18, gain: 0.55, slide: -15 });
    tone({ freq: 50, type: 'sine', dur: 0.2, gain: 0.4, slide: -15, delay: 0.22 });
  },
  // удар по бамбуку: свист ладони + сухой треск дерева
  chop: (power = 1) => {
    whoosh(0, 0.18, 0.35, false);
    noise({ dur: 0.09, gain: 0.9 * power, from: 3200, to: 900, type: 'bandpass', q: 3, delay: 0.08, attack: 0.001 });
    noise({ dur: 0.25, gain: 0.6, from: 700, to: 150, type: 'lowpass', delay: 0.08, attack: 0.002 });
    tone({ freq: 190, type: 'triangle', dur: 0.18, gain: 0.3, slide: -80, delay: 0.08 });
    crackle(0.25, 40, 0.35);
  },
  chestBreak: () => {
    noise({ dur: 0.5, gain: 1, from: 2500, to: 200, type: 'lowpass', attack: 0.001 });
    crackle(0.6, 60, 0.4);
    taiko(0, 1.3);
    [659, 784, 988, 1319, 1568].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.6, gain: 0.16, delay: 0.25 + i * 0.08 }));
    noise({ dur: 1.4, gain: 0.25, from: 3000, to: 9000, type: 'bandpass', q: 2, delay: 0.25, attack: 0.3 });
  },
  wind: () => {
    whoosh(0, 0.3, 0.5, true);
    whoosh(0.16, 0.3, 0.5, true);
    noise({ dur: 0.15, gain: 0.7, from: 6000, to: 2000, type: 'highpass', delay: 0.42, attack: 0.002 });
    noise({ dur: 0.15, gain: 0.6, from: 6000, to: 2000, type: 'highpass', delay: 0.58, attack: 0.002 });
  },
  dragon: () => {
    tone({ freq: 90, type: 'sawtooth', dur: 0.9, gain: 0.25, slide: -40, attack: 0.3 });
    noise({ dur: 0.9, gain: 0.6, from: 300, to: 3000, type: 'bandpass', q: 1.5, attack: 0.7 });
    noise({ dur: 1.6, gain: 1.1, from: 1800, to: 60, type: 'lowpass', color: 'brown', delay: 0.85, attack: 0.003 });
    tone({ freq: 48, type: 'sine', dur: 1.2, gain: 0.8, slide: -20, delay: 0.85 });
    rumble(1, 2.4, 0.8);
    crackle(1, 40, 0.3);
  },
  success: () => [784, 988, 1175, 1568].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.35, gain: 0.14, delay: i * 0.07 })),
  draw: () => whoosh(0, 0.5, 0.2),
  hold: (p = 0) => tone({ freq: 440 * Math.pow(2, p), type: 'sine', dur: 0.08, gain: 0.06 }),
};

/** Японский барабан тайко: низкий «бум» с падением высоты и призвуком шкуры. */
function taiko(delay = 0, power = 1) {
  tone({ freq: 95, type: 'sine', dur: 0.55 * power, gain: 0.6 * Math.min(1.3, power), slide: -45, delay, attack: 0.004 });
  noise({ dur: 0.12, gain: 0.35 * power, from: 900, to: 200, type: 'lowpass', delay, attack: 0.002 });
}

/** Звуковые эффекты: сначала свой файл (sounds/<имя>.mp3), иначе синтез. */
export const sfx = new Proxy(synth, {
  get(target, name) {
    return (...args) => {
      if (!ready()) return;
      if (trySoundFile(String(name))) return;
      target[name]?.(...args);
    };
  },
});

export const SOUND_NAMES = Object.keys(synth);
