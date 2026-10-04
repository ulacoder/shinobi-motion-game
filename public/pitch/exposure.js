/* =========================================================
   Контроль экспозиции
   Кадр с камеры проходит коррекцию яркости/контраста до того, как попасть в MediaPipe.
   АВТО: замеряем яркость по ладони (а не по всему кадру), поэтому окно за спиной
   не «гасит» руку. РУЧНАЯ: ползунки фиксируют значения (калибровка под зал).
   Если камера позволяет — доступны и её собственные настройки (выдержка и т.п.).
   ========================================================= */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DEFAULTS = { mode: 'auto', gain: 1, contrast: 1 };
const LIMITS = { gain: [0.5, 3.2], contrast: [0.7, 1.8] };
const TARGET = 0.5;          // желаемая яркость ладони после коррекции (0..1)
const PROC_W = 640;          // ширина кадра для распознавания — больше не нужно, а так быстрее
const STORAGE_KEY = 'pitch-expo';
// Замер света копирует кадр камеры в память процессора — это дорого, поэтому делаем его раз в MEASURE_EVERY кадров.
// Коэффициенты сглаживания пересчитаны так, чтобы скорость подстройки во времени осталась прежней (была: каждые 2 кадра).
const MEASURE_EVERY = 6;
const STEPS = MEASURE_EVERY / 2;
const rate = (a) => 1 - (1 - a) ** STEPS;

const HINTS = {
  dark: '🌙 Темно — включи свет перед собой',
  back: '☀ Свет сзади — встань лицом к окну или убери лампу из-за спины',
  bright: '💡 Пересвет — отойди от лампы или убавь яркость',
};

