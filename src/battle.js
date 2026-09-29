// Логика боя: цепочки печатей → техники, враг с заряжаемыми атаками, щит, чакра и ультимейт.
// Плюс сюжет: несколько врагов подряд (подпешки → пешки → главный злодей).
// Модуль не знает ничего про камеру и отрисовку — только правила игры. Его легко тестировать.

import { SEALS } from './seals.js';

export const TECHNIQUES = {
  fire: {
    id: 'fire',
    name: 'Огненный шар',
    glyph: '火',
    seq: ['tiger', 'snake'],
    damage: 20,
    note: 'урон',
    desc: 'Сгусток пламени летит во врага и взрывается. Главный источник урона.',
  },
  lightning: {
    id: 'lightning',
    name: 'Молния',
    glyph: '雷',
    seq: ['bird', 'tiger'],
    damage: 12,
    stun: true,
    note: 'сбивает атаку врага',
    desc: 'Над врагом собирается грозовая туча и бьёт тройной разряд. Если враг заряжает удар — сбивает его и оглушает.',
  },
  shield: {
    id: 'shield',
    name: 'Водяной щит',
    glyph: '水',
    seq: ['dog', 'dragon'],
    shieldMs: 6000,
    note: 'блокирует удар',
    desc: 'Купол из воды на 6 секунд. Полностью гасит следующий удар врага.',
  },
};

export const ULTIMATE = {
  id: 'sphere',
  name: 'Вихревая сфера',
  glyph: '円',
  damage: 34,
  note: 'нарисуй круг',
  desc: 'Сжатый вихрь чакры: закручиваешь его кругом пальца и врезаешь во врага. Самый сильный удар, нужна полная чакра.',
};

/** Приёмы, которые открываются в бамбуковых сундуках по ходу сюжета. */
export const EXTRA_TECHNIQUES = {
  wind: {
    id: 'wind',
    name: 'Клинок ветра',
    glyph: '風',
    seq: ['dragon', 'bird'],
    damage: 24,
    note: 'двойной разрез',
    desc: 'Два серпа из сжатого ветра рассекают врага крест-накрест. Бьёт сильнее огненного шара.',
  },
};

/** Второй ультимейт: подними ладонь и опусти при полной чакре. */
export const DRAGON = {
  id: 'dragon',
  name: 'Удар дракона',
  glyph: '龍',
  damage: 44,
  note: 'рубящий удар ладонью',
  desc: 'Подними раскрытую ладонь и опусти вниз — с неба обрушивается светящийся дракон. Самый мощный приём.',
};

/** Награды сундуков. */
export const REWARDS = {
  wind: { kind: 'technique', tech: EXTRA_TECHNIQUES.wind, how: 'Дракон → Птица' },
  dragon: { kind: 'ultimate', tech: DRAGON, how: 'подними ладонь и опусти при полной чакре' },
};

/** Особые связки: одна техника сразу за другой даёт бонус. */
export const COMBOS = [
  { from: 'lightning', to: 'fire', name: 'Грозовое пламя', bonus: 10 },
  { from: 'shield', to: 'lightning', name: 'Контрудар молнией', bonus: 8 },
  { from: 'fire', to: 'sphere', name: 'Огненный вихрь', bonus: 12 },
  { from: 'wind', to: 'fire', name: 'Пламенный ураган', bonus: 10 },
  { from: 'lightning', to: 'dragon', name: 'Небесный дракон', bonus: 16 },
];
export const COMBO_WINDOW_MS = 7000;

/** Герои. Играешь за Улагата, Таир и Данияр — напарники в сюжете. */
export const HEROES = {
  ulagat: { id: 'ulagat', name: 'Улагат' },
  tair: { id: 'tair', name: 'Таир' },
  daniyar: { id: 'daniyar', name: 'Данияр' },
};

