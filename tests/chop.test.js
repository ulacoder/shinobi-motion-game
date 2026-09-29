import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHands } from '../src/geometry.js';
import { ChopDetector, bladeScore } from '../src/chop.js';
import { Battle, ENEMIES, STORY, REWARDS } from '../src/battle.js';
import { makeResult, SHAPES } from './helpers.js';

const ASPECT = 16 / 9;

/** Прогоняет движение руки сверху вниз: от y0 до y1 за ms миллисекунд, кадры по 33 мс. */
function swing(det, { state = SHAPES.open, y0 = 0.15, y1 = 0.6, ms = 180, cx = 0.5, dx = 0 } = {}) {
  const events = [];
  let t = 1000;
  const frames = Math.max(2, Math.round(ms / 33));
  // рука стоит наверху
  for (let i = 0; i < 3; i++) {
    t += 33;
    events.push(...det.update(buildHands(makeResult([{ state, cx, cy: y0 }]), ASPECT), t, t));
  }
  for (let i = 1; i <= frames; i++) {
    t += 33;
    const k = i / frames;
    const hands = buildHands(makeResult([{ state, cx: cx + dx * k, cy: y0 + (y1 - y0) * k }]), ASPECT);
    events.push(...det.update(hands, t, t));
  }
  // рука остановилась внизу
  for (let i = 0; i < 4; i++) {
    t += 33;
    events.push(...det.update(buildHands(makeResult([{ state, cx: cx + dx, cy: y1 }]), ASPECT), t, t));
  }
  return events;
}

test('раскрытая ладонь засчитывается, кулак — нет', () => {
  const open = buildHands(makeResult([{ state: SHAPES.open, cx: 0.5, cy: 0.4 }]), ASPECT)[0];
  const fist = buildHands(makeResult([{ state: SHAPES.fist, cx: 0.5, cy: 0.4 }]), ASPECT)[0];
  assert.ok(bladeScore(open).score > 0.6, `ладонь ${bladeScore(open).score}`);
  assert.ok(bladeScore(fist).score < 0.5, `кулак ${bladeScore(fist).score}`);
});

test('подняли ладонь и опустили — засчитывается', () => {
  const ev = swing(new ChopDetector());
  const chop = ev.find((e) => e.type === 'chop');
  assert.ok(chop, JSON.stringify(ev));
  assert.ok(chop.power >= 0.6 && chop.power <= 1);
});

test('медленное движение — подсказка «смелее»', () => {
  const ev = swing(new ChopDetector(), { ms: 1300 });
  assert.equal(ev.some((e) => e.type === 'chop'), false);
  assert.ok(ev.some((e) => e.type === 'hint' && /Смелее/.test(e.hint)), JSON.stringify(ev));
});

test('кулаком — подсказка раскрыть ладонь', () => {
  const ev = swing(new ChopDetector(), { state: SHAPES.fist });
  assert.equal(ev.some((e) => e.type === 'chop'), false);
  assert.ok(ev.some((e) => e.type === 'hint' && /Раскрой ладонь/.test(e.hint)), JSON.stringify(ev));
});

test('низкий замах — подсказка «выше»', () => {
  const ev = swing(new ChopDetector(), { y0: 0.4, y1: 0.5, ms: 60 });
  assert.equal(ev.some((e) => e.type === 'chop'), false);
  assert.ok(ev.some((e) => e.type === 'hint' && /Выше!/.test(e.hint)), JSON.stringify(ev));
});

test('в сюжете два сундука: клинок ветра и удар дракона', () => {
  const chests = STORY.filter((s) => s.type === 'chest').map((s) => s.reward);
  assert.deepEqual(chests, ['wind', 'dragon']);
  assert.ok(REWARDS.wind && REWARDS.dragon);
});

test('клинок ветра работает только после сундука', () => {
  const locked = new Battle({ now: 0, enemy: ENEMIES.boss });
  locked.onSeal('dragon', 1, 100);
  const ev1 = locked.onSeal('bird', 1, 500);
  assert.equal(ev1.some((e) => e.type === 'cast'), false);

  const b = new Battle({ now: 0, enemy: ENEMIES.boss, unlocked: ['wind'] });
  b.onSeal('dragon', 1, 100);
  const cast = b.onSeal('bird', 1, 500).find((e) => e.type === 'cast');
  assert.equal(cast?.tech.id, 'wind');
  assert.ok(cast.damage >= 20);
});

test('удар дракона: только при полной чакре и открытом приёме', () => {
  const b = new Battle({ now: 0, enemy: ENEMIES.boss, unlocked: ['dragon'] });
  assert.equal(b.onChop(1, 100).length, 0);
  b.chakra = 100;
  const ev = b.onChop(1, 200);
  assert.equal(ev[0].tech.id, 'dragon');
  assert.equal(b.chakra, 0);
  assert.ok(b.enemyHp <= ENEMIES.boss.hp - 40);

  const locked = new Battle({ now: 0, enemy: ENEMIES.boss });
  locked.chakra = 100;
  assert.equal(locked.onChop(1, 100).length, 0);
});
