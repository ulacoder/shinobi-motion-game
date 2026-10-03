// Запись последних секунд боя (кадры камеры + 21 точка рук) для замедленного повтора
// добивающей печати и для стоп-кадров «главы манги». Всё остаётся в браузере игрока.

const TIPS = [4, 8, 12, 16, 20];
const HAND_LINKS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

export class FrameRecorder {
  /** height — высота кадра записи, max — сколько кадров держать (~2 с при 30 к/с). */
  constructor({ height = 240, max = 64 } = {}) {
    this.h = height;
    this.max = max;
    this.frames = [];
    this.pool = [];
  }

  /** Новый кадр: камера зеркально (как видит игрок) и копия точек рук. */
  push(video, hands, aspect, now) {
    if (!video || video.readyState < 2) return;
    const w = Math.round(this.h * aspect);
    const c = this.frames.length >= this.max ? this.frames.shift().canvas : this.pool.pop() ?? document.createElement('canvas');
    if (c.width !== w || c.height !== this.h) {
      c.width = w;
      c.height = this.h;
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(-1, 0, 0, 1, w, 0);
    ctx.drawImage(video, 0, 0, w, this.h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.frames.push({ canvas: c, t: now, hands: hands.map((h) => ({ side: h.side, pts: h.screen.map((p) => ({ x: p.x, y: p.y })) })) });
  }

  /** Забирает последние ms миллисекунд в отдельный клип (кадры уходят из кольца, их не перезапишут). */
  takeClip(ms = 1700) {
    const end = this.frames.at(-1)?.t;
    if (end === undefined) return null;
    const i = this.frames.findIndex((f) => f.t >= end - ms);
    const frames = this.frames.splice(i);
    return frames.length >= 4 ? { frames, ms: end - frames[0].t } : (this.release({ frames }), null);
  }

  /** Вернуть кадры клипа в пул, когда повтор больше не нужен. */
  release(clip) {
    for (const f of clip?.frames ?? []) {
      f.toned = null;
      this.pool.push(f.canvas);
    }
  }

  /** Стоп-кадр для манги: копия последнего кадра (или переданного кадра клипа) и рук. */
  still(frame = this.frames.at(-1)) {
    const f = frame;
    if (!f) return null;
    const c = document.createElement('canvas');
    c.width = f.canvas.width;
    c.height = f.canvas.height;
    c.getContext('2d').drawImage(f.canvas, 0, 0);
    return { canvas: c, hands: f.hands };
  }

  clear() {
    this.release({ frames: this.frames });
    this.frames = [];
  }
}

/**
 * Кадр замедленного повтора: камера в тонах манги, светящиеся следы кончиков пальцев
 * и скелет руки тушью. p — 0..1 прогресс повтора.
 */
export function drawReplayFrame(canvas, clip, p) {
  const ctx = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  const n = clip.frames.length;
  const i = Math.min(n - 1, Math.floor(p * n));
  const f = clip.frames[i];
  const src = f.canvas;
  // вписываем кадр «cover»
  const k = Math.max(W / src.width, H / src.height);
  const dw = src.width * k;
  const dh = src.height * k;
  const ox = (W - dw) / 2;
  const oy = (H - dh) / 2;
  // тонирование кадра (фильтр на canvas дорогой) делаем один раз на кадр и запоминаем
  if (!f.toned) {
    const t = document.createElement('canvas');
    t.width = src.width;
    t.height = src.height;
    const tc = t.getContext('2d');
    tc.filter = 'grayscale(0.55) sepia(0.35) contrast(1.15) brightness(0.95)';
    tc.drawImage(src, 0, 0);
    f.toned = t;
  }
  ctx.drawImage(f.toned, ox, oy, dw, dh);
  // точки рук хранятся в координатах [0..aspect]×[0..1] — в пиксели кадра
  const P = (q) => ({ x: ox + q.x * src.height * k, y: oy + q.y * src.height * k });

  // следы кончиков пальцев с начала клипа до текущего кадра
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const sides = new Set(f.hands.map((h) => h.side));
  for (const side of sides) {
    for (const tip of TIPS) {
      const from = Math.max(0, i - 24);
      ctx.beginPath();
      let started = false;
      for (let j = from; j <= i; j++) {
        const hand = clip.frames[j].hands.find((h) => h.side === side);
        if (!hand) {
          started = false;
          continue;
        }
        const q = P(hand.pts[tip]);
        if (started) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
        started = true;
      }
      // свечение — широкий полупрозрачный проход вместо размытия тени
      ctx.strokeStyle = 'rgba(255, 140, 50, 0.3)';
      ctx.lineWidth = Math.max(9, H / 24);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(240, 182, 74, 0.85)';
      ctx.lineWidth = Math.max(3, H / 70);
      ctx.stroke();
    }
  }
  ctx.restore();

  // скелет руки текущего кадра — тушью с золотыми кончиками
  ctx.save();
  ctx.lineCap = 'round';
  for (const hand of f.hands) {
    const pts = hand.pts.map(P);
    ctx.strokeStyle = 'rgba(26, 19, 32, 0.9)';
    ctx.lineWidth = Math.max(3, H / 80);
    for (const [a, b] of HAND_LINKS) {
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    }
    ctx.fillStyle = '#f0b64a';
    for (const t of TIPS) {
      ctx.beginPath();
      ctx.arc(pts[t].x, pts[t].y, Math.max(3, H / 90), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // манга-виньетка и полосы скорости по краям
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
  g.addColorStop(0, 'rgba(26,19,32,0)');
  g.addColorStop(1, 'rgba(26,19,32,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 230, 207, 0.22)';
  ctx.lineWidth = 2;
  for (let a = 0; a < 40; a++) {
    const ang = (a / 40) * Math.PI * 2 + i * 0.03;
    const r0 = H * (0.62 + ((a * 37) % 11) / 40);
    ctx.beginPath();
    ctx.moveTo(W / 2 + Math.cos(ang) * r0, H / 2 + Math.sin(ang) * r0 * 0.8);
    ctx.lineTo(W / 2 + Math.cos(ang) * W, H / 2 + Math.sin(ang) * W * 0.8);
    ctx.stroke();
  }
  ctx.restore();
}