/** Враги. look — как их рисовать (см. characters.js). */
export const ENEMIES = {
  scout1: {
    id: 'scout1',
    name: 'Мукадэ',
    title: 'подпешка клана Затмения',
    look: 'scout',
    tint: '#6d7a8c',
    hp: 26,
    damage: 8,
    chargeMs: 3800,
    idle: [5200, 7000],
    firstAttack: 6500,
  },
  scout2: {
    id: 'scout2',
    name: 'Ябу',
    title: 'подпешка клана Затмения',
    look: 'scout',
    tint: '#7c6a8c',
    hp: 30,
    damage: 9,
    chargeMs: 3600,
    idle: [4800, 6500],
    firstAttack: 5000,
  },
  ash1: {
    id: 'ash1',
    name: 'Хайко',
    title: 'пешка · Близнец Пепла',
    look: 'oni',
    tint: '#cc3325',
    hp: 42,
    damage: 12,
    chargeMs: 3200,
    idle: [4300, 5800],
    firstAttack: 4500,
  },
  ash2: {
    id: 'ash2',
    name: 'Сумико',
    title: 'пешка · Близнец Пепла',
    look: 'oni',
    tint: '#3f6fd1',
    hp: 42,
    damage: 12,
    chargeMs: 3000,
    idle: [4000, 5500],
    firstAttack: 4500,
  },
  boss: {
    id: 'boss',
    name: 'Кагэро',
    title: 'владыка клана Затмения',
    look: 'warlord',
    tint: '#6b2fb3',
    hp: 110,
    damage: 18,
    chargeMs: 3000,
    chargeMs2: 2400,
    idle: [4200, 5600],
    idle2: [3200, 4400],
    firstAttack: 4500,
    boss: true,
  },
};

/** Сюжет: сцены-диалоги и бои по порядку. id реплики = имя файла озвучки (public/voices/<id>.mp3). */
export const STORY = [
  {
    type: 'scene',
    stage: 1,
    title: 'Этап 1 · Подпешки',
    place: 'forest',
    lines: [
      { id: 'intro_1', who: 'sensei', text: 'Улагат, Таир, Данияр! Клан Затмения напал на деревню у Ветряного перевала. Их главарь — Кагэро.' },
      { id: 'intro_2', who: 'tair', text: 'Наконец-то настоящее дело! Я пойду первым.' },
      { id: 'intro_3', who: 'daniyar', text: 'Не спеши, Таир. Их подпешки уже здесь — сначала разберёмся с ними.' },
      { id: 'intro_4', who: 'ulagat', text: 'Я возьму их на себя. Печати отработаны.' },
      { id: 'intro_5', who: 'scout1', text: 'Хе-хе… Три мальчишки с голыми руками? Кагэро даже не узнает, что вы были.' },
    ],
  },
  { type: 'fight', stage: 1, enemy: 'scout1', place: 'forest' },
  {
    type: 'scene',
    stage: 1,
    place: 'forest',
    lines: [
      { id: 's2_1', who: 'scout2', text: 'Мукадэ свалился?! Ладно, теперь моя очередь!' },
      { id: 's2_2', who: 'daniyar', text: 'Улагат, у него удар медленный. Как увидишь красную полосу — ставь щит.' },
      { id: 's2_3', who: 'ulagat', text: 'Понял. Следующий.' },
    ],
  },
  { type: 'fight', stage: 1, enemy: 'scout2', place: 'forest' },
  { type: 'chest', stage: 1, reward: 'wind', place: 'forest' },
  {
    type: 'scene',
    stage: 2,
    title: 'Этап 2 · Пешки',
    place: 'bridge',
    heal: 30,
    lines: [
      { id: 's3_1', who: 'tair', text: 'Подпешки кончились. Дальше мост — и Близнецы Пепла.' },
      { id: 's3_2', who: 'sensei', text: 'Они бьют сильнее и быстрее. Держите щит наготове и не рвите цепочку печатей.' },
      { id: 's3_3', who: 'ash1', text: 'Подпешки — мусор. Мы — правая рука Кагэро.' },
      { id: 's3_4', who: 'ash2', text: 'И левая. Ваши печати вас не спасут.' },
      { id: 's3_5', who: 'ulagat', text: 'Посмотрим.' },
    ],
  },
  { type: 'fight', stage: 2, enemy: 'ash1', place: 'bridge' },
  {
    type: 'scene',
    stage: 2,
    place: 'bridge',
    lines: [
      { id: 's4_1', who: 'ash2', text: 'Брат?! Вы за это заплатите!' },
      { id: 's4_2', who: 'tair', text: 'Улагат, бей комбо: сначала Молния, сразу за ней Огненный шар!' },
    ],
  },
  { type: 'fight', stage: 2, enemy: 'ash2', place: 'bridge' },
  { type: 'chest', stage: 2, reward: 'dragon', place: 'bridge' },
  {
    type: 'scene',
    stage: 3,
    title: 'Этап 3 · Главный злодей',
    place: 'eclipse',
    heal: 40,
    lines: [
      { id: 's5_1', who: 'boss', text: 'Вы сломали моих пешек, мальчишки. Но печати без точности — пустые жесты.' },
      { id: 's5_2', who: 'daniyar', text: 'Он силён. Улагат, мы с Таиром отвлечём его — копи чакру!' },
      { id: 's5_3', who: 'tair', text: 'Как только чакра полная — рисуй круг. Вихревая сфера его свалит!' },
      { id: 's5_4', who: 'ulagat', text: 'Мои печати точны. Сейчас увидишь.' },
    ],
  },
  { type: 'fight', stage: 3, enemy: 'boss', place: 'eclipse' },
  {
    type: 'scene',
    stage: 3,
    place: 'dawn',
    final: true,
    lines: [
      { id: 'end_1', who: 'boss', text: 'Невозможно… Такая точность…' },
      { id: 'end_2', who: 'tair', text: 'Мы сделали это!' },
      { id: 'end_3', who: 'daniyar', text: 'Деревня спасена. Отличная работа, Улагат.' },
      { id: 'end_4', who: 'sensei', text: 'Вы трое стали настоящими мастерами печатей.' },
    ],
  },
];

