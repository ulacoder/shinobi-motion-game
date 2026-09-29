// Точка входа: камера → распознавание → экраны (меню, додзё, сюжет, бой, итоги).

import { buildHands, FINGER_NAMES, SIDE_NAMES } from './geometry.js';
import { SEALS, SEAL_ORDER, NEAR_ACCURACY, classify } from './seals.js';
import { SealDetector } from './detector.js';
import { CircleTracker, isPointing } from './air.js';
import { BrightnessMeter, frameIssue } from './quality.js';
import {
  Battle, TECHNIQUES, ULTIMATE, ENEMIES, STORY, STAGE_NAMES, PLAYER_MAX_HP, emptyStats, scoreRun, topMistakes,
} from './battle.js';
import { startCamera, createHandTracker, CameraError, prefetchRecognition, stopProgress } from './tracker.js';
import { Arena } from './fx.js';
import { drawPortrait, drawHero } from './characters.js';
import { sealIcon, techIcon } from './icons.js';
import { sfx, unlockAudio, setSound, isSoundOn, loadAudioManifest, playVoice, preloadVoices, hasVoice, audioGraph, stopVoice, voiceLog } from './audio.js';
import { music } from './music.js';
import { addRecord, getRecords, getSealBest, randomNinjaName, updateSealBest } from './storage.js';
import {
  $, el, Sensei, GestureChoice, Overlay, renderTechList, renderRecords, renderChain, stamp, formatTime, fillSealIcons,
  snapshotHands, snapshotPath, drawHandForm,
} from './ui.js';

const app = $('app');
const video = $('video');
const arena = new Arena($('arena'));
const overlay = new Overlay($('overlay'));
const sensei = new Sensei($('sensei'), $('sensei-text'));
const brightness = new BrightnessMeter();
const debugBox = $('debug');

let tracker = null;
let hands = [];
let aspect = 16 / 9;
let lastVideoTime = -1;
let controller = null;
let debug = new URLSearchParams(location.search).has('debug');
let lastBright = 1;

const SHORT = { thumb: 'большой', index: 'указательный', middle: 'средний', ring: 'безымянный', pinky: 'мизинец' };
const pct = (v) => `${Math.round(v * 100)}%`;
const FIGHTS_TOTAL = STORY.filter((s) => s.type === 'fight').length;

fillSealIcons();

// Запись в DOM только при изменении значения: иначе браузер пересчитывает стили каждый кадр.
const domCache = new WeakMap();
function setText(node, value) {
  const c = domCache.get(node) ?? {};
  if (c.text === value) return;
  c.text = value;
  domCache.set(node, c);
  node.textContent = value;
}
function setWidth(node, value) {
  const c = domCache.get(node) ?? {};
  if (c.width === value) return;
  c.width = value;
  domCache.set(node, c);
  node.style.width = value;
}

// ---------- кто говорит в сценах ----------

const SPEAKERS = {
  ulagat: { name: 'Улагат', look: 'ulagat', mood: 'angry', bg: '#1d4a66' },
  tair: { name: 'Таир', look: 'tair', mood: 'angry', bg: '#2f5a3a' },
  daniyar: { name: 'Данияр', look: 'daniyar', mood: 'calm', bg: '#5a4a1d' },
  sensei: { name: 'Сенсей Рю', look: 'sensei', bg: '#5a4630' },
};
function speaker(id) {
  if (SPEAKERS[id]) return SPEAKERS[id];
  const e = ENEMIES[id];
  return { name: e.name, look: e.look, tint: e.tint, bg: e.boss ? '#3a1030' : '#40202a' };
}

// ---------- бейдж распознанной печати на камере ----------

const camSeal = $('cam-seal');
function showCamSeal(best) {
  if (!best || best.accuracy < NEAR_ACCURACY || best.missingHands) {
    camSeal.hidden = true;
    return;
  }
  camSeal.hidden = false;
  camSeal.classList.toggle('near', !best.passed);
  setText(camSeal.querySelector('.cam-seal-glyph'), SEALS[best.seal].kanji);
  setText(camSeal.querySelector('.cam-seal-acc'), `${SEALS[best.seal].name} ${pct(best.accuracy)}`);
}

function badFingers(evaluation) {
  const set = new Set();
  for (const r of evaluation?.rules ?? []) if (r.kind === 'finger' && r.score < 0.5) set.add(`${r.side}:${r.finger}`);
  return set;
}

