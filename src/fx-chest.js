// Бамбуковый сундук: появляется на сцене, трескается от ударов ладонью и раскалывается.
// Методы подмешиваются в класс Arena (src/fx.js).

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

export const chestFx = {
  // ---------- бамбуковый сундук ----------

  showChest() {
    this.chest = { hits: 0, need: 3, shake: 0, broken: 0, glow: 0, t: 0 };
  },

  hideChest() {
    this.chest = null;
  },

  get chestPos() {
    const narrow = this.w < 820 || this.w < this.h;
    return { x: this.w * 0.5, y: this.h * (narrow ? 0.4 : 0.46), s: Math.min(this.w, this.h) / (narrow ? 480 : 700) };
  },

  chestHit(power) {
    const c = this.chest;
    if (!c) return;
    c.hits += 1;
    c.shake = 1;
    const p = this.chestPos;
    this.shake = Math.max(this.shake, 8 + power * 8);
    this.impactFrame = 0.08;
    for (let i = 0; i < 18; i++) {
      this.particles.push({ kind: 'splinter', x: p.x + rand(-60, 60) * p.s, y: p.y - 40 * p.s, vx: rand(-260, 260), vy: rand(-420, -120), t: 0, dur: rand(0.6, 1), size: rand(6, 14) * p.s, rot: rand(0, TAU) });
    }
    this.sfx(['バキッ!', 'メキッ!', 'ドカッ!'][Math.min(2, c.hits - 1)], p.x + rand(-120, 120), p.y - 140 * p.s, { color: '#ffe6a8', size: 70 });
  },

  chestBreak() {
    const c = this.chest;
    if (!c) return;
    c.broken = 0.001;
    const p = this.chestPos;
    this.flash = 1;
    this.flashColor = '255,236,170';
    this.speedLines = 1;
    for (let i = 0; i < 40; i++) {
      this.particles.push({ kind: 'splinter', x: p.x + rand(-80, 80) * p.s, y: p.y + rand(-60, 40) * p.s, vx: rand(-520, 520), vy: rand(-700, -200), t: 0, dur: rand(0.8, 1.4), size: rand(10, 26) * p.s, rot: rand(0, TAU) });
    }
    this.rings.push({ x: p.x, y: p.y, r: 20, max: 420 * p.s, life: 0.7, color: '255,230,150' });
  },

  /** Сундук в деталях: стволы бамбука с объёмом, оковка, верёвка-симэнава с бумажными зигзагами, талисман. */
  paintChest(c) {
    const { ctx } = this;
    const W = 270;
    const H = 176;
    const INK = '#1a1320';
    // свет пробивается сквозь щели — ярче с каждым ударом
    const leak = Math.min(1, c.hits / c.need + 0.15);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < 7; i++) {
      const x = -W / 2 + (i * W) / 7;
      const lg = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
      lg.addColorStop(0, 'rgba(255,220,120,0)');
      lg.addColorStop(0.5, `rgba(255,230,150,${0.65 * leak})`);
      lg.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x - 10, -H / 2 + 26, 20, H - 30);
    }
    ctx.restore();
    // стволы бамбука: цилиндр с градиентом, узлы с утолщением
    for (let i = 0; i < 7; i++) {
      const x = -W / 2 + (i * W) / 7 + 2;
      const w = W / 7 - 5;
      const y0 = -H / 2 + 20;
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#5f8f32');
      g.addColorStop(0.25, '#b5dc78');
      g.addColorStop(0.55, '#8fbf58');
      g.addColorStop(1, '#3f6a22');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x, y0, w, H - 20, 10);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.stroke();
      for (const yy of [-6, 46]) {
        ctx.fillStyle = '#6d9a3a';
        ctx.beginPath();
        ctx.roundRect(x - 2, yy - 4, w + 4, 8, 4);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 3, yy - 2);
        ctx.lineTo(x + w - 3, yy - 2);
        ctx.stroke();
        ctx.strokeStyle = INK;
      }
      // прожилки
      ctx.strokeStyle = 'rgba(40,70,20,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.7, y0 + 10);
      ctx.lineTo(x + w * 0.72, H / 2 - 8);
      ctx.stroke();
    }
    // листья, проросшие сверху
    for (const [x, a, sz] of [[-110, -2.4, 1], [-96, -2.0, 0.8], [118, -0.7, 1], [104, -1.1, 0.75]]) {
      ctx.save();
      ctx.translate(x, -H / 2 - 4);
      ctx.rotate(a + Math.sin(c.t * 2 + x) * 0.06);
      ctx.fillStyle = '#7fbf6a';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(28 * sz, 0, 30 * sz, 7 * sz, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(54 * sz, 0);
      ctx.strokeStyle = 'rgba(30,60,20,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    // крышка: тёмное лакированное дерево
    const lid = ctx.createLinearGradient(0, -H / 2 - 8, 0, -H / 2 + 34);
    lid.addColorStop(0, '#6b3a22');
    lid.addColorStop(0.5, '#4a2414');
    lid.addColorStop(1, '#2c140a');
    ctx.fillStyle = lid;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(-W / 2 - 16, -H / 2 - 8, W + 32, 42, 12);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,180,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-W / 2 - 6, -H / 2 - 1);
    ctx.lineTo(W / 2 + 6, -H / 2 - 1);
    ctx.stroke();
    // золотая оковка углов
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = sx * (W / 2 + 6);
      const y = sy < 0 ? -H / 2 - 4 : H / 2 - 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sx, sy < 0 ? 1 : -1);
      const gg = ctx.createLinearGradient(-26, 0, 0, 26);
      gg.addColorStop(0, '#fff0b0');
      gg.addColorStop(0.5, '#d4a53a');
      gg.addColorStop(1, '#8a5e18');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(-28, -4);
      ctx.lineTo(4, -4);
      ctx.lineTo(4, 28);
      ctx.lineTo(-8, 28);
      ctx.lineTo(-8, 8);
      ctx.lineTo(-28, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#5a3a10';
      ctx.beginPath();
      ctx.arc(-2, 2, 2.5, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // верёвка-симэнава: витая, с бумажными зигзагами-сидэ
    const ropeY = 30;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(-W / 2 - 14, ropeY);
    ctx.quadraticCurveTo(0, ropeY + 10, W / 2 + 14, ropeY);
    ctx.stroke();
    ctx.strokeStyle = '#e2c27c';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = '#a8833a';
    ctx.lineWidth = 2;
    for (let x = -W / 2 - 8; x < W / 2 + 8; x += 12) {
      const k = (x + W / 2 + 14) / (W + 28);
      const y = ropeY + Math.sin(k * Math.PI) * 5;
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 7, y + 4);
      ctx.stroke();
    }
    for (const x of [-90, 90]) {
      ctx.save();
      ctx.translate(x, ropeY + 8);
      ctx.rotate(Math.sin(c.t * 3 + x) * 0.08);
      ctx.fillStyle = '#fbf6ee';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.lineTo(6, 12);
      ctx.lineTo(12, 12);
      ctx.lineTo(12, 26);
      ctx.lineTo(0, 26);
      ctx.lineTo(0, 40);
      ctx.lineTo(-12, 40);
      ctx.lineTo(-12, 14);
      ctx.lineTo(-6, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // талисман-офуда: бумага с надписью кистью и красной печатью
    ctx.save();
    ctx.rotate(-0.04 + Math.sin(c.t * 2.2) * 0.02);
    ctx.fillStyle = '#f6efd9';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(-24, -40, 48, 110);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#cc3325';
    ctx.lineWidth = 2;
    ctx.strokeRect(-19, -35, 38, 100);
    ctx.fillStyle = INK;
    ctx.font = "26px 'Shippori Mincho B1', serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('封', 0, -16);
    ctx.fillText('印', 0, 14);
    ctx.fillStyle = '#cc3325';
    ctx.beginPath();
    ctx.roundRect(-11, 38, 22, 22, 3);
    ctx.fill();
    ctx.restore();
    // трещины — больше с каждым ударом, из них бьёт свет
    const cracks = [
      [[-60, -40], [-40, 0], [-55, 30], [-35, 70]],
      [[70, -50], [50, -10], [72, 20], [55, 70]],
      [[-100, -30], [-84, 10], [-100, 40], [-88, 76]],
    ];
    for (let k = 0; k < Math.min(c.hits, cracks.length); k++) {
      ctx.beginPath();
      cracks[k].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,236,170,${0.7 + 0.3 * Math.sin(c.t * 10)})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  },

  drawChest(dt) {
    const c = this.chest;
    if (!c) return;
    const { ctx } = this;
    const p = this.chestPos;
    c.t += dt;
    c.shake *= Math.pow(0.02, dt);
    if (c.broken) c.broken = Math.min(1, c.broken + dt * 1.2);
    ctx.save();
    ctx.translate(p.x + (c.shake > 0.05 ? rand(-10, 10) * c.shake : 0), p.y + Math.sin(c.t * 2) * 3);
    ctx.scale(p.s, p.s);
    // тень на земле
    ctx.save();
    ctx.translate(0, 112);
    ctx.scale(1, 0.18);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, 200);
    sh.addColorStop(0, 'rgba(0,0,0,0.6)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(0, 0, 200, 0, TAU);
    ctx.fill();
    ctx.restore();
    // свечение изнутри: сильнее с каждым ударом
    const glow = (c.hits / c.need) * 0.8 + (c.broken ? 1 : 0.15 + 0.1 * Math.sin(c.t * 4));
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 260);
    g.addColorStop(0, `rgba(255,220,120,${0.5 * glow})`);
    g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 260, 0, TAU);
    ctx.fill();
    if (!c.broken) this.paintChest(c);
    ctx.restore();
  },
};
