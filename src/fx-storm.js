// Слои «больших» эффектов техник: то, что происходит не только у врага, а на всей сцене.
// Задний слой (между фоном и врагом): затемнение неба, молнии за спиной врага, выжженная земля.
// Передний слой (поверх всего): дождь, порывы ветра, разрез экрана, трещины от удара, жар взрыва.
// Методы подмешиваются в класс Arena (src/fx.js), как и fx-effects.js.

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

export const stormFx = {
  initStorm() {
    this.dim = 0; // затемнение неба 0..1
    this.dimTarget = 0;
    this.dimUntil = 0;
    this.skyBolts = []; // молнии на заднем плане
    this.scorches = []; // выжженные пятна на земле
    this.arcs = 0; // секунды, пока по врагу бегают разряды
    this.rain = 0; // секунды ливня
    this.rainDrops = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), l: rand(0.03, 0.07), v: rand(1.6, 2.4) }));
    this.gusts = 0; // секунды порывов ветра
    this.gustLines = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), l: rand(0.08, 0.26), v: rand(2.2, 3.6), a: rand(0.25, 0.7) }));
    this.cuts = []; // разрезы экрана клинком ветра
    this.cracks = []; // трещины «по стеклу» от пропущенного удара
    this.heat = 0; // оранжевый жар после взрыва
    this.ambientBoltAt = 6;
  },

  /** Небо темнеет на время техники. */
  darken(to, sec) {
    this.dimTarget = to;
    this.dimUntil = this.time + sec;
  },

  /** Большая молния на заднем плане: от края неба до горизонта, с ветками. */
  skyBolt({ x = rand(0.1, 0.9) * this.w, color = '200,225,255', life = 0.45, width = 7, toY = this.h * rand(0.62, 0.74) } = {}) {
    const pts = [{ x, y: -10 }];
    const steps = 16;
    let cx = x;
    for (let i = 1; i <= steps; i++) {
      cx += rand(-1, 1) * this.w * 0.035;
      pts.push({ x: cx, y: -10 + ((toY + 10) * i) / steps });
    }
    const bolt = { pts, life, max: life, width, color, branches: [] };
    for (let b = 0; b < 3; b++) {
      const from = pts[3 + Math.floor(Math.random() * 9)];
      const br = [{ x: from.x, y: from.y }];
      let bx = from.x;
      const dir = Math.random() < 0.5 ? -1 : 1;
      for (let i = 1; i <= 6; i++) {
        bx += dir * rand(0.01, 0.04) * this.w;
        br.push({ x: bx, y: from.y + i * rand(14, 30) });
      }
      bolt.branches.push(br);
    }
    this.skyBolts.push(bolt);
  },

  /** Выжженное пятно под врагом. */
  scorch(color = '255,140,60', life = 2.2) {
    const p = this.enemyPos;
    this.scorches.push({ x: p.x, y: p.y + 255 * p.s, r: 170 * p.s * 1.4, life, max: life, color });
  },

  /** Удар по игроку: экран «трескается» паутиной от точки удара. */
  crackScreen() {
    const cx = this.w * rand(0.35, 0.65);
    const cy = this.h * rand(0.55, 0.75);
    const lines = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.2, 0.2);
      const pts = [{ x: cx, y: cy }];
      let x = cx;
      let y = cy;
      const len = Math.hypot(this.w, this.h) * rand(0.18, 0.4);
      const segs = 6;
      for (let s = 1; s <= segs; s++) {
        const aa = a + rand(-0.25, 0.25);
        x += (Math.cos(aa) * len) / segs;
        y += (Math.sin(aa) * len) / segs;
        pts.push({ x, y });
      }
      lines.push(pts);
    }
    // кольца паутины между лучами
    const rings = [];
    for (const r of [0.05, 0.11, 0.19]) {
      const R = Math.hypot(this.w, this.h) * r;
      const ring = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU + rand(-0.12, 0.12);
        ring.push({ x: cx + Math.cos(a) * R * rand(0.85, 1.15), y: cy + Math.sin(a) * R * rand(0.85, 1.15) });
      }
      rings.push(ring);
    }
    this.cracks.push({ lines, rings, cx, cy, life: 1.3, max: 1.3 });
  },

  // ---------- задний слой ----------

  drawBackFx(dt) {
    const { ctx, w, h } = this;
    // плавное затемнение неба
    const want = this.time < this.dimUntil ? this.dimTarget : 0;
    this.dim += (want - this.dim) * Math.min(1, dt * (want > this.dim ? 6 : 1.6));
    if (this.dim > 0.01) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(6,8,22,${0.8 * this.dim})`);
      g.addColorStop(1, `rgba(6,8,22,${0.45 * this.dim})`);
      ctx.fillStyle = g;
      ctx.fillRect(-30, -30, w + 60, h + 60);
    }

    // редкие далёкие зарницы в логове Кагэро
    if (this.place === 'eclipse' && !this.reduceMotion) {
      this.ambientBoltAt -= dt;
      if (this.ambientBoltAt <= 0) {
        this.ambientBoltAt = rand(5, 9);
        this.skyBolt({ x: rand(0.05, 0.35) * w * (Math.random() < 0.5 ? 1 : 2.6), color: '255,120,110', life: 0.3, width: 3, toY: h * rand(0.35, 0.55) });
      }
    }

    // молнии за спиной врага
    this.skyBolts = this.skyBolts.filter((b) => (b.life -= dt) > 0);
    if (this.skyBolts.length) {
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const b of this.skyBolts) {
        const a = b.life / b.max;
        // мерцание: разряд гаснет и вспыхивает снова
        const flick = a > 0.55 || Math.sin(b.life * 90) > -0.2 ? 1 : 0.25;
        const stroke = (pts, width) => {
          ctx.beginPath();
          pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(${b.color},${0.16 * a * flick})`;
          ctx.lineWidth = width * 6;
          ctx.stroke();
          ctx.strokeStyle = `rgba(${b.color},${0.3 * a * flick})`;
          ctx.lineWidth = width * 2.6;
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = `rgba(245,250,255,${a * flick})`;
          ctx.lineWidth = width;
          ctx.stroke();
        };
        stroke(b.pts, b.width);
        for (const br of b.branches) stroke(br, b.width * 0.45);
        // подсветка неба вокруг удара — готовым спрайтом свечения, без градиента на весь экран
        if (this.quality > 0 && b.width >= 5) {
          const R = h * 0.5;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.5 * a * flick;
          ctx.drawImage(this.sprites.skyGlow, b.pts[3].x - R, b.pts[3].y - R, R * 2, R * 2);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.restore();
    }

    // выжженная земля
    this.scorches = this.scorches.filter((s) => (s.life -= dt) > 0);
    for (const s of this.scorches) {
      const a = s.life / s.max;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(1, 0.28);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.r);
      g.addColorStop(0, `rgba(${s.color},${0.75 * a})`);
      g.addColorStop(0.45, `rgba(${s.color},${0.3 * a})`);
      g.addColorStop(1, `rgba(${s.color},0)`);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, s.r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  },

  // ---------- передний слой ----------

  drawFrontFx(dt) {
    const { ctx, w, h } = this;

    // разряды бегают по врагу после удара молнии
    if (this.arcs > 0 && this.enemy) {
      this.arcs -= dt;
      const p = this.enemyPos;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'lighter';
      const n = this.quality === 0 ? 2 : 4;
      for (let k = 0; k < n; k++) {
        let x = p.x + rand(-130, 130) * p.s * 1.6;
        let y = p.y + rand(-160, 220) * p.s * 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 0; i < 5; i++) {
          x += rand(-28, 28) * p.s * 1.6;
          y += rand(-24, 24) * p.s * 1.6;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(150,200,255,0.35)';
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(235,245,255,0.95)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // ливень
    if (this.rain > 0) {
      this.rain -= dt;
      const a = Math.min(1, this.rain * 1.5);
      ctx.save();
      ctx.strokeStyle = `rgba(190,210,240,${0.45 * a})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const step = this.quality === 0 ? 3 : 1;
      for (let i = 0; i < this.rainDrops.length; i += step) {
        const d = this.rainDrops[i];
        d.y += d.v * dt;
        d.x -= d.v * dt * 0.12;
        if (d.y > 1.05) {
          d.y = -0.08;
          d.x = Math.random() * 1.1;
        }
        const x = d.x * w;
        const y = d.y * h;
        ctx.moveTo(x, y);
        ctx.lineTo(x - d.l * h * 0.12, y + d.l * h);
      }
      ctx.stroke();
      ctx.restore();
    }

    // порывы ветра: длинные штрихи через весь экран
    if (this.gusts > 0) {
      this.gusts -= dt;
      const a = Math.min(1, this.gusts * 2.5);
      ctx.save();
      ctx.lineCap = 'round';
      for (const g of this.gustLines) {
        g.x += g.v * dt;
        if (g.x > 1.2) {
          g.x = -0.3;
          g.y = Math.random();
        }
        const x = g.x * w;
        const y = g.y * h + Math.sin(g.x * 6) * 14;
        ctx.strokeStyle = `rgba(225,255,240,${g.a * a})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + g.l * w * 0.5, y - 10, x + g.l * w, y + 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // разрезы клинка ветра: тонкая линия через весь экран
    this.cuts = this.cuts.filter((c) => (c.life -= dt) > 0);
    for (const c of this.cuts) {
      const a = c.life / c.max;
      const grow = Math.min(1, (1 - a) * 6);
      const x1 = c.x1;
      const y1 = c.y1;
      const x2 = x1 + (c.x2 - x1) * grow;
      const y2 = y1 + (c.y2 - y1) * grow;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(160,255,210,${0.35 * a})`;
      ctx.lineWidth = 26 * a;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 4 * a + 1;
      ctx.stroke();
      ctx.restore();
    }

    // жар после взрыва — оранжевая дымка по краям
    if (this.heat > 0.01) {
      const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.2, w / 2, h * 0.45, Math.hypot(w, h) * 0.65);
      g.addColorStop(0, 'rgba(255,120,40,0)');
      g.addColorStop(1, `rgba(255,110,30,${0.45 * this.heat})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      this.heat *= Math.pow(0.15, dt);
    }

    // трещины экрана
    this.cracks = this.cracks.filter((c) => (c.life -= dt) > 0);
    for (const c of this.cracks) {
      const a = Math.min(1, (c.life / c.max) * 1.6);
      ctx.save();
      ctx.lineJoin = 'miter';
      const path = () => {
        ctx.beginPath();
        for (const pts of [...c.lines, ...c.rings]) pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      };
      path();
      ctx.strokeStyle = `rgba(10,6,12,${0.7 * a})`;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * a})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // точка удара — белая «звезда»
      const g = ctx.createRadialGradient(c.cx, c.cy, 0, c.cx, c.cy, 60);
      g.addColorStop(0, `rgba(255,255,255,${0.8 * a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c.cx - 60, c.cy - 60, 120, 120);
      ctx.restore();
    }
  },
};