export const STAGE_NAMES = { 1: 'Подпешки', 2: 'Пешки', 3: 'Главный злодей' };

export const PLAYER_MAX_HP = 100;
const CHAIN_TIMEOUT_MS = 4500;

const sealName = (id) => SEALS[id].name;

/** Сила техники: 60% на пороге распознавания, 100% при идеальной печати. */
export function powerFromAccuracy(acc) {
  return Math.max(0.6, Math.min(1, 0.6 + (0.4 * (acc - 0.75)) / 0.25));
}

export function emptyStats() {
  return { seals: 0, techniques: 0, blocks: 0, hitsTaken: 0, stuns: 0, damage: 0, accSum: 0, accCount: 0, defeated: 0, maxCombo: 0, specials: 0, chests: 0 };
}

/** Один бой против одного врага. Здоровье героя, чакра и статистика переносятся между боями. */
export class Battle {
  constructor({
    now = 0,
    rng = Math.random,
    enemy = ENEMIES.boss,
    playerHp = PLAYER_MAX_HP,
    chakra = 0,
    stats = emptyStats(),
    mistakes = new Map(),
    combo = { count: 0, lastAt: -Infinity, lastTech: null },
    unlocked = [],
  } = {}) {
    this.combo = combo;
    this.unlocked = new Set(unlocked);
    this.techs = { ...TECHNIQUES };
    for (const id of this.unlocked) if (EXTRA_TECHNIQUES[id]) this.techs[id] = EXTRA_TECHNIQUES[id];
    this.rng = rng;
    this.enemy = enemy;
    this.startedAt = now;
    this.enemyHp = enemy.hp;
    this.playerHp = playerHp;
    this.chakra = chakra;
    this.chain = [];
    this.chainAcc = [];
    this.chainAt = 0;
    this.shieldUntil = 0;
    this.foe = { state: 'idle', until: now + (enemy.firstAttack ?? 5000), chargeStart: 0 };
    this.stats = stats;
    this.mistakes = mistakes;
    this.lastMistakeAt = new Map();
    this.over = false;
    this.result = null;
  }

  get phase2() {
    return !!this.enemy.boss && this.enemyHp <= this.enemy.hp / 2;
  }

  get ultimateReady() {
    return this.chakra >= 100;
  }

  elapsed(now) {
    return now - this.startedAt;
  }

  /** Запоминаем ошибку для итогов (одинаковые не чаще раза в 3 секунды). */
  noteMistake(hint, now) {
    if (!hint) return;
    const last = this.lastMistakeAt.get(hint) ?? -Infinity;
    if (now - last < 3000) return;
    this.lastMistakeAt.set(hint, now);
    this.mistakes.set(hint, (this.mistakes.get(hint) ?? 0) + 1);
  }

  /** Какие печати игрок может сложить следующими. */
  expectedNext() {
    const out = [];
    for (const t of Object.values(this.techs)) {
      if (this.chain.every((s, i) => t.seq[i] === s) && t.seq.length > this.chain.length) {
        out.push({ tech: t, seal: t.seq[this.chain.length] });
      }
    }
    return out;
  }

