// «Кагэро читает твои руки» в бою с боссом: он находит палец, который подводил чаще всего
// (данные отчёта ладони), объявляет его и бьёт туда. Чтобы отразить удар, сложи печать,
// где этот палец важен, и удержи его ровно. Методы подмешиваются в экран боя (src/screens/fight.js).

import { SEALS, evaluateSeal } from '../seals.js';
import { sfx, playVoice, senseiVoice } from '../audio.js';
import { $ } from '../ui.js';
import { sealPalmsIcon } from '../icons.js';
import { arena, sensei, state, setWidth, pct, moment, badFingers } from '../app/context.js';
import { wantsBySide } from '../ghost.js';
import { COUNTER_SEAL, FINGER_GEN, SIDE_PREP, pickWeakFinger, readPassed, fingerState } from '../readhands.js';

export const READ_AT_MS = 12000; // когда в бою с боссом он «читает руки»
const READ_MS = 7000; // сколько времени на ответ

export const weakfinger = {
  /** Пора ли: бой с боссом, прошло 12 с, кражи печати сейчас нет, событие ещё не было. */
  readDue(now) {
    const b = this.battle;
    return this.enemy.boss && !this.readDone && !this.read && !this.steal && !b.over && b.elapsed(now) > READ_AT_MS && b.enemyHp > this.enemy.hp * 0.2;
  },

  startRead(now) {
    const b = this.battle;
    const weak = pickWeakFinger(state.run.fingerMiss);
    const seal = COUNTER_SEAL[weak.finger];
    this.read = { ...weak, seal, start: now, until: now + READ_MS, since: 0 };
    b.holdFoe(now + READ_MS + 1500);
    const box = $('readhands');
    box.classList.remove('won', 'lost');
    $('rh-hanko').textContent = '読';
    $('rh-title').textContent = 'Кагэро читает твои руки';
    const finger = FINGER_GEN[weak.finger];
    const where = SIDE_PREP[weak.side] ?? 'на руке';
    $('rh-quote').textContent = weak.guessed
      ? `«Ни одной ошибки? Проверим твой ${finger} ${where}!»`
      : `«Твой ${finger} ${where} дрожит — ${weak.count} ${weak.count % 10 >= 2 && weak.count % 10 <= 4 && (weak.count % 100 < 12 || weak.count % 100 > 14) ? 'раза' : 'раз'} подвёл!»`;
    // руки сразу в форме печати-ответа, слабый палец залит красным — видно, как он должен стоять
    const fills = { left: {}, right: {} };
    fills[weak.side === 'left' ? 'left' : 'right'][weak.finger] = '#cc3325';
    $('rh-palm').innerHTML = sealPalmsIcon(seal, fills.left, fills.right);
    const stateWord = fingerState(SEALS[seal].roles[0].fingers, weak.finger);
    this.read.stateWord = stateWord;
    $('rh-sub').textContent = `Сложи «${SEALS[seal].name}»: ${finger} ${where} — ${stateWord}. Не дай ему дрогнуть — и удар уйдёт в пустоту`;
    box.hidden = false;
    sfx.roar();
    arena.label('読!', '#ff4d3a');
    moment({ who: 'Кагэро', caption: `Твой ${finger} палец дрожит!`, sfx: 'ギロッ!', priority: 3, kanji: '読', once: 'read' });
    playVoice(weak.guessed ? 'k_read_clean' : 'k_read');
    sensei.show(`Кагэро бьёт по слабому месту! Сложи «${SEALS[seal].name}»: ${finger} ${where} — ${stateWord}`, 'warn', now, {
      lock: 2500,
      ttl: 5000,
    });
  },

  /** Каждый кадр, пока идёт «чтение рук»: проверяем печать и именно этот палец, подсказки — как в режиме ошибки. */
  updateRead(now, issue) {
    const r = this.read;
    const ev = evaluateSeal(r.seal, state.hands);
    const ok = readPassed(ev, r.side, r.finger);
    this.overlayTone = ok ? 'pass' : ev.accuracy >= 0.45 ? 'near' : 'idle';
    this.overlayBad = ok ? null : badFingers(ev);
    this.overlayGuide = !ok && ev.accuracy >= 0.45 ? wantsBySide(ev) : null;
    setWidth($('rh-fill'), pct(Math.max(0, (r.until - now) / (r.until - r.start))));
    if (ok) {
      r.since ||= now;
      if (now - r.since >= 450) return this.resolveRead(true, ev.accuracy, now);
    } else {
      r.since = 0;
      if (!issue && ev.hint && now - r.start > 1500) sensei.show(ev.hint, 'warn', now);
    }
    if (now >= r.until) this.resolveRead(false, 0, now);
  },

  resolveRead(won, accuracy, now) {
    const b = this.battle;
    const r = this.read;
    this.read = null;
    this.readDone = true;
    this.overlayBad = null;
    this.overlayGuide = null;
    const box = $('readhands');
    const finger = FINGER_GEN[r.finger];
    if (won) {
      box.classList.add('won');
      $('rh-hanko').textContent = '破';
      $('rh-title').textContent = 'Палец не дрогнул!';
      $('rh-sub').textContent = `${SEALS[r.seal].name}: ${pct(accuracy)}. Кагэро промахнулся и открылся`;
      b.chakra = Math.min(100, b.chakra + 30);
      this.handle(b.stunFoe(2600, now), now);
      if (b.ultimateReady) this.handle([{ type: 'ultimate-ready' }], now);
      sfx.success();
      arena.label('読破!', '#6fd08c');
      moment({ caption: 'Мой палец не дрогнет!', sfx: 'ピタッ!', priority: 4, kanji: '破', once: 'read-won' });
      playVoice('u_read_won');
      sensei.show(`Отлично! ${finger} палец не дрогнул — Кагэро оглушён, +30% чакры`, 'good', now, { lock: 2000, ttl: 3000 });
      senseiVoice('se_read_won');
    } else {
      box.classList.add('lost');
      $('rh-title').textContent = 'Палец дрогнул';
      $('rh-sub').textContent = 'Кагэро ударил по слабому месту';
      const hint = `Кагэро бил по слабому пальцу: ${finger} ${SIDE_PREP[r.side] ?? ''} — потренируй «${SEALS[r.seal].name}» в додзё`;
      b.noteMistake(hint, now);
      this.handle(b.stolenHit(18, now), now);
      if (!b.over) sensei.show(hint, 'warn', now, { lock: 2200, ttl: 3500 });
    }
    setTimeout(() => (box.hidden = true), 1500);
  },
};
