// Эффекты техник на сцене боя: огненный шар, молния, клинок ветра, дракон, сфера, щит, удары и надписи.
// Методы подмешиваются в класс Arena (src/fx.js) — так файл сцены не разрастается.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

export const SFX_WORDS = {
  fire: 'ゴォッ!',
  lightning: 'バチバチッ!',
  sphere: 'ドドドン!',
  hit: 'ドン!',
  shield: 'キィン!',
  smoke: 'ボン!',
  charge: 'ゴゴゴ…',
};

export const effects = {
  // ---------- эффекты ----------

  sfx(word, x, y, { size = 64, color = '#fff4cc', rot = rand(-0.25, 0.25) } = {}) {
    this.texts.push({ text: word, x, y, t: 0, dur: 0.9, color, size, rot, jp: true });
  },

  fireball(power) {
    const from = this.playerPos;
    const to = this.enemyPos;
    // ядро: большой огненный шар с языками пламени, за ним хвост искр
    this.particles.push({ kind: 'fireCore', x: from.x, y: from.y, tx: to.x, ty: to.y, t: 0, dur: 0.55, size: (46 + power * 26) * Math.max(0.8, to.s * 1.6) });
    const n = Math.round(30 + power * 40);
    for (let i = 0; i < n; i++) {
      const delay = (i / n) * 0.22;
      this.particles.push({
        kind: 'fire', x: from.x, y: from.y, tx: to.x + rand(-26, 26), ty: to.y + rand(-26, 26),
        t: -delay, dur: 0.55, size: rand(10, 24) * (0.7 + power * 0.5), hue: rand(10, 45),
      });
    }
    this.speedLines = 0.5;
    this.later(0.55, () => this.explode(to, power));
  },

  /** Взрыв: огненный шар раздувается, летят обломки, поднимается столб дыма, по краям экрана — жар. */
  explode(at, power = 1, quiet = false) {
    const s = Math.max(0.8, at.s * 1.6);
    // огненный шар взрыва раздувается и гаснет
    this.particles.push({ kind: 'burst', x: at.x, y: at.y, t: 0, dur: 0.75, size: (190 + power * 70) * s });
    for (let i = 0; i < 26 + power * 14; i++) {
      const a = rand(0, TAU);
      const v = rand(120, 420) * s;
      this.particles.push({ kind: 'blast', x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.75 - 60, t: 0, dur: rand(0.5, 0.9), size: rand(28, 60) * s, hue: rand(12, 42) });
    }
    for (let i = 0; i < 14; i++) {
      const a = rand(-Math.PI, 0);
      const v = rand(260, 620) * s;
      this.particles.push({ kind: 'debris', x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, dur: rand(0.8, 1.3), size: rand(5, 12) * s, rot: rand(0, TAU) });
    }
    for (let i = 0; i < 10; i++) {
      this.particles.push({ kind: 'plume', x: at.x + rand(-60, 60) * s, y: at.y + rand(-20, 30) * s, vx: rand(-40, 40), vy: rand(-150, -70), t: -0.18 - i * 0.05, dur: rand(1.5, 2.2), size: rand(40, 80) * s });
    }
    for (let i = 0; i < 24; i++) {
      this.particles.push({ kind: 'ember', x: at.x + rand(-120, 120) * s, y: at.y + rand(-60, 120) * s, vx: rand(-40, 40), vy: rand(-160, -40), t: -rand(0, 0.6), dur: rand(1.2, 2.2), size: rand(2, 4) });
    }
    this.impact(at, '255,150,60', power);
    this.rings.push({ x: at.x, y: at.y, r: 20, max: 300 * s, life: 0.5, color: '255,190,110' });
    this.flash = 0.8;
    this.flashColor = '255,150,60';
    this.shake = Math.max(this.shake, 20);
    this.heat = 1;
    this.scorch('255,120,40', 2.6);
    if (!quiet) this.sfx(SFX_WORDS.fire, at.x + 120, at.y - 60, { color: '#ffb347', size: 80 });
  },

  /**
   * Грозовая молния: над врагом собирается туча, на земле загорается круг-прицел,
   * затем с неба бьёт тройной разряд со вспышкой на весь экран и раскатом.
   */
  lightning(power) {
    const to = this.enemyPos;
    const s = to.s * 2;
    const cloudY = Math.max(40, to.y - 330 * to.s * 1.1);
    // небо темнеет, по всему верху экрана собирается грозовой фронт, начинается ливень
    this.darken(0.85, 1.9);
    this.rain = 2.6;
    for (let i = 0; i < 22; i++) {
      this.particles.push({
        kind: 'cloud', x: rand(-0.05, 1.05) * this.w, y: rand(-0.04, 0.12) * this.h,
        t: -i * 0.01, dur: 2.2, size: rand(90, 160) * Math.max(0.8, s * 0.6),
      });
    }
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        kind: 'cloud', x: to.x + rand(-160, 160) * s * 0.6, y: cloudY + rand(-30, 30) * s * 0.4,
        t: -i * 0.012, dur: 1.6, size: rand(45, 90) * s * 0.55,
      });
    }
    // зарницы в туче перед ударом
    this.later(0.1, () => ((this.flash = 0.25), (this.flashColor = '120,150,220')));
    this.later(0.24, () => this.skyBolt({ x: this.w * rand(0.05, 0.25), life: 0.2, width: 3 }));
    // круг-прицел под врагом
    this.particles.push({ kind: 'target', x: to.x, y: to.y + 250 * to.s, t: 0, dur: 0.75, size: 150 * to.s * 1.4 });
    this.flash = 0.15;
    this.flashColor = '20,20,60';
    this.later(0.38, () => {
      // за спиной врага бьют молнии во всё небо
      this.skyBolt({ x: this.w * rand(0.08, 0.3), width: 8, life: 0.55 });
      this.skyBolt({ x: this.w * rand(0.7, 0.92), width: 7, life: 0.5 });
      if (this.quality > 0) this.skyBolt({ x: this.w * rand(0.36, 0.64), width: 5, life: 0.4, toY: this.h * 0.5 });
      for (let k = 0; k < 3; k++) {
        const x0 = to.x + (k - 1) * 70 * s * 0.5 + rand(-20, 20);
        const pts = this.boltPath(x0, -10, to.x + (k - 1) * 25, to.y + rand(-20, 40));
        this.bolts.push({ pts, life: 0.55 + k * 0.06, max: 0.55 + k * 0.06, width: 10 + power * 8, big: true });
        for (let b = 0; b < 2; b++) {
          const from = pts[3 + Math.floor(Math.random() * 6)];
          this.bolts.push({ pts: this.boltPath(from.x, from.y, from.x + rand(-140, 140), from.y + rand(60, 180)), life: 0.32, max: 0.32, width: 3 });
        }
      }
      // стробоскоп: вспышка гаснет и бьёт ещё дважды
      this.flash = 1;
      this.flashColor = '230,245,255';
      this.later(0.09, () => ((this.flash = 0.85), (this.flashColor = '210,230,255')));
      this.later(0.21, () => ((this.flash = 0.6), (this.flashColor = '230,245,255')));
      this.impactFrame = 0.16;
      this.speedLines = 0.9;
      this.shake = Math.max(this.shake, 24);
      this.arcs = 1.1;
      this.impact(to, '170,220,255', power * 1.3);
      this.scorch('140,190,255', 2.2);
      this.rings.push({ x: to.x, y: to.y + 250 * to.s, r: 20, max: 300 * to.s * 1.4, life: 0.7, color: '200,230,255' });
      this.sfx('ドガァン!', to.x - 160, to.y - 110, { color: '#e8f4ff', size: 96 });
    });
    // отголосок: дальняя молния через секунду
    this.later(1.35, () => this.skyBolt({ x: this.w * rand(0.6, 0.95), life: 0.3, width: 4, toY: this.h * 0.45 }));
  },

  /** Клинок ветра: порыв через весь экран, листья, два серпа и разрез экрана крест-накрест. */
  wind(power) {
    const to = this.enemyPos;
    const from = this.playerPos;
    this.gusts = 1.2;
    for (let i = 0; i < 18; i++) {
      this.particles.push({ kind: 'leaf', x: -40 - rand(0, 200), y: rand(0.1, 0.9) * this.h, vx: rand(900, 1500), vy: rand(-120, 120), t: -rand(0, 0.35), dur: rand(0.9, 1.3), size: rand(7, 13), rot: rand(0, TAU) });
    }
    for (let k = 0; k < 2; k++) {
      this.particles.push({ kind: 'slash', x: from.x, y: from.y - 60, tx: to.x, ty: to.y, t: -k * 0.16, dur: 0.42, dir: k ? -1 : 1, size: (120 + power * 60) * to.s * 2 });
    }
    this.speedLines = 0.7;
    const cut = (dir) => {
      const { w, h } = this;
      this.cuts.push(dir > 0
        ? { x1: -40, y1: to.y - h * 0.32, x2: w + 40, y2: to.y + h * 0.3, life: 0.45, max: 0.45 }
        : { x1: w + 40, y1: to.y - h * 0.32, x2: -40, y2: to.y + h * 0.3, life: 0.45, max: 0.45 });
    };
    this.later(0.42, () => {
      cut(1);
      this.impact(to, '180,255,210', power);
      this.rings.push({ x: to.x, y: to.y, r: 10, max: 200 * to.s * 2, life: 0.4, color: '200,255,225' });
    });
    this.later(0.58, () => {
      cut(-1);
      this.impact(to, '180,255,210', power * 0.8);
      this.impactFrame = 0.08;
      this.sfx('ズバッ!', to.x + 130, to.y - 70, { color: '#d8ffe8', size: 84 });
    });
  },

  /** Удар дракона: с неба спускается светящаяся змея-дракон и врезается во врага. */
  dragon(power) {
    const to = this.enemyPos;
    this.flash = 0.25;
    this.flashColor = '60,10,10';
    this.particles.push({ kind: 'dragon', x: to.x, y: -80, tx: to.x, ty: to.y, t: 0, dur: 0.85, size: (40 + power * 20) * to.s * 2 });
    this.speedLines = 1;
    this.darken(0.6, 1.1);
    this.later(0.85, () => {
      this.explode(to, 1.3, true);
      this.impactFrame = 0.25;
      this.impact(to, '255,190,90', 1.5);
      this.flash = 1;
      this.flashColor = '255,210,140';
      this.shake = 26;
      for (let i = 0; i < 3; i++) this.rings.push({ x: to.x, y: to.y + i * 10, r: 20, max: (220 + i * 120) * to.s * 2, life: 0.5 + i * 0.15, color: '255,200,120' });
      this.sfx('ドォォン!', to.x, to.y - 150, { size: 100, color: '#ffe0a0' });
    });
  },


  sphere(power) {
    const from = { x: this.w * 0.5, y: this.h * 0.8 };
    const to = this.enemyPos;
    this.particles.push({ kind: 'sphere', x: from.x, y: from.y, tx: to.x, ty: to.y, t: 0, dur: 0.9, size: 40 + power * 30 });
    this.speedLines = 1;
    this.later(0.9, () => {
      this.impactFrame = 0.22;
      this.impact(to, '120,210,255', 1.3);
      this.flash = 0.8;
      this.flashColor = '140,220,255';
      this.shake = Math.max(this.shake, 22);
      for (let i = 0; i < 4; i++) this.rings.push({ x: to.x, y: to.y, r: 10 + i * 30, max: (260 + i * 110) * to.s * 2, life: 0.45 + i * 0.12, color: '160,225,255' });
      for (let i = 0; i < 12; i++) {
        const a = rand(-Math.PI, 0);
        const v = rand(260, 600);
        this.particles.push({ kind: 'debris', x: to.x, y: to.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, dur: rand(0.8, 1.2), size: rand(5, 11), rot: rand(0, TAU) });
      }
      this.sfx(SFX_WORDS.sphere, to.x, to.y - 140, { size: 90, color: '#e0f7ff' });
    });
  },

  shieldUp() {
    this.shield = 1;
    this.shieldAt = this.time;
    this.rings.push({ x: this.w * 0.5, y: this.h * 1.05, r: 0, max: this.h * 0.55, life: 0.6, color: '88,208,255' });
    // всплеск: брызги взлетают по краю купола
    for (let i = 0; i < 40; i++) {
      const a = rand(Math.PI * 1.05, Math.PI * 1.95);
      const r = this.h * 0.5;
      this.particles.push({ kind: 'drop', x: this.w * 0.5 + Math.cos(a) * r, y: this.h * 1.05 + Math.sin(a) * r, vx: Math.cos(a) * rand(60, 220), vy: rand(-420, -160), t: -rand(0, 0.15), dur: rand(0.7, 1.1), size: rand(3, 7) });
    }
  },

  impact(at, color, power) {
    this.shake = Math.max(this.shake, 10 * power);
    this.enemyFlash = 1;
    this.enemyKick = Math.min(1.4, (this.enemyKick ?? 0) + 0.6 + power * 0.3);
    this.punch = Math.max(this.punch ?? 0, Math.min(1, power * 0.8));
    this.hitStop = Math.max(this.hitStop ?? 0, power >= 1 ? 0.09 : 0.05);
    this.impactFrame = Math.max(this.impactFrame, 0.1);
    for (let i = 0; i < 40 * power; i++) {
      const a = rand(0, TAU);
      const v = rand(80, 380) * power;
      this.particles.push({ kind: 'spark', x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, dur: rand(0.4, 0.8), size: rand(2, 5), color });
    }
    this.rings.push({ x: at.x, y: at.y, r: 10, max: 160 * power, life: 0.45, color });
  },

  damageText(value, color = '#f0b64a') {
    const p = this.enemyPos;
    this.texts.push({ text: `−${value}`, x: p.x + rand(-40, 40), y: p.y - 90 * p.s, t: 0, dur: 1.1, color, size: 38 });
  },

  label(text, color = '#efe6cf') {
    const p = this.enemyPos;
    this.texts.push({ text, x: p.x, y: p.y + 170 * p.s, t: 0, dur: 1.3, color, size: 28 });
  },

  charge() {
    const p = this.enemyPos;
    this.sfx(SFX_WORDS.charge, p.x + 150 * p.s * 2, p.y - 40, { color: '#ff8a8a', size: 54, rot: 0.15 });
  },

  playerHit(blocked) {
    if (blocked) {
      this.rings.push({ x: this.w * 0.5, y: this.h * 1.05, r: this.h * 0.4, max: this.h * 0.6, life: 0.4, color: '88,208,255' });
      this.shield = 0;
      this.sfx(SFX_WORDS.shield, this.w * 0.5, this.h * 0.62, { color: '#bff1ff' });
    } else {
      this.shake = 18;
      this.flash = 0.6;
      this.flashColor = '204,51,37';
      this.impactFrame = 0.12;
      this.crackScreen();
      this.sfx(SFX_WORDS.hit, this.w * 0.3, this.h * 0.7, { color: '#ff6a5a', size: 80 });
    }
    const from = this.enemyPos;
    for (let i = 0; i < 30; i++) {
      this.particles.push({ kind: 'spark', x: from.x, y: from.y + 40, vx: rand(-160, 160), vy: rand(300, 700), t: 0, dur: 0.6, size: rand(3, 7), color: '230,60,45' });
    }
  },

  /** Враг повержен: облако дыма и надпись. */
  smoke() {
    const p = this.enemyPos;
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU);
      this.particles.push({ kind: 'smoke', x: p.x + Math.cos(a) * rand(0, 60), y: p.y + rand(-40, 120) * p.s * 2, vx: Math.cos(a) * rand(20, 90), vy: rand(-80, -10), t: 0, dur: rand(0.9, 1.5), size: rand(40, 90) * p.s * 2 });
    }
    this.sfx(SFX_WORDS.smoke, p.x, p.y - 60, { size: 96, color: '#ffffff' });
    this.speedLines = 0.7;
  },

  /** Частицы больших эффектов (огненное ядро, взрыв, обломки, дым, угли, листья, брызги). */
  drawParticle2(p, k) {
    const { ctx } = this;
    if (p.kind === 'fireCore') {
      const e = k * k * (3 - 2 * k);
      const x = p.x + (p.tx - p.x) * e;
      const y = p.y + (p.ty - p.y) * e - Math.sin(k * Math.PI) * 80;
      const r = p.size * (0.7 + 0.3 * Math.min(1, k * 4));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.sprites.glow, x - r * 3, y - r * 3, r * 6, r * 6);
      // языки пламени крутятся вокруг ядра
      for (let i = 0; i < 7; i++) {
        const a = this.time * 9 + (i * TAU) / 7;
        const fx = x + Math.cos(a) * r * 0.55 - (p.tx - p.x) * 0.02 * i;
        const fy = y + Math.sin(a) * r * 0.55;
        ctx.drawImage(this.sprites.fire[i % this.sprites.fire.length], fx - r * 0.8, fy - r * 0.8, r * 1.6, r * 1.6);
      }
      ctx.drawImage(this.sprites.core, x - r, y - r, r * 2, r * 2);
      ctx.restore();
    } else if (p.kind === 'blast') {
      const drag = 1 - Math.exp(-p.t * 3.2);
      const x = p.x + (p.vx / 3.2) * drag;
      const y = p.y + (p.vy / 3.2) * drag;
      const r = p.size * (0.6 + k * 1.1);
      const img = this.sprites.fire[Math.min(this.sprites.fire.length - 1, Math.floor((p.hue - 10) / 7))];
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - k;
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else if (p.kind === 'debris') {
      const x = p.x + p.vx * p.t;
      const y = p.y + p.vy * p.t + 900 * p.t * p.t;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.rot + p.t * 10);
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = '#2a1e1c';
      ctx.strokeStyle = 'rgba(255,170,90,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-p.size, -p.size * 0.4);
      ctx.lineTo(p.size * 0.3, -p.size * 0.8);
      ctx.lineTo(p.size, p.size * 0.2);
      ctx.lineTo(-p.size * 0.2, p.size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (p.kind === 'burst') {
      const r = p.size * (0.35 + 0.65 * (1 - (1 - k) ** 3));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - k) ** 1.5;
      ctx.drawImage(this.sprites.glow, p.x - r * 1.8, p.y - r * 1.8, r * 3.6, r * 3.6);
      ctx.drawImage(this.sprites.core, p.x - r, p.y - r, r * 2, r * 2);
      ctx.restore();
    } else if (p.kind === 'plume') {
      const x = p.x + p.vx * p.t;
      const y = p.y + p.vy * p.t;
      const r = p.size * (0.6 + k * 1.2);
      ctx.globalAlpha = 0.5 * Math.min(1, k * 4) * (1 - k);
      ctx.drawImage(this.sprites.smoke, x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    } else if (p.kind === 'ember') {
      const x = p.x + p.vx * p.t + Math.sin(p.t * 6 + p.x) * 10;
      const y = p.y + p.vy * p.t;
      ctx.fillStyle = `rgba(255,${150 + Math.round(80 * Math.sin(p.t * 20))},70,${1 - k})`;
      ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
    } else if (p.kind === 'leaf') {
      const x = p.x + p.vx * p.t;
      const y = p.y + p.vy * p.t + Math.sin(p.t * 14 + p.rot) * 30;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.rot + p.t * 12);
      ctx.fillStyle = '#7fbf6a';
      ctx.strokeStyle = '#1a2a18';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (p.kind === 'drop') {
      const x = p.x + p.vx * p.t;
      const y = p.y + p.vy * p.t + 800 * p.t * p.t;
      ctx.fillStyle = `rgba(170,230,255,${0.9 * (1 - k)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, p.size * 0.6, p.size, 0, 0, TAU);
      ctx.fill();
    }
  },

  later(sec, fn) {
    this.particles.push({ kind: 'timer', t: 0, dur: sec, fn });
  },

  boltPath(x1, y1, x2, y2) {
    const pts = [{ x: x1, y: y1 }];
    const steps = 12;
    for (let i = 1; i < steps; i++) {
      const k = i / steps;
      pts.push({ x: x1 + (x2 - x1) * k + rand(-28, 28), y: y1 + (y2 - y1) * k });
    }
    pts.push({ x: x2, y: y2 });
    return pts;
  },
};
