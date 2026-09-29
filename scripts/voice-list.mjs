// Печатает список реплик для озвучки (VOICES.md) прямо из сюжета игры.
// Запуск: node scripts/voice-list.mjs > VOICES.md
import { STORY, ENEMIES } from '../src/battle.js';

const READERS = {
  ulagat: 'Улагат',
  tair: 'Таир',
  daniyar: 'Данияр',
  sensei: 'Данияр (голос сенсея Рю — пониже и помедленнее)',
  scout1: 'Таир (злодейский голос)',
  scout2: 'Таир (злодейский голос)',
  ash1: 'Таир (злодейский голос)',
  ash2: 'Данияр (злодейский голос)',
  boss: 'Данияр (голос Кагэро — низко и зловеще)',
};
const NAMES = { ulagat: 'Улагат', tair: 'Таир', daniyar: 'Данияр', sensei: 'Сенсей Рю' };
const who = (id) => NAMES[id] ?? ENEMIES[id]?.name ?? id;

const EXTRA = [
  { id: 'cast_fire', reader: 'ulagat', text: 'Огненный шар!' },
  { id: 'cast_lightning', reader: 'ulagat', text: 'Молния!' },
  { id: 'cast_shield', reader: 'ulagat', text: 'Водяной щит!' },
  { id: 'cast_sphere', reader: 'ulagat', text: 'Вихревая сфера!' },
  { id: 'combo', reader: 'tair', text: 'Комбо! Давай ещё!' },
  { id: 'hero_hurt', reader: 'ulagat', text: 'Агх!.. (короткий вскрик от удара)' },
];

const out = [];
out.push('# Озвучка: кто что читает');
out.push('');
out.push('Каждая реплика — отдельный файл. Имя файла = код из первой колонки, например `intro_2.mp3`.');
out.push('Подходят форматы mp3, m4a, wav, ogg. Файлы кладите в папку `public/voices/` и пересоберите проект');
out.push('(`npm run dev` или новый деплой) — игра сама найдёт записи и будет проигрывать их вместо текста без звука.');
out.push('Если какой-то записи нет, ничего не сломается: реплика просто покажется текстом.');
out.push('');
out.push('Советы: записывайте на телефон в тихой комнате, держите телефон в 20–30 см, говорите с эмоцией,');
out.push('обрежьте тишину в начале и в конце. Роли злодеев и сенсея можно менять между собой как угодно.');
out.push('');
const readers = ['Улагат', 'Таир', 'Данияр'];
for (const r of readers) {
  out.push(`## ${r}`);
  out.push('');
  out.push('| Файл | Персонаж | Текст |');
  out.push('|---|---|---|');
  for (const step of STORY) {
    for (const line of step.lines ?? []) {
      if (!READERS[line.who].startsWith(r)) continue;
      out.push(`| \`${line.id}\` | ${who(line.who)} | ${line.text} |`);
    }
  }
  for (const e of EXTRA) {
    if (!READERS[e.reader].startsWith(r)) continue;
    out.push(`| \`${e.id}\` | ${who(e.reader)} | ${e.text} |`);
  }
  out.push('');
}
out.push('## Свои звуковые эффекты (по желанию)');
out.push('');
out.push('Можно заменить синтезированные звуки настоящими записями: положите файл в `public/sounds/` с одним из имён:');
out.push('`seal`, `fire`, `lightning`, `shield`, `sphere`, `hit`, `hurt`, `blocked`, `charge`, `combo`, `smoke`, `win`, `lose`, `select`');
out.push('(например, `lightning.mp3`). Берите только звуки со свободной лицензией (CC0) или записывайте сами.');
console.log(out.join('\n'));
