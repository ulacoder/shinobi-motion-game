// Отрисовка частиц сцены боя: огонь, искры, дым, серпы ветра, дракон, тучи, сфера, молнии,
// кольца ударов и японские звуковые надписи. Методы подмешиваются в Arena (src/fx.js).

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

export const particlesFx = {
  drawParticles(dt) {
    const { ctx } = this;
    const keep = [];
    for (const p of this.particles) {
      p.t += dt;
      if (p.kind === 'timer') {
        if (p.t >= p.dur) p.fn();
        else keep.push(p);
        continue;
      }
      if (p.t < 0) {
        keep.push(p);
        continue;
      }
      const k = p.t / p.dur;
      if (k >= 1) continue;
      keep.push(p);
      if (p.kind === 'fire') {
        const e = k * k * (3 - 2 * k);
        const x = p.x + (p.tx - p.x) * e;
        const y = p.y + (p.ty - p.y) * e - Math.sin(k * Math.PI) * 80;
        const img = this.sprites.fire[Math.min(this.sprites.fire.length - 1, Math.floor((p.hue - 10) / 7))];
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(img, x - p.size, y - p.size, p.size * 2, p.size * 2);
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.kind === 'spark') {
        const x = p.x + p.vx * p.t;
        const y = p.y + p.vy * p.t + 200 * p.t * p.t;
        const r = p.size * (1 - k * 0.5);
        ctx.fillStyle = `rgba(${p.color},${1 - k})`;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      } else if (p.kind === 'smoke') {
        const x = p.x + p.vx * p.t;
        const y = p.y + p.vy * p.t;
        ctx.fillStyle = `rgba(235,232,245,${0.85 * (1 - k)})`;
        ctx.strokeStyle = `rgba(40,30,50,${0.5 * (1 - k)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (0.6 + k * 0.6), 0, TAU);
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === 'slash') {
        // серп ветра: дуга летит к врагу и растёт
        const e = k * k;
        const x = p.x + (p.tx - p.x) * e;
        const y = p.y + (p.ty - p.y) * e;
        const r = p.size * (0.5 + k * 0.7);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.dir * 0.7);
        ctx.globalCompositeOperation = 'lighter';
        for (const [wd, a] of [[16, 0.25], [7, 0.9]]) {
          ctx.strokeStyle = `rgba(200,255,225,${a * (1 - k * 0.5)})`;
          ctx.lineWidth = wd;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, 0, r, -1.2, 1.2);
          ctx.stroke();
        }
        ctx.restore();
      } else if (p.kind === 'dragon') {
        // дракон из света: змеистая лента с головой спускается сверху
        const head = Math.min(1, k * 1.15);
        const segs = 26;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        let hx = 0;
        let hy = 0;
        for (let i = 0; i < segs; i++) {
          const q = head - i * 0.035;
          if (q < 0) break;
          const yy = p.y + (p.ty - p.y) * q;
          const xx = p.tx + Math.sin(q * 9 + this.time * 3) * 120 * (1 - q * 0.6) * (p.size / 60);
          if (i === 0) {
            hx = xx;
            hy = yy;
          }
          const w = p.size * (1 - i / segs) + 4;
          ctx.fillStyle = `rgba(255,${170 + i * 3},80,${0.55 * (1 - i / segs)})`;
          ctx.beginPath();
          ctx.arc(xx, yy, w, 0, TAU);
          ctx.fill();
        }
        // голова
        ctx.fillStyle = 'rgba(255,240,190,0.95)';
        ctx.beginPath();
        ctx.ellipse(hx, hy, p.size * 1.2, p.size * 0.8, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(200,40,30,0.9)';
        ctx.beginPath();
        ctx.arc(hx - p.size * 0.4, hy - p.size * 0.2, p.size * 0.15, 0, TAU);
        ctx.arc(hx + p.size * 0.4, hy - p.size * 0.2, p.size * 0.15, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'splinter') {
        const x = p.x + p.vx * p.t;
        const y = p.y + p.vy * p.t + 900 * p.t * p.t;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot + p.t * 8);
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#8fbf58';
        ctx.strokeStyle = '#1a1320';
        ctx.lineWidth = 2;
        ctx.fillRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
        ctx.strokeRect(-p.size / 2, -p.size / 6, p.size, p.size / 3);
        ctx.restore();
      } else if (p.kind === 'cloud') {
        // клубы грозовой тучи: быстро набухают и медленно тают
        const grow = Math.min(1, k * 4);
        const alpha = k < 0.7 ? 0.85 : 0.85 * (1 - (k - 0.7) / 0.3);
        const r = p.size * (0.4 + 0.6 * grow);
        ctx.globalAlpha = alpha;
        ctx.drawImage(this.sprites.cloud, p.x - r, p.y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        if (k > 0.25 && k < 0.45 && Math.random() < 0.3) {
          ctx.fillStyle = 'rgba(200,225,255,0.35)';
          ctx.beginPath();
          ctx.arc(p.x + rand(-r, r) * 0.5, p.y, r * 0.5, 0, TAU);
          ctx.fill();
        }
      } else if (p.kind === 'target') {
        const pulse = 0.5 + 0.5 * Math.sin(p.t * 30);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, 0.35);
        ctx.strokeStyle = `rgba(160,210,255,${0.5 + 0.5 * pulse})`;
        ctx.lineWidth = 6;
        ctx.setLineDash([18, 12]);
        ctx.lineDashOffset = -p.t * 200;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.2 - k * 0.4), 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(120,180,255,${0.12 + 0.12 * pulse})`;
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'sphere') {
        const e = k < 0.45 ? 0 : ((k - 0.45) / 0.55) ** 2;
        const x = p.x + (p.tx - p.x) * e;
        const y = p.y + (p.ty - p.y) * e;
        const r = p.size * (k < 0.45 ? k / 0.45 : 1);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
        g.addColorStop(0, 'rgba(230,250,255,1)');
        g.addColorStop(0.4, 'rgba(88,208,255,0.9)');
        g.addColorStop(1, 'rgba(88,208,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.6, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(230,250,255,0.8)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * 0.35, this.time * 8 + (i * Math.PI) / 3, 0, TAU);
          ctx.stroke();
        }
      } else {
        this.drawParticle2(p, k);
      }
    }
    this.particles = keep;
  },

  drawBolts(dt) {
    const { ctx } = this;
    this.bolts = this.bolts.filter((b) => (b.life -= dt) > 0);
    for (const b of this.bolts) {
      const a = b.life / b.max;
      ctx.beginPath();
      b.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      // свечение — несколько широких полупрозрачных проходов вместо дорогого размытия
      ctx.globalCompositeOperation = 'lighter';
      const glow = b.big ? [[5.5, 0.12], [3, 0.22]] : [[3, 0.18]];
      for (const [mul, alpha] of glow) {
        ctx.strokeStyle = `rgba(120,190,255,${a * alpha})`;
        ctx.lineWidth = b.width * mul * a + 2;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(235,246,255,${a})`;
      ctx.lineWidth = b.width * a + 1;
      ctx.stroke();
    }
  },

  drawRings(dt) {
    const { ctx } = this;
    this.rings = this.rings.filter((r) => (r.life -= dt) > 0);
    for (const r of this.rings) {
      r.r += (r.max - r.r) * Math.min(1, dt * 8);
      ctx.strokeStyle = `rgba(${r.color},${Math.min(1, r.life * 2)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
  },

  drawTexts(dt) {
    const { ctx } = this;
    this.texts = this.texts.filter((t) => (t.t += dt) < t.dur);
    for (const t of this.texts) {
      const k = t.t / t.dur;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.translate(t.x, t.y - (t.jp ? 0 : k * 50));
      if (t.rot) ctx.rotate(t.rot);
      const pop = t.jp ? (k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.4)) : 1;
      ctx.scale(pop, pop);
      ctx.font = `${t.size}px 'Dela Gothic One', Unbounded, 'Arial Black', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = t.size * 0.16;
      ctx.strokeStyle = '#1a1320';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }
};
