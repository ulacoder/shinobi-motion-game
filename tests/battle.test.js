import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, ENEMIES, PLAYER_MAX_HP, STORY, emptyStats, scoreRun } from '../src/battle.js';

const boss = ENEMIES.boss;

test('Тигр → Змея выпускает огненный шар и наносит урон', () => {
  const b = new Battle({ now: 0, enemy: boss });
  b.onSeal('tiger', 0.9, 100);
  const ev = b.onSeal('snake', 0.9, 900);
  const cast = ev.find((e) => e.type === 'cast');
  assert.equal(cast.tech.id, 'fire');
  assert.ok(b.enemyHp < boss.hp);
});

test('неверная печать в цепочке даёт конкретную подсказку', () => {
  const b = new Battle({ now: 0 });
  b.onSeal('tiger', 0.9, 100);
  const ev = b.onSeal('dragon', 0.9, 500);
  const err = ev.find((e) => e.type === 'error');
  assert.match(err.hint, /нужна «Змея», а не «Дракон»/);
  assert.equal(b.chain.length, 0);
});

test('щит блокирует удар, без щита герой теряет здоровье', () => {
  const b = new Battle({ now: 0, rng: () => 0, enemy: boss });
  b.tick(boss.firstAttack);
  assert.equal(b.foe.state, 'charging');
  b.onSeal('dog', 0.9, boss.firstAttack + 300);
  b.onSeal('dragon', 0.9, boss.firstAttack + 800);
  const hitAt = boss.firstAttack + boss.chargeMs + 10;
  const hit = b.tick(hitAt).find((e) => e.type === 'foe-hit');
  assert.equal(hit.blocked, true);
  assert.equal(b.playerHp, PLAYER_MAX_HP);

  const nextCharge = hitAt + boss.idle[0] + 10;
  b.tick(nextCharge);
  const hit2 = b.tick(nextCharge + boss.chargeMs + 10).find((e) => e.type === 'foe-hit');
  assert.equal(hit2.blocked, false);
  assert.equal(b.playerHp, PLAYER_MAX_HP - boss.damage);
});

test('молния во время заряда сбивает атаку', () => {
  const b = new Battle({ now: 0, enemy: boss });
  b.tick(boss.firstAttack);
  b.onSeal('bird', 0.9, boss.firstAttack + 200);
  const ev = b.onSeal('tiger', 0.9, boss.firstAttack + 600);
  assert.ok(ev.some((e) => e.type === 'stun'));
  assert.equal(b.foe.state, 'stunned');
});

test('цепочка обрывается, если долго ждать', () => {
  const b = new Battle({ now: 0 });
  b.onSeal('tiger', 0.9, 100);
  const ev = b.tick(5000);
  assert.ok(ev.some((e) => e.type === 'error' && /оборвалась/.test(e.hint)));
});

test('враг повержен — событие enemy-down, статистика общая для всего похода', () => {
  const stats = emptyStats();
  const b = new Battle({ now: 0, enemy: ENEMIES.scout1, stats });
  let t = 0;
  let down = null;
  while (!down && t < 60000) {
    for (const e of [...b.onSeal('tiger', 1, (t += 300)), ...b.onSeal('snake', 1, (t += 300))]) {
      if (e.type === 'enemy-down') down = e;
    }
  }
  assert.ok(down);
  assert.equal(stats.defeated, 1);
  const { score } = scoreRun({ win: true, stats, playerHp: 100, timeSec: 60 });
  assert.ok(score > 0);
});

test('ультимейт доступен только при полной чакре', () => {
  const b = new Battle({ now: 0 });
  assert.equal(b.onCircle(0.9, 100).length, 0);
  b.chakra = 100;
  const ev = b.onCircle(0.9, 200);
  assert.equal(ev[0].tech.id, 'sphere');
  assert.equal(b.chakra, 0);
});

test('комбо: техники подряд наращивают множитель, связка даёт бонус', () => {
  const b = new Battle({ now: 0, enemy: ENEMIES.boss });
  b.onSeal('bird', 1, 100);
  const first = b.onSeal('tiger', 1, 500).find((e) => e.type === 'cast');
  assert.equal(first.combo, 1);
  b.onSeal('tiger', 1, 1500);
  const second = b.onSeal('snake', 1, 1900).find((e) => e.type === 'cast');
  assert.equal(second.combo, 2);
  assert.equal(second.special?.name, 'Грозовое пламя');
  assert.ok(second.damage > 20, `урон ${second.damage}`);
  // Пауза больше окна — комбо сбрасывается.
  b.onSeal('tiger', 1, 12000);
  const third = b.onSeal('snake', 1, 12400).find((e) => e.type === 'cast');
  assert.equal(third.combo, 1);
});

test('пропущенный удар сбрасывает комбо', () => {
  const b = new Battle({ now: 0, rng: () => 0, enemy: ENEMIES.boss });
  b.onSeal('tiger', 1, 100);
  b.onSeal('snake', 1, 400);
  b.tick(ENEMIES.boss.firstAttack);
  b.onSeal('tiger', 1, ENEMIES.boss.firstAttack + 100);
  b.onSeal('snake', 1, ENEMIES.boss.firstAttack + 400);
  assert.equal(b.combo.count, 2);
  const ev = b.tick(ENEMIES.boss.firstAttack + ENEMIES.boss.chargeMs + 10);
  assert.ok(ev.some((e) => e.type === 'combo-break'));
  assert.equal(b.combo.count, 0);
});

test('сюжет: подпешки → пешки → главный злодей', () => {
  const fights = STORY.filter((s) => s.type === 'fight').map((s) => ENEMIES[s.enemy].look);
  assert.deepEqual(fights, ['scout', 'scout', 'oni', 'oni', 'warlord']);
  assert.ok(STORY.at(-1).final);
  const ids = STORY.flatMap((s) => s.lines ?? []).map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, 'id реплик уникальны');
});
