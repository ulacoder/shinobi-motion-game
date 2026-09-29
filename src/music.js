// Фоновая музыка и звуки места — всё синтезируется на лету, своих мелодий, без файлов.
// Японские лады (мияко-буси), кото, сякухати, барабаны тайко и сямисэн.
// Планировщик ставит ноты на 0.25 с вперёд, поэтому музыка не зависит от просадок FPS.

import { audioGraph } from './audio.js';

// Лад мияко-буси от ре: ре, ми-бемоль, соль, ля, си-бемоль.
const MIYAKO = [0, 1, 5, 7, 8];
const MAJOR_PENTA = [0, 2, 4, 7, 9];
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const scaleNote = (root, scale, degree) => {
  const oct = Math.floor(degree / scale.length);
  const i = ((degree % scale.length) + scale.length) % scale.length;
  return root + scale[i] + oct * 12;
};

/** Треки. root — тоника (MIDI), prog — ступени аккордов по тактам. */
const TRACKS = {
  calm: { bpm: 76, root: 50, scale: MIYAKO, prog: [0, 0, 3, 2], kind: 'calm', gain: 1.5 },
  scene: { bpm: 70, root: 50, scale: MIYAKO, prog: [0, 3, 2, 0], kind: 'calm', gain: 1 },
  sceneDark: { bpm: 66, root: 45, scale: MIYAKO, prog: [0, 1, 0, 3], kind: 'dark', gain: 1.1 },
  battle: { bpm: 150, root: 50, scale: MIYAKO, prog: [0, 0, 3, 2, 0, 0, 1, 3], kind: 'battle', gain: 1 },
  boss: { bpm: 164, root: 45, scale: MIYAKO, prog: [0, 1, 0, 3, 0, 1, 2, 3], kind: 'boss', gain: 0.85 },
  chest: { bpm: 120, root: 50, scale: MIYAKO, prog: [0, 3, 0, 2], kind: 'battle', gain: 0.75 },
  victory: { bpm: 108, root: 55, scale: MAJOR_PENTA, prog: [0, 3, 4, 0], kind: 'victory', gain: 0.9 },
  defeat: { bpm: 60, root: 45, scale: MIYAKO, prog: [0, 3, 1, 0], kind: 'dark', gain: 1.1 },
};

// Ритмы тайко на 16 шагов: X — сильный, x — слабый.
const TAIKO = {
  battle: 'X.xX..X.X.xX..x.',
  boss: 'X.xXx.X.XxxX.XxX',
  victory: 'X...X...X.X.X...',
};

class Music {
  constructor() {
    this.track = null;
    this.next = null;
    this.intensity = 1;
    this.step = 0;
    this.nextTime = 0;
    this.out = null;
    this.amb = null;
    this.place = null;
    this.timer = setInterval(() => this.tick(), 90);
  }

  /** Сменить трек плавным переходом. */
  play(name) {
    if (this.track?.name === name && !this.fading) return;
    this.next = name;
  }

  setIntensity(v) {
    this.intensity = v;
  }

  /** Звуки места: ветер, птицы, река, угли, сверчки. */
  setPlace(place) {
    this.place = place;
    this.ambDirty = true;
  }

  tick() {
    const g = audioGraph();
    if (!g) return;
    const { ctx } = g;
    if (this.next) this.switchTrack(g, this.next);
    if (this.ambDirty) this.switchAmbience(g);
    if (!this.track) return;
    const spb = 60 / this.track.def.bpm / 4; // длительность шестнадцатой
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.25) {
      this.playStep(g, this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step += 1;
    }
    this.ambientEvents(g);
  }

  switchTrack(g, name) {
    const { ctx, musicBus } = g;
    const t = ctx.currentTime;
    if (this.out) {
      const old = this.out;
      old.gain.setTargetAtTime(0, t, 0.35);
      setTimeout(() => old.disconnect(), 2500);
    }
    this.next = null;
    if (!name) {
      this.track = null;
      this.out = null;
      return;
    }
    const def = TRACKS[name];
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.setTargetAtTime(def.gain, t + 0.1, 0.5);
    this.out.connect(musicBus);
    this.track = { name, def };
    this.step = 0;
    this.nextTime = t + 0.12;
    this.startDrone(g, def);
  }