/** Подсказка про условия съёмки — самая приоритетная. Возвращает true, если есть проблема. */
function reportFrameIssue(now) {
  const issue = frameIssue(hands, lastBright, aspect);
  if (issue) sensei.show(issue.hint, 'warn', now);
  return !!issue;
}

// ---------- сюжетный поход ----------

let run = null;
const sceneLog = [];

/** quick — быстрый бой: сразу к главному злодею, с запасом чакры (для жюри и демо). */
function startStory({ quick = false } = {}) {
  run = {
    step: quick ? STORY.findIndex((s) => s.type === 'fight' && ENEMIES[s.enemy].boss) : 0,
    quick,
    stats: emptyStats(),
    mistakes: new Map(),
    playerHp: PLAYER_MAX_HP,
    chakra: quick ? 60 : 0,
    startedAt: performance.now(),
    name: randomNinjaName(),
    combo: { count: 0, lastAt: -Infinity, lastTech: null },
    bestForms: {},
  };
  playStep();
}

function playStep() {
  const step = STORY[run.step];
  if (!step) return finishRun(true, 'Кагэро повержен. Деревня спасена');
  go(step.type === 'scene' ? 'scene' : 'battle', step);
}

function nextStep() {
  run.step += 1;
  playStep();
}

function finishRun(win, reason) {
  const timeSec = (performance.now() - run.startedAt) / 1000;
  const { score, avgAcc } = scoreRun({ win, stats: run.stats, playerHp: run.playerHp, timeSec });
  const step = STORY[Math.min(run.step, STORY.length - 1)];
  go('results', {
    win,
    reason,
    score,
    avgAcc,
    time: timeSec,
    stats: run.stats,
    mistakes: topMistakes(run.mistakes),
    stage: step.stage,
    name: run.name,
    bestForms: run.bestForms,
    quick: run.quick,
  });
}

// ---------- экран: меню ----------

const menu = {
  enter() {
    renderRecords($('records-menu'), getRecords());
    this.choice ??= new GestureChoice($('screen-menu'), {
      snake: () => go('dojo'),
      tiger: () => startStory(),
      bird: () => startStory({ quick: true }),
    });
    this.choice.reset();
    sensei.clear();
    arena.setPlace('night');
    arena.showEnemy(null);
    music.play('calm');
    music.setPlace('night');
  },
  update(now) {
    const active = this.choice.update(hands, now);
    this.overlayTone = active ? 'pass' : 'idle';
    if (!hands.length) sensei.show('Подними руки к лицу — камера должна их видеть', 'info', now);
    else reportFrameIssue(now);
  },
};

// ---------- экран: додзё ----------

const LESSONS = [...SEAL_ORDER.map((id) => ({ type: 'seal', id })), { type: 'circle' }];

