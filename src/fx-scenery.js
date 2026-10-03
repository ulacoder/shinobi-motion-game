// Фон: небо, светило, четыре слоя гор с дымкой и подсвеченными гребнями, земля и виньетка.
// Рисуется один раз в кэш (дальний и ближний планы). Методы подмешиваются в Arena (src/fx.js).

import { TAU, seeded, rgba, SCENES } from './scenery-kit.js';

export const scenery = {

  /** Детальная статичная часть фона поверх неба (вызывается из paintStatic, рисуется в кэш). */
  paintPlace() {
    const { ctx, w, h } = this;
    const S = SCENES[this.place] ?? SCENES.night;
    const rnd = seeded(this.place.length * 977 + 13);
    // far — небо и два дальних слоя (в paintStatic), near — два ближних слоя, земля и виньетка
    const part = this.paintPart ?? 'all';
    const doLayer = (i) => part === 'all' || (part === 'far' ? i < 2 : i >= 2);

    if (part !== 'near') {
      if (this.place === 'bridge' || this.place === 'dawn') this.sunStripes();
      if (this.place === 'night') this.moonDetail();
    }

    // 4 слоя гор: дальние светлее и в дымке, у ближних — подсвеченный гребень
    const bases = [0.6, 0.68, 0.77, 0.86];
    const amps = [1.25, 1.0, 0.8, 0.55];
    for (let i = 0; i < 4; i++) {
      const pts = this.ridge(h * bases[i], amps[i] * h * 0.16, 31 + i * 17, i < 2 ? 0.9 : 0.55);
      if (!doLayer(i)) {
        continue;
      }
      ctx.fillStyle = S.layers[i];
      ctx.beginPath();
      ctx.moveTo(-20, h + 20);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.lineTo(w + 20, h + 20);
      ctx.closePath();
      ctx.fill();
      // снег на дальних вершинах
      // светлый край гребня
      ctx.strokeStyle = rgba(S.rim, i === 0 ? 0.18 : 0.12);
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      // силуэты на средних планах
      if (i === 1) this.midProps(pts, S, rnd);
      if (i === 2) this.nearProps(pts, S, rnd);
      // дымка у подножия слоя
      const fogTop = h * bases[i] - amps[i] * h * 0.05;
      const g = ctx.createLinearGradient(0, fogTop, 0, fogTop + h * 0.14);
      g.addColorStop(0, rgba(S.fog, 0));
      g.addColorStop(1, rgba(S.fog, i < 3 ? 0.28 : 0.12));
      ctx.fillStyle = g;
      ctx.fillRect(-20, fogTop, w + 40, h * 0.14);
    }

    if (part === 'far') return;
    if (this.place === 'bridge') this.bridgeDetail();
    this.groundDetail(S, rnd);

    // виньетка: края кадра темнее, взгляд — в центр
    const v = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.hypot(w, h) * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(4,2,10,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(-20, -20, w + 40, h + 40);
  },

  /** Ломаный гребень: острые пики из суммы синусов. */
  ridge(base, amp, seed, sharp) {
    const { w } = this;
    const pts = [];
    for (let x = -20; x <= w + 20; x += 8) {
      const t = x / w;
      let y = Math.sin(t * 5.1 + seed) * 0.5 + Math.sin(t * 11.3 + seed * 1.7) * 0.25 + Math.sin(t * 23 + seed * 0.3) * 0.1;
      y = Math.sign(y) * Math.pow(Math.abs(y), sharp);
      pts.push({ x, y: base - (y * 0.5 + 0.5) * amp });
    }
    return pts;
  },

  snowCaps(pts) {
    const { ctx } = this;
    const top = Math.min(...pts.map((p) => p.y));
    const line = top + 26;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, line);
    for (const p of pts) ctx.lineTo(p.x, Math.min(line, p.y));
    ctx.lineTo(pts[pts.length - 1].x, line);
    ctx.closePath();
    ctx.fillStyle = 'rgba(220,226,255,0.55)';
    ctx.fill();
    ctx.restore();
  },

  groundDetail(S, rnd) {
    const { ctx, w, h } = this;
    if (this.place === 'bridge') return;
    const top = h * 0.9;
    const g = ctx.createLinearGradient(0, top - h * 0.04, 0, h);
    g.addColorStop(0, rgba(S.layers[3], 0));
    g.addColorStop(0.3, S.layers[3]);
    g.addColorStop(1, '#050308');
    ctx.fillStyle = g;
    ctx.fillRect(-20, top - h * 0.04, w + 40, h * 0.16);
    // трава и камни по краям
    ctx.strokeStyle = rgba(S.layers[2], 1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 160; i++) {
      const x = rnd() * w;
      const y = top + rnd() * h * 0.1;
      const len = 6 + rnd() * 14;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 2, y - len * 0.6, x + (rnd() - 0.3) * 8, y - len);
    }
    ctx.stroke();
    ctx.fillStyle = '#07050c';
    for (let i = 0; i < 7; i++) {
      const x = rnd() < 0.5 ? rnd() * w * 0.3 : w * (0.7 + rnd() * 0.3);
      const y = top + h * (0.02 + rnd() * 0.06);
      ctx.beginPath();
      ctx.ellipse(x, y, 14 + rnd() * 26, 6 + rnd() * 10, 0, Math.PI, TAU);
      ctx.fill();
    }
    if (this.place === 'eclipse') {
      // трещины в земле с лавой
      ctx.strokeStyle = 'rgba(255,90,40,0.55)';
      ctx.lineWidth = 2;
      this.lavaPaths = [];
      for (let i = 0; i < 12; i++) {
        let x = rnd() * w;
        let y = top + rnd() * h * 0.08;
        const path = [{ x, y }];
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (rnd() - 0.5) * 70;
          y += rnd() * 10;
          ctx.lineTo(x, y);
          path.push({ x, y });
        }
        ctx.stroke();
        this.lavaPaths.push(path);
      }
    }
  },

  moonDetail() {
    // кратеры и ореол поверх луны из PLACES (луна уже нарисована в paintStatic)
    const P = this.orbPos?.();
    if (!P) return;
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.arc(P.x, P.y, P.r, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(160,150,190,0.22)';
    for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.38, 0.12], [0.35, -0.35, 0.09], [-0.42, 0.25, 0.08]]) {
      ctx.beginPath();
      ctx.arc(P.x + dx * P.r, P.y + dy * P.r, rr * P.r, 0, TAU);
      ctx.fill();
    }
    // мягкая тень по краю — луна объёмная
    const g = ctx.createRadialGradient(P.x - P.r * 0.3, P.y - P.r * 0.3, P.r * 0.2, P.x, P.y, P.r);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(90,80,140,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(P.x - P.r, P.y - P.r, P.r * 2, P.r * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(239,230,207,0.12)';
    ctx.lineWidth = 2;
    for (const k of [1.35, 1.7]) {
      ctx.beginPath();
      ctx.arc(P.x, P.y, P.r * k, 0, TAU);
      ctx.stroke();
    }
  },

  /** Солнце с горизонтальными прорезями — как на старых аниме-закатах. */
  sunStripes() {
    const P = this.orbPos?.();
    if (!P) return;
    const { ctx } = this;
    // прорези закрашиваем тем же градиентом неба — солнце «режется» полосами
    ctx.save();
    ctx.fillStyle = this.skyGrad ?? '#f2a55a';
    for (let i = 0; i < 5; i++) {
      const y = P.y + P.r * (0.15 + i * 0.17);
      ctx.fillRect(P.x - P.r - 2, y, P.r * 2 + 4, 2 + i * 1.6);
    }
    ctx.restore();
    // лучи
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      ctx.fillStyle = 'rgba(255,220,170,0.05)';
      ctx.beginPath();
      ctx.moveTo(P.x, P.y);
      ctx.lineTo(P.x + Math.cos(a - 0.05) * this.w, P.y + Math.sin(a - 0.05) * this.w);
      ctx.lineTo(P.x + Math.cos(a + 0.05) * this.w, P.y + Math.sin(a + 0.05) * this.w);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },

  eclipseRays() {
    const { ctx, w, h } = this;
    const x = w * 0.78;
    const y = h * 0.22;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU + 0.1;
      ctx.fillStyle = i % 2 ? 'rgba(255,120,60,0.05)' : 'rgba(255,60,40,0.07)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a - 0.04) * w * 1.2, y + Math.sin(a - 0.04) * w * 1.2);
      ctx.lineTo(x + Math.cos(a + 0.04) * w * 1.2, y + Math.sin(a + 0.04) * w * 1.2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },

  /** Позиция светила (луна/солнце) — для деталей и живого слоя. */
  orbPos() {
    const orb = { night: { x: 0.82, y: 0.2 }, bridge: { x: 0.25, y: 0.32 }, dawn: { x: 0.5, y: 0.62 } }[this.place];
    if (!orb) return null;
    return { x: this.w * orb.x, y: this.h * orb.y, r: Math.min(this.w, this.h) * 0.09 };
  },
};