  /** Тянущийся фон: два расстроенных тона через фильтр с медленным «дыханием». */
  startDrone(g, def) {
    const { ctx } = g;
    const out = this.out;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = def.kind === 'boss' ? 500 : 700;
    f.Q.value = 2;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(f.frequency);
    const vol = ctx.createGain();
    vol.gain.value = def.kind === 'battle' ? 0.05 : def.kind === 'victory' ? 0.05 : def.kind === 'boss' ? 0.07 : 0.12;
    f.connect(vol).connect(out);
    const notes = [def.root - 12, def.root - 5];
    if (def.kind === 'boss' || def.kind === 'dark') notes.push(def.root - 11); // полутон сверху — тревожно
    const oscs = [lfo];
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n);
        o.detune.value = det;
        o.connect(f);
        oscs.push(o);
      }
    }
    const t = ctx.currentTime;
    oscs.forEach((o) => o.start(t));
    // Остановим вместе со сменой трека
    const stopWhen = out;
    const check = setInterval(() => {
      if (this.out !== stopWhen) {
        clearInterval(check);
        setTimeout(() => oscs.forEach((o) => o.stop()), 2000);
      }
    }, 500);
  }

  playStep(g, step, t, spb) {
    const def = this.track.def;
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const chord = def.prog[bar % def.prog.length];
    const note = (deg, oct = 0) => scaleNote(def.root + oct * 12, def.scale, chord + deg);
    const rnd = pseudo(step * 7 + bar * 13);

    if (def.kind === 'calm' || def.kind === 'dark') {
      // Кото: неторопливое арпеджио
      const arp = [0, 2, 4, 5, 4, 2];
      if (s16 % 4 === 0 || (s16 % 4 === 2 && rnd > 0.55)) {
        koto(g, this.out, hz(note(arp[(s16 / 2) % arp.length | 0], 1)), t, def.kind === 'dark' ? 0.2 : 0.26);
      }
      // Сякухати — фраза раз в 4 такта
      if (bar % 4 === 2 && (s16 === 0 || s16 === 6 || s16 === 10)) {
        const deg = [4, 5, 3][s16 === 0 ? 0 : s16 === 6 ? 1 : 2];
        flute(g, this.out, hz(note(deg, 1)), t, spb * (s16 === 10 ? 10 : 6), 0.16);
      }
      if (s16 === 0 && bar % 2 === 0) drum(g, this.out, t, 0.5, 70);
      return;
    }

    if (def.kind === 'victory') {
      if (s16 % 2 === 0) koto(g, this.out, hz(note([0, 2, 4, 2, 5, 4, 2, 4][s16 / 2], 1)), t, 0.14);
      if (TAIKO.victory[s16] === 'X') drum(g, this.out, t, 0.6, 85);
      if (s16 === 0 && bar % 2 === 0) flute(g, this.out, hz(note(4, 2)), t, spb * 12, 0.07);
      return;
    }

    // ЭПИЧНЫЙ БОЙ: ансамбль тайко, «трейлерный» бас, аккорды-удары, хор, тарелки и нарастания.
    const lvl = this.intensity; // 1 — начало боя, 2 — враг ранен, 3 — решающий момент
    const boss = def.kind === 'boss';
    const phrase = bar % 4; // фраза из 4 тактов
    const pattern = TAIKO[def.kind] ?? TAIKO.battle;
    const hit = pattern[s16];

    // тарелка и мощный удар в начале каждой фразы
    if (s16 === 0 && phrase === 0) {
      crash(g, this.out, t, 0.35);
      stab(g, this.out, [note(0, -1), note(2, -1), note(0, 0)].map(hz), t, spb * 6, 0.16);
      drum(g, this.out, t, 1, 55);
    }
    // бочка-«сердце» на каждую долю
    if (s16 % 4 === 0) sub(g, this.out, t, boss ? 0.5 : 0.42);
    // тайко по рисунку
    if (hit === 'X') drum(g, this.out, t, 0.75, boss ? 68 : 82);
    else if (hit === 'x') drum(g, this.out, t, 0.38, 105);
    // хлопок-«удар» на 2 и 4 долю
    if (s16 === 4 || s16 === 12) snare(g, this.out, t, 0.32);
    // хай-хэт шестнадцатыми на высокой напряжённости
    if (lvl >= 2 && s16 % 2 === 1) hat(g, this.out, t, 0.06 + 0.03 * lvl);
    if (s16 % 4 === 2) shime(g, this.out, t, 0.18 + 0.08 * lvl);

    // бас-остинато восьмыми: пульсирующий, как в трейлерах
    const bassRiff = boss ? [0, 0, 1, 0, 0, 3, 0, 1] : [0, 0, 0, 3, 0, 0, 4, 3];
    if (s16 % 2 === 0) sawBass(g, this.out, hz(note(bassRiff[s16 / 2], -1)), t, spb * 1.8, s16 % 4 === 0 ? 0.2 : 0.14);

    // сямисэн — быстрый рифф поверх
    const riff = boss ? [0, 1, 0, 3, 4, 3, 1, 0] : [4, 2, 3, 0, 4, 5, 3, 2];
    if (lvl >= 2 || s16 % 2 === 0) shamisen(g, this.out, hz(note(riff[(s16 / 2) % riff.length | 0], 1)), t, s16 % 4 === 0 ? 0.13 : 0.08);

    // аккорды-удары на акцентах
    if ((s16 === 10 && phrase % 2 === 1) || (s16 === 6 && phrase === 2)) {
      stab(g, this.out, [note(0, -1), note(2, -1), note(4, -1)].map(hz), t, spb * 3, 0.12);
    }
    // хор на длинных нотах (с середины боя или у босса)
    if ((lvl >= 2 || boss) && s16 === 0 && bar % 2 === 0) {
      choir(g, this.out, [note(0, 0), note(2, 0), note(4, 0)].map(hz), t, spb * 30, 0.05 + 0.02 * lvl);
    }
    // героическая мелодия флейты во 2–3 тактах фразы
    if (phrase === 1 || phrase === 2) {
      const motif = phrase === 1 ? { 0: 4, 4: 5, 6: 4, 8: 2, 12: 3 } : { 0: 5, 2: 6, 4: 5, 8: 4, 10: 2, 12: 4 };
      if (motif[s16] != null) flute(g, this.out, hz(note(motif[s16], 1)), t, spb * 3.5, 0.11);
    }
    // нарастание перед новой фразой и дробь тайко
    if (phrase === 3 && s16 === 8) riser(g, this.out, t, spb * 8, 0.12 + 0.04 * lvl);
    if (phrase === 3 && s16 >= 12) drum(g, this.out, t, 0.35 + (s16 - 12) * 0.12, 95);
    if (lvl >= 3 && phrase === 3 && s16 >= 8 && s16 < 12) drum(g, this.out, t, 0.3, 120);
  }

  switchAmbience(g) {
    this.ambDirty = false;
    const { ctx, ambBus, noise } = g;
    const t = ctx.currentTime;
    if (this.amb) {
      const old = this.amb;
      old.out.gain.setTargetAtTime(0, t, 0.5);
      setTimeout(() => old.srcs.forEach((s) => s.stop()), 3000);
    }
    const place = this.place ?? 'night';
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.setTargetAtTime(1, t, 0.8);
    out.connect(ambBus);
    const srcs = [];
    const layer = (color, type, freq, q, gain, lfoRate = 0.1, lfoDepth = 0) => {
      const src = ctx.createBufferSource();
      src.buffer = noise[color];
      src.loop = true;
      src.loopStart = Math.random();
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const gn = ctx.createGain();
      gn.gain.value = gain;
      if (lfoDepth) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = lfoRate;
        const d = ctx.createGain();
        d.gain.value = lfoDepth;
        lfo.connect(d).connect(gn.gain);
        lfo.start(t);
        srcs.push(lfo);
      }
      src.connect(f).connect(gn).connect(out);
      src.start(t, Math.random() * 3);
      srcs.push(src);
    };
    // ветер есть везде
    layer('pink', 'bandpass', place === 'eclipse' ? 300 : 500, 0.7, 0.35, 0.08, 0.2);
    if (place === 'bridge') layer('white', 'lowpass', 900, 0.5, 0.25, 0.3, 0.05); // река под мостом
    if (place === 'eclipse') layer('brown', 'lowpass', 120, 0.7, 0.8, 0.05, 0.3); // гул
    this.amb = { out, srcs, place, nextEvent: t + 1 };
  }

  /** Случайные события фона: птицы, сверчки, треск углей. */
  ambientEvents(g) {
    const a = this.amb;
    if (!a) return;
    const { ctx } = g;
    if (ctx.currentTime < a.nextEvent) return;
    const t = ctx.currentTime + 0.05;
    if (a.place === 'forest' || a.place === 'dawn' || a.place === 'bridge') {
      bird(g, a.out, t, a.place === 'dawn' ? 1.2 : 0.8);
      a.nextEvent = t + 1.5 + Math.random() * 3;
    } else if (a.place === 'eclipse') {
      for (let i = 0; i < 4; i++) crack(g, a.out, t + Math.random() * 0.6);
      a.nextEvent = t + 0.8 + Math.random() * 1.5;
    } else {
      cricket(g, a.out, t);
      a.nextEvent = t + 0.9 + Math.random() * 1.8;
    }
  }
}

