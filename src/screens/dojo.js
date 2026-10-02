// Додзё: обучение каждой печати, кругу и жесту «ладонь вверх-вниз» с разбором по каждому пальцу.

import { SIDE_NAMES } from '../geometry.js';
import { SEALS, SEAL_ORDER, NEAR_ACCURACY } from '../seals.js';
import { SealDetector } from '../detector.js';
import { CircleTracker, isPointing } from '../air.js';
import { ChopDetector, bladeScore } from '../chop.js';
import { TECHNIQUES, EXTRA_TECHNIQUES, ULTIMATE } from '../battle.js';
import { sealIcon, techIcon } from '../icons.js';
import { sfx } from '../audio.js';
import { music } from '../music.js';
import { getSealBest, updateSealBest } from '../storage.js';
import { $, el, GestureChoice, renderTechList, stamp } from '../ui.js';
import {
  arena, overlay, sensei, state, registerScreen, setText, setWidth, pct, SHORT, badFingers, reportFrameIssue,
} from '../app/context.js';
import { startStory } from '../app/story.js';

const LESSONS = [...SEAL_ORDER.map((id) => ({ type: 'seal', id })), { type: 'circle' }, { type: 'chop' }];
const lessonGlyph = (l) => (l.type === 'seal' ? SEALS[l.id].kanji : l.type === 'chop' ? '斬' : ULTIMATE.glyph);

