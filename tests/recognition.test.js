import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHands, fingerExtension } from '../src/geometry.js';
import { classify, evaluateSeal } from '../src/seals.js';
import { SealDetector } from '../src/detector.js';
import { scoreCircle } from '../src/air.js';
import { makeResult, makeWorldHand, SHAPES } from './helpers.js';

const two = (a, b, gap = 0.12) =>
  buildHands(makeResult([
    { state: a, cx: 0.5 - gap / 2, cy: 0.5 },
    { state: b, cx: 0.5 + gap / 2, cy: 0.5 },
  ]));

test('прямые и согнутые пальцы различаются', () => {
  const open = makeWorldHand(SHAPES.open);
  const fist = makeWorldHand(SHAPES.fist);
  for (const f of ['index', 'middle', 'ring', 'pinky']) {
    assert.ok(fingerExtension(open, f) > 0.9, `${f} прямой`);
    assert.ok(fingerExtension(fist, f) < 0.1, `${f} согнут`);
  }
  assert.ok(fingerExtension(open, 'thumb') > 0.6, 'большой отставлен');
  assert.ok(fingerExtension(fist, 'thumb') < 0.3, 'большой прижат');
});

const cases = [
  ['tiger', SHAPES.two, SHAPES.two],
  ['snake', SHAPES.open, SHAPES.open],
  ['bird', SHAPES.shaka, SHAPES.shaka],
  ['dog', SHAPES.fist, SHAPES.point],
  ['dog', SHAPES.point, SHAPES.fist],
];

for (const [seal, a, b] of cases) {
  test(`печать ${seal} распознаётся и не путается с другими`, () => {
    const hands = two(a, b);
    const top = classify(hands);
    assert.equal(top[0].seal, seal);
    assert.ok(top[0].passed, `точность ${top[0].accuracy.toFixed(2)}`);
    assert.ok(!top[1].passed, `${top[1].seal} не должна проходить`);
  });
}

test('Дракон: ладонь над кулаком проходит, под кулаком — подсказка', () => {
  const above = buildHands(makeResult([
    { state: SHAPES.fist, cx: 0.5, cy: 0.55 },
    { state: SHAPES.open, cx: 0.52, cy: 0.35 },
  ]));
  const ok = evaluateSeal('dragon', above);
  assert.ok(ok.passed, `точность ${ok.accuracy.toFixed(2)}`);

  const below = buildHands(makeResult([
    { state: SHAPES.fist, cx: 0.5, cy: 0.3 },
    { state: SHAPES.open, cx: 0.52, cy: 0.55 },
  ]));
  const bad = evaluateSeal('dragon', below);
  assert.ok(!bad.passed);
  assert.match(bad.hint, /ладонь над кулаком/);
});

test('ошибка в одном пальце даёт конкретную подсказку про этот палец и руку', () => {
  const wrongRing = { ...SHAPES.two, ring: 'up' };
  const hands = two(SHAPES.two, wrongRing);
  const res = evaluateSeal('tiger', hands);
  assert.ok(!res.passed);
  assert.match(res.hint, /согни безымянный палец/);
  assert.match(res.hint, /(левой|правой) руке/);
});

test('руки далеко друг от друга — подсказка свести руки', () => {
  const hands = two(SHAPES.two, SHAPES.two, 0.6);
  const res = evaluateSeal('tiger', hands);
  assert.ok(!res.passed);
  assert.match(res.hint, /Сведи руки/);
});

test('одна рука вместо двух — подсказка про вторую руку', () => {
  const hands = buildHands(makeResult([{ state: SHAPES.two, cx: 0.5, cy: 0.5 }]));
  const res = evaluateSeal('tiger', hands);
  assert.ok(!res.passed);
  assert.match(res.hint, /обе руки/);
});

test('много неверных пальцев — одна общая подсказка', () => {
  // Для Дракона нужен кулак, а показаны две раскрытые ладони (одна над другой).
  const hands = buildHands(makeResult([
    { state: SHAPES.open, cx: 0.5, cy: 0.55 },
    { state: SHAPES.open, cx: 0.52, cy: 0.35 },
  ]));
  const res = evaluateSeal('dragon', hands);
  assert.ok(!res.passed);
  assert.match(res.hint, /Сожми .* в кулак/);
});

test('детектор засчитывает печать только после удержания и не повторяет её', () => {
  const det = new SealDetector({ holdMs: 300 });
  const hands = two(SHAPES.two, SHAPES.two);
  let fired = 0;
  for (let t = 0; t <= 1000; t += 33) {
    for (const e of det.update(hands, t).events) if (e.type === 'seal') fired++;
  }
  assert.equal(fired, 1);
  // Отпустили и сложили снова — засчитывается ещё раз.
  for (let t = 1000; t <= 1400; t += 33) det.update([], t);
  for (let t = 1400; t <= 2000; t += 33) {
    for (const e of det.update(hands, t).events) if (e.type === 'seal') fired++;
  }
  assert.equal(fired, 2);
});

test('детектор даёт подсказку, когда печать почти сложена', () => {
  const det = new SealDetector({ hintDelayMs: 300 });
  const hands = two(SHAPES.two, { ...SHAPES.two, ring: 'up' });
  const hints = [];
  for (let t = 0; t <= 800; t += 33) {
    for (const e of det.update(hands, t).events) if (e.type === 'hint') hints.push(e.hint);
  }
  assert.ok(hints.length > 0);
  assert.match(hints[0], /безымянный/);
});

function circlePoints({ sweepDeg = 360, r = 0.12, n = 50, dur = 1000, squash = 1 }) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((sweepDeg * Math.PI) / 180) * (i / (n - 1));
    return { x: 0.8 + r * Math.cos(a), y: 0.5 + r * squash * Math.sin(a), t: (dur * i) / (n - 1), palm: 0.12 };
  });
}

test('круг: ровный замкнутый проходит', () => {
  const res = scoreCircle(circlePoints({}));
  assert.ok(res.passed, JSON.stringify(res.details));
});

test('круг: незамкнутый — подсказка замкнуть', () => {
  const res = scoreCircle(circlePoints({ sweepDeg: 200 }));
  assert.ok(!res.passed);
  assert.match(res.hint, /не замкнут/);
});

test('круг: маленький — подсказка рисовать шире', () => {
  const res = scoreCircle(circlePoints({ r: 0.025 }));
  assert.ok(!res.passed);
  assert.match(res.hint, /маленький/);
});

test('круг: сплющенный — подсказка про ровность', () => {
  const res = scoreCircle(circlePoints({ squash: 0.3 }));
  assert.ok(!res.passed);
  assert.match(res.hint, /кривым или овальным/);
});
