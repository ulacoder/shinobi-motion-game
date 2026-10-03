// Силуэты на планах фона: пагода, тории, сосны, бамбук, торо, мост с фонарями, деревня и горящий город с замком.
// Методы подмешиваются в Arena (src/fx.js).

import { TAU, rgba } from './scenery-kit.js';

export const sceneryProps = {

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
      // горящий город клана: замок и кварталы, на крышах пламя (огонь и дым оживают в drawAmbient)
      this.fires = [];
      this.town(w * 0.22, w * 1.02, yAt, '#0d0306', rnd, { burning: true, maxH: h * 0.11 });
      this.castle(w * 0.14, yAt(w * 0.14) + 8, h * 0.26, '#0a0206');
      this.fires.push({ x: w * 0.14, y: yAt(w * 0.14) - h * 0.2, s: 1.5, layer: 'far' });
      this.fires.push({ x: w * 0.1, y: yAt(w * 0.1) - h * 0.08, s: 1.2, layer: 'far' });
      this.fires.push({ x: w * 0.18, y: yAt(w * 0.18) - h * 0.1, s: 1.1, layer: 'far' });
      for (let i = 0; i < 3; i++) {
        const x = w * (0.02 + rnd() * 0.08);
        this.deadTree(x, yAt(x) + 6, h * (0.07 + rnd() * 0.05), '#12030a');
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
      // деревня внизу: тёплые окна
      this.town(w * 0.22, w * 0.36, yAt, '#0e1030', rnd, { light: '#ffcf7a', maxH: h * 0.07 });
      this.town(w * 0.64, w * 1.02, yAt, '#0e1030', rnd, { light: '#ffcf7a', maxH: h * 0.07 });
    } else if (this.place === 'eclipse') {
      for (let i = 0; i < 5; i++) {
        const x = w * (rnd() < 0.5 ? rnd() * 0.25 : 0.75 + rnd() * 0.25);
        this.spike(x, yAt(x) + 14, h * (0.05 + rnd() * 0.06), '#0b0207');
      }
    }
  },

  /** Квартал домиков с загнутыми крышами вдоль гребня. burning — окна горят красным, на крышах огонь. */
  town(x0, x1, yAt, color, rnd, { burning = false, light = '#ffcf7a', maxH = 60 } = {}) {
    const { ctx, w } = this;
    let x = x0;
    while (x < x1) {
      const hw = w * (0.026 + rnd() * 0.03);
      const hh = maxH * (0.45 + rnd() * 0.55);
      const base = yAt(x + hw / 2) + 8;
      const top = base - hh;
      ctx.fillStyle = color;
      ctx.fillRect(x, top, hw, hh + 20);
      // крыша-иримоя с загнутыми краями
      const broken = burning && rnd() < 0.3;
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.18, top + 3);
      ctx.quadraticCurveTo(x + hw * 0.1, top - 2, x + hw * 0.2, top - hh * 0.32);
      if (broken) {
        ctx.lineTo(x + hw * 0.42, top - hh * 0.16);
        ctx.lineTo(x + hw * 0.55, top - hh * 0.3);
      }
      ctx.lineTo(x + hw * 0.8, top - hh * 0.32);
      ctx.quadraticCurveTo(x + hw * 0.9, top - 2, x + hw * 1.18, top + 3);
      ctx.closePath();
      ctx.fill();
      // окна: тёплый свет или отблеск пожара
      const wins = Math.max(1, Math.round(hw / 16));
      for (let i = 0; i < wins; i++) {
        if (rnd() < 0.35) continue;
        ctx.fillStyle = burning ? (rnd() < 0.5 ? 'rgba(255,110,40,0.9)' : 'rgba(255,180,80,0.8)') : rgba(light, 0.85);
        ctx.fillRect(x + (i + 0.3) * (hw / wins), top + hh * 0.3, (hw / wins) * 0.4, hh * 0.22);
      }
      if (burning && rnd() < 0.55) this.fires.push({ x: x + hw / 2, y: top - hh * 0.25, s: 0.6 + rnd() * 0.7, layer: 'far' });
      x += hw * (1.05 + rnd() * 0.5);
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
};
