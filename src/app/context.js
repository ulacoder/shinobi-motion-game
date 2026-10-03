// Общие объекты игры: экран, сцена, сенсей, состояние кадра и переключение экранов.

import { SEALS, NEAR_ACCURACY } from '../seals.js';
import { BrightnessMeter, frameIssue } from '../quality.js';
import { Arena } from '../fx.js';
import { sfx } from '../audio.js';
import { $, Sensei, Overlay } from '../ui.js';
import { FrameRecorder } from '../replay.js';
import { addMoment } from '../manga.js';

export const app = $('app');
export const video = $('video');
export const arena = new Arena($('arena'));
export const overlay = new Overlay($('overlay'));
export const sensei = new Sensei($('sensei'), $('sensei-text'));
export const brightness = new BrightnessMeter();
/** Последние секунды камеры и рук — для замедленного повтора и главы манги. */
export const recorder = new FrameRecorder({ height: 270, max: 60 });

/** Запомнить текущий кадр как момент для главы манги. */
export function moment(opts, still = recorder.still()) {
  addMoment(state.run, still, opts);
}

/** Общее состояние кадра и похода: его читают все экраны, пишет главный цикл (main.js) и сюжет (story.js). */
export const state = {
  hands: [], // руки текущего кадра (21 точка + признаки пальцев)
  handsStamp: 0, // время кадра распознавания: новый кадр = новая метка
  aspect: 16 / 9,
  lastBright: 1,
  run: null, // текущий поход: шаг сюжета, здоровье, чакра, статистика
  controller: null, // активный экран
};

export const SHORT = { thumb: 'большой', index: 'указательный', middle: 'средний', ring: 'безымянный', pinky: 'мизинец' };
export const pct = (v) => `${Math.round(v * 100)}%`;

// Запись в DOM только при изменении значения: иначе браузер пересчитывает стили каждый кадр.
const domCache = new WeakMap();
export function setText(node, value) {
  const c = domCache.get(node) ?? {};
  if (c.text === value) return;
  c.text = value;
  domCache.set(node, c);
  node.textContent = value;
}
export function setWidth(node, value) {
  const c = domCache.get(node) ?? {};
  if (c.width === value) return;
  c.width = value;
  domCache.set(node, c);
  node.style.width = value;
}

// ---------- бейдж распознанной печати на камере ----------

export const camSeal = $('cam-seal');
export function showCamSeal(best) {
  if (!best || best.accuracy < NEAR_ACCURACY || best.missingHands) {
    camSeal.hidden = true;
    return;
  }
  camSeal.hidden = false;
  camSeal.classList.toggle('near', !best.passed);
  setText(camSeal.querySelector('.cam-seal-glyph'), SEALS[best.seal].kanji);
  setText(camSeal.querySelector('.cam-seal-acc'), `${SEALS[best.seal].name} ${pct(best.accuracy)}`);
}

export function badFingers(evaluation) {
  const set = new Set();
  for (const r of evaluation?.rules ?? []) if (r.kind === 'finger' && r.score < 0.5) set.add(`${r.side}:${r.finger}`);
  return set;
}

/** Подсказка про условия съёмки — самая приоритетная. Возвращает true, если есть проблема. */
export function reportFrameIssue(now) {
  const issue = frameIssue(state.hands, state.lastBright, state.aspect);
  if (issue) sensei.show(issue.hint, 'warn', now);
  return !!issue;
}

// ---------- переключение экранов ----------
// Каждый экран — объект { enter(arg), update(now, dt), exit() } в своём файле src/screens/*.js.
// Экраны регистрируются сами, поэтому context.js не зависит от них (нет циклических импортов).

const screens = {};

export function registerScreen(name, controller) {
  screens[name] = controller;
}

export function go(screen, arg) {
  state.controller?.exit?.();
  app.dataset.screen = screen;
  state.controller = screens[screen] ?? null;
  camSeal.hidden = true;
  arena.setOrb(null);
  state.controller?.enter?.(arg);
  sfx.select();
}
