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
    // свечение изнутри: сильнее с каждым ударом
    const glow = (c.hits / c.need) * 0.8 + (c.broken ? 1 : 0.15 + 0.1 * Math.sin(c.t * 4));
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 260);
    g.addColorStop(0, `rgba(255,220,120,${0.5 * glow})`);
    g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 260, 0, TAU);
    ctx.fill();
    if (!c.broken) {
      // корпус из бамбуковых стволов
      const W = 260;
      const H = 170;
      for (let i = 0; i < 7; i++) {
        const x = -W / 2 + (i * W) / 7;
        const w = W / 7 - 4;
        const col = i % 2 ? '#7fae4c' : '#8fbf58';
        ctx.fillStyle = col;
        ctx.strokeStyle = '#1a1320';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(x + 2, -H / 2 + 20, w, H - 20, 10);
        ctx.fill();
        ctx.stroke();
        // узлы бамбука
        ctx.strokeStyle = '#4f7a2c';
        ctx.lineWidth = 4;
        for (const yy of [-10, 40]) {
          ctx.beginPath();
          ctx.moveTo(x + 4, yy);
          ctx.lineTo(x + w, yy);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x + 7, -H / 2 + 28, 4, H - 40);
      }
      // крышка
      ctx.fillStyle = '#6a8f3a';
      ctx.strokeStyle = '#1a1320';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(-W / 2 - 14, -H / 2 - 6, W + 28, 40, 12);
      ctx.fill();
      ctx.stroke();
      // верёвка и печать
      ctx.strokeStyle = '#d9b36a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-W / 2 - 10, 30);
      ctx.lineTo(W / 2 + 10, 30);
      ctx.moveTo(0, -H / 2 - 6);
      ctx.lineTo(0, H / 2);
      ctx.stroke();
      ctx.fillStyle = '#cc3325';
      ctx.strokeStyle = '#1a1320';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-26, 4, 52, 52, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#efe6cf';
      ctx.font = "34px 'Shippori Mincho B1', serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('封', 0, 32);
      // трещины — больше с каждым ударом
      ctx.strokeStyle = '#1a1320';
      ctx.lineWidth = 3;
      const cracks = [
        [[-60, -40], [-40, 0], [-55, 30], [-35, 70]],
        [[70, -50], [50, -10], [72, 20], [55, 70]],
        [[-10, -60], [10, -20], [-8, 10], [15, 70]],
      ];
      for (let k = 0; k < Math.min(c.hits, cracks.length); k++) {
        ctx.beginPath();
        cracks[k].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};