  onSeal(sealId, accuracy, now) {
    if (this.over) return [];
    const events = [];
    this.stats.seals += 1;
    this.stats.accSum += accuracy;
    this.stats.accCount += 1;
    this.chakra = Math.min(100, this.chakra + 6 * accuracy);

    const next = [...this.chain, sealId];
    const matches = Object.values(this.techs).filter((t) => next.every((s, i) => t.seq[i] === s));

    if (matches.length) {
      this.chain = next;
      this.chainAcc.push(accuracy);
      this.chainAt = now;
      const done = matches.find((t) => t.seq.length === next.length);
      if (done) events.push(...this.cast(done, now));
      else events.push({ type: 'chain', chain: [...this.chain] });
      return events;
    }

    // Печать не продолжает цепочку — конкретно объясняем, что ожидалось.
    const expected = this.expectedNext();
    const starters = Object.values(this.techs).filter((t) => t.seq[0] === sealId);
    let hint;
    if (this.chain.length && expected.length) {
      const e = expected[0];
      hint = `После печати «${sealName(this.chain.at(-1))}» для техники «${e.tech.name}» нужна «${sealName(e.seal)}», а не «${sealName(sealId)}»`;
    } else {
      const names = [...new Set(Object.values(this.techs).map((t) => `«${sealName(t.seq[0])}»`))].join(', ');
      hint = `С печати «${sealName(sealId)}» техника не начинается. Первая печать: ${names}`;
    }
    this.noteMistake(hint, now);
    events.push({ type: 'error', hint });

    if (starters.length) {
      this.chain = [sealId];
      this.chainAcc = [accuracy];
      this.chainAt = now;
      events.push({ type: 'chain', chain: [...this.chain] });
    } else {
      this.resetChain();
      events.push({ type: 'chain', chain: [] });
    }
    return events;
  }

