// Выбор главы руками: покажи 1, 2 или 3 пальца и держи секунду. Мышью и клавишами 1–3 тоже можно.

import { FingerChoice } from '../fingers.js';
import { music } from '../music.js';
import { sfx } from '../audio.js';
import { arena, sensei, state, go, registerScreen, reportFrameIssue } from '../app/context.js';
import { startStory } from '../app/story.js';

import { fingersIcon } from '../icons.js';

const cards = () => [...document.querySelectorAll('#screen-chapters [data-chapter]')];
for (const node of document.querySelectorAll('[data-fingers]')) node.innerHTML = fingersIcon(Number(node.dataset.fingers), { size: 60 });

export const chapters = {
  picker: new FingerChoice({ holdMs: 1000, allowed: [1, 2, 3, 4] }),

  enter() {
    this.picker.reset();
    this.lastCount = -1;
    arena.setPlace('night');
    arena.showEnemy(null);
    music.play('calm');
    music.setPlace('night');
    sensei.show('Покажи 1, 2 или 3 пальца — номер главы. 4 пальца — дуэль с тенью', 'info', performance.now(), { ttl: 3500 });
  },

  exit() {
    for (const c of cards()) {
      c.classList.remove('active');
      c.querySelector('.ring circle').style.strokeDashoffset = '119.4';
    }
  },

  pick(chapter) {
    sfx.success();
    // 4 пальца — не глава, а испытание «Дуэль с тенью»
    if (chapter === 4) return go('duel');
    startStory({ chapter });
  },

  update(now) {
    const r = this.picker.update(state.hands, now);
    this.overlayTone = r.progress > 0 ? 'pass' : state.hands.length ? 'near' : 'idle';
    for (const c of cards()) {
      const n = Number(c.dataset.chapter);
      const on = r.count === n && r.progress > 0;
      c.classList.toggle('active', on);
      // кольцо удержания — как у пунктов меню
      c.querySelector('.ring circle').style.strokeDashoffset = String(119.4 * (1 - (on ? r.progress : 0)));
    }
    this.lastCount = r.count;
    if (r.chosen) return this.pick(r.chosen);
    if (!reportFrameIssue(now) && r.hint) sensei.show(r.hint, 'info', now);
  },
};

for (const c of cards()) c.addEventListener('click', () => chapters.pick(Number(c.dataset.chapter)));

registerScreen('chapters', chapters);
