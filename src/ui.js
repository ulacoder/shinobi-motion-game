// Мелкие UI-компоненты: сенсей с подсказками, выбор жестом, отрисовка рук, списки.

import { guideHand } from './ghost.js';
import { HAND_CONNECTIONS } from './tracker.js';
import { SEALS, evaluateSeal } from './seals.js';
import { TECHNIQUES, ULTIMATE, DRAGON } from './battle.js';
import { sealIcon, techIcon } from './icons.js';
import { sfx } from './audio.js';

export const $ = (id) => document.getElementById(id);

export function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

// ---------- сенсей ----------

export class Sensei {
  constructor(box, textEl) {
    this.box = box;
    this.textEl = textEl;
    this.text = '';
    this.until = 0;
    this.lockedUntil = 0;
  }

  /**
   * tone: 'warn' — ошибка, 'good' — похвала, 'info' — нейтрально.
   * Важные сообщения (lock) не перебиваются мелкими подсказками какое-то время.
   */
  show(text, tone = 'warn', now = performance.now(), { ttl = 2600, lock = 0 } = {}) {
    if (!text) return;
    if (now < this.lockedUntil && text !== this.text && !lock) return;
    if (text !== this.text) {
      this.text = text;
      this.textEl.textContent = text;
      this.box.className = `sensei ${tone}`;
      this.box.hidden = false;
      // перезапускаем анимацию появления
      this.box.style.animation = 'none';
      void this.box.offsetWidth;
      this.box.style.animation = '';
    }
    this.until = now + ttl;
    if (lock) this.lockedUntil = now + lock;
  }

  clear() {
    this.text = '';
    this.box.hidden = true;
    this.until = 0;
    this.lockedUntil = 0;
  }

  update(now) {
    if (this.text && now > this.until) this.clear();
  }
}

// ---------- выбор жестом (меню и итоги) ----------

export class GestureChoice {
  constructor(root, actions, { holdMs = 900 } = {}) {
    this.root = root;
    this.actions = actions;
    this.holdMs = holdMs;
    this.buttons = [...root.querySelectorAll('[data-choice]')];
    for (const b of this.buttons) {
      b.addEventListener('click', () => this.fire(b.dataset.choice));
    }
    this.reset();
  }

  reset() {
    this.current = null;
    this.since = 0;
    this.armed = false; // ждём, пока игрок «отпустит» жест, которым пришёл на экран
    this.fired = false;
    this.paint(null, 0);
  }

  fire(choice) {
    if (this.fired || !this.actions[choice]) return;
    this.fired = true;
    this.actions[choice]();
  }

  update(hands, now) {
    if (this.fired) return null;
    let active = null;
    let bestAcc = 0;
    for (const id of Object.keys(this.actions)) {
      if (!SEALS[id]) continue; // «в меню» — не печать: его ведёт жест «окей» двумя руками (controls.js)
      const ev = evaluateSeal(id, hands);
      if (ev.passed && ev.accuracy > bestAcc) {
        active = id;
        bestAcc = ev.accuracy;
      }
    }
    if (!this.armed) {
      if (!active) this.armed = true;
      this.paint(null, 0);
      return null;
    }
    if (active !== this.current) {
      this.current = active;
      this.since = now;
    }
    const progress = active ? Math.min(1, (now - this.since) / this.holdMs) : 0;
    // тихие щелчки по мере удержания жеста
    const quarter = Math.floor(progress * 4);
    if (active && quarter > (this.quarter ?? 0) && quarter < 4) sfx.hold(quarter / 4);
    this.quarter = active ? quarter : 0;
    this.paint(active, progress);
    if (active && progress >= 1) this.fire(active);
    return active;
  }

  paint(active, progress) {
    const key = `${active}|${progress.toFixed(2)}`;
    if (key === this.painted) return;
    this.painted = key;
    for (const b of this.buttons) {
      const on = b.dataset.choice === active;
      b.classList.toggle('active', on);
      const circle = b.querySelector('.ring circle');
      if (circle) circle.style.strokeDashoffset = String(119.4 * (1 - (on ? progress : 0)));
    }
  }
}

// ---------- отрисовка рук поверх камеры ----------

const FINGER_POINTS = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

