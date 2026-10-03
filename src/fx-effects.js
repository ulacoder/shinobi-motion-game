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
    const n = Math.round(40 + power * 50);
    for (let i = 0; i < n; i++) {
      const delay = (i / n) * 0.18;
      this.particles.push({
        kind: 'fire', x: from.x, y: from.y, tx: to.x + rand(-20, 20), ty: to.y + rand(-20, 20),
        t: -delay, dur: 0.55, size: rand(10, 26) * (0.7 + power * 0.5), hue: rand(10, 45),
      });
    }
    this.speedLines = 0.5;
    this.later(0.55, () => {
      this.impact(to, '255,150,60', power);
      this.sfx(SFX_WORDS.fire, to.x + 120, to.y - 60, { color: '#ffb347' });
    });
  },

  /**
   * Грозовая молния: над врагом собирается туча, на земле загорается круг-прицел,
   * затем с неба бьёт тройной разряд со вспышкой на весь экран и раскатом.
   */
  lightning(power) {
    const to = this.enemyPos;
    const s = to.s * 2;
    const cloudY = Math.max(40, to.y - 330 * to.s * 1.1);
    // туча
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        kind: 'cloud', x: to.x + rand(-160, 160) * s * 0.6, y: cloudY + rand(-30, 30) * s * 0.4,
        t: -i * 0.012, dur: 1.4, size: rand(45, 90) * s * 0.55,
      });
    }
    // круг-прицел под врагом
    this.particles.push({ kind: 'target', x: to.x, y: to.y + 250 * to.s, t: 0, dur: 0.75, size: 150 * to.s * 1.4 });
    this.flash = 0.15;
    this.flashColor = '20,20,60';
    this.later(0.38, () => {
      for (let k = 0; k < 3; k++) {
        const x0 = to.x + (k - 1) * 70 * s * 0.5 + rand(-20, 20);
        const pts = this.boltPath(x0, cloudY, to.x + (k - 1) * 25, to.y + rand(-20, 40));
        this.bolts.push({ pts, life: 0.5 + k * 0.06, max: 0.5 + k * 0.06, width: 9 + power * 7, big: true });
        // ветвления
        for (let b = 0; b < 2; b++) {
          const from = pts[3 + Math.floor(Math.random() * 6)];
          this.bolts.push({ pts: this.boltPath(from.x, from.y, from.x + rand(-120, 120), from.y + rand(60, 160)), life: 0.3, max: 0.3, width: 3 });
        }
      }
      this.flash = 1;
      this.flashColor = '230,245,255';
      this.impactFrame = 0.14;
      this.speedLines = 0.8;
      this.impact(to, '170,220,255', power * 1.2);
      this.rings.push({ x: to.x, y: to.y + 250 * to.s, r: 20, max: 260 * to.s * 1.4, life: 0.6, color: '200,230,255' });
      this.sfx('ドガァン!', to.x - 160, to.y - 110, { color: '#e8f4ff', size: 84 });
    });
  },

  /** Клинок ветра: два серпа крест-накрест. */
  wind(power) {
    const to = this.enemyPos;
    const from = this.playerPos;
    for (let k = 0; k < 2; k++) {
      this.particles.push({ kind: 'slash', x: from.x, y: from.y - 60, tx: to.x, ty: to.y, t: -k * 0.16, dur: 0.42, dir: k ? -1 : 1, size: (120 + power * 60) * to.s * 2 });
    }
    this.speedLines = 0.7;
    this.later(0.42, () => {
      this.impact(to, '180,255,210', power);
      this.rings.push({ x: to.x, y: to.y, r: 10, max: 200 * to.s * 2, life: 0.4, color: '200,255,225' });
    });
    this.later(0.58, () => {
      this.impact(to, '180,255,210', power * 0.8);
      this.sfx('ズバッ!', to.x + 130, to.y - 70, { color: '#d8ffe8', size: 76 });
    });
  },

  /** Удар дракона: с неба спускается светящаяся змея-дракон и врезается во врага. */
  dragon(power) {
    const to = this.enemyPos;
    this.flash = 0.25;
    this.flashColor = '60,10,10';
    this.particles.push({ kind: 'dragon', x: to.x, y: -80, tx: to.x, ty: to.y, t: 0, dur: 0.85, size: (40 + power * 20) * to.s * 2 });
    this.speedLines = 1;
    this.later(0.85, () => {
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
      this.sfx(SFX_WORDS.sphere, to.x, to.y - 140, { size: 90, color: '#e0f7ff' });
    });
  },

  shieldUp() {
    this.shield = 1;
    this.rings.push({ x: this.w * 0.5, y: this.h * 1.05, r: 0, max: this.h * 0.55, life: 0.6, color: '88,208,255' });
  },

  impact(at, color, power) {
    this.shake = Math.max(this.shake, 10 * power);
    this.enemyFlash = 1;
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
