import { FilesetResolver, HandLandmarker } from './vendor/mediapipe/vision_bundle.mjs';
import { setupExposure } from './exposure.js';

/* =========================================================
   Настройки
   ========================================================= */
const SLIDE_COUNT = 12;
const slideSrc = (i) => `slides/${String(i + 1).padStart(2, '0')}.jpg`;

const CFG = {
  stableFrames: 3,          // сколько кадров жест должен держаться, чтобы засчитаться
  lostGraceMs: 220,         // сколько «помним» руку после пропадания
  pinchOn: 0.26,            // щипок: расстояние большой–указательный / длина ладони
  pinchOff: 0.40,
  swipeDist: 0.15,          // доля ширины кадра за окно swipeWindowMs
  swipeWindowMs: 320,
  swipeCooldownMs: 650,
  swipeOppositeBlockMs: 1200, // защита от «обратного» взмаха, когда рука возвращается
  toggleMs: 600,            // окно между «ладонь» и «кулак», чтобы считать это открытием/закрытием руки
  minFistMs: 150,           // кулак должен продержаться хоть чуть-чуть, иначе это шум
  maxFistMs: 1500,          // долго сжатый кулак (например, пока говоришь) при раскрытии не приближает
  openZoom: 2.5,            // во сколько раз приближает раскрытие ладони
  maxZoom: 5,
  laserTrailMs: 260,
};

// Зона кадра камеры, которая растягивается на весь слайд (чтобы не тянуться к краям)
const zone = { cx: 0.5, cy: 0.45, size: 0.7 };

const GESTURES = {
  point: { emoji: '☝️', name: 'Указка', color: '#ff4a2e' },
  palm:  { emoji: '✋', name: 'Листать', color: '#f3e8ca' },
  pinch: { emoji: '🤏', name: 'Двигать', color: '#4fd1c5' },
  fist:  { emoji: '✊', name: 'Кулак',  color: '#d9442f' },
  none:  { emoji: '🖐', name: '—',       color: '#8a87a8' },
};

const FINGER_COLORS = ['#ff4a2e', '#f2b544', '#f3e8ca', '#4fd1c5', '#b48cff'];
const FINGERS = [ // [mcp, pip, dip, tip]
  [1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20],
];
const PALM_EDGES = [[0, 1], [0, 5], [5, 9], [9, 13], [13, 17], [0, 17]];

/* =========================================================
   DOM
   ========================================================= */
const $ = (s) => document.querySelector(s);
const deckEl = $('#deck'), zoomLayer = $('#zoomLayer');
const ink = $('#ink'), ictx = ink.getContext('2d');
const cursorsEl = $('#cursors');
const camEl = $('#cam'), video = $('#video'), skel = $('#skel'), sctx = skel.getContext('2d');
const toastEl = $('#toast'), zoomBadge = $('#zoomBadge');
const introEl = $('#intro'), loadStatus = $('#loadStatus');
const btnStart = $('#btnStart'), btnNoCam = $('#btnNoCam');
const btnGest = $('#btnGest'), btnSize = $('#btnSize');
const fpsEl = $('#camFps'), camDot = $('#camDot');
const pills = [$('#pill0'), $('#pill1')];
const frameEl = $('#frame'), btnExpo = $('#btnExpo');

/* =========================================================
   Слайды
   ========================================================= */
let current = 0;
const slides = [];
for (let i = 0; i < SLIDE_COUNT; i++) {
  const img = new Image();
  img.src = slideSrc(i);
  img.className = 'slide';
  img.alt = `Слайд ${i + 1}`;
  img.draggable = false;
  zoomLayer.appendChild(img);
  slides.push(img);
}

function goTo(i, opts = {}) {
  i = Math.max(0, Math.min(SLIDE_COUNT - 1, i));
  if (i === current && !opts.force) return false;
  current = i;
  slides.forEach((s, k) => {
    s.classList.toggle('active', k === i);
    s.classList.toggle('before', k < i);
    s.classList.toggle('after', k > i);
  });
  $('#progressBar').style.width = `${((i + 1) / SLIDE_COUNT) * 100}%`;
  history.replaceState(null, '', `#${i + 1}`);
  resetZoom(true);
  return true;
}
const next = () => goTo(current + 1);
const prev = () => goTo(current - 1);

/* =========================================================
   Геометрия: слайд 16:9 по центру + зум
   ========================================================= */
const deck = { x: 0, y: 0, w: 0, h: 0 };
const view = { s: 1, tx: 0, ty: 0 };
let dpr = 1;

function layout() {
  const W = innerWidth, H = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);
  deck.w = Math.min(W, (H * 16) / 9);
  deck.h = (deck.w * 9) / 16;
  deck.x = (W - deck.w) / 2;
  deck.y = (H - deck.h) / 2;
  Object.assign(deckEl.style, { left: `${deck.x}px`, top: `${deck.y}px`, width: `${deck.w}px`, height: `${deck.h}px` });
  ink.width = W * dpr; ink.height = H * dpr; inkDirty = true;
  clampView(); applyView();
}
addEventListener('resize', layout);

