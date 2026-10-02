// Точка входа: камера → распознавание → главный цикл. Экраны лежат в src/screens/,
// общее состояние и переключение экранов — в src/app/context.js, сюжет — в src/app/story.js.

import { buildHands, FINGER_NAMES } from './geometry.js';
import { SEALS, classify } from './seals.js';
import { TECHNIQUES } from './battle.js';
import { startCamera, createHandTracker, CameraError, prefetchRecognition, stopProgress } from './tracker.js';
import { sfx, unlockAudio, setSound, isSoundOn, loadAudioManifest, audioGraph, voiceLog } from './audio.js';
import { music } from './music.js';
import { $, fillSealIcons } from './ui.js';
import { backIcon, okOneIcon } from './icons.js';
import { isOkSign } from './fingers.js';
import { app, video, arena, overlay, sensei, brightness, state, go, pct, SHORT, recorder } from './app/context.js';
import { HandSmoother } from './herohands.js';
import { startStory } from './app/story.js';
import { menu } from './screens/menu.js';
import { dojo } from './screens/dojo.js';
import { scene, sceneLog } from './screens/scene.js';
import { fight } from './screens/fight.js';
import { results } from './screens/results.js';
import { chest } from './screens/chest.js';
import { forge, forgeDebug } from './screens/forge.js';
import { chapters } from './screens/chapters.js';
import { mangaScreen } from './screens/manga.js';
import { path } from './screens/path.js';

fillSealIcons();

let tracker = null;
let lastVideoTime = -1;
let debug = new URLSearchParams(location.search).has('debug');
const debugBox = $('debug');

// ---------- запуск ----------

async function boot() {
  const btn = $('btn-start');
  const status = $('intro-status');
  btn.disabled = true;
  unlockAudio();
  try {
    status.textContent = 'Включаю камеру…';
    await startCamera(video);
    state.aspect = video.videoWidth / video.videoHeight || 16 / 9;
    app.style.setProperty('--cam-ar', String(state.aspect));
    loadAudioManifest();
    tracker = await createHandTracker((t) => (status.textContent = t));
    status.textContent = '';
    go('menu');
  } catch (err) {
    console.error(err);
    $('error-text').textContent =
      err instanceof CameraError ? err.message : `Не удалось загрузить распознавание рук: ${err?.message ?? err}. Проверь интернет и обнови страницу.`;
    app.dataset.screen = 'error';
  } finally {
    btn.disabled = false;
  }
}

$('btn-start').addEventListener('click', boot);

// Модель рук начинаем качать сразу, пока игрок читает заставку.
const introIdle = () => app.dataset.screen === 'intro' && !$('btn-start').disabled;
const introProgress = (p) => {
  if (introIdle()) $('intro-status').textContent = `Готовлю распознавание рук: ${Math.round(p * 100)}%`;
};
const introStatus = (t) => {
  if (introIdle()) $('intro-status').textContent = t;
};
prefetchRecognition(introProgress).then(() => {
  stopProgress(introProgress);
  // Сразу после скачивания создаём и прогреваем распознаватель — к нажатию кнопки он уже готов.
  createHandTracker(introStatus).catch(() => {});
});
$('btn-retry').addEventListener('click', () => location.reload());

// Повторные визиты: тяжёлые файлы (движок, модель, голоса) берутся из кэша сервис-воркера.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Если доступ к камере уже был разрешён раньше — стартуем без клика.
navigator.permissions
  ?.query({ name: 'camera' })
  .then((p) => {
    if (p.state === 'granted') boot();
  })
  .catch(() => {});

// Звук
const soundBtn = $('btn-sound');
soundBtn.addEventListener('click', () => {
  unlockAudio();
  setSound(!isSoundOn());
  soundBtn.setAttribute('aria-pressed', String(isSoundOn()));
});
addEventListener('pointerdown', unlockAudio, { once: true });

