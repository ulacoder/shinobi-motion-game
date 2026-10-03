// Своя печать из Кузницы в бою и кража печати Кагэро (фаза ярости босса).
// Методы подмешиваются в экран боя (src/screens/fight.js).

import { sfx, playVoice } from '../audio.js';
import { $, snapshotHands, drawHandForm } from '../ui.js';
import { arena, sensei, state, camSeal, moment } from '../app/context.js';
import { evaluateTemplate } from '../forge.js';

export const stolen = {
  /**
   * Своя печать: если жест совпал с эталоном из Кузницы (и это не встроенная печать) и держится 0,4 с — техника.
   * Повтор — только после того, как жест «отпустили». Возвращает true, пока жест совпадает (тогда молчат подсказки печатей).
   */
  updateForged(now, best) {
    if (!this.forged) return false;
    const ev = evaluateTemplate(this.forged.seal.tpl, state.hands);
    const match = ev.passed && !best?.passed;
    if (!match) {
      this.forgedSince = 0;
      if (ev.accuracy < 0.55) this.forgedArmed = true;
      return false;
    }
    this.overlayTone = 'pass';
    camSeal.hidden = true;
    if (!this.forgedArmed) return true;
    if (!this.forgedSince) this.forgedSince = now;
    if (now - this.forgedSince < 400) return true;
    this.forgedArmed = false;
    this.forgedSince = 0;
    if (this.steal) {
      this.resolveSteal(true, ev.accuracy, now);
      return true;
    }
    const events = this.battle.onForged(this.forged.tech, ev.accuracy, now);
    if (!events.length) {
      sensei.show(`${this.forged.tech.name} перезаряжается — через пару секунд`, 'info', now, { lock: 900 });
      return true;
    }
    sfx.seal();
    const form = snapshotHands(state.hands);
    for (const e of events) if (e.type === 'cast') e.forms = [form];
    this.handle(events, now);
    return true;
  },

  /** Кагэро показывает украденную печать красными руками: у игрока 5 секунд, чтобы повторить её первым. */
  startSteal(now) {
    const b = this.battle;
    this.steal = { start: now, until: now + 5000 };
    b.holdFoe(now + 6500);
    const box = $('steal');
    box.classList.remove('won');
    $('steal-hanko').textContent = '奪';
    box.querySelector('.steal-title').textContent = 'Кагэро украл печать!';
    $('steal-sub').textContent = `Повтори «${this.forged.tech.name}» быстрее него — или поставь щит`;
    // форма печати — зеркально, как будто её складывает сам Кагэро
    const form = this.forged.seal.form ?? { hands: [] };
    const mirrored = { hands: (form.hands ?? []).map((h) => h.map((p) => ({ x: -p.x, y: p.y }))) };
    // тушью, как формы печатей в цепочке, но с красным свечением Затмения
    drawHandForm($('steal-hands'), mirrored, { glow: 'rgba(156, 34, 25, 0.95)' });
    box.hidden = false;
    sfx.roar();
    arena.label('奪!', '#ff4d3a');
    moment({ who: 'Кагэро', caption: 'Твоя печать теперь моя!', sfx: '奪!', priority: 3, kanji: '奪' });
    sensei.show('Кагэро: «Твоя печать теперь моя!» Повтори её первым!', 'warn', now, { lock: 2500, ttl: 5000 });
  },

  resolveSteal(won, accuracy, now) {
    const b = this.battle;
    this.steal = null;
    this.stealDone = true;
    const box = $('steal');
    if (won) {
      $('steal-hanko').textContent = '返';
      b.forgedAt = -Infinity; // перезарядка не мешает вернуть печать
      const tech = { ...this.forged.tech, damage: 30 };
      const cast = b.onForged(tech, accuracy, now);
      // если возвращённая печать добила Кагэро — не оглушаем уже поверженного
      const events = b.over ? cast : [...cast, ...b.stunFoe(2600, now)];
      const form = snapshotHands(state.hands);
      for (const e of events) if (e.type === 'cast') e.forms = [form];
      box.classList.add('won');
      box.querySelector('.steal-title').textContent = 'Печать возвращена!';
      $('steal-sub').textContent = b.over ? 'Кагэро повержен своей же жадностью' : 'Кагэро оглушён своей же жадностью';
      arena.label('返!', '#6fd08c');
      moment({ caption: 'Это моя печать. Верни!', sfx: '返!', priority: 5, kanji: '返' });
      this.handle(events, now);
      // после каста: реплика героя заменяет обычный выкрик своей печати
      playVoice('u_return');
      if (!b.over) sensei.show('Печать возвращена! Кагэро оглушён — бей!', 'good', now, { lock: 2000, ttl: 3000 });
    } else {
      const events = b.stolenHit(22, now);
      box.querySelector('.steal-title').textContent = 'Украдено!';
      $('steal-sub').textContent = 'Кагэро ударил твоей же печатью';
      const hint = 'Кагэро украл печать: повтори её сразу, как только увидишь красные руки';
      b.noteMistake(hint, now);
      this.handle(events, now);
      if (!b.over) sensei.show(hint, 'warn', now, { lock: 2200, ttl: 3500 });
    }
    setTimeout(() => (box.hidden = true), 1400);
  },
};
