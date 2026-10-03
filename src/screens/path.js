// «Свиток пути»: что сказало жюри отбора и что изменилось к финалу — прямо в игре, в виде свитка.
// Пункты появляются по одному с печатью-ханко. Раскрытые ладони — в меню, Птица — сразу в быстрое демо.

import { sfx } from '../audio.js';
import { music } from '../music.js';
import { $, el, GestureChoice } from '../ui.js';
import { arena, sensei, state, go, registerScreen } from '../app/context.js';
import { startStory } from '../app/story.js';

/** Замечания жюри отбора → что сделали (цифры — замеры из README). */
export const PATH_FIXES = [
  { said: 'Первый запуск тяжеловат', did: 'Сжатая модель, прогрев на заставке, кэш', from: '31 МБ', to: '9 МБ', kanji: '速' },
  { said: 'Сюжет длинноват для демо', did: 'Быстрое демо и выбор главы пальцами', from: '6–10 мин', to: '2 мин', kanji: '短' },
  { said: 'main.js на 1000+ строк', did: 'Экраны и логика — по модулям', from: '1292', to: '252 строки', kanji: '分' },
  { said: 'Печати были у других команд', did: 'Кузница: игра учит любой твой жест', from: '5 печатей', to: '∞ жестов', kanji: '鍛' },
];

/** Новое к финалу — всё видно в игре. */
export const PATH_NEW = [
  { kanji: '奪', name: 'Кагэро крадёт печать', how: 'повтори её первым' },
  { kanji: '影', name: 'Рука-призрак', how: 'показывает верную форму' },
  { kanji: '火', name: 'AR-эффекты', how: 'искры и иероглифы на руках' },
  { kanji: '掌', name: 'Отчёт ладони', how: 'какой палец подводит' },
  { kanji: '手', name: 'Руки героя', how: 'повторяют твои пальцы' },
  { kanji: '再', name: 'Повтор печати', how: 'замедленно, со следами' },
  { kanji: '漫', name: 'Глава манги', how: 'страница из твоего боя' },
  { kanji: '友', name: 'Печать дружбы', how: 'кооп: только вдвоём' },
  { kanji: '指', name: 'Всё руками', how: '«окей» — меню, пальцы — главы' },
  { kanji: '読', name: 'Кагэро читает руки', how: 'бьёт по твоему слабому пальцу' },
  { kanji: '闘', name: 'Дуэль с тенью', how: 'повтори печать тени на время' },
  { kanji: '印', name: 'Ханко-ладонь', how: 'твоя печать — подпись игрока' },
];

export const path = {
  enter() {
    const fixes = $('path-fixes');
    fixes.replaceChildren();
    PATH_FIXES.forEach((f, i) => {
      const li = el('li', 'path-fix');
      li.style.setProperty('--d', `${0.25 + i * 0.35}s`);
      const said = el('p', 'path-said', `«${f.said}»`);
      const did = el('p', 'path-did', f.did);
      const nums = el('p', 'path-nums');
      nums.append(el('s', '', f.from), el('span', 'path-arrow', '→'), el('b', '', f.to));
      const hanko = el('span', 'hanko path-hanko', f.kanji);
      li.append(hanko, said, did, nums);
      fixes.append(li);
    });
    const news = $('path-new');
    news.replaceChildren();
    PATH_NEW.forEach((n, i) => {
      const li = el('li', 'path-new-item');
      li.style.setProperty('--d', `${1.7 + i * 0.12}s`);
      li.append(el('span', 'hanko hanko-sm', n.kanji), el('b', '', n.name), el('span', '', n.how));
      news.append(li);
    });
    this.choice ??= new GestureChoice($('screen-path'), {
      menu: () => go('menu'),
      bird: () => startStory({ quick: true }),
    });
    this.choice.reset();
    arena.setPlace('dawn');
    arena.showEnemy(null);
    music.play('calm');
    music.setPlace('dawn');
    sfx.page();
    // печати пунктов «ставятся» по очереди
    clearTimeout(this.t);
    let k = 0;
    const tick = () => {
      if (state.controller !== this || k >= PATH_FIXES.length) return;
      sfx.seal();
      k++;
      this.t = setTimeout(tick, 350);
    };
    this.t = setTimeout(tick, 250);
    sensei.clear();
  },
  exit() {
    clearTimeout(this.t);
  },
  update(now) {
    const active = this.choice.update(state.hands, now);
    this.overlayTone = active ? 'pass' : 'idle';
  },
};

registerScreen('path', path);