// ---------- инструменты ----------

function env(g, node, t, peak, attack, decay) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function koto(g, out, f, t, vol) {
  const { ctx } = g;
  const v = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(4000, t);
  lp.frequency.exponentialRampToValueAtTime(900, t + 0.6);
  for (const [mul, type, amp] of [[1, 'triangle', 1], [2, 'sine', 0.4], [3.01, 'sine', 0.15]]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f * mul * 1.01, t);
    o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.05); // «подтяжка» струны
    const a = ctx.createGain();
    a.gain.value = amp;
    o.connect(a).connect(lp);
    o.start(t);
    o.stop(t + 1.6);
  }
  lp.connect(v).connect(out);
  env(g, v, t, vol, 0.004, 1.4);
}

function shamisen(g, out, f, t, vol) {
  const { ctx } = g;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = f;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(f * 5, t);
  bp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.2);
  bp.Q.value = 3;
  const v = ctx.createGain();
  o.connect(bp).connect(v).connect(out);
  env(g, v, t, vol, 0.002, 0.22);
  o.start(t);
  o.stop(t + 0.3);
}

function bass(g, out, f, t, dur) {
  const { ctx } = g;
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = f;
  const v = ctx.createGain();
  o.connect(v).connect(out);
  env(g, v, t, 0.22, 0.01, dur);
  o.start(t);
  o.stop(t + dur + 0.1);
}

