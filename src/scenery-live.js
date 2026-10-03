// Живой слой фона поверх кэша: туман, облака, огни пожаров и дым, корона затмения, лава, фонарики, светлячки, птицы.
// Методы подмешиваются в Arena (src/fx.js).

import { TAU, seeded, rgba, SCENES } from './scenery-kit.js';

export const sceneryLive = {

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

  // ---------- живой слой поверх кэша ----------

  makeFlame() {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 64, 0, 0);
    gr.addColorStop(0, 'rgba(255,240,170,0.95)');
    gr.addColorStop(0.35, 'rgba(255,150,50,0.85)');
    gr.addColorStop(1, 'rgba(200,40,20,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(2, 64);
    g.quadraticCurveTo(0, 30, 16, 0);
    g.quadraticCurveTo(32, 30, 30, 64);
    g.closePath();
    g.fill();
    this.flameSprite = c;
    return c;
  },

  /** Дым пожара: снизу подсвечен огнём. */
  makeCitySmoke() {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(48, 56, 4, 48, 48, 48);
    rg.addColorStop(0, 'rgba(20,8,12,0.95)');
    rg.addColorStop(0.6, 'rgba(14,6,10,0.75)');
    rg.addColorStop(1, 'rgba(10,4,8,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 96, 96);
    this.citySmoke = c;
    return c;
  },

  makeHorizon() {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,80,30,0)');
    gr.addColorStop(0.75, 'rgba(255,90,30,1)');
    gr.addColorStop(1, 'rgba(255,60,20,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 8, 64);
    this.sprites.horizon = c;
    return c;
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
      if (!this.coronaSprite || this.coronaSprite.r0 !== r0) {
        const R = r0 * 1.6;
        const c = document.createElement('canvas');
        c.width = c.height = Math.ceil(R * 2);
        const g = c.getContext('2d');
        g.translate(R, R);
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          const len = r0 * (0.3 + 0.25 * ((i * 7) % 5) / 5);
          const gr = g.createLinearGradient(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len));
          gr.addColorStop(0, 'rgba(255,210,120,0.55)');
          gr.addColorStop(1, 'rgba(255,120,60,0)');
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(Math.cos(a - 0.07) * r0, Math.sin(a - 0.07) * r0);
          g.quadraticCurveTo(Math.cos(a + 0.05) * (r0 + len * 0.6), Math.sin(a + 0.05) * (r0 + len * 0.6), Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len));
          g.lineTo(Math.cos(a + 0.07) * r0, Math.sin(a + 0.07) * r0);
          g.closePath();
          g.fill();
        }
        c.r0 = r0;
        this.coronaSprite = c;
      }
      // корона медленно вращается и «дышит»
      const cs = this.coronaSprite;
      const sc = 1 + 0.04 * Math.sin(t * 1.3);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(t * 0.08);
      ctx.scale(sc, sc);
      ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 2.3);
      ctx.drawImage(cs, -cs.width / 2, -cs.height / 2);
      ctx.restore();
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

    // горящий город: зарево над горизонтом, пламя на крышах, столбы дыма
    if (this.place === 'eclipse' && this.fires) {
      const off = this.farOffset ?? 0;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glowA = 0.32 + 0.08 * Math.sin(t * 1.3) + 0.05 * Math.sin(t * 3.7);
      ctx.globalAlpha = glowA;
      ctx.drawImage(this.sprites.horizon ?? this.makeHorizon(), 0, h * 0.38, w, h * 0.36);
      ctx.globalAlpha = 1;
      const fl = this.flameSprite ?? this.makeFlame();
      const step = this.quality === 0 ? 2 : 1;
      for (let i = 0; i < this.fires.length; i += step) {
        const f = this.fires[i];
        const x = f.x + off;
        // пожар — пять рваных языков разной высоты, а не одна «свечка»
        for (let k = 0; k < 5; k++) {
          const flick = 0.6 + 0.4 * Math.abs(Math.sin(t * (7 + k * 2.3) + i * 1.7 + k * 1.3));
          const fh = 70 * f.s * flick * (k === 2 ? 1.25 : 0.75 + (k % 2) * 0.2);
          const fw = 26 * f.s;
          const dx = (k - 2) * 11 * f.s + Math.sin(t * 6 + i + k) * 3;
          ctx.save();
          ctx.translate(x + dx, f.y + 6);
          ctx.rotate((k - 2) * 0.12 + Math.sin(t * 4 + k + i) * 0.08);
          ctx.drawImage(fl, -fw / 2, -fh, fw, fh);
          ctx.restore();
        }
        ctx.drawImage(this.sprites.glow, x - 70 * f.s, f.y - 80 * f.s, 140 * f.s, 140 * f.s);
      }
      ctx.restore();
      // дым поднимается над пожарами и сносится ветром
      if (this.quality > 0) {
        for (let i = 0; i < this.fires.length; i += 2) {
          const f = this.fires[i];
          for (let k = 0; k < 3; k++) {
            const q = (t * 0.07 + k / 3 + i * 0.13) % 1;
            const r = (40 + q * 160) * f.s;
            ctx.globalAlpha = 0.85 * Math.sin(q * Math.PI);
            ctx.drawImage(this.citySmoke ?? this.makeCitySmoke(), f.x + off + q * 80 * f.s - r, f.y - 40 - q * h * 0.45 - r, r * 2, r * 2);
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    // ночь: в небо поднимаются бумажные фонарики
    if (this.place === 'night') {
      this.skyLanterns ??= Array.from({ length: 9 }, (_, i) => ({ x: 0.05 + (i / 9) * 0.9 + Math.random() * 0.05, p: Math.random(), v: 0.012 + Math.random() * 0.01 }));
      ctx.save();
      for (const L of this.skyLanterns) {
        L.p = (L.p + L.v * dt) % 1;
        const x = L.x * w + Math.sin(t * 0.6 + L.x * 9) * 12;
        const y = h * (0.75 - L.p * 0.7);
        const a = Math.min(1, L.p * 5, (1 - L.p) * 4);
        const sz = 5 + (1 - L.p) * 5;
        ctx.globalAlpha = a * 0.9;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.sprites.glow, x - sz * 3, y - sz * 3, sz * 6, sz * 6);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffb35a';
        ctx.fillRect(x - sz / 2, y - sz * 0.7, sz, sz * 1.3);
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