// Спрайты искр: по одному на цвет (цвета округлены), рисуются один раз.
const sparkSprites = new Map();
function sparkSprite(r, g, b) {
  const key = `${Math.round(r / 16)}|${Math.round(g / 16)}|${Math.round(b / 16)}`;
  let c = sparkSprites.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const grad = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, `rgba(${r | 0},${g | 0},${b | 0},1)`);
  grad.addColorStop(1, `rgba(${r | 0},${g | 0},${b | 0},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, 32, 32);
  sparkSprites.set(key, c);
  return c;
}

export class Overlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.trail = [];
    this.ghost = null;
    this.box = { width: canvas.clientWidth, height: canvas.clientHeight };
    // Размер берём из ResizeObserver, а не из getBoundingClientRect каждый кадр (это вызывает перерасчёт вёрстки).
    new ResizeObserver(([e]) => (this.box = e.contentRect)).observe(canvas);
    this.empty = false;
  }

  fit() {
    const r = this.box;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return { w, h, dpr };
  }

  /**
   * hands — руки из buildHands; tone — цвет скелета;
   * bad — Set строк `${side}:${finger}` для подсветки неверных пальцев.
   */
  draw(hands, { tone = 'idle', bad = null, aspect = 16 / 9, trail = null, now = 0, guide = null } = {}) {
    const hasGhost = this.ghost && now < this.ghost.until;
    const fxLeft = (this.sparks?.length ?? 0) + (this.bursts?.length ?? 0);
    if (!hands.length && !(trail && trail.length) && !hasGhost && !fxLeft) {
      // Нечего рисовать — не трогаем холст вовсе.
      if (!this.empty) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.empty = true;
      }
      return;
    }
    this.empty = false;
    const { w, h, dpr } = this.fit();
    // Толщина линий растёт с размером камеры: на большом экране и через демонстрацию экрана скелет виден чётко.
    const k = dpr * Math.max(1, (this.box?.width || 520) / 520);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    const px = (p) => ({ x: (p.x / aspect) * w, y: p.y * h });
    const colors = { idle: '#58d0ff', near: '#f0b64a', pass: '#6fd08c' };
    const base = colors[tone] ?? colors.idle;
    const dt = Math.min(50, now - (this.lastNow ?? now));
    this.lastNow = now;

    // Рука-призрак: правильная форма поверх живой руки, неверные пальцы «тянутся» к ней
    if (guide && guide.size) this.drawGuide(hands, guide, px, k, now);

    for (const hand of hands) {
      const pts = hand.screen.map(px);
      ctx.lineCap = 'round';
      // тёмная подложка под линиями — скелет читается на любом фоне
      ctx.lineWidth = 7 * k;
      ctx.strokeStyle = 'rgba(10, 12, 30, 0.55)';
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
        ctx.stroke();
      }
      ctx.lineWidth = 4 * k;
      ctx.strokeStyle = base;
      ctx.globalAlpha = 0.95;
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
        ctx.stroke();
      }
      if (bad) {
        ctx.strokeStyle = '#ff5a48';
        ctx.lineWidth = 8 * k;
        for (const [finger, idx] of Object.entries(FINGER_POINTS)) {
          if (!bad.has(`${hand.side}:${finger}`)) continue;
          ctx.beginPath();
          idx.forEach((i, k) => (k ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y)));
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#efe6cf';
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.4 * k, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // След пальца при рисовании круга
    const drawPath = (points, color, width) => {
      if (!points || points.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width * dpr;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      points.forEach((p, i) => {
        const q = px(p);
        i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      });
      ctx.stroke();
    };
    if (trail && trail.length) {
      ctx.shadowColor = '#58d0ff';
      ctx.shadowBlur = this.quality === 0 ? 0 : 16 * dpr;
      drawPath(trail, 'rgba(200,240,255,0.95)', 6);
      ctx.shadowBlur = 0;
    }
    if (this.ghost && now < this.ghost.until) {
      ctx.globalAlpha = Math.max(0, (this.ghost.until - now) / 1200);
      drawPath(this.ghost.points, this.ghost.passed ? '#6fd08c' : '#ff5a48', 5);
      ctx.globalAlpha = 1;
    }

    // AR-эффекты: искры чакры с кончиков пальцев, огненный след круга, иероглиф над руками
    this.spawnSparks(hands, trail, tone, now);
    this.drawSparks(px, k, dt);
    this.drawBursts(k, w, h, now);
  }

  /** Искры с кончиков пальцев: цвет — по состоянию (ищет / почти / засчитано). */
  spawnSparks(hands, trail, tone, now) {
    this.sparks ??= [];
    const palette = { idle: [88, 208, 255], near: [240, 182, 74], pass: [111, 208, 140] };
    const [r, g, b] = palette[tone] ?? palette.idle;
    // число искр зависит от качества графики (Overlay.quality ставит главный цикл по замеру FPS)
    const cap = [50, 100, 160][this.quality ?? 2];
    if (this.sparks.length < cap && now - (this.sparkAt ?? 0) > 30) {
      this.sparkAt = now;
      for (const hand of hands) {
        for (const i of [4, 8, 12, 16, 20]) {
          if (Math.random() > 0.55) continue;
          const p = hand.screen[i];
          this.sparks.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 0.00012, vy: -0.00018 - Math.random() * 0.0002, life: 1, r, g, b, size: 1 });
        }
      }
      // огонь вдоль следа круга
      if (trail && trail.length > 1) {
        const p = trail[trail.length - 1];
        for (let j = 0; j < 3; j++) {
          this.sparks.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 0.0003, vy: -0.0003 - Math.random() * 0.0003, life: 1, r: 255, g: 120 + Math.random() * 80, b: 40, size: 1.8 });
        }
      }
    }
  }

  drawSparks(px, k, dt) {
    const ctx = this.ctx;
    if (!this.sparks?.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const alive = [];
    for (const s of this.sparks) {
      s.life -= dt / 650;
      if (s.life <= 0) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      alive.push(s);
      const q = px(s);
      const rad = (2 + 5 * s.life) * s.size * k;
      // готовый спрайт-свечение вместо градиента на каждую искру в каждом кадре
      ctx.globalAlpha = 0.9 * s.life;
      ctx.drawImage(sparkSprite(s.r, s.g, s.b), q.x - rad, q.y - rad, rad * 2, rad * 2);
    }
    this.sparks = alive;
    ctx.restore();
  }

  /** Иероглиф печати вспыхивает над руками и разлетается кольцом. */
  burst(kanji, hands, color = '#f0b64a') {
    this.bursts ??= [];
    let x = 0.5;
    let y = 0.45;
    if (hands?.length) {
      x = hands.reduce((s, h) => s + h.center.x / (h.aspect || 16 / 9), 0) / hands.length;
      y = hands.reduce((s, h) => s + h.bbox.minY, 0) / hands.length - 0.06;
    }
    this.bursts.push({ kanji, x, y: Math.max(0.12, y), start: performance.now(), color });
    if (this.bursts.length > 3) this.bursts.shift();
  }

  drawBursts(k, w, h, now) {
    if (!this.bursts?.length) return;
    const ctx = this.ctx;
    const DUR = 1000;
    this.bursts = this.bursts.filter((b) => now - b.start < DUR);
    for (const b of this.bursts) {
      const t = (now - b.start) / DUR;
      const x = b.x * w;
      const y = b.y * h;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      // ударная волна
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 6 * k * (1 - t);
      ctx.beginPath();
      ctx.arc(x, y, (30 + 160 * t) * k, 0, Math.PI * 2);
      ctx.stroke();
      // иероглиф
      const size = (56 + 50 * Math.sin(Math.min(1, t * 2) * Math.PI * 0.5)) * k;
      ctx.font = `700 ${size}px 'Shippori Mincho B1', 'Noto Serif CJK JP', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 8 * k;
      ctx.strokeStyle = 'rgba(20, 8, 12, 0.85)';
      ctx.strokeText(b.kanji, x, y);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = this.quality === 0 ? 0 : 24 * k;
      ctx.fillText(b.kanji, x, y);
      ctx.restore();
    }
  }

  /** Рука-призрак для каждой руки, у которой есть неверные пальцы. */
  drawGuide(hands, guide, px, k, now) {
    const ctx = this.ctx;
    const pulse = 0.55 + 0.35 * Math.sin(now / 160);
    for (const hand of hands) {
      const wants = guide.get(hand.side);
      if (!wants || !Object.keys(wants).length) continue;
      const g = guideHand(hand.screen, wants).map(px);
      const live = hand.screen.map(px);
      ctx.save();
      ctx.lineCap = 'round';
      // весь призрак — полупрозрачный белый
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#efe6cf';
      ctx.lineWidth = 12 * k;
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(g[a].x, g[a].y);
        ctx.lineTo(g[b].x, g[b].y);
        ctx.stroke();
      }
      // пальцы, которые надо исправить, — золотые и пульсируют; стрелка от живого кончика к нужному
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#f0b64a';
      ctx.shadowColor = '#cc3325';
      ctx.shadowBlur = this.quality === 0 ? 0 : 14 * k;
      for (const finger of Object.keys(wants)) {
        const idx = FINGER_POINTS[finger];
        ctx.lineWidth = 10 * k;
        ctx.beginPath();
        idx.forEach((i, j) => (j ? ctx.lineTo(g[i].x, g[i].y) : ctx.moveTo(g[i].x, g[i].y)));
        ctx.stroke();
        const from = live[idx[3]];
        const to = g[idx[3]];
        const len = Math.hypot(to.x - from.x, to.y - from.y);
        if (len > 12 * k) {
          ctx.lineWidth = 3 * k;
          ctx.setLineDash([8 * k, 6 * k]);
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
          ctx.setLineDash([]);
          const ang = Math.atan2(to.y - from.y, to.x - from.x);
          ctx.beginPath();
          ctx.moveTo(to.x, to.y);
          ctx.lineTo(to.x - 14 * k * Math.cos(ang - 0.5), to.y - 14 * k * Math.sin(ang - 0.5));
          ctx.lineTo(to.x - 14 * k * Math.cos(ang + 0.5), to.y - 14 * k * Math.sin(ang + 0.5));
          ctx.closePath();
          ctx.fillStyle = '#f0b64a';
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  showGhost(points, passed, now) {
    this.ghost = { points, passed, until: now + 1200 };
  }
}

// ---------- списки ----------

const sealHanko = (id, cls = '') => {
  const s = el('span', `hanko ${cls}`.trim(), SEALS[id].kanji);
  s.title = SEALS[id].name;
  return s;
};

export function renderTechList(
  ul,
  { chain = [], ultimateReady = false, showUltimate = true, showDesc = false, techs = Object.values(TECHNIQUES), dragon = false, forged = null } = {},
) {
  ul.replaceChildren();
  ul.classList.toggle('many', techs.length + (forged ? 1 : 0) + (showUltimate ? 1 + (dragon ? 1 : 0) : 0) > 4);
  for (const t of techs) {
    const li = el('li', 'tech');
    const matches = chain.length && chain.every((s, i) => t.seq[i] === s);
    if (matches) li.classList.add('hot');
    const glyph = el('span', 'tech-glyph');
    glyph.innerHTML = techIcon(t.id, 36);
    li.append(glyph, el('span', 'tech-name', t.name));
    const seq = el('span', 'tech-seq');
    t.seq.forEach((id, i) => {
      if (i) seq.append(el('span', '', '→'));
      let cls = 'dim';
      if (matches) cls = i < chain.length ? 'done' : i === chain.length ? 'next' : 'dim';
      else if (!chain.length) cls = i === 0 ? '' : 'dim';
      const mini = el('span', `seal-mini ${cls}`.trim());
      mini.innerHTML = sealIcon(id, { size: 30, title: true });
      seq.append(mini);
      seq.append(el('span', '', SEALS[id].name));
    });
    li.append(seq);
    if (showDesc) li.append(el('span', 'tech-desc', t.desc));
    ul.append(li);
  }
  if (forged) {
    // своя печать из Кузницы: один жест — техника
    const li = el('li', 'tech forged');
    const glyph = el('span', 'tech-glyph');
    glyph.append(el('span', 'hanko', forged.kanji));
    li.append(glyph, el('span', 'tech-name', forged.name));
    li.append(el('span', 'tech-seq', 'Своя печать из Кузницы: покажи свой жест'));
    if (showDesc) li.append(el('span', 'tech-desc', 'Выкована в Кузнице'));
    ul.append(li);
  }
  if (showUltimate) {
    const li = el('li', `tech ultimate${ultimateReady ? ' ready' : ''}`);
    const glyph = el('span', 'tech-glyph');
    glyph.innerHTML = techIcon('sphere', 36);
    li.append(glyph, el('span', 'tech-name', ULTIMATE.name));
    li.append(el('span', 'tech-seq', ultimateReady ? 'Нарисуй круг пальцем одной руки' : 'Накопи чакру до 100%'));
    if (showDesc) li.append(el('span', 'tech-desc', ULTIMATE.desc));
    ul.append(li);
    if (dragon) {
      const d = el('li', `tech ultimate new${ultimateReady ? ' ready' : ''}`);
      const g2 = el('span', 'tech-glyph');
      g2.innerHTML = techIcon('dragon', 36);
      d.append(g2, el('span', 'tech-name', DRAGON.name));
      d.append(el('span', 'tech-seq', ultimateReady ? 'Подними ладонь и опусти!' : 'Накопи чакру до 100%'));
      if (showDesc) d.append(el('span', 'tech-desc', DRAGON.desc));
      ul.append(d);
    }
  }
}

/** Заполняет все .choice-icon[data-seal] иконками рук. */
export function fillSealIcons(root = document) {
  for (const node of root.querySelectorAll('[data-seal]')) {
    if (!node.firstChild) node.innerHTML = sealIcon(node.dataset.seal, { size: 60 });
  }
}

export function renderRecords(ol, records, highlightId = null) {
  ol.replaceChildren();
  if (!records.length) {
    ol.append(el('li', 'empty', 'Пока пусто. Первый бой — твой.'));
    return;
  }
  for (const r of records) {
    const li = el('li', r.id === highlightId ? 'me' : '');
    li.append(el('span', '', `${r.name}${r.win ? '' : ' (пораж.)'}`), el('span', '', String(r.score)));
    ol.append(li);
  }
}

/** Цепочка печатей: форма твоих рук + печать-ханко в углу. */
export function renderChain(box, chain, forms = []) {
  box.replaceChildren();
  chain.forEach((id, i) => {
    if (i) box.append(el('span', 'arrow', '→'));
    const card = el('span', 'form-card');
    const c = document.createElement('canvas');
    c.width = 150;
    c.height = 110;
    if (forms[i]) drawHandForm(c, forms[i]);
    card.append(c, sealHanko(id, 'hanko-corner'));
    card.title = SEALS[id].name;
    box.append(card);
  });
}

// ---------- форма печатей игрока ----------

/** Снимок формы рук в момент печати (копия экранных точек). */
export function snapshotHands(hands) {
  return { hands: hands.map((h) => h.screen.map((p) => ({ x: p.x, y: p.y }))) };
}

/** Снимок нарисованного круга. */
export function snapshotPath(points) {
  return { path: points.map((p) => ({ x: p.x, y: p.y })) };
}

/**
 * Рисует форму печати кистью: тушь с красным свечением, золотые кончики пальцев.
 */
export function drawHandForm(canvas, form, { ink = '#1a1320', glow = 'rgba(204,51,37,0.8)', tips = '#f0b64a', bg = null } = {}) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  const all = form.path ?? form.hands?.flat() ?? [];
  if (!all.length) return;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 0.12;
  const scale = Math.min((w * (1 - 2 * pad)) / (maxX - minX || 1), (h * (1 - 2 * pad)) / (maxY - minY || 1));
  const ox = (w - (maxX - minX) * scale) / 2;
  const oy = (h - (maxY - minY) * scale) / 2;
  const P = (p) => ({ x: ox + (p.x - minX) * scale, y: oy + (p.y - minY) * scale });
  const lw = Math.max(2.5, Math.min(w, h) / 22);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = glow;
  ctx.shadowBlur = lw * 1.6;
  ctx.strokeStyle = ink;
  ctx.lineWidth = lw;
  if (form.path) {
    ctx.beginPath();
    form.path.map(P).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
    ctx.shadowBlur = 0;
    return;
  }
  for (const hand of form.hands) {
    const pts = hand.map(P);
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = tips;
  for (const hand of form.hands) {
    for (const i of [4, 8, 12, 16, 20]) {
      const q = P(hand[i]);
      ctx.beginPath();
      ctx.arc(q.x, q.y, lw * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function stamp(node, glyph) {
  node.textContent = glyph;
  node.classList.remove('show');
  void node.offsetWidth;
  node.classList.add('show');
}

export function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