const dojo = {
  detector: new SealDetector({ holdMs: 600, hintDelayMs: 500 }),
  circle: new CircleTracker(),

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
      const glyph = l.type === 'seal' ? SEALS[l.id].kanji : ULTIMATE.glyph;
      const li = el('li', i < this.idx || this.finished ? 'done' : i === this.idx ? 'current' : '', glyph);
      li.title = l.type === 'seal' ? SEALS[l.id].name : 'Круг';
      ol.append(li);
    });
  },

  startLesson() {
    const lesson = LESSONS[this.idx];
    this.detector.reset();
    this.circle.reset();
    const best = getSealBest();
    if (lesson.type === 'seal') {
      const s = SEALS[lesson.id];
      $('lesson-hanko').textContent = s.kanji;
      $('lesson-icon').innerHTML = sealIcon(lesson.id, { size: 110 });
      $('lesson-kicker').textContent = `Печать ${this.idx + 1} из ${SEAL_ORDER.length}`;
      $('lesson-name').textContent = s.name;
      $('lesson-how').textContent = s.how;
      $('lesson-best').textContent = best[lesson.id] ? `· лучший результат ${pct(best[lesson.id])}` : '';
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
      this.choice.update(hands, now);
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
      const res = this.detector.update(hands, now, lesson.id);
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
      if (!hands.length && !issue) sensei.show('Подними руки к лицу: камера их не видит', 'warn', now);
      return;
    }

    // Урок: круг в воздухе
    this.overlayBad = null;
    const pointer = hands.find(isPointing);
    this.overlayTone = pointer ? 'near' : 'idle';
    if (now - this.lastRender > 150) {
      const checks = $('lesson-checks');
      checks.replaceChildren();
      const row = el('div', 'check-row');
      const one = hands.length === 1;
      row.append(el('span', `chip ${one ? 'ok' : 'bad'}`, `${one ? '✓' : '✗'} одна рука в кадре`));
      row.append(el('span', `chip ${pointer ? 'ok' : 'bad'}`, `${pointer ? '✓' : '✗'} указательный вверх, остальные согнуты`));
      row.append(el('span', `chip ${this.circle.drawing ? 'ok' : ''}`, this.circle.drawing ? '✓ рисуешь…' : '· веди палец по кругу'));
      checks.append(row);
      this.lastRender = now;
    }
    if (!hands.length && !issue) sensei.show('Подними одну руку к лицу: камера её не видит', 'warn', now);
    if (hands.length > 1) {
      if (!issue) sensei.show('Оставь в кадре одну руку: рисуем круг одним пальцем', 'warn', now);
      this.circle.reset();
      return;
    }
    if (hands.length === 1 && !pointer && !this.circle.drawing && !issue) {
      sensei.show('Подними указательный палец, остальные согни — и рисуй круг', 'info', now);
    }
    const result = this.circle.update(hands, now);
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
      renderTechList($('lesson-techs'), { showDesc: true });
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

// ---------- экран: сюжетная сцена ----------

const scene = {
  enter(step) {
    this.step = step;
    this.i = -1;
    this.armed = false;
    this.holdSince = 0;
    arena.setPlace(step.place);
    arena.showEnemy(null);
    music.setPlace(step.place);
    music.play(step.final ? 'victory' : step.place === 'eclipse' ? 'sceneDark' : 'scene');
    sensei.clear();
    if (step.heal && run) {
      run.playerHp = Math.min(PLAYER_MAX_HP, run.playerHp + step.heal);
      sensei.show(`Команда перевела дух: +${step.heal} к здоровью`, 'good', performance.now(), { ttl: 2600 });
    }
    const card = $('title-card');
    if (step.title) {
      card.textContent = step.title;
      card.hidden = false;
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = '';
      this.startAt = performance.now() + 1700;
      sfx.title();
    } else {
      card.hidden = true;
      this.startAt = performance.now() + 150;
    }
    $('scene-text').textContent = '';
    $('scene-who').textContent = '';
    preloadVoices(step.lines.map((l) => l.id));
    document.querySelector('.manga').style.visibility = 'hidden';
    this.onClick ??= () => this.skip(performance.now());
    document.querySelector('.bubble').addEventListener('click', this.onClick);
  },

  exit() {
    $('title-card').hidden = true;
    document.querySelector('.bubble').removeEventListener('click', this.onClick);
  },

  showLine(now) {
    this.i += 1;
    const line = this.step.lines[this.i];
    if (!line) {
      nextStep();
      return;
    }
    const sp = speaker(line.who);
    this.line = line;
    this.sp = sp;
    this.lineStart = now;
    this.lineDur = Math.max(2400, line.text.length * 42) + 1000;
    // Озвучка реплики (если записана): длительность подстраивается под запись.
    const lineRef = line;
    this.typed = 0;
    this.voiced = hasVoice(line.id);
    stopVoice();
    sceneLog.push({ id: line.id, at: now });
    playVoice(line.id).then((sec) => {
      // Реплика держится на экране, пока звучит голос (+ небольшая пауза), даже если файл начал играть с задержкой.
      if (sec && this.line === lineRef) this.lineDur = Math.max(this.lineDur, performance.now() - this.lineStart + sec * 1000 + 450);
    });
    document.querySelector('.manga').style.visibility = 'visible';
    $('scene-who').textContent = sp.name;
    const portrait = $('scene-portrait');
    portrait.style.animation = 'none';
    void portrait.offsetWidth;
    portrait.style.animation = '';
    sfx.page();
  },

  skip(now) {
    if (!this.line) return;
    const typed = Math.floor((now - this.lineStart) / 28);
    if (typed < this.line.text.length) this.lineStart = now - this.line.text.length * 28;
    else this.showLine(now);
  },

  update(now) {
    this.overlayTone = 'idle';
    if (now < this.startAt) return;
    if (this.i < 0) this.showLine(now);
    if (!this.line) return;

    const n = Math.min(this.line.text.length, Math.floor((now - this.lineStart) / 28));
    if (!this.voiced && n > (this.typed ?? 0) && n < this.line.text.length && n % 2 === 0 && this.line.text[n - 1] !== ' ') sfx.type();
    this.typed = n;
    setText($('scene-text'), this.line.text.slice(0, n));
    setWidth($('scene-timer'), pct(Math.min(1, (now - this.lineStart) / this.lineDur)));
    if (now - (this.portraitAt ?? 0) > 33) {
      this.portraitAt = now;
      drawPortrait($('scene-portrait'), this.sp.look, { t: now / 1000, tint: this.sp.tint, mood: this.sp.mood, bg: this.sp.bg });
    }

    // Жест «дальше»: раскрытые ладони (Змея), держать полсекунды
    const snake = classify(hands, ['snake'])[0];
    if (!snake.passed) {
      this.armed = true;
      this.holdSince = 0;
    } else if (this.armed) {
      this.overlayTone = 'pass';
      if (!this.holdSince) this.holdSince = now;
      if (now - this.holdSince > 450) {
        this.armed = false;
        this.holdSince = 0;
        this.skip(now);
      }
    }
    if (now - this.lineStart > this.lineDur) this.showLine(now);
  },
};

// ---------- кат-ин техники ----------

const cutinFace = $('cutin-face');
function drawCutinFace() {
  const ctx = cutinFace.getContext('2d');
  const { width: w, height: h } = cutinFace;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#e8552e');
  g.addColorStop(1, '#f0b64a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 20; i++) {
    const y = (i / 20) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + 10);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(w / 2, h / 2 + 10);
  ctx.scale(2.3, 2.3);
  ctx.translate(0, -6);
  drawHero(ctx, 0, { mood: 'shout' });
  ctx.restore();
}
drawCutinFace();

/** Кат-ин-трансформация: формы твоих печатей влетают, вспышка — и появляется техника. */
function cutin(tech, forms = []) {
  $('cutin-kanji').textContent = tech.glyph;
  $('cutin-name').textContent = tech.name;
  $('cutin-desc').textContent = tech.desc ?? '';
  const holder = $('cutin-forms');
  holder.replaceChildren();
  forms.forEach((form, i) => {
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 180;
    drawHandForm(c, form, { bg: '#efe6cf' });
    c.style.animationDelay = `${i * 0.12}s`;
    holder.append(c);
  });
  playVoice(`cast_${tech.id}`);
  const box = $('cutin');
  box.classList.remove('show');
  void box.offsetWidth;
  box.classList.add('show');
}

// ---------- экран: бой ----------

const fight = {
  detector: new SealDetector(),
  circle: new CircleTracker(),

  enter(step) {
    this.step = step;
    this.enemy = ENEMIES[step.enemy];
    this.battle = null;
    const firstFight = STORY.findIndex((s) => s.type === 'fight') === run.step;
    this.countdownUntil = performance.now() + (firstFight ? 3200 : 1300);
    this.endAt = 0;
    this.endAction = null;
    this.lastEval = null;
    this.warnedPhase2 = false;
    this.chainForms = [];
    this.detector.reset();
    this.circle.reset();
    arena.setPlace(step.place);
    arena.showEnemy(this.enemy);
    arena.shield = 0;
    music.setPlace(step.place);
    music.play(this.enemy.boss ? 'boss' : 'battle');
    music.setIntensity(1);
    this.heartAt = 0;
    this.wasDrawing = false;
    setTimeout(() => sfx.enemy(), 250);
    renderChain($('chain'), []);
    renderTechList($('battle-techs'), { ultimateReady: run.chakra >= 100 });

    // HUD: портреты, имена, этап
    drawPortrait($('portrait-hero'), 'ulagat', { mood: 'angry', bg: '#1d4a66', lines: false });
    $('combo').hidden = true;
    drawPortrait($('portrait-enemy'), this.enemy.look, { tint: this.enemy.tint, bg: '#40202a', lines: false });
    $('enemy-name').textContent = this.enemy.name;
    $('enemy-title').textContent = this.enemy.title;
    $('stage-label').textContent = `Этап ${step.stage} из 3`;
    $('stage-name').textContent = STAGE_NAMES[step.stage];
    const dots = $('stage-dots');
    dots.replaceChildren();
    let k = 0;
    for (const s of STORY) {
      if (s.type !== 'fight') continue;
      const before = STORY.indexOf(s) < run.step;
      const i = el('i', s === step ? 'now' : k < run.stats.defeated || (run.quick && before) ? 'done' : '');
      dots.append(i);
      k++;
    }
    this.hud();
    sensei.show(`${this.enemy.name} — ${this.enemy.title}. Техники на свитке справа, серии дают комбо`, 'info', performance.now(), { ttl: 3000 });
    $('countdown').hidden = false;
  },

  exit() {
    $('countdown').hidden = true;
  },

  handle(events, now) {
    const b = this.battle;
    for (const e of events) {
      switch (e.type) {
        case 'chain':
          this.chainForms = e.chain.length ? this.chainForms.slice(-e.chain.length) : [];
          renderChain($('chain'), e.chain, this.chainForms);
          renderTechList($('battle-techs'), { chain: e.chain, ultimateReady: b.ultimateReady });
          break;
        case 'cast': {
          const id = e.tech.id;
          cutin(e.tech, e.forms ?? this.chainForms);
          this.chainForms = [];
          this.showCombo(e);
          if (id === 'fire') (arena.fireball(e.power), sfx.fire());
          if (id === 'lightning') (arena.lightning(e.power), sfx.lightning());
          if (id === 'shield') (arena.shieldUp(), sfx.shield());
          if (id === 'sphere') (arena.sphere(e.power), sfx.sphere());
          if (e.damage) setTimeout(() => (arena.damageText(e.damage), sfx.hit()), id === 'sphere' ? 900 : id === 'fire' ? 550 : 420);
          const weakHint = this.weakHint();
          if (e.power < 0.9 && weakHint) {
            sensei.show(`${e.tech.name}: сила ${pct(e.power)}. ${weakHint}`, 'info', now, { lock: 1500, ttl: 3200 });
          } else {
            sensei.show(`${e.tech.name}! Сила ${pct(e.power)}`, 'good', now, { lock: 900 });
          }
          renderChain($('chain'), []);
          renderTechList($('battle-techs'), { chain: [], ultimateReady: b.ultimateReady });
          break;
        }
        case 'stun':
          sfx.stun();
          arena.label('Оглушён!', '#f0b64a');
          sensei.show(`Атака сбита! ${this.enemy.name} оглушён`, 'good', now, { lock: 1200 });
          break;
        case 'foe-charge':
          sfx.charge();
          arena.charge();
          sensei.show(`${this.enemy.name} готовит удар! Щит: Собака → Дракон. Или сбей Молнией: Птица → Тигр`, 'warn', now, {
            lock: 1400,
            ttl: e.duration,
          });
          break;
        case 'foe-hit':
          arena.playerHit(e.blocked);
          if (e.blocked) {
            sfx.blocked();
            sensei.show('Щит выдержал удар!', 'good', now, { lock: 1000 });
          } else {
            sfx.hurt();
            playVoice('hero_hurt');
            const hint = 'Удар пропущен: когда под врагом растёт красная полоса, ставь щит (Собака → Дракон)';
            b.noteMistake(hint, now);
            sensei.show(hint, 'warn', now, { lock: 1800, ttl: 3500 });
          }
          break;
        case 'combo-break':
          this.showCombo({ combo: e.count, broken: true });
          break;
        case 'error':
          sfx.hint();
          sensei.show(e.hint, 'warn', now, { lock: 1600, ttl: 3500 });
          break;
        case 'ultimate-ready':
          sfx.ultimate();
          renderTechList($('battle-techs'), { chain: b.chain, ultimateReady: true });
          sensei.show('Чакра полная! Оставь одну руку и нарисуй указательным пальцем круг', 'good', now, { lock: 2000, ttl: 4000 });
          break;
        case 'enemy-down':
          setTimeout(() => (arena.smoke(), sfx.win()), 500);
          run.playerHp = b.playerHp;
          run.chakra = b.chakra;
          sensei.show(`${this.enemy.name} повержен!`, 'good', now, { lock: 2000, ttl: 2400 });
          this.endAt = now + 2300;
          this.endAction = () => nextStep();
          break;
        case 'player-down':
          sfx.lose();
          run.playerHp = 0;
          sensei.show('Улагат пал в бою…', 'warn', now, { lock: 2500, ttl: 2600 });
          this.endAt = now + 2300;
          this.endAction = () => finishRun(false, `Поражение в бою с противником ${this.enemy.name}`);
          break;
      }
    }
  },

  /** Счётчик комбо в аниме-стиле. */
  showCombo(e) {
    const box = $('combo');
    clearTimeout(this.comboTimer);
    if (e.broken) {
      box.hidden = false;
      box.classList.add('break');
      box.querySelector('.combo-count').textContent = `Комбо ×${e.combo}`;
      box.querySelector('.combo-special').textContent = 'сорвано';
    } else if (e.combo >= 2) {
      box.hidden = false;
      box.classList.remove('break');
      box.querySelector('.combo-count').textContent = `Комбо ×${e.combo}`;
      box.querySelector('.combo-special').textContent = e.special
        ? `${e.special.name}! +${e.special.bonus}`
        : `урон ×${e.mult.toFixed(1)}`;
      sfx.combo(e.combo);
      if (e.special || e.combo >= 3) playVoice('combo');
      if (e.special) arena.label(e.special.name, '#f0b64a');
    } else {
      box.hidden = true;
      return;
    }
    box.classList.remove('pop');
    void box.offsetWidth;
    box.classList.add('pop');
    this.comboTimer = setTimeout(() => (box.hidden = true), 2600);
  },

  /** Самое слабое правило последней печати — чтобы объяснить, почему техника вышла слабой. */
  weakHint() {
    const rules = this.lastEval?.rules ?? [];
    let worst = null;
    for (const r of rules) if (r.score < 0.97 && (!worst || r.score < worst.score)) worst = r;
    return worst ? `Точнее: ${worst.hint.replace(/^На (левой|правой) руке: /, (m) => m.toLowerCase())}` : '';
  },

  hud() {
    const b = this.battle;
    const playerHp = b ? b.playerHp : run.playerHp;
    const enemyHp = b ? b.enemyHp : this.enemy.hp;
    setWidth($('hp-enemy'), pct(enemyHp / this.enemy.hp));
    setWidth($('hp-player'), pct(playerHp / PLAYER_MAX_HP));
    const chakra = b ? b.chakra : run.chakra;
    setWidth($('chakra'), pct(chakra / 100));
    setText($('chakra-val'), pct(chakra / 100));
  },

  update(now) {
    if (!this.battle) {
      const left = Math.ceil((this.countdownUntil - now) / 1000);
      const label = left > 1 ? String(left - 1) : 'Бой!';
      if (label !== $('countdown').textContent) sfx.countdown(label === 'Бой!');
      setText($('countdown'), label);
      this.overlayTone = 'idle';
      if (now >= this.countdownUntil) {
        this.battle = new Battle({
          now,
          enemy: this.enemy,
          playerHp: run.playerHp,
          chakra: run.chakra,
          stats: run.stats,
          mistakes: run.mistakes,
          combo: run.combo,
        });
        setTimeout(() => ($('countdown').hidden = true), 400);
      }
      return;
    }
    const b = this.battle;

    if (this.endAt) {
      if (b.result?.win && arena.enemy) arena.enemy.dead = Math.min(1, arena.enemy.dead + 0.03);
      if (now >= this.endAt) {
        const act = this.endAction;
        this.endAt = 0;
        this.endAction = null;
        act?.();
      }
      return;
    }

    const issue = reportFrameIssue(now);
    this.overlayBad = null;

    // Ультимейт: одна рука, указательный палец рисует круг
    const drawingMode = b.ultimateReady && hands.length === 1 && (isPointing(hands[0]) || this.circle.drawing);
    if (drawingMode || (this.circle.drawing && b.ultimateReady)) {
      this.overlayTone = 'near';
      camSeal.hidden = true;
      const r = this.circle.update(hands, now);
      if (r) {
        overlay.showGhost(r.points, r.passed, now);
        if (r.passed) {
          const form = snapshotPath(r.points);
          const events = b.onCircle(r.accuracy, now);
          for (const ev of events) if (ev.type === 'cast') ev.forms = [form];
          this.handle(events, now);
        }
        else {
          sfx.hint();
          b.noteMistake(r.hint, now);
          sensei.show(r.hint, 'warn', now, { lock: 1800, ttl: 3200 });
        }
      }
    } else {
      if (this.circle.drawing) this.circle.reset();
      const res = this.detector.update(hands, now);
      const best = res.best;
      showCamSeal(best);
      this.overlayTone = best?.passed ? 'pass' : best && best.accuracy >= NEAR_ACCURACY ? 'near' : 'idle';
      if (best && !best.passed && best.accuracy >= NEAR_ACCURACY) this.overlayBad = badFingers(best);
      for (const e of res.events) {
        if (e.type === 'seal') {
          sfx.seal();
          this.lastEval = e.evaluation;
          const form = snapshotHands(hands);
          this.chainForms.push(form);
          const best = run.bestForms[e.seal];
          if (!best || e.accuracy > best.accuracy) run.bestForms[e.seal] = { form, accuracy: e.accuracy };
          this.handle(b.onSeal(e.seal, e.accuracy, now), now);
        } else if (e.type === 'hint' && !issue) {
          b.noteMistake(e.hint, now);
          sensei.show(e.hint, 'warn', now);
        }
      }
    }

    this.handle(b.tick(now), now);

    if (b.phase2 && !this.warnedPhase2) {
      this.warnedPhase2 = true;
      arena.speedLines = 1;
      arena.sfx('ゴゴゴゴ…', arena.w * 0.75, arena.h * 0.3, { color: '#c38bff', size: 70 });
      sfx.roar();
      music.setIntensity(2);
      sensei.show('Кагэро в ярости! Теперь он заряжает удары быстрее', 'warn', now, { lock: 2200, ttl: 3000 });
    }

    // Состояние врага для отрисовки
    const f = b.foe;
    if (arena.enemy) {
      arena.enemy.state = f.state;
      arena.enemy.phase2 = b.phase2;
      arena.enemy.charge = f.state === 'charging' ? Math.min(1, (now - f.chargeStart) / (f.until - f.chargeStart)) : 0;
    }
    arena.shield = now < b.shieldUntil ? 1 : Math.max(0, arena.shield - 0.05);
    // Мало здоровья — слышно сердцебиение
    if (b.playerHp > 0 && b.playerHp <= 30 && now - this.heartAt > 900) {
      this.heartAt = now;
      sfx.heartbeat();
    }
    if (this.circle.drawing && !this.wasDrawing) sfx.draw();
    this.wasDrawing = this.circle.drawing;
    this.hud();
  },
};

// ---------- экран: итоги ----------

const results = {
  enter(res) {
    const { id } = addRecord({ name: res.name, score: res.score, win: res.win, time: Math.round(res.time), acc: res.avgAcc, stage: res.stage });
    $('res-kicker').textContent = res.reason;
    $('res-title').textContent = res.win ? 'Победа' : 'Поражение';
    $('res-score').textContent = String(res.score);
    $('res-stage').textContent = res.quick
      ? res.win ? 'Быстрый бой: Кагэро повержен. Полный сюжет — «Сюжет» в меню' : 'Быстрый бой с Кагэро'
      : res.win
      ? `Пройдены все 3 этапа, повержено врагов: ${res.stats.defeated} из ${FIGHTS_TOTAL}`
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
    const ul = $('res-mistakes');
    ul.replaceChildren();
    if (!res.mistakes.length) ul.append(el('li', '', 'Ошибок почти не было — чистая техника.'));
    for (const [hint, count] of res.mistakes) ul.append(el('li', '', `${hint}${count > 1 ? ` (×${count})` : ''}`));
    renderRecords($('records-results'), getRecords(), id);
    this.choice ??= new GestureChoice($('screen-results'), {
      snake: () => startStory(),
      tiger: () => go('dojo'),
    });
    this.choice.reset();
    arena.setPlace(res.win ? 'dawn' : 'night');
    arena.showEnemy(null);
    music.setPlace(res.win ? 'dawn' : 'night');
    music.play(res.win ? 'victory' : 'defeat');
    if (res.win) setTimeout(() => sfx.win(), 300);
  },
  update(now) {
    const active = this.choice.update(hands, now);
    this.overlayTone = active ? 'pass' : 'idle';
  },
};

// ---------- переключение экранов ----------

const controllers = { menu, dojo, scene, battle: fight, results };

function go(screen, arg) {
  controller?.exit?.();
  app.dataset.screen = screen;
  controller = controllers[screen] ?? null;
  camSeal.hidden = true;
  controller?.enter?.(arg);
  sfx.select();
}

// ---------- запуск ----------

async function boot() {
  const btn = $('btn-start');
  const status = $('intro-status');
  btn.disabled = true;
  unlockAudio();
  try {
    status.textContent = 'Включаю камеру…';
    await startCamera(video);
    aspect = video.videoWidth / video.videoHeight || 16 / 9;
    app.style.setProperty('--cam-ar', String(aspect));
    loadAudioManifest();
    tracker = await createHandTracker((t) => (status.textContent = t));
    status.textContent = '';
    go('menu');
  } catch (err) {
    console.error(err);
    $('error-text').textContent =
      err instanceof CameraError ? err.message : `Не удалось загрузить распознавание рук: ${err?.message ?? err}. Проверь интернет и обнови страницу.`;
    app.dataset.screen = 'error';
  } finally {
    btn.disabled = false;
  }
}

$('btn-start').addEventListener('click', boot);

// Модель рук начинаем качать сразу, пока игрок читает заставку.
const introProgress = (p) => {
  if (app.dataset.screen === 'intro' && !$('btn-start').disabled) {
    $('intro-status').textContent = p < 1 ? `Готовлю распознавание рук: ${Math.round(p * 100)}%` : 'Распознавание рук готово';
  }
};
prefetchRecognition(introProgress).then(() => stopProgress(introProgress));
$('btn-retry').addEventListener('click', () => location.reload());

// Если доступ к камере уже был разрешён раньше — стартуем без клика.
navigator.permissions
  ?.query({ name: 'camera' })
  .then((p) => {
    if (p.state === 'granted') boot();
  })
  .catch(() => {});

// Звук
const soundBtn = $('btn-sound');
soundBtn.addEventListener('click', () => {
  unlockAudio();
  setSound(!isSoundOn());
  soundBtn.setAttribute('aria-pressed', String(isSoundOn()));
});
addEventListener('pointerdown', unlockAudio, { once: true });

// Отладка: клавиша D или ?debug в адресе — показывает сырые признаки пальцев.
// Запасное управление с клавиатуры: 1–3 — пункты меню и итогов, пробел/Enter — следующая реплика.
addEventListener('keydown', (e) => {
  const screen = app.dataset.screen;
  if ((screen === 'menu' || screen === 'results') && /^[1-3]$/.test(e.key)) {
    const buttons = [...$(`screen-${screen}`).querySelectorAll('[data-choice]')];
    buttons[Number(e.key) - 1]?.click();
  } else if (screen === 'scene' && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight')) {
    e.preventDefault();
    scene.skip(performance.now());
  }
});

addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'в') {
    debug = !debug;
    debugBox.hidden = !debug;
  }
});
debugBox.hidden = !debug;