  /**
   * Комбо: техники подряд (не дольше 7 с между ними и без пропущенных ударов)
   * наращивают множитель урона. Особые пары техник дают дополнительный бонус.
   */
  advanceCombo(tech, now) {
    const c = this.combo;
    const inWindow = now - c.lastAt <= COMBO_WINDOW_MS;
    const special = inWindow ? COMBOS.find((k) => k.from === c.lastTech && k.to === tech.id) ?? null : null;
    c.count = inWindow ? c.count + 1 : 1;
    c.lastAt = now;
    c.lastTech = tech.id;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, c.count);
    if (special) this.stats.specials += 1;
    const mult = Math.min(2, 1 + 0.2 * (c.count - 1));
    return { combo: c.count, mult, special };
  }

  resetChain() {
    this.chain = [];
    this.chainAcc = [];
    this.chainAt = 0;
  }

  cast(tech, now) {
    const events = [];
    const acc = this.chainAcc.reduce((a, b) => a + b, 0) / this.chainAcc.length;
    const power = powerFromAccuracy(acc);
    this.resetChain();
    this.stats.techniques += 1;
    this.chakra = Math.min(100, this.chakra + 14 * power);
    const ev = { type: 'cast', tech, power, accuracy: acc, ...this.advanceCombo(tech, now) };

    if (tech.damage) {
      const dmg = Math.round(tech.damage * power * ev.mult) + (ev.special?.bonus ?? 0);
      this.enemyHp = Math.max(0, this.enemyHp - dmg);
      this.stats.damage += dmg;
      ev.damage = dmg;
    }
    if (tech.shieldMs) {
      this.shieldUntil = now + tech.shieldMs;
      ev.shieldUntil = this.shieldUntil;
    }
    events.push(ev);

    if (tech.stun && this.foe.state === 'charging') {
      this.foe = { state: 'stunned', until: now + 1800, chargeStart: 0 };
      this.stats.stuns += 1;
      events.push({ type: 'stun' });
    }
    if (this.chakra >= 100) events.push({ type: 'ultimate-ready' });
    events.push(...this.checkEnd(now));
    return events;
  }

  onCircle(accuracy, now) {
    if (this.over || !this.ultimateReady) return [];
    const power = Math.max(0.6, Math.min(1, accuracy));
    const combo = this.advanceCombo(ULTIMATE, now);
    const dmg = Math.round(ULTIMATE.damage * power * combo.mult) + (combo.special?.bonus ?? 0);
    this.enemyHp = Math.max(0, this.enemyHp - dmg);
    this.stats.damage += dmg;
    this.stats.techniques += 1;
    this.chakra = 0;
    const events = [{ type: 'cast', tech: ULTIMATE, power, accuracy, damage: dmg, ...combo }];
    if (this.foe.state === 'charging') {
      this.foe = { state: 'stunned', until: now + 1800, chargeStart: 0 };
      events.push({ type: 'stun' });
    }
    events.push(...this.checkEnd(now));
    return events;
  }

  /** Удар дракона: рубящий удар ладонью при полной чакре (если приём открыт). */
  onChop(power, now) {
    if (this.over || !this.ultimateReady || !this.unlocked.has('dragon')) return [];
    const p = Math.max(0.6, Math.min(1, power));
    const combo = this.advanceCombo(DRAGON, now);
    const dmg = Math.round(DRAGON.damage * p * combo.mult) + (combo.special?.bonus ?? 0);
    this.enemyHp = Math.max(0, this.enemyHp - dmg);
    this.stats.damage += dmg;
    this.stats.techniques += 1;
    this.chakra = 0;
    const events = [{ type: 'cast', tech: DRAGON, power: p, accuracy: p, damage: dmg, ...combo }];
    if (this.foe.state === 'charging') {
      this.foe = { state: 'stunned', until: now + 2200, chargeStart: 0 };
      events.push({ type: 'stun' });
    }
    events.push(...this.checkEnd(now));
    return events;
  }

  tick(now) {
    if (this.over) return [];
    const events = [];

    if (this.chain.length && now - this.chainAt > CHAIN_TIMEOUT_MS) {
      const hint = 'Цепочка оборвалась: между печатями должно пройти не больше 4 секунд';
      this.noteMistake(hint, now);
      this.resetChain();
      events.push({ type: 'error', hint }, { type: 'chain', chain: [] });
    }

    const e = this.enemy;
    const f = this.foe;
    if (now >= f.until) {
      if (f.state === 'idle' || f.state === 'stunned') {
        const charge = this.phase2 ? e.chargeMs2 ?? e.chargeMs : e.chargeMs;
        this.foe = { state: 'charging', until: now + charge, chargeStart: now };
        events.push({ type: 'foe-charge', duration: charge });
      } else if (f.state === 'charging') {
        const blocked = now < this.shieldUntil;
        if (blocked) {
          this.stats.blocks += 1;
          this.shieldUntil = 0;
        } else {
          this.playerHp = Math.max(0, this.playerHp - e.damage);
          this.stats.hitsTaken += 1;
          if (this.combo.count > 1) events.push({ type: 'combo-break', count: this.combo.count });
          this.combo.count = 0;
          this.combo.lastTech = null;
        }
        events.push({ type: 'foe-hit', blocked, damage: blocked ? 0 : e.damage });
        const [lo, hi] = this.phase2 ? e.idle2 ?? e.idle : e.idle;
        this.foe = { state: 'idle', until: now + lo + this.rng() * (hi - lo), chargeStart: 0 };
      }
    }
    events.push(...this.checkEnd(now));
    return events;
  }

  checkEnd(now) {
    if (this.over) return [];
    if (this.enemyHp <= 0) {
      this.over = true;
      this.stats.defeated += 1;
      this.result = { win: true };
      return [{ type: 'enemy-down', enemy: this.enemy, now }];
    }
    if (this.playerHp <= 0) {
      this.over = true;
      this.result = { win: false };
      return [{ type: 'player-down', enemy: this.enemy, now }];
    }
    return [];
  }
}

/** Итоговые очки за весь поход. */
export function scoreRun({ win, stats, playerHp, timeSec }) {
  const avgAcc = stats.accCount ? stats.accSum / stats.accCount : 0;
  const score = Math.round(
    stats.damage * 10 +
      stats.defeated * 300 +
      stats.blocks * 150 +
      stats.stuns * 100 +
      stats.maxCombo * 120 +
      stats.specials * 200 +
      (stats.chests ?? 0) * 150 +
      avgAcc * 1000 +
      (win ? playerHp * 8 + Math.max(0, 300 - timeSec) * 6 : 0),
  );
  return { score, avgAcc };
}

export function topMistakes(mistakes, n = 3) {
  return [...mistakes.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}
