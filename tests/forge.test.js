import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHands } from '../src/geometry.js';
import { features, learnTemplate, evaluateTemplate, describeTemplate, FORGE_SAMPLES } from '../src/forge.js';
import { makeResult, SHAPES } from './helpers.js';

const ASPECT = 16 / 9;
const ROCK = { thumb: 'down', index: 'up', middle: 'down', ring: 'down', pinky: 'up' }; // «коза»
const hands = (list) => buildHands(makeResult(list, ASPECT), ASPECT);

/** Несколько снимков одного жеста с небольшим сдвигом руки — как у живого игрока. */
function record(list) {
  const samples = [];
  for (let i = 0; i < FORGE_SAMPLES; i++) {
    const jitter = (i - 2) * 0.01;
    samples.push(features(hands(list.map((h) => ({ ...h, cx: h.cx + jitter, cy: h.cy - jitter })))));
  }
  return learnTemplate(samples);
}

test('кузница: выученный жест «коза» узнаётся снова', () => {
  const tpl = record([{ state: ROCK, cx: 0.5, cy: 0.4 }]);
  assert.equal(tpl.count, 1);
  const ev = evaluateTemplate(tpl, hands([{ state: ROCK, cx: 0.45, cy: 0.45 }]));
  assert.ok(ev.passed, `точность ${ev.accuracy}`);
});

test('кузница: другой жест не проходит и получает подсказку по пальцу', () => {
  const tpl = record([{ state: ROCK, cx: 0.5, cy: 0.4 }]);
  const ev = evaluateTemplate(tpl, hands([{ state: SHAPES.open, cx: 0.5, cy: 0.4 }]));
  assert.equal(ev.passed, false);
  assert.match(ev.hint, /согни (средний|безымянный)|прижми большой/);
  const bad = ev.rules.filter((r) => r.kind === 'finger' && r.score < 0.5).map((r) => r.finger);
  assert.ok(bad.includes('middle') && bad.includes('ring'), bad.join(','));
});

test('кузница: подсказка «выпрями», если палец согнут лишний', () => {
  const tpl = record([{ state: SHAPES.open, cx: 0.5, cy: 0.4 }]);
  const ev = evaluateTemplate(tpl, hands([{ state: { ...SHAPES.open, pinky: 'down' }, cx: 0.5, cy: 0.4 }]));
  assert.equal(ev.passed, false);
  assert.match(ev.hint, /выпрями мизинец/);
});

test('кузница: печать на две руки — следит за расстоянием между руками', () => {
  const tpl = record([
    { state: SHAPES.two, cx: 0.44, cy: 0.4 },
    { state: SHAPES.two, cx: 0.56, cy: 0.4 },
  ]);
  assert.equal(tpl.count, 2);
  const ok = evaluateTemplate(tpl, hands([
    { state: SHAPES.two, cx: 0.45, cy: 0.42 },
    { state: SHAPES.two, cx: 0.57, cy: 0.42 },
  ]));
  assert.ok(ok.passed, `точность ${ok.accuracy}`);
  const far = evaluateTemplate(tpl, hands([
    { state: SHAPES.two, cx: 0.15, cy: 0.4 },
    { state: SHAPES.two, cx: 0.85, cy: 0.4 },
  ]));
  assert.equal(far.passed, false);
  assert.match(far.hint, /Сведи руки ближе/);
});

test('кузница: лишняя или недостающая рука — понятная подсказка', () => {
  const one = record([{ state: ROCK, cx: 0.5, cy: 0.4 }]);
  const extra = evaluateTemplate(one, hands([
    { state: ROCK, cx: 0.3, cy: 0.4 },
    { state: SHAPES.fist, cx: 0.7, cy: 0.4 },
  ]));
  assert.match(extra.hint, /убери вторую/);
  const two = record([
    { state: SHAPES.two, cx: 0.44, cy: 0.4 },
    { state: SHAPES.two, cx: 0.56, cy: 0.4 },
  ]);
  const missing = evaluateTemplate(two, hands([{ state: SHAPES.two, cx: 0.5, cy: 0.4 }]));
  assert.match(missing.hint, /вторую руку/);
});

test('кузница: описание жеста словами', () => {
  assert.match(describeTemplate(record([{ state: SHAPES.open, cx: 0.5, cy: 0.4 }])), /раскрытая ладонь/);
  assert.match(describeTemplate(record([{ state: ROCK, cx: 0.5, cy: 0.4 }])), /указательный, мизинец — прямо/);
});
