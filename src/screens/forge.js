// Кузница печатей: игрок придумывает СВОЙ жест, игра снимает его 5 раз, выводит правила
// (src/forge.js) и тут же проверяет повторы с подсказками по каждому пальцу — тот же режим «ошибка»,
// что у встроенных печатей, но для любого жеста.
//
// Фазы: record (снимки) → check (3 повтора с разбором) → done (печать выкована, выбор жестом).

import { FINGERS, FINGER_NAMES, SIDE_NAMES } from '../geometry.js';
import { SEALS, classify } from '../seals.js';
import { FORGE_SAMPLES, FORGE_PASS, features, learnTemplate, evaluateTemplate, describeTemplate, nameForSeal } from '../forge.js';
import { sfx } from '../audio.js';
import { music } from '../music.js';
import { saveForged } from '../storage.js';
import { $, el, GestureChoice, stamp, snapshotHands, drawHandForm } from '../ui.js';
import { startStory, nextStep } from '../app/story.js';
import { arena, sensei, state, registerScreen, go, setText, setWidth, pct, badFingers, reportFrameIssue } from '../app/context.js';

const REPEATS = 3; // сколько раз повторить жест после записи
const STABLE_MS = 450; // рука должна замереть, чтобы снимок был чётким
const SAMPLE_GAP_MS = 380;

/** Насколько изменились пальцы между кадрами (0 — замерли). */
function motion(a, b) {
  if (!a || !b || a.count !== b.count) return 1;
  let m = 0;
  a.hands.forEach((h, i) => {
    for (const f of FINGERS) m = Math.max(m, Math.abs(h[f] - b.hands[i][f]));
  });
  return m;
}

