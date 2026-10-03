// Сцена боя в аниме-стиле: фон этапа, враг, эффекты техник,
// линии скорости, кадры удара, японские звуковые надписи, дым.

import { drawCharacter } from './characters.js';
import { drawHeroHands } from './herohands.js';
import { effects } from './fx-effects.js';
import { chestFx } from './fx-chest.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

const PLACES = {
  night: { sky: ['#0f1030', '#1f2250', '#2b2f6a'], hills: ['#191b44', '#121331'], ground: '#0d0e24', orb: { color: '#efe6cf', x: 0.82, y: 0.2 } },
  forest: { sky: ['#12302e', '#2d5a4a', '#e0915a'], hills: ['#173a33', '#0e2622'], ground: '#0a1a17', trees: true, leaves: '#7fbf6a' },
  bridge: { sky: ['#3a1f4f', '#b84a5a', '#f2a55a'], hills: ['#4a2440', '#2a1430'], ground: '#1a0e1c', bridge: true, orb: { color: '#ffd9a0', x: 0.25, y: 0.32 }, leaves: '#f2b0c0' },
  eclipse: { sky: ['#12030a', '#4a0f1e', '#8a1f2a'], hills: ['#2a0a14', '#16050c'], ground: '#0c0306', eclipse: true, embers: true },
  dawn: { sky: ['#f7c59f', '#f0a6a0', '#9a8ac9'], hills: ['#7a6aa0', '#5a4a80'], ground: '#3a2e55', orb: { color: '#fff1c8', x: 0.5, y: 0.62 } },
};


