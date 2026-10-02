// Печати: каждая описана набором понятных правил (какой палец прямой, какой согнут,
// как расположены руки). Правило даёт оценку 0..1 и готовую подсказку, если не выполнено.
// Поэтому «режим ошибки» точно знает, ЧТО не так, а не просто «не распознано».

import { FINGERS, FINGER_NAMES, SIDE_NAMES, PLAYER_NAMES, clamp01, dist } from './geometry.js';

export const PASS_ACCURACY = 0.75; // порог «печать засчитана»
export const NEAR_ACCURACY = 0.45; // порог «почти получилось — подскажем»
const MIN_RULE = 0.3; // ни одно правило не должно быть совсем провалено

const UP = 'up';
const DOWN = 'down';

const FIST = { thumb: null, index: DOWN, middle: DOWN, ring: DOWN, pinky: DOWN };
const OPEN = { thumb: UP, index: UP, middle: UP, ring: UP, pinky: UP };
const POINT = { thumb: null, index: UP, middle: DOWN, ring: DOWN, pinky: DOWN };

export const SEALS = {
  tiger: {
    id: 'tiger',
    name: 'Тигр',
    kanji: '寅',
    how: 'Обе руки: указательный и средний вверх, остальные пальцы согнуты. Руки рядом.',
    roles: [
      { label: 'рука', fingers: { thumb: null, index: UP, middle: UP, ring: DOWN, pinky: DOWN } },
      { label: 'рука', fingers: { thumb: null, index: UP, middle: UP, ring: DOWN, pinky: DOWN } },
    ],
    relations: [{ type: 'close', max: 2.6 }],
  },
  snake: {
    id: 'snake',
    name: 'Змея',
    kanji: '巳',
    how: 'Обе ладони раскрыты, все пальцы прямые. Руки рядом.',
    roles: [
      { label: 'ладонь', fingers: OPEN },
      { label: 'ладонь', fingers: OPEN },
    ],
    relations: [{ type: 'close', max: 3.2 }],
  },
  bird: {
    id: 'bird',
    name: 'Птица',
    kanji: '酉',
    how: 'Обе руки: большой палец и мизинец в стороны, три средних пальца согнуты.',
    roles: [
      { label: 'рука', fingers: { thumb: UP, index: DOWN, middle: DOWN, ring: DOWN, pinky: UP } },
      { label: 'рука', fingers: { thumb: UP, index: DOWN, middle: DOWN, ring: DOWN, pinky: UP } },
    ],
    relations: [],
  },
  dog: {
    id: 'dog',
    name: 'Собака',
    kanji: '戌',
    how: 'Одна рука в кулаке, на другой указательный палец смотрит вверх.',
    roles: [
      { label: 'кулак', fingers: FIST },
      { label: 'указка', fingers: POINT, pointUp: true },
    ],
    relations: [],
  },
  dragon: {
    id: 'dragon',
    name: 'Дракон',
    kanji: '辰',
    how: 'Одна рука в кулаке, над ней раскрытая ладонь другой руки.',
    roles: [
      { label: 'кулак', fingers: FIST },
      { label: 'ладонь', fingers: OPEN },
    ],
    relations: [{ type: 'above', upper: 1, lower: 0 }],
  },
  // Сюжетная печать финала — только вдвоём (в бою не распознаётся): два игрока дают по ПРАВОЙ руке
  // и сцепляют мизинцы — японская клятва «юбикири». Две правые руки не могут быть у одного человека.
  friend: {
    id: 'friend',
    name: 'Печать дружбы',
    kanji: '友',
    coop: true,
    how: 'Вдвоём: каждый даёт правую руку, мизинец вверх — сцепите мизинцы.',
    roles: [
      { label: 'мизинец', fingers: { thumb: null, index: DOWN, middle: DOWN, ring: DOWN, pinky: UP } },
      { label: 'мизинец', fingers: { thumb: null, index: DOWN, middle: DOWN, ring: DOWN, pinky: UP } },
    ],
    relations: [{ type: 'pinkies', max: 1.1 }, { type: 'twoPlayers' }],
  },
};

