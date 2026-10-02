// Сюжетный поход: шаги сюжета по порядку (сцены, бои, сундуки) и подсчёт итогов.

import { STORY, PLAYER_MAX_HP, emptyStats, scoreRun, topMistakes } from '../battle.js';
import { randomNinjaName } from '../storage.js';
import { state, go } from './context.js';

export const FIGHTS_TOTAL = STORY.filter((s) => s.type === 'fight').length;

/**
 * Быстрое демо (~2 минуты, для жюри и живого показа): бамбуковый сундук → бой с Кагэро → финальная сцена.
 * Показывает всё главное: жест «ладонь вверх-вниз», печати и техники, ультимейт, режим ошибки, концовку.
 */
export const DEMO_STORY = [
  { type: 'chest', stage: 3, reward: 'dragon', place: 'eclipse' },
  { type: 'fight', stage: 3, enemy: 'boss', place: 'eclipse', hp: 80 },
  STORY[STORY.length - 1],
];

/** С какого шага начинается глава (1 — подпешки, 2 — пешки, 3 — главный злодей). */
export function chapterStart(chapter) {
  const i = STORY.findIndex((s) => s.type === 'scene' && s.stage === chapter && s.title);
  return Math.max(0, i);
}

/**
 * quick — быстрое демо; chapter — начать сюжет с главы 1–3.
 * Приёмы из сундуков прошлых глав открываются сразу, чтобы глава 3 не была сложнее, чем по сюжету.
 */
export function startStory({ quick = false, chapter = 1 } = {}) {
  const story = quick ? DEMO_STORY : STORY;
  const unlocked = quick ? ['wind'] : chapter >= 3 ? ['wind', 'dragon'] : chapter === 2 ? ['wind'] : [];
  state.run = {
    story,
    step: quick ? 0 : chapterStart(chapter),
    chapter: quick ? 0 : chapter,
    quick,
    stats: emptyStats(),
    mistakes: new Map(),
    fingerMiss: {}, // «left:ring» → сколько раз палец подвёл (для отчёта ладони)
    playerHp: PLAYER_MAX_HP,
    chakra: quick ? 60 : 0,
    startedAt: performance.now(),
    name: randomNinjaName(),
    combo: { count: 0, lastAt: -Infinity, lastTech: null },
    bestForms: {},
    unlocked,
  };
  playStep();
}

export function playStep() {
  const step = state.run.story[state.run.step];
  if (!step) return finishRun(true, 'Кагэро повержен. Деревня спасена');
  go(step.type === 'fight' ? 'battle' : step.type, step);
}

export function nextStep() {
  state.run.step += 1;
  playStep();
}

export function finishRun(win, reason) {
  const timeSec = (performance.now() - state.run.startedAt) / 1000;
  const { score, avgAcc } = scoreRun({ win, stats: state.run.stats, playerHp: state.run.playerHp, timeSec });
  const { story } = state.run;
  const step = story[Math.min(state.run.step, story.length - 1)];
  go('results', {
    win,
    reason,
    score,
    avgAcc,
    time: timeSec,
    stats: state.run.stats,
    mistakes: topMistakes(state.run.mistakes),
    fingerMiss: state.run.fingerMiss,
    stage: step.stage,
    name: state.run.name,
    bestForms: state.run.bestForms,
    quick: state.run.quick,
    chapter: state.run.chapter,
  });
}
