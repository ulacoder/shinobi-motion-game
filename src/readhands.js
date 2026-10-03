// «Кагэро читает твои руки»: босс берёт данные отчёта ладони (какой палец чаще всего подводил)
// и бьёт по слабому месту — игрок должен сложить печать, где этот палец важен, и не дать ему дрогнуть.
// Здесь только логика (её проверяют тесты); экран — src/screens/weakfinger.js.

import { worstFinger } from './palmreport.js';

/** Печать, в которой палец стоит «трудно»: безымянный согнут у Тигра, мизинец и большой отставлены у Птицы. */
export const COUNTER_SEAL = { thumb: 'bird', index: 'tiger', middle: 'tiger', ring: 'tiger', pinky: 'bird' };

export const FINGER_GEN = { thumb: 'большой', index: 'указательный', middle: 'средний', ring: 'безымянный', pinky: 'мизинец' };
export const SIDE_PREP = { left: 'на левой руке', right: 'на правой руке' };

/** Слабый палец по отчёту ладони. Ошибок не было — Кагэро всё равно проверит безымянный на левой. */
export function pickWeakFinger(misses = {}) {
  const w = worstFinger(misses);
  if (w) return { ...w, guessed: false };
  return { side: 'left', finger: 'ring', count: 0, guessed: true };
}

/** Оценка правила для этого пальца на этой руке (0..1); рука одна — берём любую. */
export function fingerScore(evaluation, side, finger) {
  const rules = (evaluation?.rules ?? []).filter((r) => r.kind === 'finger' && r.finger === finger);
  if (!rules.length) return 0;
  return (rules.find((r) => r.side === side) ?? rules[0]).score;
}

/** Засчитано: печать сложена и именно этот палец стоит уверенно. */
export function readPassed(evaluation, side, finger) {
  return !!evaluation?.passed && fingerScore(evaluation, side, finger) >= 0.75;
}