export const forge = {
  /** step — шаг сюжета (глава 3): тогда после ковки история идёт дальше сама. */
  enter(step) {
    this.story = !!step;
    this.restart();
    this.choice ??= new GestureChoice($('forge-done'), {
      snake: () => go('menu'),
      tiger: () => this.restart(),
      bird: () => startStory({ quick: true }),
    });
    arena.setPlace(this.story ? step.place : 'night');
    arena.showEnemy(null);
    music.play('calm');
    music.setPlace('forest');
  },

  restart() {
    this.phase = 'record';
    this.samples = [];
    this.forms = [];
    this.prev = null;
    this.stableSince = 0;
    this.lastSampleAt = 0;
    this.tpl = null;
    this.seal = null;
    this.count = 0;
    this.accs = [];
    this.armed = false;
    this.holdSince = 0;
    this.lastRender = 0;
    this.lastLive = 0;
    this.overlayBad = null;
    this.choice?.reset();
    $('forge-done').hidden = true;
    $('forge-pair').hidden = true;
    $('forge-hanko').textContent = '鍛';
    $('forge-kicker').textContent = this.story ? 'Глава 3 · Кузница · шаг 1 из 2' : 'Кузница печатей · шаг 1 из 2';
    $('forge-name').textContent = 'Придумай свою печать';
    $('forge-how').textContent =
      'Любой жест одной или двумя руками: «коза», «окей», сердечко из ладоней. Покажи его камере и замри — я сделаю 5 снимков и выведу для него правила.';
    $('forge-label').textContent = 'рука неподвижна';
    $('forge-checks').replaceChildren();
    this.renderDots();
    sensei.clear();
  },

  renderDots() {
    const ol = $('forge-dots');
    ol.replaceChildren();
    for (let i = 0; i < FORGE_SAMPLES; i++) {
      const done = this.phase !== 'record' || i < this.samples.length;
      ol.append(el('li', done ? 'done' : i === this.samples.length ? 'current' : '', done ? '✓' : String(i + 1)));
    }
    for (let i = 0; i < REPEATS; i++) {
      const done = i < this.count;
      const cur = this.phase === 'check' && i === this.count;
      ol.append(el('li', done ? 'done' : cur ? 'current' : '', done ? '印' : '·'));
    }
  },

  // ---------- запись ----------

  updateRecord(now) {
    const hands = state.hands;
    if (!hands.length) {
      this.prev = null;
      this.stableSince = 0;
      this.setMeter(0, false);
      if (!reportFrameIssue(now)) sensei.show('Покажи свой жест камере и замри', 'info', now);
      return;
    }
    reportFrameIssue(now);
    const f = features(hands);
    const still = motion(f, this.prev) < 0.12;
    this.prev = f;
    if (!still) this.stableSince = 0;
    else if (!this.stableSince) this.stableSince = now;
    const ready = this.stableSince ? Math.min(1, (now - this.stableSince) / STABLE_MS) : 0;
    this.setMeter(ready, ready >= 1);
    this.overlayTone = ready >= 1 ? 'pass' : 'near';
    if (ready >= 1 && now - this.lastSampleAt > SAMPLE_GAP_MS) {
      this.lastSampleAt = now;
      // встроенная печать — в бою сработает она, а не своя: просим другой жест
      const same = classify(hands)[0];
      if (same?.passed) {
        sfx.hint();
        this.samples = [];
        this.forms = [];
        this.renderDots();
        sensei.show(`Это уже печать «${SEALS[same.seal].name}». Придумай другой жест — например «козу» или «окей»`, 'warn', now, { lock: 2500, ttl: 4000 });
        return;
      }
      // число рук поменялось посреди записи — начинаем снимки заново
      if (this.samples.length && this.samples[0].count !== f.count) {
        this.samples = [];
        this.forms = [];
        sensei.show('Число рук поменялось — снимаю заново. Держи один и тот же жест', 'warn', now, { lock: 1500 });
      }
      this.samples.push(f);
      this.forms.push(snapshotHands(hands));
      sfx.seal();
      this.renderDots();
      const left = FORGE_SAMPLES - this.samples.length;
      if (left > 0) sensei.show(`Снимок ${this.samples.length} из ${FORGE_SAMPLES} — держи жест`, 'good', now, { lock: 300 });
      else this.learn(now);
    }
  },

  learn(now) {
    this.tpl = learnTemplate(this.samples);
    if (!this.tpl) {
      sensei.show('Не разглядел жест — попробуем ещё раз', 'warn', now);
      this.restart();
      return;
    }
    this.seal = { ...nameForSeal(), form: this.forms[Math.floor(this.forms.length / 2)] };
    stamp($('stamp'), this.seal.kanji);
    sfx.success();
    this.phase = 'check';
    this.armed = false;
    $('forge-hanko').textContent = this.seal.kanji;
    $('forge-kicker').textContent = 'Кузница печатей · шаг 2 из 2';
    $('forge-name').textContent = this.seal.name;
    $('forge-how').textContent = `Я понял так: ${describeTemplate(this.tpl)} Теперь опусти руки и повтори жест ${REPEATS} раза — проверю каждый палец.`;
    $('forge-label').textContent = 'совпадение с эталоном';
    $('forge-pair').hidden = false;
    drawHandForm($('forge-ref'), this.seal.form, { bg: '#efe6cf' });
    this.renderDots();
    sensei.show(`${this.seal.name} выкована! Опусти руки и повтори её`, 'good', now, { lock: 1800, ttl: 3000 });
  },

  // ---------- проверка ----------

  updateCheck(now) {
    const hands = state.hands;
    const issue = reportFrameIssue(now);
    const ev = evaluateTemplate(this.tpl, hands);
    this.overlayBad = ev.passed ? null : badFingers(ev);
    this.overlayTone = ev.passed ? 'pass' : ev.accuracy >= 0.45 ? 'near' : 'idle';
    this.setMeter(ev.accuracy, ev.passed);
    if (now - this.lastRender > 140) {
      this.renderChecks(ev);
      this.lastRender = now;
    }
    if (now - this.lastLive > 90) {
      this.lastLive = now;
      if (hands.length) drawHandForm($('forge-live'), snapshotHands(hands), { bg: '#efe6cf' });
      else $('forge-live').getContext('2d').clearRect(0, 0, 200, 150);
    }
    // повтор засчитываем только после того, как жест «отпустили»
    if (!ev.passed && ev.accuracy < 0.55) this.armed = true;
    if (ev.passed && this.armed) {
      if (!this.holdSince) this.holdSince = now;
      if (now - this.holdSince > 450) this.succeed(ev.accuracy, now);
    } else {
      this.holdSince = 0;
    }
    if (issue) return;
    if (!hands.length) sensei.show(this.count ? 'Покажи жест ещё раз' : 'Повтори свой жест', 'info', now);
    else if (!ev.passed && ev.hint && ev.accuracy >= 0.4) sensei.show(ev.hint, 'warn', now);
    else if (!ev.passed && !ev.missingHands) sensei.show(`Это другой жест. Твоя печать: ${describeTemplate(this.tpl)}`, 'warn', now);
    else if (!ev.passed && ev.hint) sensei.show(ev.hint, 'warn', now);
    else if (ev.passed && !this.armed) sensei.show('Опусти руки и покажи жест снова', 'info', now);
  },

  succeed(acc, now) {
    this.armed = false;
    this.holdSince = 0;
    this.count += 1;
    this.accs.push(acc);
    stamp($('stamp'), this.seal.kanji);
    sfx.seal();
    sfx.success();
    this.renderDots();
    if (this.count >= REPEATS) return this.finish(now);
    sensei.show(`Есть! Повтор ${this.count} из ${REPEATS}, совпадение ${pct(acc)}. Опусти руки и ещё раз`, 'good', now, { lock: 1300 });
  },

  finish(now) {
    this.phase = 'done';
    this.overlayBad = null;
    const avg = this.accs.reduce((s, v) => s + v, 0) / this.accs.length;
    saveForged({ name: this.seal.name, kanji: this.seal.kanji, effect: this.seal.effect, tpl: this.tpl, form: this.seal.form, acc: avg, at: Date.now() });
    sfx.win();
    $('forge-kicker').textContent = 'Печать выкована';
    $('forge-how').textContent = `${this.seal.name}: ${REPEATS} точных повтора, среднее совпадение ${pct(avg)}. Игра выучила твой жест по 5 снимкам — без нейросети, по углам суставов.`;
    $('forge-checks').replaceChildren();
    if (this.story) {
      // в сюжете — сразу дальше, к Кагэро
      this.nextAt = now + 3200;
      sensei.show(`${this.seal.name} — теперь твоя техника. Покажи её в бою с Кагэро!`, 'good', now, { lock: 3000, ttl: 3500 });
      return;
    }
    $('forge-done').hidden = false;
    this.choice.reset();
    sensei.show('Готово! Птица — в бой с этой печатью. Змея — меню. Тигр — выковать ещё', 'good', now, { lock: 2000, ttl: 4500 });
  },

  setMeter(acc, pass) {
    const fill = $('forge-meter');
    setWidth(fill, pct(Math.min(1, acc)));
    fill.classList.toggle('pass', pass);
    setText($('forge-acc'), pct(acc));
  },

  /** Разбор по пальцам — как в додзё: ✓ совпадает с эталоном, ✗ — что исправить. */
  renderChecks(ev) {
    const box = $('forge-checks');
    box.replaceChildren();
    if (!ev.rules.length) {
      box.append(el('p', 'check-title', 'Покажи руки камере — здесь появится разбор каждого пальца.'));
      return;
    }
    const groups = new Map();
    const rel = [];
    for (const r of ev.rules) {
      if (r.kind === 'relation') rel.push(r);
      else (groups.get(r.side) ?? groups.set(r.side, []).get(r.side)).push(r);
    }
    for (const [side, rules] of groups) {
      const g = el('div', 'check-group');
      const title = SIDE_NAMES[side]?.nom ?? 'рука';
      g.append(el('div', 'check-title', title[0].toUpperCase() + title.slice(1)));
      const row = el('div', 'check-row');
      for (const r of rules) {
        const want = r.target >= 0.6 ? 'прямой' : r.target <= 0.35 ? 'согнут' : 'полусогнут';
        const name = FINGER_NAMES[r.finger].replace(' палец', '');
        row.append(el('span', `chip ${r.score >= 0.5 ? 'ok' : 'bad'}`, `${r.score >= 0.5 ? '✓' : '✗'} ${name} ${want}`));
      }
      g.append(row);
      box.append(g);
    }
    if (rel.length) {
      const g = el('div', 'check-group');
      g.append(el('div', 'check-title', 'Положение рук'));
      const row = el('div', 'check-row');
      for (const r of rel) row.append(el('span', `chip ${r.score >= 0.5 ? 'ok' : 'bad'}`, `${r.score >= 0.5 ? '✓' : '✗'} ${r.label}`));
      g.append(row);
      box.append(g);
    }
  },

  update(now) {
    if (this.phase === 'record') return this.updateRecord(now);
    if (this.phase === 'check') return this.updateCheck(now);
    if (this.story) {
      if (this.nextAt && now >= this.nextAt) {
        this.nextAt = 0;
        nextStep();
      }
      return;
    }
    const active = this.choice.update(state.hands, now);
    this.overlayTone = active ? 'pass' : 'idle';
  },
};

$('btn-forge-redo').addEventListener('click', () => forge.restart());
$('btn-forge-menu').addEventListener('click', () => go('menu'));

registerScreen('forge', forge);

// для автотестов: доступ к фазе и эталону
export const forgeDebug = () => ({ phase: forge.phase, samples: forge.samples?.length, count: forge.count, tpl: forge.tpl });
