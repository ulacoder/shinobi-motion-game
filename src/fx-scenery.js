// Детальные фоны локаций: слои гор с дымкой и подсветкой гребней, силуэты (пагода, бамбук,
// мост с фонарями, замок Кагэро), трава, туман и виньетка — всё рисуется один раз в кэш фона.
// Плюс живой слой поверх кэша: облака, лучи света, светлячки, огни фонарей, блики на воде, птицы.
// Методы подмешиваются в класс Arena (src/fx.js).

const TAU = Math.PI * 2;

/** Детерминированный генератор случайных чисел: фон одинаковый при каждой перерисовке. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Сцены: цвета слоёв от дальнего к ближнему, дымка, подсветка гребней. */
const SCENES = {
  night: { layers: ['#2a2f6e', '#20245a', '#171a44', '#0f1130'], fog: '#3a3f86', rim: '#9aa6ff', snow: true },
  forest: { layers: ['#2f6052', '#22493f', '#17352e', '#0d2420'], fog: '#5f8f6f', rim: '#ffcf8a' },
  bridge: { layers: ['#7a3d63', '#5c2b4f', '#43203d', '#2a1426'], fog: '#d9727a', rim: '#ffc48a' },
  eclipse: { layers: ['#3a0d1c', '#2a0914', '#1c060e', '#100308'], fog: '#7a1b26', rim: '#ff6a4a' },
  dawn: { layers: ['#b69ad0', '#9a82c0', '#7a68a8', '#5a4a86'], fog: '#f2c2b2', rim: '#fff0d0' },
};

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

  /** Средний план: пагода, бамбук или замок — по краям, центр свободен для врага. */
  midProps(pts, S, rnd) {
    const { w, h } = this;
    const yAt = (x) => pts[Math.max(0, Math.min(pts.length - 1, Math.round((x + 20) / 8)))].y;
    if (this.place === 'night') {
      this.pagoda(w * 0.86, yAt(w * 0.86) + 6, h * 0.2, S.layers[2], '#ffd27a');
      for (let i = 0; i < 9; i++) {
        const x = w * (0.02 + rnd() * 0.24);
        this.pine(x, yAt(x) + 10, h * (0.06 + rnd() * 0.05), S.layers[2]);
      }
    } else if (this.place === 'eclipse') {
      this.castle(w * 0.14, yAt(w * 0.14) + 8, h * 0.26, '#0a0206');
      for (let i = 0; i < 4; i++) {
        const x = w * (0.72 + rnd() * 0.26);
        this.deadTree(x, yAt(x) + 6, h * (0.08 + rnd() * 0.06), '#12030a');
      }
    } else if (this.place === 'forest') {
      for (let i = 0; i < 16; i++) {
        const side = i % 2 ? rnd() * 0.3 : 0.7 + rnd() * 0.3;
        this.bamboo(w * side, h * 0.95, h * (0.75 + rnd() * 0.25), S.layers[2], rnd);
      }
    } else if (this.place === 'dawn') {
      this.pagoda(w * 0.12, yAt(w * 0.12) + 6, h * 0.16, S.layers[2], '#fff0c8');
    }
  },

  nearProps(pts, S, rnd) {
    const { w, h } = this;
    const yAt = (x) => pts[Math.max(0, Math.min(pts.length - 1, Math.round((x + 20) / 8)))].y;
    if (this.place === 'forest') {
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? rnd() * 0.18 : 0.82 + rnd() * 0.18;
        this.bamboo(w * side, h * 1.02, h * 1.1, S.layers[3], rnd, 1.6);
      }
      this.toro(w * 0.08, h * 0.93, h * 0.12);
    } else if (this.place === 'night') {
      this.torii(w * 0.16, yAt(w * 0.16) + 10, h * 0.13, '#0d0f2a');
    } else if (this.place === 'eclipse') {
      for (let i = 0; i < 5; i++) {
        const x = w * (rnd() < 0.5 ? rnd() * 0.25 : 0.75 + rnd() * 0.25);
        this.spike(x, yAt(x) + 14, h * (0.05 + rnd() * 0.06), '#0b0207');
      }
    }
  },

  pagoda(x, y, size, color, light) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = color;
    const tiers = 5;
    let yy = y;
    for (let i = 0; i < tiers; i++) {
      const tw = size * (0.55 - i * 0.07);
      const th = size * 0.13;
      ctx.fillRect(x - tw * 0.32, yy - th, tw * 0.64, th);
      // загнутая крыша
      ctx.beginPath();
      ctx.moveTo(x - tw * 0.62, yy - th + 2);
      ctx.quadraticCurveTo(x - tw * 0.3, yy - th - 4, x, yy - th - size * 0.06);
      ctx.quadraticCurveTo(x + tw * 0.3, yy - th - 4, x + tw * 0.62, yy - th + 2);
      ctx.lineTo(x + tw * 0.45, yy - th - 2);
      ctx.lineTo(x - tw * 0.45, yy - th - 2);
      ctx.closePath();
      ctx.fill();
      // окна-огоньки
      ctx.fillStyle = rgba(light, 0.75);
      ctx.fillRect(x - tw * 0.08, yy - th * 0.75, tw * 0.16, th * 0.4);
      ctx.fillStyle = color;
      yy -= th + size * 0.06;
    }
    ctx.fillRect(x - 1.5, yy - size * 0.16, 3, size * 0.18);
    ctx.restore();
  },

  pine(x, y, size, color) {
    const { ctx } = this;
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      const yy = y - size * (0.3 + i * 0.25);
      const ww = size * (0.42 - i * 0.1);
      ctx.beginPath();
      ctx.moveTo(x - ww, yy + size * 0.18);
      ctx.lineTo(x, yy - size * 0.2);
      ctx.lineTo(x + ww, yy + size * 0.18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(x - 2, y - size * 0.15, 4, size * 0.2);
  },

  torii(x, y, size, color) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = color;
    const wd = size * 1.1;
    ctx.fillRect(x - wd * 0.38, y - size, size * 0.09, size);
    ctx.fillRect(x + wd * 0.38 - size * 0.09, y - size, size * 0.09, size);
    ctx.fillRect(x - wd * 0.45, y - size * 0.78, wd * 0.9, size * 0.07);
    ctx.beginPath();
    ctx.moveTo(x - wd * 0.62, y - size * 0.9);
    ctx.quadraticCurveTo(x, y - size * 1.02, x + wd * 0.62, y - size * 0.9);
    ctx.lineTo(x + wd * 0.58, y - size * 1.04);
    ctx.quadraticCurveTo(x, y - size * 1.16, x - wd * 0.58, y - size * 1.04);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  castle(x, y, size, color) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = color;
    // каменное основание
    ctx.beginPath();
    ctx.moveTo(x - size * 0.5, y);
    ctx.lineTo(x - size * 0.4, y - size * 0.22);
    ctx.lineTo(x + size * 0.4, y - size * 0.22);
    ctx.lineTo(x + size * 0.5, y);
    ctx.closePath();
    ctx.fill();
    let yy = y - size * 0.22;
    for (let i = 0; i < 4; i++) {
      const tw = size * (0.78 - i * 0.15);
      const th = size * 0.12;
      ctx.fillRect(x - tw * 0.36, yy - th, tw * 0.72, th);
      ctx.beginPath();
      ctx.moveTo(x - tw * 0.62, yy - th + 4);
      ctx.quadraticCurveTo(x - tw * 0.2, yy - th - 2, x, yy - th - size * 0.07);
      ctx.quadraticCurveTo(x + tw * 0.2, yy - th - 2, x + tw * 0.62, yy - th + 4);
      ctx.closePath();
      ctx.fill();
      // красные окна-бойницы
      ctx.fillStyle = 'rgba(255,90,60,0.8)';
      for (let k = -1; k <= 1; k++) ctx.fillRect(x + k * tw * 0.18 - 3, yy - th * 0.7, 6, th * 0.35);
      ctx.fillStyle = color;
      yy -= th + size * 0.07;
    }
    // рога-сятихоко на крыше
    ctx.beginPath();
    ctx.moveTo(x - size * 0.08, yy);
    ctx.lineTo(x - size * 0.13, yy - size * 0.08);
    ctx.lineTo(x - size * 0.03, yy);
    ctx.moveTo(x + size * 0.08, yy);
    ctx.lineTo(x + size * 0.13, yy - size * 0.08);
    ctx.lineTo(x + size * 0.03, yy);
    ctx.fill();
    ctx.restore();
  },

  deadTree(x, y, size, color) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    const branch = (bx, by, len, ang, wd, depth) => {
      const ex = bx + Math.cos(ang) * len;
      const ey = by + Math.sin(ang) * len;
      ctx.lineWidth = wd;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      if (depth > 0) {
        branch(ex, ey, len * 0.68, ang - 0.5, wd * 0.6, depth - 1);
        branch(ex, ey, len * 0.62, ang + 0.45, wd * 0.6, depth - 1);
      }
    };
    branch(x, y, size * 0.45, -Math.PI / 2, size * 0.08, 4);
    ctx.restore();
  },

  spike(x, y, size, color) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.25, y);
    ctx.lineTo(x - size * 0.05, y - size);
    ctx.lineTo(x + size * 0.08, y - size * 0.55);
    ctx.lineTo(x + size * 0.2, y - size * 0.8);
    ctx.lineTo(x + size * 0.3, y);
    ctx.closePath();
    ctx.fill();
  },

  bamboo(x, bottom, height, color, rnd, scale = 1) {
    const { ctx } = this;
    const wd = (8 + rnd() * 6) * scale;
    const lean = (rnd() - 0.5) * 0.08;
    ctx.save();
    ctx.translate(x, bottom);
    ctx.rotate(lean);
    ctx.fillStyle = color;
    ctx.fillRect(-wd / 2, -height, wd, height);
    // узлы стебля
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = -height; y < 0; y += 60 * scale) ctx.fillRect(-wd / 2 - 1, y, wd + 2, 3 * scale);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(-wd / 2 + 1, -height, wd * 0.25, height);
    // листья
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const y = -height * (0.35 + rnd() * 0.6);
      const dir = rnd() < 0.5 ? -1 : 1;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(dir * (14 + k * 10) * scale, y + k * 6 * scale, 16 * scale, 3.4 * scale, dir * (0.3 + k * 0.25), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  /** Каменный фонарь торо. */
  toro(x, y, size) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = '#0a1a16';
    ctx.fillRect(x - size * 0.08, y - size * 0.5, size * 0.16, size * 0.5);
    ctx.fillRect(x - size * 0.26, y - size * 0.56, size * 0.52, size * 0.08);
    ctx.fillRect(x - size * 0.18, y - size * 0.8, size * 0.36, size * 0.24);
    ctx.beginPath();
    ctx.moveTo(x - size * 0.34, y - size * 0.8);
    ctx.lineTo(x, y - size);
    ctx.lineTo(x + size * 0.34, y - size * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,210,120,0.85)';
    ctx.fillRect(x - size * 0.09, y - size * 0.74, size * 0.18, size * 0.12);
    ctx.restore();
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

  bridgeDetail() {
    const { ctx, w, h } = this;
    // вода под мостом
    const top = h * 0.84;
    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, '#5a2a4a');
    g.addColorStop(1, '#1a0e1c');
    ctx.fillStyle = g;
    ctx.fillRect(-20, top, w + 40, h - top + 20);
    ctx.strokeStyle = 'rgba(255,190,150,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const y = top + 8 + (i / 18) * (h - top);
      const x = ((i * 137) % 100) / 100 * w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30 + (i % 4) * 20, y);
      ctx.stroke();
    }
    // арочный мост: настил, перила, столбики с навершиями
    const arc = (k) => h * 0.8 - Math.sin(k * Math.PI) * h * 0.06;
    ctx.fillStyle = '#7a1e22';
    ctx.strokeStyle = '#1a0a10';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, arc(0) + 10);
    for (let i = 0; i <= 40; i++) ctx.lineTo((i / 40) * w, arc(i / 40));
    ctx.lineTo(w + 20, arc(1) + 10);
    for (let i = 40; i >= 0; i--) ctx.lineTo((i / 40) * w, arc(i / 40) + h * 0.035);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // перила
    ctx.strokeStyle = '#a3282b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * w;
      const y = arc(i / 40) - h * 0.06;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i <= 12; i++) {
      const x = (i / 12) * w;
      const y = arc(i / 12);
      ctx.fillStyle = '#8a2226';
      ctx.fillRect(x - 4, y - h * 0.07, 8, h * 0.07);
      ctx.fillStyle = '#d4a53a';
      ctx.beginPath();
      ctx.arc(x, y - h * 0.074, 6, 0, TAU);
      ctx.fill();
    }
    this.lanterns = [0.12, 0.3, 0.7, 0.88].map((k) => ({ x: k * w, y: arc(k) - h * 0.115 }));
    for (const L of this.lanterns) {
      ctx.strokeStyle = '#1a0a10';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(L.x, L.y - 20);
      ctx.lineTo(L.x, L.y - 10);
      ctx.stroke();
      ctx.fillStyle = '#e04a3a';
      ctx.beginPath();
      ctx.ellipse(L.x, L.y, 10, 13, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,10,10,0.6)';
      ctx.lineWidth = 1.2;
      for (const dy of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.moveTo(L.x - 9, L.y + dy);
        ctx.lineTo(L.x + 9, L.y + dy);
        ctx.stroke();
      }
    }
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

  /** Позиция светила (луна/солнце) — для деталей и живого слоя. */
  orbPos() {
    const orb = { night: { x: 0.82, y: 0.2 }, bridge: { x: 0.25, y: 0.32 }, dawn: { x: 0.5, y: 0.62 } }[this.place];
    if (!orb) return null;
    return { x: this.w * orb.x, y: this.h * orb.y, r: Math.min(this.w, this.h) * 0.09 };
  },

  // ---------- живой слой поверх кэша ----------

  /** Полосы тумана плывут между планами: 0 — за ближними горами, 1 — у самой земли. */
  drawFog(dt, layer) {
    if (this.quality === 0) return;
    const { ctx, w, h } = this;
    const S = SCENES[this.place] ?? SCENES.night;
    if (!this.fogSprite || this.fogSprite.place !== this.place) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 96;
      const g = c.getContext('2d');
      const rnd = seeded(7);
      for (let i = 0; i < 26; i++) {
        const x = rnd() * 512;
        const y = 48 + (rnd() - 0.5) * 30;
        const r = 30 + rnd() * 50;
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, rgba(S.fog, 0.35));
        rg.addColorStop(1, rgba(S.fog, 0));
        g.fillStyle = rg;
        // повторяем у краёв, чтобы полоса склеивалась бесшовно
        for (const dx of [-512, 0, 512]) g.fillRect(x - r + dx, y - r, r * 2, r * 2);
      }
      c.place = this.place;
      this.fogSprite = c;
    }
    const y = layer ? h * 0.82 : h * 0.6;
    const bandH = h * (layer ? 0.16 : 0.2);
    const tileW = w * 0.9;
    this.fogX = (this.fogX ?? 0) + dt;
    const off = (-(this.fogX * (layer ? 22 : 9)) % tileW) - tileW;
    ctx.save();
    ctx.globalAlpha = layer ? 0.55 : 0.75;
    for (let x = off; x < w + tileW; x += tileW) ctx.drawImage(this.fogSprite, x, y - bandH / 2, tileW, bandH);
    ctx.restore();
  },

  drawAmbient(dt) {
    const { ctx, w, h } = this;
    const t = this.time;
    this.ambClouds ??= Array.from({ length: 4 }, (_, i) => ({ x: i / 4 + Math.random() * 0.2, y: 0.08 + Math.random() * 0.22, s: 0.7 + Math.random() * 0.6, v: 0.004 + Math.random() * 0.006 }));
    this.flies ??= Array.from({ length: 18 }, () => ({ x: Math.random(), y: 0.45 + Math.random() * 0.45, p: Math.random() * TAU }));

    // плывущие облака
    if (this.place !== 'forest') {
      const tint = { night: '120,130,200', bridge: '255,170,160', eclipse: '120,20,30', dawn: '255,235,225' }[this.place];
      for (const c of this.ambClouds) {
        c.x += c.v * dt;
        if (c.x > 1.3) c.x = -0.4;
        const cw = w * 0.32 * c.s;
        const ch = h * 0.05 * c.s;
        ctx.fillStyle = `rgba(${tint},0.16)`;
        ctx.beginPath();
        for (const [dx, dy, rx, ry] of [[0, 0, 0.5, 1], [0.22, -0.5, 0.28, 0.9], [-0.2, -0.3, 0.22, 0.7]]) {
          ctx.moveTo(c.x * w + dx * cw + rx * cw, c.y * h + dy * ch);
          ctx.ellipse(c.x * w + dx * cw, c.y * h + dy * ch, rx * cw, ry * ch, 0, 0, TAU);
        }
        ctx.fill();
      }
    }

    // пульсирующие лучи от затмения
    if (this.place === 'eclipse') {
      const ex = w * 0.78;
      const ey = h * 0.22;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * (0.55 + i * 0.09) + Math.sin(t * 0.2 + i) * 0.03;
        const al = 0.035 + 0.03 * Math.sin(t * 0.9 + i * 1.3);
        const r0 = Math.min(w, h) * 0.11; // лучи начинаются за краем диска — затмение остаётся чёрным
        ctx.fillStyle = `rgba(255,150,90,${al})`;
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a - 0.02) * r0, ey + Math.sin(a - 0.02) * r0);
        ctx.lineTo(ex + Math.cos(a - 0.06) * w * 1.3, ey + Math.sin(a - 0.06) * w * 1.3);
        ctx.lineTo(ex + Math.cos(a + 0.06) * w * 1.3, ey + Math.sin(a + 0.06) * w * 1.3);
        ctx.lineTo(ex + Math.cos(a + 0.02) * r0, ey + Math.sin(a + 0.02) * r0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // логово Кагэро: корона затмения шевелится, лава в трещинах дышит
    if (this.place === 'eclipse' && this.quality > 0) {
      const ex = w * 0.78;
      const ey = h * 0.22;
      const r0 = Math.min(w, h) * 0.1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU + t * 0.08;
        const len = r0 * (0.25 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2.3 + i * 2.1)));
        const g = ctx.createLinearGradient(ex + Math.cos(a) * r0, ey + Math.sin(a) * r0, ex + Math.cos(a) * (r0 + len), ey + Math.sin(a) * (r0 + len));
        g.addColorStop(0, 'rgba(255,210,120,0.5)');
        g.addColorStop(1, 'rgba(255,120,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a - 0.07) * r0, ey + Math.sin(a - 0.07) * r0);
        ctx.quadraticCurveTo(ex + Math.cos(a + 0.05) * (r0 + len * 0.6), ey + Math.sin(a + 0.05) * (r0 + len * 0.6), ex + Math.cos(a) * (r0 + len), ey + Math.sin(a) * (r0 + len));
        ctx.lineTo(ex + Math.cos(a + 0.07) * r0, ey + Math.sin(a + 0.07) * r0);
        ctx.closePath();
        ctx.fill();
      }
      if (this.lavaPaths) {
        const glowA = 0.35 + 0.25 * Math.sin(t * 1.7);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const [j, path] of this.lavaPaths.entries()) {
          ctx.beginPath();
          path.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
          ctx.strokeStyle = `rgba(255,90,30,${glowA * (0.6 + 0.4 * Math.sin(t * 2.4 + j))})`;
          ctx.lineWidth = 7;
          ctx.stroke();
          ctx.strokeStyle = `rgba(255,200,120,${glowA})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // лучи света сквозь бамбук
    if (this.place === 'forest') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const a = 0.05 + 0.04 * Math.sin(t * 0.6 + i * 1.7);
        const x = w * (0.15 + i * 0.18);
        ctx.fillStyle = `rgba(255,220,150,${a})`;
        ctx.beginPath();
        ctx.moveTo(x, -10);
        ctx.lineTo(x + w * 0.05, -10);
        ctx.lineTo(x + w * 0.2, h);
        ctx.lineTo(x + w * 0.08, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // светлячки
    if (this.place === 'forest' || this.place === 'night') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const step = this.quality === 0 ? 3 : 1;
      for (let i = 0; i < this.flies.length; i += step) {
        const f = this.flies[i];
        const x = (f.x + Math.sin(t * 0.3 + f.p) * 0.03) * w;
        const y = (f.y + Math.cos(t * 0.4 + f.p) * 0.02) * h;
        const a = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + f.p * 3));
        ctx.drawImage(this.sprites.fly, x - 8, y - 8, 16, 16);
        ctx.fillStyle = `rgba(255,250,190,${a})`;
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
      ctx.restore();
    }

    // огни фонарей на мосту и блики на воде
    if (this.place === 'bridge' && this.lanterns) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const [i, L] of this.lanterns.entries()) {
        const a = 0.5 + 0.2 * Math.sin(t * 7 + i * 2) + 0.1 * Math.sin(t * 13 + i);
        ctx.globalAlpha = a;
        ctx.drawImage(this.sprites.glow, L.x - 46, L.y - 46, 92, 92);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,200,150,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const y = h * (0.87 + i * 0.012);
        const x = ((t * 30 * (1 + (i % 3)) + i * 97) % (w + 200)) - 100;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 40, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // птицы на рассвете
    if (this.place === 'dawn') {
      ctx.strokeStyle = 'rgba(60,40,80,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const x = ((t * 40 + i * 70) % (w + 200)) - 100;
        const y = h * (0.2 + (i % 3) * 0.04) + Math.sin(t + i) * 6;
        const flap = Math.sin(t * 8 + i) * 4;
        ctx.moveTo(x - 9, y - flap);
        ctx.quadraticCurveTo(x - 4, y - 4, x, y);
        ctx.quadraticCurveTo(x + 4, y - 4, x + 9, y - flap);
      }
      ctx.stroke();
    }
  },
};