// Отладка: клавиша D или ?debug в адресе — показывает сырые признаки пальцев.
// Запасное управление с клавиатуры: 1–3 — пункты меню и итогов, пробел/Enter — следующая реплика.
addEventListener('keydown', (e) => {
  const screen = app.dataset.screen;
  if (e.key === 'Escape' && screen !== 'menu' && screen !== 'intro' && screen !== 'error') {
    // Esc — назад в меню с любого экрана (удобно на показе)
    go('menu');
  } else if (screen === 'forge' && (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К')) {
    forge.restart();
  } else if (screen === 'chapters' && /^[1-3]$/.test(e.key)) {
    chapters.pick(Number(e.key));
  } else if ((screen === 'menu' || screen === 'results' || screen === 'manga' || screen === 'path') && /^[1-5]$/.test(e.key)) {
    const buttons = [...$(`screen-${screen}`).querySelectorAll('[data-choice]')];
    buttons[Number(e.key) - 1]?.click();
  } else if (screen === 'chest' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    chest.hit(0.8, performance.now());
  } else if (screen === 'scene' && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight')) {
    e.preventDefault();
    scene.skip(performance.now());
  } else if (screen === 'battle' && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault();
    fight.skipReplay();
  }
});

addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'в') {
    debug = !debug;
    debugBox.hidden = !debug;
  }
});
debugBox.hidden = !debug;

function renderDebug() {
  if (!debug) return;
  const lines = [`fps: ${Math.round(1000 / (frameAvg || 16))}  распознавание: ${detectCost.toFixed(0)} мс  качество: ${arena.quality}  рук: ${state.hands.length}  яркость: ${state.lastBright.toFixed(2)}  экран: ${app.dataset.screen}`];
  for (const h of state.hands) {
    const ext = Object.entries(h.ext).map(([f, v]) => `${SHORT[f].slice(0, 4)} ${v.toFixed(2)}`).join('  ');
    lines.push(`${h.side.padEnd(6)} ладонь ${h.palm.toFixed(3)} | ${ext}`);
  }
  lines.push(classify(state.hands).slice(0, 3).map((e) => `${SEALS[e.seal].name} ${pct(e.accuracy)}${e.passed ? ' ✓' : ''}`).join('   '));
  debugBox.textContent = lines.join('\n');
}

// ---------- главный цикл ----------

let fakeResult = null;
let lastFake = null;
let prev = performance.now();

let frameAvg = 16;
let lastDetectAt = 0;
let detectGap = 0;
let detectCost = 8;
let lastStampMs = 1;

// ---------- «Окей» двумя руками — в меню: навигация только руками с любого экрана ----------
// Жест нарочно непривычный: так руки случайно не держат, и он не совпадает ни с одной печатью.
const BACK_HOLD_MS = 1200;
const backCue = $('back-cue');
const backRing = $('back-ring');
$('back-icon').innerHTML = backIcon({ size: 38 });
let backSince = 0;
let oneSince = 0;
let oneArmed = false;
for (const icon of document.querySelectorAll('[data-cue-icon]')) icon.innerHTML = icon.dataset.cueIcon === 'one' ? okOneIcon({ size: 38 }) : backIcon({ size: 38 });
// экраны, где внизу свои подсказки-жесты: «окей» одной рукой — действие экрана, двумя — в меню
const CUE_SCREENS = ['forge', 'dojo'];

function paintCue(screen, cue, p) {
  const btn = document.querySelector(`#screen-${screen} [data-cue="${cue}"]`);
  if (!btn) return;
  btn.classList.toggle('active', p > 0);
  btn.querySelector('.ring circle').style.strokeDashoffset = String(119.4 * (1 - p));
}

