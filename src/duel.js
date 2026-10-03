// «Дуэль с тенью»: тень Кагэро складывает печать-загадку — повтори её, пока не догорела кисть.
// 5 раундов, время с каждым раундом короче. Здесь чистая логика (раунды, ранг) — её проверяют тесты;
// экран — src/screens/duel.js.

import { SEAL_ORDER } from './seals.js';

export const ROUND_MS = [4500, 4000, 3500, 3000, 2600];

/** Пять печатей подряд без повторов соседних; последняя — своя печать из Кузницы, если она есть. */
export function duelRounds(rand = Math.random, forged = false) {
  const out = [];
  for (let i = 0; i < ROUND_MS.length; i++) {
    if (forged && i === ROUND_MS.length - 1) {
      out.push('forged');
      continue;
    }
    const pool = SEAL_ORDER.filter((s) => s !== out[i - 1]);
    out.push(pool[Math.floor(rand() * pool.length)]);
  }
  return out;
}

/** Ранг по итогам: results = [{ won, ms, acc }]. */
export function duelRank(results) {
  const wins = results.filter((r) => r.won);
  const avg = wins.length ? wins.reduce((s, r) => s + r.ms, 0) / wins.length : Infinity;
  if (wins.length === results.length && avg < 1600) return { kanji: '極', title: 'Мастер теней', line: 'Быстрее тени. Кагэро растворяется во тьме.' };
  if (wins.length === results.length) return { kanji: '影', title: 'Быстрее тени', line: 'Все пять печатей — твои.' };
  const misses = results.length - wins.length;
  if (wins.length >= 3) return { kanji: '忍', title: 'Ученик тени', line: `Почти. Тень успела ${misses === 1 ? 'один раз' : 'дважды'}.` };
  return { kanji: '修', title: 'Тень победила', line: 'Тренируй печати в додзё и возвращайся.' };
}