function renderDebug() {
  if (!debug) return;
  const lines = [`fps: ${Math.round(1000 / (frameAvg || 16))}  распознавание: ${detectCost.toFixed(0)} мс  качество: ${arena.quality}  рук: ${hands.length}  яркость: ${lastBright.toFixed(2)}  экран: ${app.dataset.screen}`];
  for (const h of hands) {
    const ext = Object.entries(h.ext).map(([f, v]) => `${SHORT[f].slice(0, 4)} ${v.toFixed(2)}`).join('  ');
    lines.push(`${h.side.padEnd(6)} ладонь ${h.palm.toFixed(3)} | ${ext}`);
  }
  lines.push(classify(hands).slice(0, 3).map((e) => `${SEALS[e.seal].name} ${pct(e.accuracy)}${e.passed ? ' ✓' : ''}`).join('   '));
  debugBox.textContent = lines.join('\n');
}

// ---------- главный цикл ----------

let fakeResult = null;
let prev = performance.now();

let frameAvg = 16;
let lastDetectAt = 0;
let detectGap = 0;
let detectCost = 8;
function loop(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  frameAvg = frameAvg * 0.95 + (now - prev) * 0.05;
  prev = now;

  if (fakeResult) {
    hands = buildHands(fakeResult, aspect);
  } else if (tracker && video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastDetectAt >= detectGap) {
    lastVideoTime = video.currentTime;
    lastDetectAt = now;
    try {
      const t0 = performance.now();
      const result = tracker.detectForVideo(video, now);
      // Если распознавание тяжёлое (слабый ноутбук), реже запускаем его, чтобы графика не тормозила.
      detectCost = detectCost * 0.9 + (performance.now() - t0) * 0.1;
      detectGap = detectCost > 22 ? 60 : detectCost > 14 ? 40 : 0;
      hands = buildHands(result, aspect);
    } catch (err) {
      console.warn('Ошибка распознавания кадра', err);
    }
    lastBright = brightness.sample(video, now);
  }

  if (controller) controller.update(now, dt);

  const trail = controller === fight || controller === dojo ? controller.circle?.points : null;
  overlay.draw(hands, {
    tone: controller?.overlayTone ?? 'idle',
    bad: controller?.overlayBad ?? null,
    aspect,
    trail,
    now,
  });

  sensei.update(now);
  arena.frame(dt);
  renderDebug();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Для консоли разработчика и автотестов: можно подставить «руки» вместо камеры.
window.__shinobi = {
  SEALS,
  TECHNIQUES,
  FINGER_NAMES,
  get hands() {
    return hands;
  },
  setFakeResult(result) {
    fakeResult = result;
  },
  get battle() {
    return fight.battle;
  },
  get run() {
    return run;
  },
  startStory,
  go,
  arena,
  music,
  audioGraph,
  sfx,
  voiceLog,
  sceneLog,
};