function clampView() {
  view.s = Math.max(1, Math.min(CFG.maxZoom, view.s));
  view.tx = Math.min(0, Math.max(deck.w * (1 - view.s), view.tx));
  view.ty = Math.min(0, Math.max(deck.h * (1 - view.s), view.ty));
}
function applyView() {
  zoomLayer.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`;
  const z = view.s > 1.01;
  zoomBadge.hidden = !z;
  if (z) zoomBadge.textContent = `×${view.s.toFixed(1)}`;
}
function animateView() {
  zoomLayer.classList.add('animate');
  clearTimeout(animateView.t);
  animateView.t = setTimeout(() => zoomLayer.classList.remove('animate'), 480);
}
function resetZoom(animated) {
  if (animated) animateView();
  view.s = 1; view.tx = 0; view.ty = 0; applyView();
}
// зум вокруг точки экрана
function zoomAt(sx, sy, newScale) {
  const lx = sx - deck.x, ly = sy - deck.y;
  const px = (lx - view.tx) / view.s, py = (ly - view.ty) / view.s;
  view.s = Math.max(1, Math.min(CFG.maxZoom, newScale));
  view.tx = lx - px * view.s; view.ty = ly - py * view.s;
  clampView(); applyView();
}

/* =========================================================
   Тосты
   ========================================================= */
function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('on'), 1300);
}

/* =========================================================
   One Euro filter — убирает дрожание курсора, не добавляя лагов
   ========================================================= */
class OneEuro {
  constructor(minCutoff = 1.0, beta = 0.012, dCutoff = 1.0) {
    Object.assign(this, { minCutoff, beta, dCutoff });
    this.reset();
  }
  reset() { this.x = null; this.dx = 0; this.t = null; }
  static a(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(x, t) {
    if (this.x === null) { this.x = x; this.t = t; return x; }
    const dt = Math.max(1e-3, (t - this.t) / 1000); this.t = t;
    const dx = (x - this.x) / dt;
    this.dx += OneEuro.a(this.dCutoff, dt) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.a(cutoff, dt) * (x - this.x);
    return this.x;
  }
}

/* =========================================================
   Состояние рук
   ========================================================= */
function makeCursor() {
  const el = document.createElement('div');
  el.className = 'cursor';
  el.innerHTML = `
    <div class="c-ring"></div><div class="c-core"></div><div class="c-label"></div>`;
  cursorsEl.appendChild(el);
  return el;
}

const hands = [0, 1].map((id) => ({
  id, active: false, lastSeen: 0,
  lm: null, wlm: null, label: '',
  ext: [false, false, false, false, false], curled: [false, false, false, false, false],
  pinch: false, pinchRatio: 1,
  raw: 'none', cand: 'none', candN: 0, gesture: 'none', gestureSince: 0,
  cam: { x: 0.5, y: 0.5 },          // центр ладони, зеркальные нормированные координаты кадра
  fx: new OneEuro(), fy: new OneEuro(),
  x: 0, y: 0,                        // курсор на экране
  hist: [], lastPalmT: 0,
  fistStart: 0, fistEnd: 0, fistLen: 0, fistClosed: false, fistWasClose: false, palmEnd: 0,
  trail: [],
  el: makeCursor(), labelUntil: 0,
}));

let gesturesOn = true;
let swipeReverse = false;
let lastSwipe = { t: 0, dir: 0 };
let pan = null;       // состояние перетаскивания одной рукой

/* ---------- геометрия руки ---------- */
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function analyseHand(h) {
  const w = h.wlm;
  const palm = d3(w[0], w[9]) || 1e-6;

  // пальцы (указательный..мизинец): кончик дальше от запястья, чем средний сустав → выпрямлен
  for (let f = 1; f < 5; f++) {
    const [, pip, , tip] = FINGERS[f];
    const r = d3(w[tip], w[0]) / (d3(w[pip], w[0]) || 1e-6);
    h.ext[f] = h.ext[f] ? r > 1.06 : r > 1.16;   // гистерезис
    h.curled[f] = r < 0.98;
  }
  // большой палец: кончик далеко от основания мизинца
  const rt = d3(w[4], w[17]) / (d3(w[2], w[17]) || 1e-6);
  h.ext[0] = rt > 1.25;

  h.pinchRatio = d3(w[4], w[8]) / palm;
  h.pinch = h.pinch ? h.pinchRatio < CFG.pinchOff : h.pinchRatio < CFG.pinchOn;

  const [, i, m, r, p] = h.ext;
  let g = 'none';
  if (h.pinch && !h.curled[1]) g = 'pinch';
  else if (h.curled[1] && h.curled[2] && h.curled[3] && h.curled[4]) g = 'fist';
  else if (i && m && r && p) g = 'palm';
  else if (i && !m && !r && !p) g = 'point';
  h.raw = g;
}

function stabilise(h, now) {
  if (h.raw === h.cand) h.candN++;
  else { h.cand = h.raw; h.candN = 1; }
  if (h.cand !== h.gesture && h.candN >= CFG.stableFrames) {
    const prevG = h.gesture;
    h.gesture = h.cand;
    h.gestureSince = now;
    onGestureChange(h, prevG, h.gesture);
  }
}

function anchorFor(h) {
  const L = h.lm;
  const mx = (p) => 1 - p.x; // зеркалим
  if (h.gesture === 'point') return [mx(L[8]), L[8].y];
  if (h.gesture === 'pinch') return [(mx(L[4]) + mx(L[8])) / 2, (L[4].y + L[8].y) / 2];
  const ids = [0, 5, 9, 13, 17];
  return [ids.reduce((s, k) => s + mx(L[k]), 0) / 5, ids.reduce((s, k) => s + L[k].y, 0) / 5];
}

function camToScreen(nx, ny) {
  const half = zone.size / 2;
  const u = (nx - (zone.cx - half)) / zone.size;
  const v = (ny - (zone.cy - half)) / zone.size;
  return [
    deck.x + Math.max(-0.02, Math.min(1.02, u)) * deck.w,
    deck.y + Math.max(-0.02, Math.min(1.02, v)) * deck.h,
  ];
}

/* =========================================================
   Обработка результатов MediaPipe
   ========================================================= */
function processResults(res, now) {
  const dets = (res.landmarks || []).map((lm, k) => {
    const ids = [0, 5, 9, 13, 17];
    return {
      lm, wlm: res.worldLandmarks?.[k] || lm,
      label: res.handedness?.[k]?.[0]?.categoryName || '',
      cx: ids.reduce((s, j) => s + (1 - lm[j].x), 0) / 5,
      cy: ids.reduce((s, j) => s + lm[j].y, 0) / 5,
    };
  });

  // сопоставляем найденные руки со «слотами», чтобы рука не прыгала между ними
  const taken = new Set();
  for (const d of dets) {
    let best = null, bestD = 0.35;
    for (const h of hands) {
      if (!h.active || taken.has(h.id)) continue;
      const dd = Math.hypot(h.cam.x - d.cx, h.cam.y - d.cy);
      if (dd < bestD) { bestD = dd; best = h; }
    }
    if (!best) best = hands.find((h) => !h.active && !taken.has(h.id)) || hands.find((h) => !taken.has(h.id));
    if (!best) continue;
    taken.add(best.id);
    if (!best.active) startHand(best, now);
    best.lm = d.lm; best.wlm = d.wlm; best.label = d.label;
    best.cam.x = d.cx; best.cam.y = d.cy;
    best.lastSeen = now;
    analyseHand(best);
    stabilise(best, now);
    const [ax, ay] = anchorFor(best);
    const [sx, sy] = camToScreen(ax, ay);
    best.x = best.fx.filter(sx, now);
    best.y = best.fy.filter(sy, now);
  }
  for (const h of hands) {
    if (h.active && !taken.has(h.id) && now - h.lastSeen > CFG.lostGraceMs) endHand(h);
  }
  if (gesturesOn && introEl.classList.contains('hidden')) actOnGestures(now);
  else for (const h of hands) h.hist.length = 0;
}

function startHand(h, now) {
  h.active = true;
  h.fx.reset(); h.fy.reset();
  h.gesture = 'none'; h.cand = 'none'; h.candN = 0; h.gestureSince = now;
  h.ext = [false, false, false, false, false]; h.pinch = false;
  h.hist.length = 0; h.trail.length = 0;
}
function endHand(h) {
  h.active = false; h.gesture = 'none'; h.lm = null;
  h.hist.length = 0;
  h.el.classList.remove('on');
}

const gesturesLive = () => gesturesOn && introEl.classList.contains('hidden');

function onGestureChange(h, from, to) {
  const now = performance.now();
  if (from === 'palm') h.palmEnd = now;
  if (from === 'fist') {
    h.fistEnd = now; h.fistLen = now - h.fistStart; h.fistWasClose = h.fistClosed;
    h.fistStart = 0; h.fistClosed = false;
  }
  if (to === 'fist') {
    h.fistStart = now; h.fistClosed = false;
    // ✋ → ✊ : сжал ладонь — отдаляем
    if (gesturesLive() && now - h.palmEnd < CFG.toggleMs && view.s > 1.01) {
      resetZoom(true);
      h.fistClosed = true;   // если сразу раскрыть ладонь — не приближаем обратно
      toast('✊ Отдаление');
    }
  }
  if (to === 'palm') {
    // ✊ → ✋ : раскрыл ладонь — приближаем в точке, где рука
    if (gesturesLive() && now - h.fistEnd < CFG.toggleMs && !h.fistWasClose
        && h.fistLen >= CFG.minFistMs && h.fistLen <= CFG.maxFistMs) {
      animateView();
      zoomAt(h.x, h.y, view.s > 1.01 ? view.s * 1.6 : CFG.openZoom);
      h.hist.length = 0;
      toast(`✋ Приближение ×${view.s.toFixed(1)}`);
    }
  }
  if (to !== 'point') h.trail.length = 0;
  h.labelUntil = now + 900;
}

/* ---------- действия ---------- */
function actOnGestures(now) {
  const act = hands.filter((h) => h.active);

  // --- Перетаскивание щипком одной рукой ---
  // только рука, видимая в этом кадре и реально сжатая сейчас — иначе вид прыгает, когда рука выпадает из кадра
  const pinching = act.find((h) => h.gesture === 'pinch' && h.raw === 'pinch' && h.lastSeen === now);
  if (pinching) {
    const h = pinching;
    if (!pan || pan.id !== h.id) pan = { id: h.id, x0: h.x, y0: h.y, tx0: view.tx, ty0: view.ty };
    if (view.s > 1.01) {
      view.tx = pan.tx0 + (h.x - pan.x0);
      view.ty = pan.ty0 + (h.y - pan.y0);
      clampView(); applyView();
    }
  } else pan = null;

  // --- Осмотр: при зуме открытая ладонь водит видом (рука слева — видим левый край слайда и т.д.) ---
  const looker = view.s > 1.01 && act.find((h) => h.gesture === 'palm' && h.lastSeen === now);
  if (looker && !pinching) {
    const u = Math.max(0, Math.min(1, (looker.x - deck.x) / deck.w));
    const v = Math.max(0, Math.min(1, (looker.y - deck.y) / deck.h));
    view.tx = -u * (view.s - 1) * deck.w;
    view.ty = -v * (view.s - 1) * deck.h;
    clampView(); applyView();
  }

  for (const h of act) {
    // --- Лазер ---
    if (h.gesture === 'point') {
      h.trail.push({ x: h.x, y: h.y, t: now });
    }
    // --- Взмах ладонью ---
    detectSwipe(h, now);
  }
}

function detectSwipe(h, now) {
  // копим историю центра ладони, пока рука открыта (короткие провалы распознавания прощаем)
  if (h.raw === 'palm' || h.gesture === 'palm') h.lastPalmT = now;
  // при зуме ладонь водит видом, а не листает
  if (now - h.lastPalmT > 140 || view.s > 1.01) { h.hist.length = 0; return; }
  h.hist.push({ t: now, x: h.cam.x, y: h.cam.y });
  while (h.hist.length && now - h.hist[0].t > CFG.swipeWindowMs) h.hist.shift();
  if (h.hist.length < 4) return;

  const o = h.hist[0], n = h.hist[h.hist.length - 1];
  const dx = n.x - o.x, dy = n.y - o.y;
  if (Math.abs(dx) < CFG.swipeDist || Math.abs(dx) < Math.abs(dy) * 1.6) return;

  const dir = dx < 0 ? 1 : -1; // рука влево → следующий слайд (как на телефоне)
  const finalDir = swipeReverse ? -dir : dir;
  if (now - lastSwipe.t < CFG.swipeCooldownMs) return;
  if (finalDir === -lastSwipe.dir && now - lastSwipe.t < CFG.swipeOppositeBlockMs) return;

  lastSwipe = { t: now, dir: finalDir };
  h.hist.length = 0;
  const moved = finalDir > 0 ? next() : prev();
  if (moved) toast(finalDir > 0 ? `→ Слайд ${current + 1} / ${SLIDE_COUNT}` : `← Слайд ${current + 1} / ${SLIDE_COUNT}`);
  else toast(finalDir > 0 ? 'Это последний слайд' : 'Это первый слайд');
}

/* =========================================================
   Рендер: курсоры и лазер
   ========================================================= */
let inkDirty = true;
function renderOverlay(now) {
  const W = innerWidth, H = innerHeight;
  for (const h of hands) while (h.trail.length && now - h.trail[0].t > CFG.laserTrailMs) h.trail.shift();
  const hasTrail = hands.some((h) => h.trail.length >= 2);
  // производительность: полноэкранный холст очищаем только если на нём что-то было или будет
  if (hasTrail || inkDirty) {
    ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ictx.clearRect(0, 0, W, H);
    inkDirty = hasTrail;
  }
  ictx.lineCap = 'round'; ictx.lineJoin = 'round';

  // лазерный след
  for (const h of hands) {
    const tr = h.trail;
    if (tr.length < 2) continue;
    ictx.shadowColor = '#ff3a1e'; ictx.shadowBlur = 14;
    for (let k = 1; k < tr.length; k++) {
      const age = (now - tr[k].t) / CFG.laserTrailMs;
      ictx.strokeStyle = `rgba(255,${70 + 60 * (1 - age)},40,${0.85 * (1 - age)})`;
      ictx.lineWidth = 9 * (1 - age) + 1;
      ictx.beginPath(); ictx.moveTo(tr[k - 1].x, tr[k - 1].y); ictx.lineTo(tr[k].x, tr[k].y); ictx.stroke();
    }
    ictx.shadowBlur = 0;
  }

  // курсоры
  const showCursors = gesturesOn && introEl.classList.contains('hidden');
  for (const h of hands) {
    const el = h.el;
    const on = showCursors && h.active;
    if (!on) { if (el.classList.contains('on')) el.classList.remove('on'); continue; }
    el.style.transform = `translate(${h.x}px, ${h.y}px)`;
    const cls = `cursor on m-${h.gesture}` + (now < h.labelUntil && h.gesture !== 'none' ? ' show-label' : '');
    if (el.className !== cls) el.className = cls;
    const G = GESTURES[h.gesture];
    const label = `${G.emoji} ${h.gesture === 'palm' && view.s > 1.01 ? 'Осмотр' : G.name}`;
    if (h.labelText !== label) { h.labelText = label; (h.labelEl ??= el.querySelector('.c-label')).textContent = label; }
  }
}

/* =========================================================
   Скелет руки в окне камеры
   ========================================================= */
const skelRect = { width: 0, height: 0 };
new ResizeObserver(([e]) => { skelRect.width = e.contentRect.width; skelRect.height = e.contentRect.height; }).observe(skel);
function renderSkeleton(now) {
  if (camEl.hidden || camEl.classList.contains('size-off')) return;
  const r = skelRect.width ? skelRect : skel.getBoundingClientRect();
  const cw = Math.round(r.width * dpr), ch = Math.round(r.height * dpr);
  if (skel.width !== cw || skel.height !== ch) { skel.width = cw; skel.height = ch; }
  const W = cw, H = ch, k = dpr * (r.width / 320) ** 0.5;
  sctx.clearRect(0, 0, W, H);
  const P = (p) => [(1 - p.x) * W, p.y * H];

  // зона управления
  const half = zone.size / 2;
  sctx.save();
  sctx.setLineDash([6 * k, 6 * k]);
  sctx.strokeStyle = 'rgba(243,232,202,.28)'; sctx.lineWidth = 1.2 * k;
  sctx.strokeRect((zone.cx - half) * W, (zone.cy - half) * H, zone.size * W, zone.size * H);
  sctx.setLineDash([]);
  sctx.fillStyle = 'rgba(243,232,202,.45)';
  sctx.font = `700 ${8.5 * k}px Rubik, sans-serif`;
  sctx.fillText('ЗОНА УПРАВЛЕНИЯ', (zone.cx - half) * W + 5 * k, (zone.cy + half) * H - 6 * k);
  sctx.restore();

  const activeHands = hands.filter((h) => h.active && h.lm);
  if (!activeHands.length) {
    sctx.fillStyle = 'rgba(243,232,202,.7)';
    sctx.font = `700 ${13 * k}px Rubik, sans-serif`;
    sctx.textAlign = 'center';
    sctx.fillText('Покажи руку ✋', W / 2, H / 2 + 5 * k);
    sctx.textAlign = 'left';
  }

  for (const h of activeHands) {
    const L = h.lm.map(P);
    const G = GESTURES[h.gesture];

    // кости: тёмная обводка, затем цветная с glow
    const bones = [];
    PALM_EDGES.forEach(([a, b]) => bones.push([a, b, 'rgba(243,232,202,.75)']));
    FINGERS.forEach((f, fi) => {
      const chain = fi === 0 ? f : [f[0], ...f.slice(1)];
      for (let j = 0; j < chain.length - 1; j++) bones.push([chain[j], chain[j + 1], FINGER_COLORS[fi]]);
    });
    sctx.lineCap = 'round';
    sctx.strokeStyle = 'rgba(5,6,15,.75)'; sctx.lineWidth = 7 * k;
    sctx.beginPath(); bones.forEach(([a, b]) => { sctx.moveTo(...L[a]); sctx.lineTo(...L[b]); }); sctx.stroke();
    sctx.lineWidth = 3.2 * k; sctx.shadowBlur = 10 * k;
    const byColor = new Map();
    for (const [a, b, c] of bones) { if (!byColor.has(c)) byColor.set(c, []); byColor.get(c).push(a, b); }
    for (const [c, seg] of byColor) {
      sctx.strokeStyle = c; sctx.shadowColor = c;
      sctx.beginPath();
      for (let j = 0; j < seg.length; j += 2) { sctx.moveTo(...L[seg[j]]); sctx.lineTo(...L[seg[j + 1]]); }
      sctx.stroke();
    }
    sctx.shadowBlur = 0;

    // суставы
    for (let j = 0; j < 21; j++) {
      const isTip = [4, 8, 12, 16, 20].includes(j);
      if (isTip) continue;
      sctx.beginPath(); sctx.arc(...L[j], (j === 0 ? 4.5 : 2.6) * k, 0, Math.PI * 2);
      sctx.fillStyle = '#fff'; sctx.fill();
      sctx.lineWidth = 1.2 * k; sctx.strokeStyle = 'rgba(5,6,15,.9)'; sctx.stroke();
    }
    // кончики: горят, если палец выпрямлен
    FINGERS.forEach((f, fi) => {
      const [x, y] = L[f[3]];
      const c = FINGER_COLORS[fi];
      sctx.beginPath(); sctx.arc(x, y, 5.2 * k, 0, Math.PI * 2);
      if (h.ext[fi]) {
        sctx.fillStyle = c; sctx.shadowColor = c; sctx.shadowBlur = 16 * k; sctx.fill(); sctx.shadowBlur = 0;
        sctx.lineWidth = 1.6 * k; sctx.strokeStyle = '#fff'; sctx.stroke();
      } else {
        sctx.fillStyle = 'rgba(5,6,15,.8)'; sctx.fill();
        sctx.lineWidth = 2 * k; sctx.strokeStyle = c; sctx.stroke();
      }
    });

    // щипок — луч между большим и указательным
    if (h.pinch || h.pinchRatio < CFG.pinchOff * 1.3) {
      const [x1, y1] = L[4], [x2, y2] = L[8];
      sctx.strokeStyle = h.pinch ? '#4fd1c5' : 'rgba(79,209,197,.4)';
      sctx.lineWidth = (h.pinch ? 3 : 1.5) * k;
      sctx.setLineDash(h.pinch ? [] : [3 * k, 3 * k]);
      sctx.beginPath(); sctx.moveTo(x1, y1); sctx.lineTo(x2, y2); sctx.stroke();
      sctx.setLineDash([]);
      if (h.pinch) {
        sctx.beginPath(); sctx.arc((x1 + x2) / 2, (y1 + y2) / 2, 9 * k, 0, Math.PI * 2);
        sctx.shadowColor = '#4fd1c5'; sctx.shadowBlur = 14 * k; sctx.stroke(); sctx.shadowBlur = 0;
      }
    }
    // указка — прицел на кончике
    if (h.gesture === 'point') {
      const [x, y] = L[8];
      sctx.strokeStyle = '#ff4a2e'; sctx.lineWidth = 1.6 * k;
      sctx.beginPath(); sctx.arc(x, y, 11 * k, 0, Math.PI * 2); sctx.stroke();
      sctx.beginPath();
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => { sctx.moveTo(x + dx * 14 * k, y + dy * 14 * k); sctx.lineTo(x + dx * 19 * k, y + dy * 19 * k); });
      sctx.stroke();
    }

    // HUD-рамка вокруг руки
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    L.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    const pad = 12 * k; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const c = 12 * k;
    sctx.strokeStyle = G.color; sctx.lineWidth = 2.2 * k;
    sctx.beginPath();
    sctx.moveTo(x0, y0 + c); sctx.lineTo(x0, y0); sctx.lineTo(x0 + c, y0);
    sctx.moveTo(x1 - c, y0); sctx.lineTo(x1, y0); sctx.lineTo(x1, y0 + c);
    sctx.moveTo(x1, y1 - c); sctx.lineTo(x1, y1); sctx.lineTo(x1 - c, y1);
    sctx.moveTo(x0 + c, y1); sctx.lineTo(x0, y1); sctx.lineTo(x0, y1 - c);
    sctx.stroke();

    // ярлык
    const side = handSide(h);
    const text = `${side} · ${G.emoji} ${G.name.toUpperCase()}`;
    sctx.font = `700 ${10 * k}px Rubik, sans-serif`;
    const tw = sctx.measureText(text).width + 12 * k;
    const ly = Math.max(2 * k, y0 - 20 * k);
    const lx = Math.min(W - tw - 2 * k, Math.max(2 * k, x0));
    sctx.fillStyle = 'rgba(5,6,15,.82)'; sctx.fillRect(lx, ly, tw, 16 * k);
    sctx.fillStyle = G.color; sctx.fillRect(lx, ly, 3 * k, 16 * k);
    sctx.fillStyle = '#f3e8ca'; sctx.fillText(text, lx + 8 * k, ly + 11.5 * k);
  }

  if (!gesturesOn) {
    sctx.fillStyle = 'rgba(5,6,15,.55)'; sctx.fillRect(0, H - 24 * k, W, 24 * k);
    sctx.fillStyle = '#ff8a73'; sctx.font = `700 ${10 * k}px Rubik, sans-serif`;
    sctx.textAlign = 'center'; sctx.fillText('ЖЕСТЫ НА ПАУЗЕ · нажми G', W / 2, H - 8 * k); sctx.textAlign = 'left';
  }
}

// MediaPipe считает кадр зеркальным, а вебкамера отдаёт незеркальный — метки меняем местами
const handSide = (h) => (h.label === 'Left' ? 'ПРАВАЯ' : h.label === 'Right' ? 'ЛЕВАЯ' : 'РУКА');

function renderPills() {
  hands.forEach((h, k) => {
    const el = pills[k];
    if (!h.active) {
      el.classList.remove('active');
      const idle = `<b>—</b><span>${k === 0 ? 'рука не видна' : ''}</span>`;
      if (el.innerHTML !== idle) el.innerHTML = idle;
      return;
    }
    const G = GESTURES[h.gesture];
    el.classList.toggle('active', h.gesture !== 'none');
    const html = `<b>${G.emoji}</b><span>${handSide(h).toLowerCase()} · ${G.name}</span>`;
    if (el.innerHTML !== html) el.innerHTML = html;
  });
}

/* =========================================================
   Камера и модель
   ========================================================= */
let landmarker = null;
let modelPromise = null;
let camRunning = false;
let debugCam = false;

function loadModel() {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm', location.href).href.replace(/\/$/, ''));
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: './vendor/mediapipe/hand_landmarker.task', delegate },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try { landmarker = await HandLandmarker.createFromOptions(fileset, opts('GPU')); }
    catch (e) { console.warn('GPU недоступен, переключаюсь на CPU', e); landmarker = await HandLandmarker.createFromOptions(fileset, opts('CPU')); }
    return landmarker;
  })();
  return modelPromise;
}

async function startCamera() {
  btnStart.disabled = true;
  loadStatus.className = '';
  try {
    loadStatus.textContent = 'Запрашиваю камеру…';
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false,
    });
    video.srcObject = stream;
    await video.play();
    expo.attachTrack(stream.getVideoTracks()[0]);
    camEl.style.setProperty('--cam-ar', `${video.videoWidth} / ${video.videoHeight}`);
    loadStatus.textContent = 'Загружаю модель рук…';
    await loadModel();
    camRunning = true;
    camEl.hidden = false;
    camDot.classList.add('live');
    hideIntro();
    toast('Камера включена — покажи руку ✋');
  } catch (e) {
    console.error(e);
    loadStatus.className = 'err';
    loadStatus.textContent = e.name === 'NotAllowedError' ? 'Доступ к камере запрещён — разреши его в адресной строке.'
      : e.name === 'NotFoundError' ? 'Камера не найдена.'
      : `Ошибка: ${e.message || e}`;
  } finally {
    btnStart.disabled = false;
  }
}

function hideIntro() { introEl.classList.add('hidden'); }
function toggleIntro() {
  introEl.classList.toggle('hidden');
  btnStart.textContent = camRunning ? 'Продолжить' : 'Включить камеру и жесты';
}

btnStart.addEventListener('click', () => (camRunning ? hideIntro() : startCamera()));
btnNoCam.addEventListener('click', hideIntro);

/* =========================================================
   Главный цикл
   ========================================================= */
let lastVideoTime = -1;
let fpsFrames = 0, fpsT = performance.now();

function loop() {
  const now = performance.now();
  if (camRunning && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime && expo.process(now)) {
    lastVideoTime = video.currentTime;
    // в распознавание идёт кадр после коррекции экспозиции
    const res = landmarker.detectForVideo(frameEl, now);
    processResults(res, now);
    fpsFrames++;
  } else if (camRunning) {
    // нет нового кадра — проверяем, не потеряли ли руку
    for (const h of hands) if (h.active && now - h.lastSeen > CFG.lostGraceMs) endHand(h);
  }
  if (now - fpsT > 500) {
    fpsEl.textContent = `${Math.round((fpsFrames * 1000) / (now - fpsT))} fps`;
    fpsFrames = 0; fpsT = now;
  }
  renderOverlay(now);
  if (camRunning || debugCam) { renderSkeleton(now); renderPills(); }
  requestAnimationFrame(loop);
}

/* =========================================================
   Клавиатура, мышь, окно камеры
   ========================================================= */
const CAM_SIZES = ['size-s', 'size-m', 'size-l', 'size-off'];
function cycleCamSize() {
  const i = CAM_SIZES.findIndex((c) => camEl.classList.contains(c));
  camEl.classList.remove(...CAM_SIZES);
  const nextCls = CAM_SIZES[(i + 1) % CAM_SIZES.length];
  camEl.classList.add(nextCls);
  camEl.style.display = nextCls === 'size-off' ? 'none' : '';
  if (nextCls === 'size-off') toast('Окно камеры скрыто (V — вернуть)');
}
function toggleGestures() {
  gesturesOn = !gesturesOn;
  btnGest.textContent = gesturesOn ? 'ЖЕСТЫ: ВКЛ' : 'ЖЕСТЫ: ВЫКЛ';
  btnGest.classList.toggle('off', !gesturesOn);
  for (const h of hands) { h.trail.length = 0; h.hist.length = 0; }
  pan = null;
  toast(gesturesOn ? '✋ Жесты включены' : '⏸ Жесты на паузе');
}
btnGest.addEventListener('click', toggleGestures);

/* ---------- экспозиция ---------- */
// прямоугольник ладони (запястье + основания пальцев) в координатах исходного кадра — по нему меряем свет
const PALM_IDS = [0, 1, 5, 9, 13, 17];
function handBoxes() {
  return hands.filter((h) => h.active && h.lm).map((h) => {
    const xs = PALM_IDS.map((k) => h.lm[k].x), ys = PALM_IDS.map((k) => h.lm[k].y);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  });
}
const expo = setupExposure({ video, frame: frameEl, panel: $('#expo'), hintEl: $('#lightHint'), getHandBoxes: handBoxes, toast });
function syncExpoBtn() {
  btnExpo.textContent = expo.state.mode === 'auto' ? '☀ АВТО' : '☀ РУЧН';
}
function toggleExpo() {
  if (camEl.classList.contains('size-s') || camEl.classList.contains('size-off')) {
    camEl.classList.remove(...CAM_SIZES); camEl.classList.add('size-m'); camEl.style.display = '';
  }
  btnExpo.classList.toggle('on', expo.toggle());
}
btnExpo.addEventListener('click', toggleExpo);
$('#expo').addEventListener('click', () => setTimeout(syncExpoBtn));
$('#expo').addEventListener('input', syncExpoBtn);
syncExpoBtn();
btnSize.addEventListener('click', cycleCamSize);

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(k) && introEl.classList.contains('hidden')) { e.preventDefault(); next(); }
  else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
  else if (k === 'Home') goTo(0);
  else if (k === 'End') goTo(SLIDE_COUNT - 1);
  else if (k === 'f' || k === 'F' || k === 'а' || k === 'А') {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
  }
  else if (k === 'g' || k === 'G' || k === 'п' || k === 'П') toggleGestures();
  else if (k === 'v' || k === 'V' || k === 'м' || k === 'М') { if (camRunning) cycleCamSize(); }
  else if (k === 'e' || k === 'E' || k === 'у' || k === 'У') { if (camRunning) toggleExpo(); }
  else if (k === '0') resetZoom(true);
  else if (k === '+' || k === '=') { animateView(); zoomAt(innerWidth / 2, innerHeight / 2, view.s * 1.4); }
  else if (k === '-' || k === '_') { animateView(); zoomAt(innerWidth / 2, innerHeight / 2, view.s / 1.4); }
  else if (k === 'h' || k === 'H' || k === 'р' || k === 'Р' || k === '?') toggleIntro();
  else if (k === 'Escape') { if (!introEl.classList.contains('hidden') ) hideIntro(); else resetZoom(true); }
  else if (k === 'r' || k === 'R' || k === 'к' || k === 'К') { swipeReverse = !swipeReverse; toast(swipeReverse ? 'Взмах: вправо → следующий' : 'Взмах: влево → следующий'); }
  else if (k === '[' || k === 'х') { zone.size = Math.max(0.35, zone.size - 0.05); toast(`Зона управления: ${Math.round(zone.size * 100)}% кадра`); }
  else if (k === ']' || k === 'ъ') { zone.size = Math.min(1, zone.size + 0.05); toast(`Зона управления: ${Math.round(zone.size * 100)}% кадра`); }
});

// колесо мыши — зум в точку
addEventListener('wheel', (e) => {
  if (!introEl.classList.contains('hidden')) return;
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, view.s * Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

// перетаскивание мышью, когда слайд приближен
let mouseDrag = null;
deckEl.addEventListener('pointerdown', (e) => {
  if (view.s <= 1.01) return;
  mouseDrag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  deckEl.setPointerCapture(e.pointerId);
});
deckEl.addEventListener('pointermove', (e) => {
  if (!mouseDrag) return;
  view.tx = mouseDrag.tx + e.clientX - mouseDrag.x;
  view.ty = mouseDrag.ty + e.clientY - mouseDrag.y;
  clampView(); applyView();
});
deckEl.addEventListener('pointerup', () => { mouseDrag = null; });

// окно камеры можно перетащить за заголовок
let camDrag = null;
$('#camBar').addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  const r = camEl.getBoundingClientRect();
  camDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
  e.currentTarget.setPointerCapture(e.pointerId);
});
$('#camBar').addEventListener('pointermove', (e) => {
  if (!camDrag) return;
  const r = camEl.getBoundingClientRect();
  const x = Math.max(0, Math.min(innerWidth - r.width, e.clientX - camDrag.dx));
  const y = Math.max(0, Math.min(innerHeight - r.height, e.clientY - camDrag.dy));
  Object.assign(camEl.style, { left: `${x}px`, top: `${y}px`, right: 'auto', bottom: 'auto' });
});
$('#camBar').addEventListener('pointerup', () => { camDrag = null; });

/* =========================================================
   Старт
   ========================================================= */
layout();
const fromHash = parseInt(location.hash.slice(1), 10);
goTo(Number.isFinite(fromHash) ? fromHash - 1 : 0, { force: true });
requestAnimationFrame(loop);

// модель грузим заранее, чтобы кнопка «Включить» срабатывала быстро
if (navigator.mediaDevices?.getUserMedia) {
  loadModel().catch((e) => { console.error(e); loadStatus.className = 'err'; loadStatus.textContent = 'Не удалось загрузить модель рук.'; });
} else {
  loadStatus.className = 'err';
  loadStatus.textContent = 'Камера недоступна: открой сайт через localhost или https.';
}

// для отладки без камеры: window.__pitch.feed({landmarks, worldLandmarks, handedness})
window.__pitch = {
  feed: (res) => processResults(res, performance.now()), hands, view, goTo, CFG, zone,
  current: () => current,
  showCam: () => { debugCam = true; camEl.hidden = false; hideIntro(); },
  modelReady: () => !!landmarker,
  expo,
};
