import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HandGate, plausibleHand, MIN_PALM } from '../src/geometry.js';

const handAt = (x, y) => ({ center: { x, y } });

test('ложная рука-крошка (глаз) отсекается по размеру ладони', () => {
  const tiny = Array.from({ length: 21 }, () => ({ x: 1, y: 0.4 }));
  tiny[9] = { x: 1, y: 0.4 + MIN_PALM * 0.6 };
  assert.equal(plausibleHand(tiny), false);
  const real = Array.from({ length: 21 }, () => ({ x: 1, y: 0.6 }));
  real[9] = { x: 1, y: 0.48 };
  assert.equal(plausibleHand(real), true);
});

test('новая рука засчитывается только после трёх распознаваний подряд', () => {
  const gate = new HandGate();
  assert.equal(gate.filter([handAt(0.8, 0.5)]).length, 0);
  assert.equal(gate.filter([handAt(0.81, 0.5)]).length, 0);
  assert.equal(gate.filter([handAt(0.82, 0.51)]).length, 1);
  assert.equal(gate.filter([handAt(0.83, 0.51)]).length, 1);
});

test('мигающая ложная рука не проходит, настоящая рука рядом не сбрасывается', () => {
  const gate = new HandGate();
  for (let i = 0; i < 3; i++) gate.filter([handAt(0.5, 0.6)]);
  // глаз мелькает через кадр далеко от руки
  for (let i = 0; i < 6; i++) {
    const hands = i % 2 ? [handAt(0.5, 0.6), handAt(1.2, 0.2)] : [handAt(0.5, 0.6)];
    const out = gate.filter(hands);
    assert.equal(out.length, 1);
    assert.equal(out[0].center.x, 0.5);
  }
});

test('две руки не цепляются за один и тот же трек', () => {
  const gate = new HandGate();
  for (let i = 0; i < 3; i++) gate.filter([handAt(0.6, 0.5)]);
  const out = gate.filter([handAt(0.6, 0.5), handAt(0.65, 0.5)]);
  assert.equal(out.length, 1); // вторая рука новая — ждёт подтверждения
});
