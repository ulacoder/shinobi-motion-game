// Сцена боя в аниме-стиле: фон этапа, враг, эффекты техник,
// линии скорости, кадры удара, японские звуковые надписи, дым.

import { drawCharacter } from './characters.js';
import { drawKageroAura } from './kagero.js';
import { drawHeroHands } from './herohands.js';
import { effects } from './fx-effects.js';
import { chestFx } from './fx-chest.js';
import { stormFx } from './fx-storm.js';
import { scenery } from './fx-scenery.js';
import { sceneryProps } from './scenery-props.js';
import { sceneryLive } from './scenery-live.js';
import { particlesFx } from './fx-particles.js';

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
    this.initStorm();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  /**
   * Потолок качества от нагрузки распознавания рук: понижаем сразу, повышаем только
   * после 6 секунд спокойной работы (смена качества перестраивает фон).
   */
  capQuality(cap) {
    const cur = this.qualityCap ?? 2;
    if (cap < cur) {
      this.qualityCap = cap;
      this.capAt = this.time;
      if (this.quality > cap) {
        this.quality = cap;
        this.resize();
      }
    } else if (cap > cur && this.time - (this.capAt ?? 0) > 6) {
      this.qualityCap = cur + 1;
      this.capAt = this.time;
    }
  }

  get dpr() {
    // выше 1,25 разница на глаз почти не видна, а заливка экрана дорожает в разы
    const base = Math.min(devicePixelRatio || 1, 1.25);
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
    // при тяжёлом эффекте реагируем быстро (через ~0,5 с), а повышаем качество осторожно
    if (this.frameTimes.length < 30) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p80 = sorted[Math.floor(sorted.length * 0.8)];
    this.frameTimes.length = 0;
    const was = this.quality;
    // смена качества перестраивает фон — это заметная пауза, поэтому повышаем только после
    // ~4 секунд ровной работы и не раньше чем через 8 секунд после понижения
    this.goodWindows = p80 < 1 / 58 ? (this.goodWindows ?? 0) + 1 : 0;
    if (p80 > 1 / 42 && this.quality > 0) {
      this.quality -= 1;
      this.loweredAt = this.time;
    } else if (this.goodWindows >= 8 && this.quality < (this.qualityCap ?? 2) && this.time - (this.loweredAt ?? -99) > 8) {
      this.quality += 1;
      this.goodWindows = 0;
    }
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
    // «стоп-кадр» удара, как в файтингах: на долю секунды всё почти замирает
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.1;
    }
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
    // «удар камерой»: кадр на миг приближается к врагу и отпускает
    if (this.punch > 0.002 && !this.reduceMotion) {
      const ep = this.enemyPos;
      const z = 1 + this.punch * 0.05;
      ctx.translate(ep.x, ep.y);
      ctx.scale(z, z);
      ctx.translate(-ep.x, -ep.y);
      this.punch *= Math.pow(0.004, dt);
    }
    this.drawBackground(dt);
    this.drawBackFx(dt);
    if (this.enemy) this.drawEnemy(dt);
    if (this.chest) this.drawChest(dt);
    this.drawShield();
    this.drawHero(dt);
    this.drawParticles(dt);
    this.drawBolts(dt);
    this.drawRings(dt);
    this.drawFrontFx(dt);
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

  /**
   * Статичная часть фона рисуется один раз в два холста: дальний план (небо, светило, дальние горы)
   * и ближний (ближние горы, силуэты, земля, виньетка). Планы потом чуть смещаются с разной
   * скоростью — получается параллакс, как в 2D-играх.
   */
  buildBackground() {
    const dpr = this.dpr;
    const make = (part) => {
      const c = document.createElement('canvas');
      c.width = Math.round((this.w + 40) * dpr);
      c.height = Math.round((this.h + 40) * dpr);
      const real = this.ctx;
      this.ctx = c.getContext('2d');
      this.ctx.setTransform(dpr, 0, 0, dpr, 20 * dpr, 20 * dpr);
      this.paintPart = part;
      if (part === 'far') this.paintStatic();
      else this.paintPlace();
      this.ctx = real;
      return c;
    };
    this.bgCache = make('far');
    this.bgNear = make('near');
    this.paintPart = null;
  }

  drawBackground(dt) {
    const { ctx, w, h } = this;
    const P = PLACES[this.place];
    if (!this.bgCache) this.buildBackground();
    // медленное «дыхание» камеры: ближний план смещается сильнее дальнего
    const drift = this.reduceMotion ? 0 : Math.sin(this.time * 0.18);
    const bob = this.reduceMotion ? 0 : Math.sin(this.time * 0.27) * 2;
    ctx.drawImage(this.bgCache, -20 + drift * 4, -20 + bob * 0.5, w + 40, h + 40);
    this.farOffset = drift * 4;

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

    this.drawAmbient(dt);
    this.drawFog(dt, 0);
    ctx.drawImage(this.bgNear, -20 + drift * 11, -20 + bob, w + 40, h + 40);
    this.drawFog(dt, 1);
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
    this.skyGrad = g;

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
      this.eclipseRays();
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

    // горы, силуэты, вода, трава и виньетка — src/fx-scenery.js
    this.paintPlace();
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

    // тень под ногами врага — он стоит на земле, а не висит в воздухе
    ctx.save();
    ctx.globalAlpha = fade * 0.8;
    ctx.translate(p.x + shakeX + (1 - e.enter) * 200, p.y + 250 * s);
    ctx.scale(1, 0.22);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, 190 * s);
    sh.addColorStop(0, 'rgba(0,0,0,0.6)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(0, 0, 190 * s, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = fade;
    // отдача от попадания: враг отлетает назад и сплющивается, потом пружинит обратно
    const kick = this.enemyKick ?? 0;
    this.enemyKick = kick * Math.pow(0.002, dt);
    ctx.translate(p.x + shakeX + (1 - e.enter) * 200, p.y + bob - kick * 18 * s);
    // дыхание: грудь чуть поднимается
    const breathe = this.reduceMotion ? 0 : Math.sin(this.time * 2.1) * 0.012;
    ctx.scale(s * (1 + kick * 0.08), s * (1 + breathe - kick * 0.1));

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

    // у Кагэро — языки тёмного пламени за спиной
    if (e.look === 'warlord' && this.quality > 0) drawKageroAura(ctx, this.time, { phase2: e.phase2, charge: charging ? e.charge : 0 });
    // у пешек своя аура: пепельный дым у подпешек, тлеющие угли у Близнецов Пепла (ярче при заряде удара)
    else if (this.quality > 0) drawKageroAura(ctx, this.time, { color: e.look === 'oni' ? 'ember' : 'ash', scale: 0.75, count: 12, charge: charging ? e.charge : 0 });
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
    if (this.quality > 1) this.lightSprite(c);
    c.key = key;
    c.at = this.time;
    this.enemyCache = c;
    return c;
  }

  /**
   * Свет сцены на персонаже: объём (светлее сверху, темнее снизу) и контровой свет —
   * тонкий цветной край со стороны луны, затмения или фонарей.
   */
  lightSprite(c) {
    const g = c.ctx;
    const { width: W, height: H } = c.canvas;
    const light = {
      night: { color: '150,175,255', dx: 1, dy: -1 },
      forest: { color: '255,220,150', dx: -1, dy: -1 },
      bridge: { color: '255,170,110', dx: -1, dy: -0.4 },
      eclipse: { color: '255,140,70', dx: 1, dy: -1 },
      dawn: { color: '255,230,200', dx: 0, dy: -1 },
    }[this.place] ?? { color: '255,255,255', dx: 1, dy: -1 };
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    const sg = g.createLinearGradient(W * (0.5 + light.dx * 0.5), H * (0.5 + light.dy * 0.5), W * (0.5 - light.dx * 0.5), H * (0.5 - light.dy * 0.5) + H * 0.3);
    sg.addColorStop(0, 'rgba(255,245,230,0.10)');
    sg.addColorStop(0.45, 'rgba(0,0,0,0)');
    sg.addColorStop(1, 'rgba(12,4,24,0.42)');
    g.fillStyle = sg;
    g.fillRect(0, 0, W, H);
    // контровой свет: силуэт минус тот же силуэт, сдвинутый от источника света
    if (!this.rimCanvas || this.rimCanvas.width !== W || this.rimCanvas.height !== H) {
      this.rimCanvas = document.createElement('canvas');
      this.rimCanvas.width = W;
      this.rimCanvas.height = H;
    }
    const r = this.rimCanvas.getContext('2d');
    const off = Math.max(3, W / 110);
    r.globalCompositeOperation = 'source-over';
    r.clearRect(0, 0, W, H);
    r.drawImage(c.canvas, 0, 0);
    r.globalCompositeOperation = 'source-in';
    r.fillStyle = `rgb(${light.color})`;
    r.fillRect(0, 0, W, H);
    r.globalCompositeOperation = 'destination-out';
    r.drawImage(c.canvas, -light.dx * off, -light.dy * off);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = 0.85;
    g.drawImage(this.rimCanvas, 0, 0);
    g.restore();
  }

  drawShield() {
    if (this.shield <= 0.01) return;
    const { ctx, w, h } = this;
    const r = h * 0.5;
    const cx = w * 0.5;
    const cy = h * 1.05;
    const pulse = 0.5 + 0.2 * Math.sin(this.time * 5);
    // купол воды «вырастает» за 0,3 с
    const grow = Math.min(1, (this.time - (this.shieldAt ?? -9)) / 0.3);
    const R = r * (0.6 + 0.4 * grow);
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
    g.addColorStop(0, 'rgba(88,208,255,0)');
    g.addColorStop(0.8, `rgba(88,208,255,${0.12 * this.shield})`);
    g.addColorStop(1, `rgba(150,230,255,${0.3 * this.shield})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI, TAU);
    ctx.fill();
    // бегущие волны по поверхности купола
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const rr = R * (0.72 + i * 0.08);
      const off = this.time * (0.6 + i * 0.25) + i;
      ctx.strokeStyle = `rgba(190,240,255,${(0.18 + 0.1 * i) * this.shield})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let a = Math.PI; a <= TAU + 0.001; a += 0.06) {
        const wob = Math.sin(a * 9 + off * 4) * 5;
        const x = cx + Math.cos(a) * (rr + wob);
        const y = cy + Math.sin(a) * (rr + wob);
        if (a === Math.PI) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // блики-«каустики»
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (1.15 + i * 0.13) + Math.sin(this.time * 1.3 + i) * 0.05;
      ctx.fillStyle = `rgba(220,250,255,${0.25 * this.shield * (0.5 + 0.5 * Math.sin(this.time * 3 + i * 2))})`;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * R * 0.93, cy + Math.sin(a) * R * 0.93, 16, 4, a + Math.PI / 2, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(150,230,255,${0.6 * this.shield * pulse + 0.25})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI, TAU);
    ctx.stroke();
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
  const cloud = radial([[0, 'rgba(74,78,110,0.95)'], [0.45, 'rgba(46,48,74,0.8)'], [0.8, 'rgba(28,30,50,0.35)'], [1, 'rgba(20,22,40,0)']], 96);
  const glow = radial([[0, 'rgba(255,170,70,0.55)'], [0.4, 'rgba(255,100,30,0.22)'], [1, 'rgba(255,60,20,0)']], 128);
  const core = radial([[0, 'rgba(255,255,235,1)'], [0.35, 'rgba(255,230,140,1)'], [0.7, 'rgba(255,140,40,0.9)'], [1, 'rgba(255,80,20,0)']], 128);
  const smoke = radial([[0, 'rgba(60,52,58,0.95)'], [0.6, 'rgba(45,38,46,0.7)'], [1, 'rgba(30,26,34,0)']], 96);
  const fly = radial([[0, 'rgba(255,245,170,0.6)'], [1, 'rgba(255,230,120,0)']], 32);
  const skyGlow = radial([[0, 'rgba(200,225,255,0.5)'], [1, 'rgba(200,225,255,0)']], 128);
  return { fire, cloud, glow, core, smoke, fly, skyGlow };
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// Эффекты техник и сундук живут в своих файлах, но это методы той же сцены
for (const part of [effects, chestFx, stormFx, scenery, sceneryProps, sceneryLive, particlesFx]) Object.defineProperties(Arena.prototype, Object.getOwnPropertyDescriptors(part));