export const SEAL_ORDER = ['tiger', 'snake', 'bird', 'dog', 'dragon'];

// ---------- правила ----------

function fingerRule(hand, finger, want, names = SIDE_NAMES) {
  const e = hand.ext[finger];
  const score = want === UP ? e : 1 - e;
  const side = names[hand.side];
  const name = FINGER_NAMES[finger];
  let hint;
  if (want === UP) {
    hint = finger === 'thumb' ? `На ${side.prep}: отставь большой палец в сторону` : `На ${side.prep}: выпрями ${name}`;
  } else {
    hint = finger === 'thumb' ? `На ${side.prep}: прижми большой палец` : `На ${side.prep}: согни ${name}`;
  }
  return { kind: 'finger', finger, want, side: hand.side, score, hint, weight: 1 };
}

function roleRules(hand, role, names = SIDE_NAMES) {
  const rules = [];
  for (const f of FINGERS) {
    const want = role.fingers[f];
    if (want) rules.push(fingerRule(hand, f, want, names));
  }
  if (role.pointUp) {
    // Указательный должен смотреть вверх: кончик выше основания.
    const tip = hand.screen[8];
    const base = hand.screen[5];
    const up = (base.y - tip.y) / (hand.palm || 1);
    rules.push({
      kind: 'direction',
      label: 'указательный смотрит вверх',
      side: hand.side,
      score: clamp01(up / 0.6),
      hint: `На ${names[hand.side].prep}: направь указательный палец вверх`,
      weight: 1,
    });
  }
  // Если провалено сразу много пальцев — одна понятная подсказка вместо пяти мелких.
  const bad = rules.filter((r) => r.kind === 'finger' && r.score < 0.5);
  if (bad.length >= 3) {
    const acc = names[hand.side].acc;
    const summary =
      role.label === 'кулак'
        ? `Сожми ${acc} в кулак`
        : role.label === 'ладонь'
          ? `Раскрой ${acc}: все пальцы прямые`
          : role.label === 'указка'
            ? `На ${names[hand.side].prep}: подними только указательный палец`
            : `На ${names[hand.side].prep}: ${roleShape(role)}`;
    for (const r of bad) r.summary = summary;
  }
  return rules;
}

function roleShape(role) {
  const up = FINGERS.filter((f) => role.fingers[f] === UP).map((f) => FINGER_NAMES[f].replace(' палец', ''));
  return `${up.join(' и ')} вверх, остальные согнуты`;
}

function relationRule(rel, hands) {
  if (rel.type === 'close') {
    const a = hands[0];
    const b = hands[1];
    const palm = (a.palm + b.palm) / 2 || 1;
    const d = dist(a.center, b.center) / palm;
    const score = clamp01(1 - (d - rel.max) / rel.max);
    return { kind: 'relation', label: 'руки рядом', score, hint: 'Сведи руки ближе друг к другу', weight: 1.5 };
  }
  if (rel.type === 'above') {
    const upper = hands[rel.upper];
    const lower = hands[rel.lower];
    const palm = (upper.palm + lower.palm) / 2 || 1;
    const dy = (lower.center.y - upper.center.y) / palm; // >0 значит верхняя рука выше
    const score = clamp01((dy + 0.2) / 0.9);
    return { kind: 'relation', label: 'ладонь над кулаком', score, hint: 'Подними раскрытую ладонь над кулаком', weight: 1.5 };
  }
  if (rel.type === 'pinkies') {
    const a = hands[0];
    const b = hands[1];
    const palm = (a.palm + b.palm) / 2 || 1;
    const d = dist(a.screen[20], b.screen[20]) / palm;
    const score = clamp01(1 - (d - rel.max) / (rel.max * 1.5));
    return { kind: 'relation', label: 'мизинцы сцеплены', score, hint: 'Сцепите мизинцы: кончики должны встретиться', weight: 1.5 };
  }
  if (rel.type === 'twoPlayers') {
    const verdict = twoPlayers(hands);
    // строго: печать засчитывается, только если модель уверена, что руки от двух разных людей
    const score = verdict === 'two' ? 1 : verdict === 'one' ? 0 : 0.2;
    return {
      kind: 'relation',
      label: 'руки двух игроков',
      score,
      verdict,
      hint:
        verdict === 'one'
          ? 'Это руки одного человека. Нужен второй игрок: каждый даёт свою правую руку'
          : 'Покажите обе руки камере целиком — проверяю, что вас двое',
      weight: 2,
    };
  }
  return { kind: 'relation', label: '', score: 1, hint: '', weight: 0 };
}