export class Arena {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.bolts = [];
    this.texts = [];
    this.rings = [];
    this.stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.4 + 0.3, p: Math.random() * TAU }));
    this.floaters = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), s: rand(4, 9), v: rand(0.02, 0.06), p: Math.random() * TAU }));
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '255,255,255';
    this.enemyFlash = 0;
    this.speedLines = 0;
    this.impactFrame = 0;
    this.time = 0;
    this.place = 'night';
    this.enemy = null; // { look, tint, state, charge, phase2, dead, enter }
    this.shield = 0;
    // руки героя (вид от первого лица): { hands: [[21 точка]], glow } — их ставит экран боя/сцены
    this.heroHands = null;
    this.heroAlpha = 0;
    this.lastHeroHands = [];
    this.reduceMotion = matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // Качество подстраивается под мощность устройства: 2 — полное, 1 — среднее, 0 — экономное.
    this.quality = 2;
    this.frameTimes = [];
    this.bgCache = null;
    this.enemyCache = null;
    this.sprites = makeSprites();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  get dpr() {
    const base = Math.min(devicePixelRatio || 1, 1.5);
    return base * [0.6, 0.8, 1][this.quality];
  }

  resize() {
    const dpr = this.dpr;
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.bgCache = null;
    this.enemyCache = null;
  }

  /** Следит за временем кадра и понижает/повышает качество, чтобы игра не лагала. */
  adapt(dt) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p80 = sorted[Math.floor(sorted.length * 0.8)];
    this.frameTimes.length = 0;
    const was = this.quality;
    if (p80 > 1 / 42 && this.quality > 0) this.quality -= 1;
    else if (p80 < 1 / 58 && this.quality < 2) this.quality += 1;
    if (this.quality !== was) this.resize();
  }

  setPlace(place) {
    const next = PLACES[place] ? place : 'night';
    if (next !== this.place) this.bgCache = null;
    this.place = next;
  }

  /** Новый враг выходит на сцену. */
  showEnemy(enemy) {
    this.enemy = enemy ? { look: enemy.look, tint: enemy.tint, state: 'idle', charge: 0, phase2: false, dead: 0, enter: 0 } : null;
  }

  get enemyPos() {
    const narrow = this.w < 820 || this.w < this.h;
    return { x: this.w * 0.5, y: this.h * (narrow ? 0.3 : 0.4), s: Math.min(this.w, this.h) / 900 };
  }

  get playerPos() {
    // техники вылетают из рук героя, когда они на экране
    if (this.heroAlpha > 0.5) {
      const narrow = this.w < 820 || this.w < this.h;
      return narrow ? { x: this.w * 0.5, y: this.h * 0.78 } : { x: this.w * 0.6, y: this.h * 0.78 };
    }
    return { x: this.w * 0.22, y: this.h * 0.95 };
  }

  // ---------- кадр ----------

  frame(dt) {
    this.adapt(dt);
    this.time += dt;
    // Ограничиваем число частиц: при просадке FPS старые искры просто пропадают.
    const cap = [160, 320, 600][this.quality];
    if (this.particles.length > cap) {
      const timers = this.particles.filter((p) => p.kind === 'timer');
      this.particles = [...timers, ...this.particles.filter((p) => p.kind !== 'timer').slice(-cap)];
    }
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.save();
    if (this.shake > 0.3) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
      this.shake *= Math.pow(0.02, dt);
    }
    this.drawBackground(dt);
    if (this.enemy) this.drawEnemy(dt);
    if (this.chest) this.drawChest(dt);
    this.drawShield();
    this.drawHero(dt);
    this.drawParticles(dt);
    this.drawBolts(dt);
    this.drawRings(dt);
    this.drawSpeedLines(dt);
    this.drawTexts(dt);
    ctx.restore();

    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.35})`;
      ctx.fillRect(0, 0, w, h);
      this.flash *= Math.pow(0.01, dt);
    }
    // «Кадр удара» как в аниме: на мгновение всё становится чёрно-белым негативом
    if (this.impactFrame > 0 && this.reduceMotion) this.impactFrame = 0;
    if (this.impactFrame > 0) {
      ctx.save();
      if (this.quality > 0) {
        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
      }
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      this.impactFrame -= dt;
    }
  }

  /** Руки героя повторяют пальцы игрока: появляются снизу, когда руки в кадре, и светятся при печати. */
  drawHero(dt) {
    const want = this.heroHands?.hands?.length ? 1 : 0;
    if (want) this.lastHeroHands = this.heroHands.hands;
    this.heroAlpha += (want - this.heroAlpha) * Math.min(1, dt * 8);
    if (this.heroAlpha < 0.02 || !this.lastHeroHands.length) return;
    const { w, h } = this;
    const narrow = w < 820 || w < h;
    // в бою — снизу, от первого лица; в сюжетной сцене — над манга-пузырём
    const inScene = this.heroHands?.place === 'scene' || (!want && this.heroPlace === 'scene');
    if (want) this.heroPlace = this.heroHands.place;
    const box = inScene
      ? narrow
        ? { x: w * 0.2, y: h * 0.14, w: w * 0.6, h: h * 0.26 }
        : { x: w * 0.3, y: h * 0.06, w: w * 0.4, h: h * 0.34 }
      : narrow
        ? { x: w * 0.46, y: h * 0.46, w: w * 0.5, h: h * 0.22 } // телефон: справа от камеры, над полосой техник
        : { x: w * 0.42, y: h * 0.6, w: w * 0.36, h: h * 0.4 };
    // при появлении руки «поднимаются» снизу
    box.y += (1 - this.heroAlpha) * box.h * 0.5;
    drawHeroHands(this.ctx, this.lastHeroHands, box, { glow: this.heroHands?.glow ?? null, alpha: this.heroAlpha });
  }

  /** Статичная часть фона (небо, горы, деревья, мост) рисуется один раз в отдельный холст. */
  buildBackground() {
    const dpr = this.dpr;
    const c = document.createElement('canvas');
    c.width = Math.round((this.w + 40) * dpr);
    c.height = Math.round((this.h + 40) * dpr);
    const real = this.ctx;
    this.ctx = c.getContext('2d');
    this.ctx.setTransform(dpr, 0, 0, dpr, 20 * dpr, 20 * dpr);
    this.paintStatic();
    this.ctx = real;
    this.bgCache = c;
  }

  drawBackground(dt) {
    const { ctx, w, h } = this;
    const P = PLACES[this.place];
    if (!this.bgCache) this.buildBackground();
    ctx.drawImage(this.bgCache, -20, -20, w + 40, h + 40);

    if (this.place === 'night' || this.place === 'eclipse') {
      const step = this.quality === 0 ? 3 : 1;
      for (let i = 0; i < this.stars.length; i += step) {
        const s = this.stars[i];
        const a = 0.35 + 0.35 * Math.sin(this.time * 1.3 + s.p);
        ctx.fillStyle = `rgba(239,230,207,${a * (this.place === 'eclipse' ? 0.5 : 1)})`;
        ctx.fillRect(s.x * w - s.r, s.y * h - s.r, s.r * 2, s.r * 2);
      }
    }

    if (P.eclipse) {
      // пульсирующий ореол затмения — одним кольцом без размытия
      const mx = w * 0.78;
      const my = h * 0.22;
      const mr = Math.min(w, h) * 0.1;
      ctx.strokeStyle = `rgba(255,207,106,${0.25 + 0.15 * Math.sin(this.time * 2)})`;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(mx, my, mr + 8, 0, TAU);
      ctx.stroke();
    }

    this.drawFloaters(dt);
  }

  paintStatic() {
    const { ctx, w, h } = this;
    const P = PLACES[this.place];
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, P.sky[0]);
    g.addColorStop(0.55, P.sky[1]);
    g.addColorStop(1, P.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    if (P.orb) {
      const mx = w * P.orb.x;
      const my = h * P.orb.y;
      const mr = Math.min(w, h) * 0.09;
      const mg = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 2.8);
      mg.addColorStop(0, hexA(P.orb.color, 0.3));
      mg.addColorStop(1, hexA(P.orb.color, 0));
      ctx.fillStyle = mg;
      ctx.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
      ctx.fillStyle = P.orb.color;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, TAU);
      ctx.fill();
    }

    if (P.eclipse) {
      const mx = w * 0.78;
      const my = h * 0.22;
      const mr = Math.min(w, h) * 0.1;
      ctx.save();
      ctx.shadowColor = '#ffcf6a';
      ctx.shadowBlur = 50;
      ctx.strokeStyle = '#ffd98a';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, TAU);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#050104';
      ctx.beginPath();
      ctx.arc(mx, my, mr - 2, 0, TAU);
      ctx.fill();
    }

    this.mountains(h * 0.72, P.hills[0], 0.9, 7);
    if (P.trees) this.trees(P.hills[1]);
    this.mountains(h * 0.82, P.hills[1], 1.3, 13);
    ctx.fillStyle = P.ground;
    ctx.fillRect(-20, h * 0.9, w + 40, h * 0.2);
    if (P.bridge) this.bridge();
  }

  drawFloaters(dt) {
    const { ctx, w, h } = this;
    const P = PLACES[this.place];
    // Летящие листья / лепестки / угольки
    if (P.leaves || P.embers) {
      for (const f of this.floaters) {
        f.y += f.v * dt * (P.embers ? -1 : 1);
        f.x += Math.sin(this.time + f.p) * 0.0008 + (P.embers ? 0 : 0.0006);
        if (f.y > 1.05) f.y = -0.05;
        if (f.y < -0.05) f.y = 1.05;
        if (f.x > 1.05) f.x = -0.05;
        ctx.save();
        ctx.translate(f.x * w, f.y * h);
        ctx.rotate(this.time * 2 + f.p);
        if (P.embers) {
          ctx.fillStyle = `rgba(255,${120 + Math.round(60 * Math.sin(f.p + this.time))},60,0.85)`;
          ctx.fillRect(-2, -2, 4, 4);
        } else {
          ctx.fillStyle = P.leaves;
          ctx.fillRect(-f.s, -f.s * 0.3, f.s * 2, f.s * 0.6);
        }
        ctx.restore();
      }
    }
  }

  mountains(base, color, amp, seed) {
    const { ctx, w, h } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-20, h);
    for (let x = -20; x <= w + 20; x += 20) {
      const y = base - (Math.sin(x * 0.004 + seed) * 50 + Math.sin(x * 0.011 + seed * 2) * 25 + 40) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 20, h);
    ctx.closePath();
    ctx.fill();
  }

  trees(color) {
    const { ctx, w, h } = this;
    ctx.fillStyle = color;
    for (let i = 0; i < 9; i++) {
      const x = (i / 8) * w + Math.sin(i * 7) * 40;
      if (Math.abs(x - w * 0.5) < w * 0.18) continue;
      const tw = 26 + (i % 3) * 10;
      ctx.fillRect(x - tw / 2, h * 0.2, tw, h * 0.75);
      ctx.beginPath();
      ctx.ellipse(x, h * 0.22, tw * 3, h * 0.12, 0, 0, TAU);
      ctx.fill();
    }
  }

  bridge() {
    const { ctx, w, h } = this;
    ctx.strokeStyle = '#2a1420';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.8);
    ctx.quadraticCurveTo(w / 2, h * 0.72, w, h * 0.8);
    ctx.stroke();
    ctx.lineWidth = 5;
    for (let i = 0; i <= 16; i++) {
      const x = (i / 16) * w;
      const y = h * 0.8 - Math.sin((i / 16) * Math.PI) * h * 0.04;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h * 0.1);
      ctx.stroke();
    }
  }

  drawEnemy(dt) {
    const { ctx } = this;
    const e = this.enemy;
    const p = this.enemyPos;
    e.enter = Math.min(1, e.enter + dt * 2.5);
    const s = p.s * (e.look === 'warlord' ? 1.05 : e.look === 'scout' ? 1.1 : 1);
    const bob = Math.sin(this.time * 1.6) * 8 * s;
    const charging = e.state === 'charging';
    const shakeX = charging ? rand(-2, 2) * e.charge * 3 : 0;
    const fade = (1 - e.dead) * e.enter;
    if (fade <= 0) return;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(p.x + shakeX + (1 - e.enter) * 200, p.y + bob);
    ctx.scale(s, s);

    // Аура: краснеет при заряде; у главного злодея во второй фазе — постоянная
    const auraR = 190 + (charging ? e.charge * 110 : 0);
    const ag = ctx.createRadialGradient(0, 0, 40, 0, 0, auraR);
    const auraColor = e.look === 'warlord' ? '130,60,220' : '204,51,37';
    const auraA = (e.phase2 ? 0.4 : 0.16) + (charging ? e.charge * 0.45 : 0);
    ag.addColorStop(0, `rgba(${auraColor},${auraA})`);
    ag.addColorStop(1, `rgba(${auraColor},0)`);
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, TAU);
    ctx.fill();

    // Персонаж рисуется в отдельный холст ~20 раз в секунду, а на сцену — одной картинкой.
    const sprite = this.enemySprite(e, s);
    ctx.drawImage(sprite.canvas, SPRITE.x0, SPRITE.y0, SPRITE.w, SPRITE.h);
    // Вспышка при попадании: персонаж рисуется ещё раз поверх в режиме «осветление»
    if (this.enemyFlash > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, this.enemyFlash) * fade;
      ctx.drawImage(sprite.canvas, SPRITE.x0, SPRITE.y0, SPRITE.w, SPRITE.h);
      ctx.restore();
    }
    this.enemyFlash *= Math.pow(0.02, dt);

    if (e.state === 'stunned') {
      for (let i = 0; i < 4; i++) {
        const a = this.time * 3 + (i * TAU) / 4;
        ctx.fillStyle = '#f0b64a';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 80, -150 + Math.sin(a) * 18, 7, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    if (charging) {
      const bw = 220 * p.s * 1.6;
      const x = p.x - bw / 2;
      const y = p.y + 280 * p.s;
      ctx.fillStyle = 'rgba(239,230,207,0.15)';
      ctx.fillRect(x, y, bw, 10);
      ctx.fillStyle = '#e8413a';
      ctx.fillRect(x, y, bw * e.charge, 10);
    }
  }

  enemySprite(e, s) {
    const scale = s * this.dpr;
    let c = this.enemyCache;
    const key = `${e.look}|${e.tint}|${e.state}|${e.phase2}|${scale.toFixed(3)}`;
    const stale = !c || c.key !== key || this.time - c.at > (e.state === 'charging' ? 0.05 : 0.066);
    if (!stale) return c;
    if (!c || c.scale !== scale) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(SPRITE.w * scale);
      canvas.height = Math.ceil(SPRITE.h * scale);
      c = { canvas, ctx: canvas.getContext('2d'), scale };
    }
    const g = c.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.canvas.width, c.canvas.height);
    g.setTransform(scale, 0, 0, scale, -SPRITE.x0 * scale, -SPRITE.y0 * scale);
    drawCharacter(g, e.look, this.time, e);
    c.key = key;
    c.at = this.time;
    this.enemyCache = c;
    return c;
  }

  drawShield() {
    if (this.shield <= 0.01) return;
    const { ctx, w, h } = this;
    const r = h * 0.5;
    const pulse = 0.5 + 0.2 * Math.sin(this.time * 5);
    ctx.save();
    ctx.strokeStyle = `rgba(88,208,255,${0.55 * this.shield * pulse + 0.2})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 1.05, r, Math.PI, TAU);
    ctx.stroke();
    const g = ctx.createRadialGradient(w * 0.5, h * 1.05, r * 0.6, w * 0.5, h * 1.05, r);
    g.addColorStop(0, 'rgba(88,208,255,0)');
    g.addColorStop(1, `rgba(88,208,255,${0.18 * this.shield})`);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  drawSpeedLines(dt) {
    if (this.speedLines <= 0.02) return;
    const { ctx, w, h } = this;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.hypot(w, h);
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, this.speedLines * 0.6)})`;
    ctx.beginPath();
    const n = [30, 50, 70][this.quality];
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const inner = R * rand(0.28, 0.4);
      const wd = rand(0.003, 0.012);
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a - wd) * R, cy + Math.sin(a - wd) * R);
      ctx.lineTo(cx + Math.cos(a + wd) * R, cy + Math.sin(a + wd) * R);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
    this.speedLines -= dt * 1.6;
  }

  drawParticles(dt) {
    const { ctx } = this;
    const keep = [];
    for (const p of this.particles) {
      p.t += dt;
      if (p.kind === 'timer') {
        if (p.t >= p.dur) p.fn();
        else keep.push(p);
        continue;
      }
      if (p.t < 0) {
        keep.push(p);
        continue;
      }
      const k = p.t / p.dur;
      if (k >= 1) continue;
      keep.push(p);
      if (p.kind === 'fire') {
        const e = k * k * (3 - 2 * k);
        const x = p.x + (p.tx - p.x) * e;
        const y = p.y + (p.ty - p.y) * e - Math.sin(k * Math.PI) * 80;
        const img = this.sprites.fire[Math.min(this.sprites.fire.length - 1, Math.floor((p.hue - 10) / 7))];
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(img, x - p.size, y - p.size, p.size * 2, p.size * 2);
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.kind === 'spark') {
        const x = p.x + p.vx * p.t;
        const y = p.y + p.vy * p.t + 200 * p.t * p.t;
        const r = p.size * (1 - k * 0.5);
        ctx.fillStyle = `rgba(${p.color},${1 - k})`;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      } else if (p.kind === 'smoke') {
        const x = p.x + p.vx * p.t;
        const y = p.y + p.vy * p.t;
        ctx.fillStyle = `rgba(235,232,245,${0.85 * (1 - k)})`;
        ctx.strokeStyle = `rgba(40,30,50,${0.5 * (1 - k)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (0.6 + k * 0.6), 0, TAU);
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === 'slash') {
        // серп ветра: дуга летит к врагу и растёт
        const e = k * k;
        const x = p.x + (p.tx - p.x) * e;
        const y = p.y + (p.ty - p.y) * e;
        const r = p.size * (0.5 + k * 0.7);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.dir * 0.7);
        ctx.globalCompositeOperation = 'lighter';
        for (const [wd, a] of [[16, 0.25], [7, 0.9]]) {
          ctx.strokeStyle = `rgba(200,255,225,${a * (1 - k * 0.5)})`;
          ctx.lineWidth = wd;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, 0, r, -1.2, 1.2);
          ctx.stroke();
        }
        ctx.restore();
      } else if (p.kind === 'dragon') {
        // дракон из света: змеистая лента с головой спускается сверху
        const head = Math.min(1, k * 1.15);
        const segs = 26;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        let hx = 0;
        let hy = 0;
        for (let i = 0; i < segs; i++) {
          const q = head - i * 0.035;
          if (q < 0) break;
          const yy = p.y + (p.ty - p.y) * q;
          const xx = p.tx + Math.sin(q * 9 + this.time * 3) * 120 * (1 - q * 0.6) * (p.size / 60);
          if (i === 0) {
            hx = xx;
            hy = yy;
          }
          const w = p.size * (1 - i / segs) + 4;
          ctx.fillStyle = `rgba(255,${170 + i * 3},80,${0.55 * (1 - i / segs)})`;
          ctx.beginPath();
          ctx.arc(xx, yy, w, 0, TAU);
          ctx.fill();
        }
        // голова
        ctx.fillStyle = 'rgba(255,240,190,0.95)';
        ctx.beginPath();
        ctx.ellipse(hx, hy, p.size * 1.2, p.size * 0.8, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(200,40,30,0.9)';
        ctx.beginPath();
        ctx.arc(hx - p.size * 0.4, hy - p.size * 0.2, p.size * 0.15, 0, TAU);
        ctx.arc(hx + p.size * 0.4, hy - p.size * 0.2, p.size * 0.15, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'splinter') {
        const x = p.x + p.vx * p.t;
        const y = p.y + p.vy * p.t + 900 * p.t * p.t;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot + p.t * 8);
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#8fbf58';
        ctx.strokeStyle = '#1a1320';
        ctx.lineWidth = 2;
        ctx.fillRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
        ctx.strokeRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
        ctx.restore();
      } else if (p.kind === 'cloud') {
        // клубы грозовой тучи: быстро набухают и медленно тают
        const grow = Math.min(1, k * 4);
        const alpha = k < 0.7 ? 0.85 : 0.85 * (1 - (k - 0.7) / 0.3);
        const r = p.size * (0.4 + 0.6 * grow);
        ctx.globalAlpha = alpha;
        ctx.drawImage(this.sprites.cloud, p.x - r, p.y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        if (k > 0.25 && k < 0.45 && Math.random() < 0.3) {
          ctx.fillStyle = 'rgba(200,225,255,0.35)';
          ctx.beginPath();
          ctx.arc(p.x + rand(-r, r) * 0.5, p.y, r * 0.5, 0, TAU);
          ctx.fill();
        }
      } else if (p.kind === 'target') {
        const pulse = 0.5 + 0.5 * Math.sin(p.t * 30);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, 0.35);
        ctx.strokeStyle = `rgba(160,210,255,${0.5 + 0.5 * pulse})`;
        ctx.lineWidth = 6;
        ctx.setLineDash([18, 12]);
        ctx.lineDashOffset = -p.t * 200;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.2 - k * 0.4), 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(120,180,255,${0.12 + 0.12 * pulse})`;
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'sphere') {
        const e = k < 0.45 ? 0 : ((k - 0.45) / 0.55) ** 2;
        const x = p.x + (p.tx - p.x) * e;
        const y = p.y + (p.ty - p.y) * e;
        const r = p.size * (k < 0.45 ? k / 0.45 : 1);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
        g.addColorStop(0, 'rgba(230,250,255,1)');
        g.addColorStop(0.4, 'rgba(88,208,255,0.9)');
        g.addColorStop(1, 'rgba(88,208,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.6, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(230,250,255,0.8)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * 0.35, this.time * 8 + (i * Math.PI) / 3, 0, TAU);
          ctx.stroke();
        }
      }
    }
    this.particles = keep;
  }

  drawBolts(dt) {
    const { ctx } = this;
    this.bolts = this.bolts.filter((b) => (b.life -= dt) > 0);
    for (const b of this.bolts) {
      const a = b.life / b.max;
      ctx.beginPath();
      b.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      // свечение — несколько широких полупрозрачных проходов вместо дорогого размытия
      ctx.globalCompositeOperation = 'lighter';
      const glow = b.big ? [[5.5, 0.12], [3, 0.22]] : [[3, 0.18]];
      for (const [mul, alpha] of glow) {
        ctx.strokeStyle = `rgba(120,190,255,${a * alpha})`;
        ctx.lineWidth = b.width * mul * a + 2;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(235,246,255,${a})`;
      ctx.lineWidth = b.width * a + 1;
      ctx.stroke();
    }
  }

  drawRings(dt) {
    const { ctx } = this;
    this.rings = this.rings.filter((r) => (r.life -= dt) > 0);
    for (const r of this.rings) {
      r.r += (r.max - r.r) * Math.min(1, dt * 8);
      ctx.strokeStyle = `rgba(${r.color},${Math.min(1, r.life * 2)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
  }

  drawTexts(dt) {
    const { ctx } = this;
    this.texts = this.texts.filter((t) => (t.t += dt) < t.dur);
    for (const t of this.texts) {
      const k = t.t / t.dur;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.translate(t.x, t.y - (t.jp ? 0 : k * 50));
      if (t.rot) ctx.rotate(t.rot);
      const pop = t.jp ? (k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.4)) : 1;
      ctx.scale(pop, pop);
      ctx.font = `${t.size}px 'Dela Gothic One', Unbounded, 'Arial Black', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = t.size * 0.16;
      ctx.strokeStyle = '#1a1320';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }
}

/** Габариты холста персонажа в его собственных координатах (лицо в 0,0). */
const SPRITE = { x0: -240, y0: -270, w: 480, h: 560 };

/** Заранее нарисованные «кисти» для огня и туч — вместо градиента на каждую частицу. */
function makeSprites() {
  const radial = (stops, size = 64) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return c;
  };
  const fire = [];
  for (let hue = 10; hue <= 45; hue += 7) {
    fire.push(radial([[0, `hsla(${hue + 20},100%,75%,0.95)`], [1, `hsla(${hue},100%,50%,0)`]]));
  }
  const cloud = radial([[0, 'rgba(70,74,105,1)'], [0.75, 'rgba(30,32,55,0.95)'], [1, 'rgba(20,22,40,0)']], 96);
  return { fire, cloud };
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// Эффекты техник и сундук живут в своих файлах, но это методы той же сцены
for (const part of [effects, chestFx]) Object.defineProperties(Arena.prototype, Object.getOwnPropertyDescriptors(part));
