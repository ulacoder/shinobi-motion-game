import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHands } from '../src/geometry.js';
import { evaluateSeal, classify } from '../src/seals.js';
import { pickMoments, layoutRows } from '../src/manga.js';
import { makeResult } from './helpers.js';

const PINKY = { thumb: 'down', index: 'down', middle: 'down', ring: 'down', pinky: 'up' };
const hands = (spec) => buildHands(makeResult(spec), 16 / 9);

test('печать дружбы: мизинцы сцеплены — засчитана, далеко — подсказка', () => {
  const near = evaluateSeal('friend', hands([{ state: PINKY, cx: 0.47, cy: 0.45 }, { state: PINKY, cx: 0.53, cy: 0.45 }]));
  assert.ok(near.passed, `точность ${near.accuracy}`);
  const far = evaluateSeal('friend', hands([{ state: PINKY, cx: 0.2, cy: 0.45 }, { state: PINKY, cx: 0.8, cy: 0.45 }]));
  assert.equal(far.passed, false);
  assert.match(far.hint, /мизинц/);
  // в бою печать дружбы не распознаётся: её нет среди боевых печатей
  assert.ok(!classify(hands([{ state: PINKY, cx: 0.47, cy: 0.45 }, { state: PINKY, cx: 0.53, cy: 0.45 }])).some((e) => e.seal === 'friend'));
});

test('глава манги: самые важные моменты, но в порядке боя', () => {
  const moments = [1, 5, 2, 1, 4, 3, 1].map((priority, i) => ({ priority, caption: String(i) }));
  const picked = pickMoments(moments, 4);
  assert.deepEqual(picked.map((m) => m.caption), ['1', '2', '4', '5']);
  assert.deepEqual(layoutRows(5), [1, 2, 2]);
  assert.deepEqual(layoutRows(2), [1, 1]);
});
