// Экран меню: выбор режима жестом (Змея — додзё, Тигр — сюжет, Птица — быстрый бой).

import { music } from '../music.js';
import { getRecords } from '../storage.js';
import { $, GestureChoice, renderRecords } from '../ui.js';
import { arena, sensei, state, go, registerScreen, reportFrameIssue } from '../app/context.js';
import { startStory } from '../app/story.js';

export const menu = {
  enter() {
    renderRecords($('records-menu'), getRecords());
    this.choice ??= new GestureChoice($('screen-menu'), {
      snake: () => go('dojo'),
      tiger: () => go('chapters'),
      bird: () => startStory({ quick: true }),
      dog: () => go('forge'),
    });
    this.choice.reset();
    sensei.clear();
    arena.setPlace('night');
    arena.showEnemy(null);
    music.play('calm');
    music.setPlace('night');
  },
  update(now) {
    const active = this.choice.update(state.hands, now);
    this.overlayTone = active ? 'pass' : 'idle';
    if (!state.hands.length) sensei.show('Подними руки к лицу — камера должна их видеть', 'info', now);
    else reportFrameIssue(now);
  },
};

registerScreen('menu', menu);