function updateBackGesture(now) {
  const screen = app.dataset.screen;
  // «окей» нельзя выковать в Кузнице, поэтому жест работает и во время записи
  const allowed = !['intro', 'error', 'menu'].includes(screen);
  const okBoth = allowed && state.hands.length === 2 && state.hands.every(isOkSign);
  backSince = okBoth ? backSince || now : 0;
  const p = backSince ? Math.min(1, (now - backSince) / BACK_HOLD_MS) : 0;
  const cues = CUE_SCREENS.includes(screen);
  // подсказку видно всегда на спокойных экранах и только во время удержания — в бою и сценах
  const calm = ['results', 'chapters', 'manga', 'path'].includes(screen);
  backCue.hidden = !allowed || cues || (!calm && !p);
  backCue.classList.toggle('active', p > 0);
  backCue.classList.toggle('dim', p === 0);
  backRing.style.strokeDashoffset = String(119.4 * (1 - p));
  if (cues) paintCue(screen, 'both', p);

  // «окей» одной рукой — действие экрана (записать заново / пропустить урок); после срабатывания
  // ждём, пока руку опустят, чтобы не повторялось
  const okOne = cues && state.hands.length === 1 && isOkSign(state.hands[0]);
  if (!okOne) oneArmed = true;
  oneSince = okOne && oneArmed ? oneSince || now : 0;
  const q = oneSince ? Math.min(1, (now - oneSince) / BACK_HOLD_MS) : 0;
  if (cues) paintCue(screen, 'one', q);
  if (q >= 1) {
    oneSince = 0;
    oneArmed = false;
    sfx.success();
    document.querySelector(`#screen-${screen} [data-cue="one"]`)?.click();
  }

  if (p >= 1) {
    backSince = 0;
    sfx.success();
    go('menu');
  }
}

let recordedStamp = -1;
const heroSmoother = new HandSmoother();

function loop(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  frameAvg = frameAvg * 0.95 + (now - prev) * 0.05;
  prev = now;

  if (fakeResult) {
    state.hands = buildHands(fakeResult, state.aspect);
    // как с настоящей камерой: новый «кадр распознавания» только когда подставили новый результат
    if (fakeResult !== lastFake) {
      lastFake = fakeResult;
      state.handsStamp = now;
    }
  } else if (tracker && video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastDetectAt >= detectGap) {
    lastVideoTime = video.currentTime;
    lastDetectAt = now;
    try {
      const t0 = performance.now();
      // MediaPipe требует строго растущие метки времени
      lastStampMs = Math.max(now, lastStampMs + 1);
      const result = tracker.detectForVideo(video, lastStampMs);
      // Если распознавание тяжёлое (слабый ноутбук), реже запускаем его, чтобы графика не тормозила.
      detectCost = detectCost * 0.9 + (performance.now() - t0) * 0.1;
      detectGap = detectCost > 22 ? 60 : detectCost > 14 ? 40 : 0;
      state.hands = buildHands(result, state.aspect);
      state.handsStamp = now;
    } catch (err) {
      console.warn('Ошибка распознавания кадра', err);
    }
    state.lastBright = brightness.sample(video, now);
  }

  // кадры камеры для замедленного повтора и главы манги — только в бою и в сюжетных жестах
  const rec = state.controller?.records || (state.controller === scene && scene.wait);
  if (rec && state.handsStamp !== recordedStamp) {
    recordedStamp = state.handsStamp;
    recorder.push(video, state.hands, state.aspect, now);
  }

  updateBackGesture(now);
  const controller = state.controller;
  if (controller) controller.update(now, dt);

  // герой повторяет пальцы игрока: руки на арене в бою и в сюжетных жестах
  const heroOn = (controller === fight && fight.battle && !fight.endAt) || (controller === scene && scene.wait && !scene.wait.done);
  arena.heroHands = heroOn
    ? {
        hands: heroSmoother.update(state.hands),
        glow: controller.overlayTone === 'pass' ? 'rgba(240, 182, 74, 0.95)' : null,
        place: controller === scene ? 'scene' : 'battle',
      }
    : null;

  const trail = controller === fight || controller === dojo ? controller.circle?.points : null;
  overlay.draw(state.hands, {
    tone: controller?.overlayTone ?? 'idle',
    bad: controller?.overlayBad ?? null,
    guide: controller?.overlayGuide ?? null,
    aspect: state.aspect,
    trail,
    now,
  });

  sensei.update(now);
  arena.frame(dt);
  renderDebug();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Для консоли разработчика и автотестов: можно подставить «руки» вместо камеры.
window.__shinobi = {
  SEALS,
  TECHNIQUES,
  FINGER_NAMES,
  get hands() {
    return state.hands;
  },
  setFakeResult(result) {
    fakeResult = result;
  },
  get battle() {
    return fight.battle;
  },
  get run() {
    return state.run;
  },
  startStory,
  go,
  arena,
  music,
  audioGraph,
  sfx,
  voiceLog,
  sceneLog,
  get forge() {
    return forgeDebug();
  },
};
