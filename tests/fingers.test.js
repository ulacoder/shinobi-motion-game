import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHands } from '../src/geometry.js';
import { countFingers, FingerChoice } from '../src/fingers.js';
import { makeResult, SHAPES } from './helpers.js';

const ASPECT = 16 / 9;
const hand = (state) => buildHands(makeResult([{ state, cx: 0.5, cy: 0.4 }], ASPECT), ASPECT);
const THREE = { thumb: 'down', index: 'up', middle: 'up', ring: 'up', pinky: 'down' };

test('пальцы: 1, 2, 3, кулак и ладонь', () => {
  assert.equal(countFingers(hand(SHAPES.point)[0]), 1);
  assert.equal(countFingers(hand(SHAPES.two)[0]), 2);
  assert.equal(countFingers(hand(THREE)[0]), 3);
  assert.equal(countFingers(hand(SHAPES.fist)[0]), 0);
  assert.equal(countFingers(hand(SHAPES.open)[0]), 5);
});

test('выбор главы: держать секунду, повтор только после смены жеста', () => {
  const c = new FingerChoice({ holdMs: 1000 });
  assert.equal(c.update(hand(SHAPES.two), 0).chosen, null);
  assert.ok(c.update(hand(SHAPES.two), 500).progress > 0.4);
  assert.equal(c.update(hand(SHAPES.two), 1000).chosen, 2);
  assert.equal(c.update(hand(SHAPES.two), 2500).chosen, null);
  c.update([], 2600);
  c.update(hand(THREE), 2700);
  assert.equal(c.update(hand(THREE), 3800).chosen, 3);
});

test('выбор главы: подсказки', () => {
  const c = new FingerChoice();
  assert.match(c.update([], 0).hint, /покажи 1, 2 или 3/);
  assert.match(c.update(hand(SHAPES.open), 0).hint, /пять пальцев/);
  assert.match(c.update(hand(SHAPES.fist), 100).hint, /кулак/);
});

test('знак «окей»: кольцо из большого и указательного, три пальца прямые', async () => {
  const { isOkSign } = await import('../src/fingers.js');
  const base = hand(SHAPES.open)[0];
  // сводим кончики большого и указательного вместе
  const screen = base.screen.map((p) => ({ ...p }));
  screen[8] = { ...screen[4], x: screen[4].x + 0.01 };
  const ok = { ...base, screen, ext: { ...base.ext, index: 0.4 } };
  assert.equal(isOkSign(ok), true);
  assert.equal(isOkSign(base), false); // раскрытая ладонь — нет
  assert.equal(isOkSign(hand(SHAPES.fist)[0]), false); // кулак — нет
});