/**
 * Чьи это руки: 'two' — две руки с одной меткой (две правые) — значит, два человека;
 * 'one' — левая и правая, как у одного человека; 'unknown' — модель не уверена.
 */
export function twoPlayers(hands) {
  if (hands.length < 2) return 'unknown';
  const [a, b] = hands;
  if (!a.label || !b.label || a.labelScore < 0.55 || b.labelScore < 0.55) return 'unknown';
  return a.label === b.label ? 'two' : 'one';
}

function aggregate(rules) {
  let sum = 0;
  let w = 0;
  let worst = null;
  for (const r of rules) {
    sum += r.score * r.weight;
    w += r.weight;
    if (!worst || r.score * (r.weight > 1 ? 0.9 : 1) < worst.score * (worst.weight > 1 ? 0.9 : 1)) worst = r;
  }
  const accuracy = w ? sum / w : 0;
  const minRule = rules.reduce((m, r) => Math.min(m, r.score), 1);
  return { accuracy, worst, minRule };
}

/**
 * Оценивает, насколько руки совпадают с печатью.
 * Возвращает точность 0..1, прошла ли печать, список правил и главную подсказку.
 */
export function evaluateSeal(sealId, hands) {
  const seal = SEALS[sealId];
  const need = seal.roles.length;
  const names = seal.coop ? PLAYER_NAMES : SIDE_NAMES;

  if (hands.length === 0) {
    return {
      seal: sealId,
      accuracy: 0,
      passed: false,
      rules: [],
      hint: 'Подними руки к лицу: камера их не видит',
      missingHands: true,
    };
  }

  if (hands.length < need) {
    // Одна рука из двух: оцениваем лучшую роль, но точность режем вдвое.
    let best = null;
    for (const role of seal.roles) {
      const rules = roleRules(hands[0], role, names);
      const agg = aggregate(rules);
      if (!best || agg.accuracy > best.agg.accuracy) best = { rules, agg };
    }
    return {
      seal: sealId,
      accuracy: best.agg.accuracy * 0.5,
      passed: false,
      rules: best.rules,
      hint: seal.coop ? 'Нужна вторая рука — от второго игрока: встаньте рядом' : 'Нужны обе руки: вторую камера не видит, подними её к лицу',
      missingHands: true,
    };
  }

  // Две руки: пробуем оба распределения ролей и берём лучшее.
  const pair = hands.slice(0, 2);
  const orders = need === 2 ? [[0, 1], [1, 0]] : [[0], [1]];
  let best = null;
  for (const order of orders) {
    const assigned = order.map((i) => pair[i]);
    const rules = [];
    seal.roles.forEach((role, k) => rules.push(...roleRules(assigned[k], role, names)));
    for (const rel of seal.relations) rules.push(relationRule(rel, assigned));
    const agg = aggregate(rules);
    if (!best || agg.accuracy > best.agg.accuracy) best = { rules, agg };
  }

  const { accuracy, worst, minRule } = best.agg;
  const passed = accuracy >= PASS_ACCURACY && minRule >= MIN_RULE;
  const hint = passed ? null : worst ? worst.summary ?? worst.hint : null;
  return { seal: sealId, accuracy, passed, rules: best.rules, hint, missingHands: false };
}

/** Оценивает все печати и сортирует по точности — какую печать игрок пытается сложить. */
export function classify(hands, ids = SEAL_ORDER) {
  return ids.map((id) => evaluateSeal(id, hands)).sort((a, b) => b.accuracy - a.accuracy);
}