export function setupExposure({ video, frame, panel, hintEl, getHandBoxes, toast }) {
  const fctx = frame.getContext('2d', { alpha: false });
  const meterCanvas = document.createElement('canvas');
  meterCanvas.width = 32; meterCanvas.height = 18;
  const mctx = meterCanvas.getContext('2d', { willReadFrequently: true });
  const hasFilter = typeof fctx.filter === 'string';

  const st = load();
  const m = { frame: 0.5, hand: null, std: 0.2, bright: 0 };  // сглаженные замеры исходного кадра; bright — доля пересвеченных пикселей
  const hint = { cur: null, cand: null, since: 0 };
  let track = null;
  let frameN = 0, uiT = 0;
  let lut = null, lutKey = '';

  // ---------- UI ----------
  const q = (s) => panel.querySelector(s);
  const modeBtns = [...panel.querySelectorAll('[data-mode]')];
  const gainIn = q('#exGain'), contrastIn = q('#exContrast');
  const gainOut = q('#exGainV'), contrastOut = q('#exContrastV');
  const meterFill = q('#meterFill'), meterHand = q('#meterHand');
  const hwBox = q('#hwControls'), info = q('#exInfo');

  gainIn.min = LIMITS.gain[0]; gainIn.max = LIMITS.gain[1];
  contrastIn.min = LIMITS.contrast[0]; contrastIn.max = LIMITS.contrast[1];

  modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  // тронул ползунок — значит калибруешь вручную
  gainIn.addEventListener('input', () => { st.gain = +gainIn.value; setMode('manual'); save(); syncUI(true); });
  contrastIn.addEventListener('input', () => { st.contrast = +contrastIn.value; setMode('manual'); save(); syncUI(true); });
  q('#exReset').addEventListener('click', () => {
    Object.assign(st, DEFAULTS); save(); setMode('auto');
    if (track) resetHardware();
    toast('Экспозиция сброшена — снова АВТО');
  });

  function setMode(mode) {
    if (st.mode !== mode) {
      st.mode = mode; save();
      if (mode === 'manual') toast(`Экспозиция зафиксирована: яркость ×${st.gain.toFixed(2)}`);
    }
    modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    info.textContent = mode === 'auto'
      ? 'Авто подстраивает кадр под яркость ладони'
      : 'Значения зафиксированы — так камера не «плавает» от света';
  }

  function syncUI(force) {
    const now = performance.now();
    if (!force && now - uiT < 150) return;
    uiT = now;
    if (document.activeElement !== gainIn) gainIn.value = st.gain;
    if (document.activeElement !== contrastIn) contrastIn.value = st.contrast;
    gainOut.textContent = `×${st.gain.toFixed(2)}`;
    contrastOut.textContent = `×${st.contrast.toFixed(2)}`;
    meterFill.style.width = `${Math.round(clamp(m.frame, 0, 1) * 100)}%`;
    meterHand.hidden = m.hand == null;
    if (m.hand != null) meterHand.style.left = `${clamp(m.hand, 0, 1) * 100}%`;
  }

  // ---------- хранение ----------
  function load() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
    catch { return { ...DEFAULTS }; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: st.mode, gain: st.gain, contrast: st.contrast })); } catch { /* приватный режим */ }
  }

  // ---------- замер ----------
  function luminance(data) {
    let s = 0, s2 = 0, hi = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      s += l; s2 += l * l;
      if (l > 0.8) hi++;
    }
    const mean = s / n;
    return [mean, Math.sqrt(Math.max(0, s2 / n - mean * mean)), hi / n];
  }

  function measure() {
    const vw = video.videoWidth, vh = video.videoHeight;
    mctx.drawImage(video, 0, 0, 32, 18);
    const [fm, fs, fb] = luminance(mctx.getImageData(0, 0, 32, 18).data);

    // ладонь: прямоугольник по запястью и основаниям пальцев — там почти одна кожа
    let hm = null;
    const boxes = getHandBoxes();
    if (boxes.length) {
      let sum = 0;
      for (const [x0, y0, x1, y1] of boxes) {
        const sx = clamp(x0, 0, 1) * vw, sy = clamp(y0, 0, 1) * vh;
        const sw = Math.max(4, (clamp(x1, 0, 1) - clamp(x0, 0, 1)) * vw);
        const sh = Math.max(4, (clamp(y1, 0, 1) - clamp(y0, 0, 1)) * vh);
        mctx.drawImage(video, sx, sy, sw, sh, 0, 0, 12, 12);
        sum += luminance(mctx.getImageData(0, 0, 12, 12).data)[0];
      }
      hm = sum / boxes.length;
    }
    const a = rate(0.15);
    m.frame += (fm - m.frame) * a;
    m.std += (fs - m.std) * a;
    m.bright += (fb - m.bright) * a;
    m.hand = hm == null ? null : m.hand == null ? hm : m.hand + (hm - m.hand) * a;
  }

  function autoAdjust() {
    // ладонь важнее фона: если рука в кадре — меряем в основном по ней
    const measured = m.hand != null ? 0.75 * m.hand + 0.25 * m.frame : m.frame;
    const tg = clamp(TARGET / Math.max(measured, 0.03), ...LIMITS.gain);
    const tc = clamp(0.2 / Math.max(m.std * Math.min(tg, 2), 0.05), 1, 1.3);
    st.gain += (tg - st.gain) * rate(0.08);
    st.contrast += (tc - st.contrast) * rate(0.05);
  }

  function evalHint(now) {
    const subject = m.hand ?? m.frame;
    let c = null;
    // контровой свет: рука тёмная, а заметная часть кадра (окно, лампа) пересвечена
    if (m.hand != null && m.hand < 0.3 && m.bright > 0.1) c = 'back';
    else if (m.frame < 0.12 || (st.mode === 'auto' && st.gain > LIMITS.gain[1] - 0.1 && subject < 0.14)) c = 'dark';
    else if (subject > 0.88) c = 'bright';

    if (c !== hint.cand) { hint.cand = c; hint.since = now; }
    // подсказка появляется/исчезает только если состояние держится больше секунды
    if (hint.cand !== hint.cur && now - hint.since > 1200) {
      hint.cur = hint.cand;
      hintEl.hidden = !hint.cur;
      if (hint.cur) hintEl.textContent = HINTS[hint.cur];
    }
  }

  // ---------- коррекция кадра ----------
  function buildLut() {
    const key = `${st.gain.toFixed(3)}|${st.contrast.toFixed(3)}`;
    if (key === lutKey) return;
    lutKey = key;
    lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) lut[v] = (((v / 255) * st.gain - 0.5) * st.contrast + 0.5) * 255;
  }

  function process(now) {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return false;
    const W = PROC_W, H = Math.round((PROC_W * vh) / vw);
    if (frame.width !== W || frame.height !== H) { frame.width = W; frame.height = H; }

    if (++frameN % MEASURE_EVERY === 0) {
      measure();
      if (st.mode === 'auto') autoAdjust();
      evalHint(now);
    }

    const identity = Math.abs(st.gain - 1) < 0.01 && Math.abs(st.contrast - 1) < 0.01;
    if (hasFilter) {
      fctx.filter = identity ? 'none' : `brightness(${st.gain.toFixed(3)}) contrast(${st.contrast.toFixed(3)})`;
      fctx.drawImage(video, 0, 0, W, H);
      fctx.filter = 'none';
    } else {
      // старые браузеры без ctx.filter — правим пиксели таблицей
      fctx.drawImage(video, 0, 0, W, H);
      if (!identity) {
        buildLut();
        const img = fctx.getImageData(0, 0, W, H), d = img.data;
        for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
        fctx.putImageData(img, 0, 0);
      }
    }
    if (!panel.hidden) syncUI();
    return true;
  }

  // ---------- настройки самой камеры (если драйвер даёт) ----------
  async function applyHw(c) {
    try { await track.applyConstraints({ advanced: [c] }); }
    catch (e) { console.warn(e); toast('Камера не приняла настройку'); }
  }

  function addSlider(label, range, value, fmt, onInput) {
    const row = document.createElement('label');
    row.className = 'ex-row';
    row.innerHTML = `<span>${label}</span><input type="range"><output></output>`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    Object.assign(input, { min: range.min, max: range.max, step: range.step || (range.max - range.min) / 100 });
    input.value = value;
    out.textContent = fmt(+input.value);
    input.addEventListener('input', () => { out.textContent = fmt(+input.value); onInput(+input.value); });
    hwBox.appendChild(row);
    return input;
  }

  let hwDefaults = {};
  function attachTrack(t) {
    track = t;
    hwBox.innerHTML = '';
    const caps = t.getCapabilities?.() || {};
    const set = t.getSettings?.() || {};
    hwDefaults = {};

    if (caps.exposureTime && caps.exposureMode?.includes('manual')) {
      hwDefaults.exposureMode = set.exposureMode || 'continuous';
      // показываем разумный диапазон: длинная выдержка смазывает быстрые взмахи
      const r = { min: caps.exposureTime.min, max: Math.min(caps.exposureTime.max, Math.max(caps.exposureTime.min * 2, 500)), step: caps.exposureTime.step };
      addSlider('Выдержка камеры', r, set.exposureTime ?? r.max / 2, (v) => `${(v / 10).toFixed(1)} мс`,
        (v) => applyHw({ exposureMode: 'manual', exposureTime: v }));
    }
    if (caps.exposureCompensation) {
      hwDefaults.exposureCompensation = set.exposureCompensation ?? 0;
      addSlider('Экспокоррекция', caps.exposureCompensation, set.exposureCompensation ?? 0, (v) => v.toFixed(1),
        (v) => applyHw({ exposureCompensation: v }));
    }
    if (caps.brightness) {
      hwDefaults.brightness = set.brightness;
      addSlider('Яркость камеры', caps.brightness, set.brightness ?? caps.brightness.min, (v) => String(Math.round(v)),
        (v) => applyHw({ brightness: v }));
    }
    if (!hwBox.children.length) {
      hwBox.innerHTML = '<div class="ex-note">Эта камера не даёт менять свою экспозицию — работает программная коррекция выше.</div>';
    } else {
      hwBox.insertAdjacentHTML('afterbegin', '<div class="ex-sub">НАСТРОЙКИ КАМЕРЫ</div>');
    }
  }

  async function resetHardware() {
    const c = {};
    if (hwDefaults.exposureMode) c.exposureMode = 'continuous';
    if (hwDefaults.exposureCompensation != null) c.exposureCompensation = hwDefaults.exposureCompensation;
    if (hwDefaults.brightness != null) c.brightness = hwDefaults.brightness;
    if (Object.keys(c).length) await applyHw(c);
    attachTrack(track);
  }

  function toggle(force) {
    panel.hidden = force != null ? !force : !panel.hidden;
    if (!panel.hidden) syncUI(true);
    return !panel.hidden;
  }

  setMode(st.mode);
  syncUI(true);
  return { process, attachTrack, toggle, state: st, meter: m };
}