function flute(g, out, f, t, dur, vol) {
  const { ctx, noise } = g;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f * 0.97, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.12); // мягкий подъезд к ноте, как у сякухати
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.2;
  const vibD = ctx.createGain();
  vibD.gain.setValueAtTime(0, t);
  vibD.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.5);
  vib.connect(vibD).connect(o.frequency);
  const v = ctx.createGain();
  v.gain.setValueAtTime(0.0001, t);
  v.gain.exponentialRampToValueAtTime(vol, t + 0.15);
  v.gain.setValueAtTime(vol, t + dur * 0.7);
  v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(v).connect(out);
  // дыхание
  const br = ctx.createBufferSource();
  br.buffer = noise.white;
  const bf = ctx.createBiquadFilter();
  bf.type = 'bandpass';
  bf.frequency.value = f * 2;
  bf.Q.value = 2;
  const bv = ctx.createGain();
  bv.gain.setValueAtTime(0.0001, t);
  bv.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.08);
  bv.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  br.connect(bf).connect(bv).connect(out);
  [o, vib].forEach((x) => (x.start(t), x.stop(t + dur + 0.05)));
  br.start(t, Math.random() * 2, dur + 0.05);
}

function drum(g, out, t, vol, f0) {
  const { ctx, noise } = g;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 0.35);
  const v = ctx.createGain();
  o.connect(v).connect(out);
  env(g, v, t, vol, 0.003, 0.45);
  o.start(t);
  o.stop(t + 0.5);
  const n = ctx.createBufferSource();
  n.buffer = noise.white;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  const nv = ctx.createGain();
  n.connect(lp).connect(nv).connect(out);
  env(g, nv, t, vol * 0.35, 0.002, 0.08);
  n.start(t, Math.random() * 3, 0.12);
}

/** Низкая «бочка»: удар в грудь. */
function sub(g, out, t, vol) {
  const { ctx } = g;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const v = ctx.createGain();
  o.connect(v).connect(out);
  env(g, v, t, vol, 0.002, 0.28);
  o.start(t);
  o.stop(t + 0.32);
}

/** Хлопок-удар (как большой клэп с залом). */
function snare(g, out, t, vol) {
  const { ctx, noise } = g;
  const n = ctx.createBufferSource();
  n.buffer = noise.white;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1600;
  bp.Q.value = 0.8;
  const v = ctx.createGain();
  n.connect(bp).connect(v).connect(out);
  env(g, v, t, vol, 0.002, 0.22);
  n.start(t, Math.random() * 3, 0.26);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
  const ov = ctx.createGain();
  o.connect(ov).connect(out);
  env(g, ov, t, vol * 0.5, 0.002, 0.1);
  o.start(t);
  o.stop(t + 0.12);
}

function hat(g, out, t, vol) {
  const { ctx, noise } = g;
  const n = ctx.createBufferSource();
  n.buffer = noise.white;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const v = ctx.createGain();
  n.connect(hp).connect(v).connect(out);
  env(g, v, t, vol, 0.001, 0.04);
  n.start(t, Math.random() * 3, 0.06);
}

function crash(g, out, t, vol) {
  const { ctx, noise } = g;
  const n = ctx.createBufferSource();
  n.buffer = noise.white;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4500;
  const v = ctx.createGain();
  n.connect(hp).connect(v).connect(out);
  env(g, v, t, vol, 0.003, 1.6);
  n.start(t, Math.random() * 2, 1.7);
}

