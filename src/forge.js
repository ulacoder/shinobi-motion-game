// Кузница печатей: игрок показывает камере СВОЙ жест несколько раз, а игра сама строит для него
// правила — те же, что у встроенных печатей (какой палец прямой, какой согнут, где руки),
// только выведенные из примеров, а не написанные вручную. Поэтому режим «ошибка» работает
// для любого жеста: «на правой руке: выпрями мизинец», «сведи руки ближе».
//
// Как учимся (без нейросети):
//  - признаки снимка: выпрямленность каждого пальца 0..1 (из углов суставов), для двух рук —
//    расстояние между руками и разница по высоте в «ладонях»;
//  - эталон = среднее по снимкам, допуск = разброс снимков (но не меньше разумного минимума);
//  - проверка: каждый признак даёт оценку 0..1 (внутри допуска — 1, дальше плавно падает) и подсказку,
//    куда двигаться: выпрямить или согнуть палец, свести или развести руки, поднять руку выше.

import { FINGERS, FINGER_NAMES, SIDE_NAMES, clamp01, dist } from './geometry.js';

export const FORGE_SAMPLES = 5; // сколько снимков нужно для эталона
export const FORGE_PASS = 0.8; // порог «жест повторён»
const MIN_TOL = { finger: 0.2, close: 0.6, height: 0.45 };
const FALLOFF = { finger: 0.35, close: 1.2, height: 0.9 };

/** Признаки одного снимка: руки слева направо (как их видит игрок). */
export function features(hands) {
  const list = [...hands].slice(0, 2).sort((a, b) => a.center.x - b.center.x);
  const f = { count: list.length, hands: list.map((h) => ({ ...h.ext })) };
  if (list.length === 2) {
    const [a, b] = list;
    const palm = (a.palm + b.palm) / 2 || 0.1;
    f.close = dist(a.center, b.center) / palm;
    f.height = (b.center.y - a.center.y) / palm; // >0: левая рука выше правой
  }
  return f;
}

const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
const spread = (xs) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((v) => (v - m) ** 2)));
};

/** Эталон из снимков. Число рук — как у большинства снимков. Возвращает null, если снимков мало. */
export function learnTemplate(samples) {
  const usable = samples.filter((s) => s.count > 0);
  if (usable.length < 2) return null;
  const votes = [1, 2].map((n) => usable.filter((s) => s.count === n).length);
  const count = votes[1] > votes[0] ? 2 : 1;
  const same = usable.filter((s) => s.count === count);
  const tpl = { count, hands: [], samples: same.length };
  for (let i = 0; i < count; i++) {
    const hand = {};
    for (const f of FINGERS) {
      const xs = same.map((s) => s.hands[i][f]);
      hand[f] = { mean: mean(xs), tol: Math.max(MIN_TOL.finger, 2.5 * spread(xs)) };
    }
    tpl.hands.push(hand);
  }
  if (count === 2) {
    for (const key of ['close', 'height']) {
      const xs = same.map((s) => s[key]);
      tpl[key] = { mean: mean(xs), tol: Math.max(MIN_TOL[key], 2.5 * spread(xs)) };
    }
  }
  return tpl;
}

/** Оценка признака: 1 внутри допуска, дальше линейно падает до 0. */
function closeness(value, { mean: m, tol }, falloff) {
  const d = Math.abs(value - m);
  return d <= tol ? 1 : clamp01(1 - (d - tol) / falloff);
}

function fingerHint(side, finger, value, target) {
  const where = SIDE_NAMES[side].prep;
  const more = value < target; // нужно выпрямить сильнее
  const name = FINGER_NAMES[finger];
  const slight = target > 0.25 && target < 0.75; // в эталоне палец полусогнут
  if (finger === 'thumb') return `На ${where}: ${more ? 'отставь большой палец в сторону' : 'прижми большой палец'}`;
  if (slight) return `На ${where}: ${more ? `чуть выпрями ${name}` : `согни ${name} чуть сильнее`}`;
  return `На ${where}: ${more ? `выпрями ${name}` : `согни ${name}`}`;
}

function handRules(hand, tplHand, side) {
  const rules = [];
  for (const f of FINGERS) {
    const t = tplHand[f];
    const value = hand.ext[f];
    rules.push({
      kind: 'finger',
      finger: f,
      side,
      want: t.mean >= 0.5 ? 'up' : 'down',
      target: t.mean,
      value,
      score: closeness(value, t, FALLOFF.finger),
      hint: fingerHint(side, f, value, t.mean),
      weight: 1,
    });
  }
  return rules;
}

function relationRules(a, b, tpl) {
  const now = features([a, b]);
  const rules = [];
  const c = tpl.close;
  rules.push({
    kind: 'relation',
    label: c.mean < 2.2 ? 'руки рядом' : 'руки на расстоянии',
    score: closeness(now.close, c, FALLOFF.close),
    hint: now.close > c.mean ? 'Сведи руки ближе друг к другу' : 'Разведи руки чуть дальше друг от друга',
    weight: 1.5,
  });
  const h = tpl.height;
  const want = h.mean;
  rules.push({
    kind: 'relation',
    label: Math.abs(want) < 0.5 ? 'руки на одной высоте' : want > 0 ? 'левая рука выше' : 'правая рука выше',
    score: closeness(now.height, h, FALLOFF.height),
    hint:
      Math.abs(want) < 0.5
        ? 'Держи руки на одной высоте'
        : now.height < want === want > 0
          ? `Подними ${want > 0 ? 'левую' : 'правую'} руку выше`
          : `Опусти ${want > 0 ? 'левую' : 'правую'} руку чуть ниже`,
    weight: 1.5,
  });
  return rules;
}