export const dojo = {
  detector: new SealDetector({ holdMs: 600, hintDelayMs: 500 }),
  circle: new CircleTracker(),
  chop: new ChopDetector(),

  enter() {
    this.idx = 0;
    this.nextAt = 0;
    this.finished = false;
    this.lastRender = 0;
    this.choice ??= new GestureChoice($('screen-dojo'), { snake: () => startStory() }, { holdMs: 900 });
    this.choice.reset();
    $('lesson-done').hidden = true;
    arena.setPlace('night');
    arena.showEnemy(null);
    music.play('calm');
    music.setPlace('forest');
    this.renderSteps();
    this.startLesson();
  },

  renderSteps() {
    const ol = $('dojo-steps');
    ol.replaceChildren();
    LESSONS.forEach((l, i) => {
      const glyph = lessonGlyph(l);
      const li = el('li', i < this.idx || this.finished ? 'done' : i === this.idx ? 'current' : '', glyph);
      li.title = l.type === 'seal' ? SEALS[l.id].name : l.type === 'chop' ? 'Ладонь вверх-вниз' : 'Круг';
      ol.append(li);
    });
  },

  startLesson() {
    const lesson = LESSONS[this.idx];
    this.detector.reset();
    this.circle.reset();
    this.chop.reset();
    const best = getSealBest();
    if (lesson.type === 'seal') {
      const s = SEALS[lesson.id];
      $('lesson-hanko').textContent = s.kanji;
      $('lesson-icon').innerHTML = sealIcon(lesson.id, { size: 110 });
      $('lesson-kicker').textContent = `Печать ${this.idx + 1} из ${SEAL_ORDER.length}`;
      $('lesson-name').textContent = s.name;
      $('lesson-how').textContent = s.how;
      $('lesson-best').textContent = best[lesson.id] ? `· лучший результат ${pct(best[lesson.id])}` : '';
    } else if (lesson.type === 'chop') {
      $('lesson-hanko').textContent = '斬';
      $('lesson-icon').innerHTML = techIcon('dragon', 80);
      $('lesson-kicker').textContent = 'Удар для сундуков и ультимейта';
      $('lesson-name').textContent = 'Ладонь вверх-вниз';
      $('lesson-how').textContent =
        'Просто подними раскрытую ладонь над головой и плавно опусти вниз. Так открываются бамбуковые сундуки и работает «Удар дракона».';
      $('lesson-best').textContent = best.chop ? `· лучший результат ${pct(best.chop)}` : '';
    } else {
      $('lesson-hanko').textContent = ULTIMATE.glyph;
      $('lesson-icon').innerHTML = techIcon('sphere', 80);
      $('lesson-kicker').textContent = 'Приём мастера';
      $('lesson-name').textContent = ULTIMATE.name;
      $('lesson-how').textContent =
        'Оставь в кадре одну руку, подними указательный палец и нарисуй им в воздухе ровный круг размером с ладонь.';
      $('lesson-best').textContent = best.circle ? `· лучший результат ${pct(best.circle)}` : '';
    }
    this.setMeter(0, false);
    $('lesson-checks').replaceChildren();
    sensei.clear();
  },

  setMeter(acc, pass) {
    const fill = $('lesson-meter');
    setWidth(fill, pct(Math.min(1, acc)));
    fill.classList.toggle('pass', pass);
    setText($('lesson-acc'), pct(acc));
    setText($('lesson-fix'), !pass && acc >= 0.75 ? '· исправь то, что отмечено красным' : '');
  },

  renderChecks(evaluation) {
    const box = $('lesson-checks');
    box.replaceChildren();
    if (!evaluation || !evaluation.rules.length) {
      box.append(el('p', 'check-title', 'Покажи руки камере — здесь появится разбор каждого пальца.'));
      return;
    }
    const groups = new Map();
    const other = [];
    for (const r of evaluation.rules) {
      if (r.kind === 'relation') {
        if (r.label) other.push(r);
        continue;
      }
      if (!groups.has(r.side)) groups.set(r.side, []);
      groups.get(r.side).push(r);
    }
    for (const side of ['left', 'center', 'right']) {
      if (!groups.has(side)) continue;
      const g = el('div', 'check-group');
      const title = SIDE_NAMES[side].nom;
      g.append(el('div', 'check-title', title.charAt(0).toUpperCase() + title.slice(1)));
      const row = el('div', 'check-row');
      for (const r of groups.get(side)) {
        const text = r.kind === 'finger' ? `${SHORT[r.finger]} ${r.want === 'up' ? 'прямой' : 'согнут'}` : r.label ?? '';
        row.append(el('span', `chip ${r.score >= 0.5 ? 'ok' : 'bad'}`, `${r.score >= 0.5 ? '✓' : '✗'} ${text}`));
      }
      g.append(row);
      box.append(g);
    }
    if (other.length) {
      const g = el('div', 'check-group');
      g.append(el('div', 'check-title', 'Положение рук'));
      const row = el('div', 'check-row');
      for (const r of other) row.append(el('span', `chip ${r.score >= 0.5 ? 'ok' : 'bad'}`, `${r.score >= 0.5 ? '✓' : '✗'} ${r.label}`));
      g.append(row);
      box.append(g);
    }
  },

  succeed(glyph, accuracy, key, now) {
    stamp($('stamp'), glyph);
    sfx.seal();
    sfx.success();
    updateSealBest(key, accuracy);
    this.setMeter(accuracy, true);
    sensei.show(`Отлично! Совпадение ${pct(accuracy)}`, 'good', now, { lock: 1200 });
    this.nextAt = now + 1300;
  },

  update(now) {
    if (this.finished) {
      this.choice.update(state.hands, now);
      this.overlayTone = 'idle';
      return;
    }
    if (this.nextAt) {
      if (now >= this.nextAt) {
        this.nextAt = 0;
        this.advance();
      }
      return;
    }
    const lesson = LESSONS[this.idx];
    const issue = reportFrameIssue(now);

    if (lesson.type === 'seal') {
      const res = this.detector.update(state.hands, now, lesson.id);
      const ev = res.evals[0];
      this.overlayTone = ev.passed ? 'pass' : ev.accuracy >= NEAR_ACCURACY ? 'near' : 'idle';
      this.overlayBad = badFingers(ev);
      this.setMeter(ev.smooth ?? ev.accuracy, ev.passed);
      if (now - this.lastRender > 120) {
        this.renderChecks(ev);
        this.lastRender = now;
      }
      for (const e of res.events) {
        if (e.type === 'seal') this.succeed(SEALS[lesson.id].kanji, e.accuracy, lesson.id, now);
        else if (e.type === 'hint' && !issue) sensei.show(e.hint, 'warn', now);
      }
      if (!state.hands.length && !issue) sensei.show('Подними руки к лицу: камера их не видит', 'warn', now);
      return;
    }

    if (lesson.type === 'chop') {
      this.overlayBad = null;
      const hand = state.hands[0];
      const blade = hand ? bladeScore(hand) : null;
      this.overlayTone = blade && blade.score > 0.6 ? 'near' : 'idle';
      if (now - this.lastRender > 150) {
        const checks = $('lesson-checks');
        checks.replaceChildren();
        const row = el('div', 'check-row');
        const ok1 = blade && blade.straight > 0.55;
        const ok2 = blade && blade.together > 0.5;
        row.append(el('span', `chip ${ok1 ? 'ok' : 'bad'}`, `${ok1 ? '✓' : '✗'} ладонь раскрыта`));
        row.append(el('span', `chip ${ok2 ? 'ok' : 'bad'}`, `${ok2 ? '✓' : '✗'} пальцы рядом`));
        row.append(el('span', 'chip', '· подними и опусти вниз'));
        checks.append(row);
        this.lastRender = now;
      }
      if (!state.hands.length && !issue) sensei.show('Подними раскрытую ладонь над головой', 'info', now);
      for (const e of this.chop.update(state.hands, now, state.handsStamp)) {
        if (e.type === 'chop') {
          sfx.chop(e.power);
          arena.shake = 10;
          this.succeed('斬', e.power, 'chop', now);
        } else {
          sfx.hint();
          sensei.show(e.hint, 'warn', now, { lock: 1600, ttl: 3000 });
        }
      }
      return;
    }

    // Урок: круг в воздухе
    this.overlayBad = null;
    const pointer = state.hands.find(isPointing);
    this.overlayTone = pointer ? 'near' : 'idle';
    if (now - this.lastRender > 150) {
      const checks = $('lesson-checks');
      checks.replaceChildren();
      const row = el('div', 'check-row');
      const one = state.hands.length === 1;
      row.append(el('span', `chip ${one ? 'ok' : 'bad'}`, `${one ? '✓' : '✗'} одна рука в кадре`));
      row.append(el('span', `chip ${pointer ? 'ok' : 'bad'}`, `${pointer ? '✓' : '✗'} указательный вверх, остальные согнуты`));
      row.append(el('span', `chip ${this.circle.drawing ? 'ok' : ''}`, this.circle.drawing ? '✓ рисуешь…' : '· веди палец по кругу'));
      checks.append(row);
      this.lastRender = now;
    }
    if (!state.hands.length && !issue) sensei.show('Подними одну руку к лицу: камера её не видит', 'warn', now);
    if (state.hands.length > 1) {
      if (!issue) sensei.show('Оставь в кадре одну руку: рисуем круг одним пальцем', 'warn', now);
      this.circle.reset();
      return;
    }
    if (state.hands.length === 1 && !pointer && !this.circle.drawing && !issue) {
      sensei.show('Подними указательный палец, остальные согни — и рисуй круг', 'info', now);
    }
    const result = this.circle.update(state.hands, now);
    if (result) {
      overlay.showGhost(result.points, result.passed, now);
      this.setMeter(result.accuracy, result.passed);
      if (result.passed) this.succeed(ULTIMATE.glyph, result.accuracy, 'circle', now);
      else {
        sfx.hint();
        sensei.show(result.hint, 'warn', now, { lock: 1800, ttl: 3200 });
      }
    }
  },

  advance() {
    this.idx += 1;
    if (this.idx >= LESSONS.length) {
      this.finished = true;
      this.renderSteps();
      $('lesson-hanko').textContent = '印';
      $('lesson-icon').innerHTML = '';
      $('lesson-kicker').textContent = 'Обучение пройдено';
      $('lesson-name').textContent = 'Ты готов к бою';
      $('lesson-how').textContent = 'Печати складываются в техники. Держи каждую печать, пока она не засчитается.';
      $('lesson-checks').replaceChildren();
      $('lesson-done').hidden = false;
      renderTechList($('lesson-techs'), { showDesc: true, techs: [...Object.values(TECHNIQUES), EXTRA_TECHNIQUES.wind], dragon: true });
      this.choice.reset();
      sensei.show('Раскрой обе ладони и держи секунду — начнём поход', 'good', performance.now());
      return;
    }
    this.renderSteps();
    this.startLesson();
  },

  skip() {
    if (this.finished) startStory();
    else {
      this.nextAt = 0;
      this.advance();
    }
  },
};

$('btn-skip').addEventListener('click', () => dojo.skip());

registerScreen('dojo', dojo);