/** Шумовое нарастание перед новой фразой. */
function riser(g, out, t, dur, vol) {
  const { ctx, noise } = g;
  const n = ctx.createBufferSource();
  n.buffer = noise.white;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 2;
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
  const v = ctx.createGain();
  v.gain.setValueAtTime(0.0001, t);
  v.gain.exponentialRampToValueAtTime(vol, t + dur * 0.95);
  v.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  n.connect(bp).connect(v).connect(out);
  n.start(t, Math.random(), dur + 0.1);
}

/** Пульсирующий бас из двух расстроенных «пил». */
function sawBass(g, out, f, t, dur, vol) {
  const { ctx } = g;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 4;
  lp.frequency.setValueAtTime(1400, t);
  lp.frequency.exponentialRampToValueAtTime(220, t + dur);
  const v = ctx.createGain();
  lp.connect(v).connect(out);
  env(g, v, t, vol, 0.004, dur);
  for (const det of [-8, 8]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = det;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

/** Аккорд-удар «медью»: резкая атака и спад. */
function stab(g, out, freqs, t, dur, vol) {
  const { ctx } = g;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3200, t);
  lp.frequency.exponentialRampToValueAtTime(600, t + dur);
  const v = ctx.createGain();
  lp.connect(v).connect(out);
  env(g, v, t, vol, 0.01, dur);
  for (const f of freqs) {
    for (const det of [-10, 0, 10]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}

/** Хор «а-а»: аккорд через фильтры гласной. */
function choir(g, out, freqs, t, dur, vol) {
  const { ctx } = g;
  const v = ctx.createGain();
  v.gain.setValueAtTime(0.0001, t);
  v.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
  v.gain.setValueAtTime(vol, t + dur * 0.7);
  v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  v.connect(out);
  const formants = [[700, 1], [1150, 0.6], [2600, 0.25]];
  const mix = ctx.createGain();
  for (const [ff, amp] of formants) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = ff;
    bp.Q.value = 6;
    const a = ctx.createGain();
    a.gain.value = amp * 3;
    mix.connect(bp).connect(a).connect(v);
  }
  for (const f of freqs) {
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(mix);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}

function shime(g, out, t, vol) {
  const { ctx, noise } = g;
  const n = ctx.createBufferSource();
  n.buffer = noise.white;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 3;
  const v = ctx.createGain();
  n.connect(bp).connect(v).connect(out);
  env(g, v, t, vol, 0.001, 0.06);
  n.start(t, Math.random() * 3, 0.08);
  const o = ctx.createOscillator();
  o.frequency.value = 420;
  const ov = ctx.createGain();
  o.connect(ov).connect(out);
  env(g, ov, t, vol * 0.4, 0.001, 0.08);
  o.start(t);
  o.stop(t + 0.1);
}

function bird(g, out, t, vol) {
  const { ctx } = g;
  const notes = 2 + Math.floor(Math.random() * 4);
  const base = 2600 + Math.random() * 1600;
  for (let i = 0; i < notes; i++) {
    const s = t + i * (0.09 + Math.random() * 0.05);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * (1 + Math.random() * 0.2), s);
    o.frequency.exponentialRampToValueAtTime(base * (0.8 + Math.random() * 0.6), s + 0.07);
    const v = ctx.createGain();
    o.connect(v).connect(out);
    env(g, v, s, 0.05 * vol, 0.01, 0.07);
    o.start(s);
    o.stop(s + 0.1);
  }
}

function cricket(g, out, t) {
  const { ctx } = g;
  for (let i = 0; i < 3; i++) {
    const s = t + i * 0.06;
    const o = ctx.createOscillator();
    o.frequency.value = 4400;
    const v = ctx.createGain();
    o.connect(v).connect(out);
    env(g, v, s, 0.025, 0.005, 0.035);
    o.start(s);
    o.stop(s + 0.05);
  }
}

function crack(g, out, t) {
  const { ctx, noise } = g;
  const n = ctx.createBufferSource();
  n.buffer = noise.white;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2500 + Math.random() * 2500;
  bp.Q.value = 4;
  const v = ctx.createGain();
  n.connect(bp).connect(v).connect(out);
  env(g, v, t, 0.1 + Math.random() * 0.15, 0.001, 0.03);
  n.start(t, Math.random() * 3, 0.05);
}

/** Детерминированное «случайное» число для шага, чтобы вариации повторялись в такт. */
function pseudo(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export const music = new Music();