function aggregate(rules) {
  let sum = 0;
  let w = 0;
  let worst = null;
  for (const r of rules) {
    sum += r.score * r.weight;
    w += r.weight;
    if (!worst || r.score < worst.score) worst = r;
  }
  return { accuracy: w ? sum / w : 0, worst };
}

/**
 * Сравнивает текущие руки с эталоном. Формат как у встроенных печатей (evaluateSeal):
 * { accuracy, passed, rules, hint, missingHands } — поэтому работают те же подсветка пальцев и разбор.
 */
export function evaluateTemplate(tpl, hands) {
  if (!tpl) return { accuracy: 0, passed: false, rules: [], hint: null };
  if (!hands.length) {
    return { accuracy: 0, passed: false, rules: [], hint: 'Покажи руки камере', missingHands: true };
  }
  const list = [...hands].slice(0, 2).sort((a, b) => a.center.x - b.center.x);
  if (tpl.count === 2 && list.length < 2) {
    const rules = handRules(list[0], tpl.hands[list[0].side === 'right' ? 1 : 0], list[0].side);
    return {
      accuracy: aggregate(rules).accuracy * 0.5,
      passed: false,
      rules,
      hint: 'Твоя печать — на две руки: покажи камере вторую руку',
      missingHands: true,
    };
  }
  if (tpl.count === 1 && list.length > 1) {
    // Лишняя рука: оцениваем ту, что больше похожа, и просим убрать вторую.
    const evals = list.map((h) => aggregate(handRules(h, tpl.hands[0], h.side)));
    const k = evals[0].accuracy >= evals[1].accuracy ? 0 : 1;
    const rules = handRules(list[k], tpl.hands[0], list[k].side);
    return { accuracy: aggregate(rules).accuracy * 0.6, passed: false, rules, hint: 'Твоя печать — на одну руку: убери вторую из кадра' };
  }
  let rules;
  if (tpl.count === 1) {
    rules = handRules(list[0], tpl.hands[0], list[0].side);
  } else {
    rules = [...handRules(list[0], tpl.hands[0], 'left'), ...handRules(list[1], tpl.hands[1], 'right')];
    rules.push(...relationRules(list[0], list[1], tpl));
  }
  const { accuracy, worst } = aggregate(rules);
  const minRule = rules.reduce((m, r) => Math.min(m, r.score), 1);
  const passed = accuracy >= FORGE_PASS && minRule >= 0.35;
  return { accuracy, passed, rules, hint: passed ? null : worst?.hint ?? null, missingHands: false };
}

/** Короткое описание выученного жеста словами — показываем игроку, что игра «поняла». */
export function describeTemplate(tpl) {
  if (!tpl) return '';
  const handText = (hand) => {
    const up = FINGERS.filter((f) => hand[f].mean >= 0.6).map((f) => FINGER_NAMES[f].replace(' палец', ''));
    const down = FINGERS.filter((f) => hand[f].mean <= 0.35).map((f) => FINGER_NAMES[f].replace(' палец', ''));
    if (up.length === 5) return 'раскрытая ладонь';
    if (down.length === 5) return 'кулак';
    const parts = [];
    if (up.length) parts.push(`${up.join(', ')} — прямо`);
    if (down.length) parts.push(`${down.join(', ')} — согнуто`);
    const mid = 5 - up.length - down.length;
    if (mid) parts.push('остальные — полусогнуты');
    return parts.join('; ');
  };
  if (tpl.count === 1) return `Одна рука: ${handText(tpl.hands[0])}.`;
  const rel = tpl.close.mean < 2.2 ? 'руки рядом' : 'руки на расстоянии';
  const [l, r] = tpl.hands.map(handText);
  const both = l === r ? `Обе руки: ${l}.` : `Левая: ${l}. Правая: ${r}.`;
  return `${both} ${rel[0].toUpperCase()}${rel.slice(1)}.`;
}

const KANJI = ['炎', '風', '雷', '水', '光', '影', '月', '星', '鋼', '桜', '嵐', '牙'];
const NAMES = ['Пламени', 'Ветра', 'Грома', 'Волны', 'Света', 'Тени', 'Луны', 'Звезды', 'Стали', 'Сакуры', 'Бури', 'Клыка'];
// какой эффект показывает печать в бою — по стихии имени
const EFFECTS = ['fire', 'wind', 'lightning', 'sphere', 'dragon', 'wind', 'sphere', 'lightning', 'wind', 'wind', 'lightning', 'fire'];

/** Имя, иероглиф и стихия для новой печати (игрок не печатает с клавиатуры — придумываем сами). */
export function nameForSeal(seed = Math.random()) {
  const i = Math.floor(seed * KANJI.length) % KANJI.length;
  return { kanji: KANJI[i], name: `Печать ${NAMES[i]}`, effect: EFFECTS[i] };
}

export const FORGED_DAMAGE = 22;
export const FORGED_COOLDOWN_MS = 4000;

/** Выкованная печать как техника в бою: один жест, без цепочки, с перезарядкой. */
export function forgedTechnique(seal) {
  return {
    id: 'forged',
    name: seal.name,
    glyph: seal.kanji,
    effect: seal.effect ?? 'fire',
    damage: FORGED_DAMAGE,
    desc: 'Твоя печать из Кузницы: один жест — и техника. Игра выучила её по твоим снимкам.',
  };
}
