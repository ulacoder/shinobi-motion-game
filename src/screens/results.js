// Итоги похода: очки, статистика, галерея лучших печатей, частые ошибки и таблица рекордов.

import { SEALS } from '../seals.js';
import { STAGE_NAMES } from '../battle.js';
import { sfx } from '../audio.js';
import { music } from '../music.js';
import { addRecord, getRecords } from '../storage.js';
import { $, el, GestureChoice, renderRecords, formatTime, drawHandForm } from '../ui.js';
import { arena, state, go, registerScreen, pct } from '../app/context.js';
import { drawPalmReport, describeWorst } from '../palmreport.js';
import { startStory, FIGHTS_TOTAL } from '../app/story.js';

export const results = {
  enter(res) {
    const { id } = addRecord({ name: res.name, score: res.score, win: res.win, time: Math.round(res.time), acc: res.avgAcc, stage: res.stage });
    $('res-kicker').textContent = res.reason;
    $('res-title').textContent = res.win ? 'Победа' : 'Поражение';
    $('res-score').textContent = String(res.score);
    const fromChapter = res.chapter > 1 ? ` (с главы ${res.chapter})` : '';
    $('res-stage').textContent = res.quick
      ? res.win ? 'Быстрое демо: Кагэро повержен. Полный сюжет — «Сюжет» в меню' : 'Быстрое демо: бой с Кагэро'
      : res.win
      ? `Сюжет пройден${fromChapter}, повержено врагов: ${res.stats.defeated}`
      : `Этап ${res.stage} · ${STAGE_NAMES[res.stage]} · повержено врагов: ${res.stats.defeated} из ${FIGHTS_TOTAL}`;
    const s = res.stats;
    const stats = [
      ['Время', formatTime(res.time)],
      ['Средняя точность', pct(res.avgAcc)],
      ['Печатей', s.seals],
      ['Техник', s.techniques],
      ['Блоков щитом', s.blocks],
      ['Лучшее комбо', s.maxCombo ? `×${s.maxCombo}` : '—'],
      ['Особых связок', s.specials],
      ['Пропущено ударов', s.hitsTaken],
    ];
    const dl = $('res-stats');
    dl.replaceChildren();
    for (const [k, v] of stats) {
      const d = el('div');
      d.append(el('dt', '', k), el('dd', '', String(v)));
      dl.append(d);
    }
    const gallery = $('res-forms');
    gallery.replaceChildren();
    const forms = Object.entries(res.bestForms ?? {});
    if (!forms.length) gallery.append(el('p', 'check-title', 'Печатей пока нет — в бою они сохранятся здесь.'));
    for (const [sealId, { form, accuracy }] of forms) {
      const item = el('figure', 'gallery-form');
      item.style.margin = '0';
      const c = document.createElement('canvas');
      c.width = 176;
      c.height = 132;
      drawHandForm(c, form);
      item.append(c, el('figcaption', '', `${SEALS[sealId].kanji} ${SEALS[sealId].name} · ${pct(accuracy)}`));
      gallery.append(item);
    }
    // Отчёт ладони: какие пальцы чаще всего подводили
    drawPalmReport($('palm-report'), res.fingerMiss ?? {});
    $('palm-worst').textContent = describeWorst(res.fingerMiss ?? {});
    $('palm-worst-m').textContent = describeWorst(res.fingerMiss ?? {});
    const ul = $('res-mistakes');
    ul.replaceChildren();
    if (!res.mistakes.length) ul.append(el('li', '', 'Ошибок почти не было — чистая техника.'));
    for (const [hint, count] of res.mistakes) ul.append(el('li', '', `${hint}${count > 1 ? ` (×${count})` : ''}`));
    renderRecords($('records-results'), getRecords(), id);
    this.res = res;
    this.choice ??= new GestureChoice($('screen-results'), {
      snake: () => go('menu'),
      tiger: () => startStory({ quick: this.res.quick, chapter: this.res.chapter || 1 }),
      dog: () => go('dojo'),
    });
    this.choice.reset();
    arena.setPlace(res.win ? 'dawn' : 'night');
    arena.showEnemy(null);
    music.setPlace(res.win ? 'dawn' : 'night');
    music.play(res.win ? 'victory' : 'defeat');
    if (res.win) setTimeout(() => sfx.win(), 300);
  },
  update(now) {
    const active = this.choice.update(state.hands, now);
    this.overlayTone = active ? 'pass' : 'idle';
  },
};

registerScreen('results', results);
