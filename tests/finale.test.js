import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHands } from '../src/geometry.js';
import { evaluateSeal, classify, twoPlayers } from '../src/seals.js';
import { pickMoments, layoutRows } from '../src/manga.js';
import { makeResult } from './helpers.js';

const PINKY = { thumb: 'down', index: 'down', middle: 'down', ring: 'down', pinky: 'up' };
/** labels — метки MediaPipe для рук: ['Left', 'Left'] — две правые руки двух людей (кадр не зеркальный). */
const hands = (spec, labels = ['Left', 'Left']) => {
  const r = makeResult(spec);
  r.handedness = labels.map((l) => [{ categoryName: l, score: 0.95 }]);
  return buildHands(r, 16 / 9);
};
const PAIR = [{ state: PINKY, cx: 0.47, cy: 0.45 }, { state: PINKY, cx: 0.53, cy: 0.45 }];

test('печать дружбы: двое сцепили мизинцы — засчитана, далеко — подсказка', () => {
  const near = evaluateSeal('friend', hands(PAIR));
  assert.ok(near.passed, `точность ${near.accuracy}`);
  const far = evaluateSeal('friend', hands([{ state: PINKY, cx: 0.2, cy: 0.45 }, { state: PINKY, cx: 0.8, cy: 0.45 }]));
  assert.equal(far.passed, false);
  assert.match(far.hint, /мизинц/);
  assert.match(far.rules.find((r) => r.kind === 'finger')?.hint ?? '', /игрока/);
  // сцепленные мизинцы сгибаются крючком — печать всё равно засчитывается
  const HOOK = { ...PINKY, pinky: 'down' };
  assert.ok(evaluateSeal('friend', hands([{ state: HOOK, cx: 0.47, cy: 0.45 }, { state: HOOK, cx: 0.53, cy: 0.45 }])).passed);
  // в бою печать дружбы не распознаётся: её нет среди боевых печатей
  assert.ok(!classify(hands(PAIR)).some((e) => e.seal === 'friend'));
});

test('печать дружбы — только вдвоём: левая и правая одного человека не проходят', () => {
  const solo = evaluateSeal('friend', hands(PAIR, ['Left', 'Right']));
  assert.equal(solo.passed, false);
  assert.match(solo.hint, /второй игрок/);
  assert.equal(twoPlayers(hands(PAIR, ['Right', 'Right'])), 'two');
  // модель не уверена — тоже не засчитываем
  assert.equal(evaluateSeal('friend', hands(PAIR, [])).passed, false);
});

test('глава манги: самые важные моменты, но в порядке боя', () => {
  const moments = [1, 5, 2, 1, 4, 3, 1].map((priority, i) => ({ priority, caption: String(i) }));
  const picked = pickMoments(moments, 4);
  assert.deepEqual(picked.map((m) => m.caption), ['1', '2', '4', '5']);
  assert.deepEqual(layoutRows(5), [1, 2, 2]);
  assert.deepEqual(layoutRows(2), [1, 1]);
});

test('Кагэро читает руки: слабый палец из отчёта ладони и печать, где он важен', async () => {
  const { pickWeakFinger, COUNTER_SEAL, readPassed, fingerScore } = await import('../src/readhands.js');
  assert.deepEqual(pickWeakFinger({ 'left:ring': 3, 'right:index': 1 }).finger, 'ring');
  assert.equal(pickWeakFinger({}).guessed, true);
  assert.equal(COUNTER_SEAL.ring, 'tiger');
  const TIGER = { thumb: 'down', index: 'up', middle: 'up', ring: 'down', pinky: 'down' };
  const good = evaluateSeal('tiger', hands([{ state: TIGER, cx: 0.42, cy: 0.45 }, { state: TIGER, cx: 0.58, cy: 0.45 }]));
  assert.ok(readPassed(good, 'left', 'ring'));
  // безымянный на левой руке выпрямлен — печать не засчитана именно из-за него
  // (кадр зеркальный: cx 0.58 в кадре камеры — левая рука на экране)
  const bad = evaluateSeal('tiger', hands([{ state: TIGER, cx: 0.42, cy: 0.45 }, { state: { ...TIGER, ring: 'up' }, cx: 0.58, cy: 0.45 }]));
  assert.ok(fingerScore(bad, 'left', 'ring') < 0.5);
  assert.equal(readPassed(bad, 'left', 'ring'), false);
});

test('Дуэль с тенью: 5 раундов без повторов подряд, своя печать в конце, ранги', async () => {
  const { duelRounds, duelRank } = await import('../src/duel.js');
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const r = duelRounds(rand, true);
  assert.equal(r.length, 5);
  assert.equal(r[4], 'forged');
  for (let i = 1; i < 4; i++) assert.notEqual(r[i], r[i - 1]);
  const win = (ms) => ({ won: true, ms, acc: 0.9 });
  assert.equal(duelRank([win(1000), win(1200), win(900), win(1500), win(1100)]).kanji, '極');
  assert.equal(duelRank([win(2000), win(2200), win(1900), win(2500), win(2100)]).kanji, '影');
  assert.equal(duelRank([win(2000), win(2200), win(1900), { won: false }, { won: false }]).kanji, '忍');
  assert.equal(duelRank([{ won: false }, { won: false }, win(1900), { won: false }, { won: false }]).kanji, '修');
});

// ---------- темно, но руки видны: подсказки по пальцам не глушатся ----------
import { frameIssue, darkButSeen } from '../src/quality.js';

const hand = { side: 'left', palm: 0.15, bbox: { minX: 0.5, maxX: 0.8, minY: 0.3, maxY: 0.7 } };

test('темнота без рук — сенсей говорит про свет', () => {
  assert.equal(frameIssue([], 0.08, 16 / 9)?.id, 'dark');
  assert.equal(darkButSeen([], 0.08), false);
});

test('темнота, но руки распознаны — нет плашки, вместо неё значок у превью', () => {
  assert.equal(frameIssue([hand], 0.08, 16 / 9), null);
  assert.equal(darkButSeen([hand], 0.08), true);
  assert.equal(darkButSeen([hand], 0.5), false);
});
