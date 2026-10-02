// «Твоя глава манги»: после боя игра показывает страницу манги из стоп-кадров камеры.
// Птица — сохранить PNG, раскрытые ладони — к итогам.

import { sfx } from '../audio.js';
import { music } from '../music.js';
import { renderMangaPage } from '../manga.js';
import { $, GestureChoice } from '../ui.js';
import { arena, sensei, state, go, registerScreen } from '../app/context.js';

export const mangaScreen = {
  enter(res) {
    this.res = res;
    const date = new Date().toLocaleDateString('ru-RU');
    const chapterTitle = res.win ? (res.quick ? 'Глава: бой с Кагэро' : 'Глава: спасение деревни') : 'Глава: продолжение следует…';
    this.page = renderMangaPage(res.moments ?? [], { name: res.name, score: res.score, win: res.win, chapterTitle, date });
    const c = $('manga-canvas');
    c.getContext('2d').drawImage(this.page, 0, 0, c.width, c.height);
    $('manga-saved').hidden = true;
    this.choice ??= new GestureChoice($('screen-manga'), {
      bird: () => this.save(),
      snake: () => go('results', this.res),
    });
    this.choice.reset();
    arena.setPlace(res.win ? 'dawn' : 'night');
    arena.showEnemy(null);
    music.play(res.win ? 'victory' : 'defeat');
    sfx.page();
    sensei.clear();
  },

  /** Сохраняет страницу как PNG и остаётся на экране (можно сохранить ещё раз). */
  save() {
    const name = `put-pechatey-${this.res.name.replace(/[^\p{L}\d-]+/gu, '')}.png`;
    this.page.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
    sfx.success();
    const saved = $('manga-saved');
    saved.textContent = `Сохранено: ${name}`;
    saved.hidden = false;
    // повторное сохранение — после того, как жест отпустили
    this.choice.reset();
  },

  update(now) {
    const active = this.choice.update(state.hands, now);
    this.overlayTone = active ? 'pass' : 'idle';
  },
};

registerScreen('manga', mangaScreen);
