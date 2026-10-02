// Сюжетный поход: шаги сюжета по порядку (сцены, бои, сундуки) и подсчёт итогов.

import { ENEMIES, STORY, PLAYER_MAX_HP, emptyStats, scoreRun, topMistakes } from '../battle.js';
import { randomNinjaName } from '../storage.js';
import { state, go } from './context.js';

export const FIGHTS_TOTAL = STORY.filter((s) => s.type === 'fight').length;

/** quick — быстрый бой: сразу к главному злодею, с запасом чакры (для жюри и демо). */
export function startStory({ quick = false } = {}) {
  state.run = {
    step: quick ? STORY.findIndex((s) => s.type === 'fight' && ENEMIES[s.enemy].boss) : 0,
    quick,
    stats: emptyStats(),
    mistakes: new Map(),
    playerHp: PLAYER_MAX_HP,
    chakra: quick ? 60 : 0,
    startedAt: performance.now(),
    name: randomNinjaName(),
    combo: { count: 0, lastAt: -Infinity, lastTech: null },
    bestForms: {},
    // в быстром бою сразу открыты все приёмы, в сюжете — из сундуков
    unlocked: quick ? ['wind', 'dragon'] : [],
  };
  playStep();
}

export function playStep() {
  const step = STORY[state.run.step];
  if (!step) return finishRun(true, 'Кагэро повержен. Деревня спасена');
  go(step.type === 'scene' ? 'scene' : step.type === 'chest' ? 'chest' : 'battle', step);
}

export function nextStep() {
  state.run.step += 1;
  playStep();
}

export function finishRun(win, reason) {
  const timeSec = (performance.now() - state.run.startedAt) / 1000;
  const { score, avgAcc } = scoreRun({ win, stats: state.run.stats, playerHp: state.run.playerHp, timeSec });
  const step = STORY[Math.min(state.run.step, STORY.length - 1)];
  go('results', {
    win,
    reason,
    score,
    avgAcc,
    time: timeSec,
    stats: state.run.stats,
    mistakes: topMistakes(state.run.mistakes),
    stage: step.stage,
    name: state.run.name,
    bestForms: state.run.bestForms,
    quick: state.run.quick,
  });
}
