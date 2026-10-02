// Сюжетные сцены в стиле манги: портрет, реплика с озвучкой, перелистывание жестом «раскрытые ладони».

import { SEALS, NEAR_ACCURACY, classify, evaluateSeal, twoPlayers } from '../seals.js';
import { ENEMIES, PLAYER_MAX_HP } from '../battle.js';
import { drawPortrait } from '../characters.js';
import { sfx, playVoice, preloadVoices, hasVoice, stopVoice } from '../audio.js';
import { music } from '../music.js';
import { $, stamp } from '../ui.js';
import { sealIcon } from '../icons.js';
import { wantsBySide } from '../ghost.js';
import { arena, overlay, sensei, state, registerScreen, setText, setWidth, pct, badFingers, reportFrameIssue, moment } from '../app/context.js';
import { nextStep } from '../app/story.js';

export const sceneLog = [];

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

export const scene = {
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
    if (step.heal && state.run) {
      state.run.playerHp = Math.min(PLAYER_MAX_HP, state.run.playerHp + step.heal);
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
    this.wait = null;
    $('scene-gesture').hidden = true;
    this.onClick ??= () => this.skip(performance.now());
    document.querySelector('.bubble').addEventListener('click', this.onClick);
  },

  exit() {
    stopVoice();
    this.line = null;
    this.wait = null;
    this.overlayBad = null;
    this.overlayGuide = null;
    $('scene-gesture').hidden = true;
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
    // Сюжетный жест: история ждёт, пока игрок сложит печать (с подсказками по пальцам)
    this.wait = line.gesture ? { seal: line.gesture, since: 0, done: 0 } : null;
    this.overlayBad = null;
    const card = $('scene-gesture');
    card.hidden = !this.wait;
    document.querySelector('.skip-cue').style.visibility = this.wait ? 'hidden' : '';
    if (this.wait) {
      const s = SEALS[line.gesture];
      $('scene-gesture-icon').innerHTML = sealIcon(line.gesture, { size: 64 });
      $('scene-gesture-name').textContent = `Сложи «${s.name}»`;
      $('scene-gesture-how').textContent = s.how;
      setWidth($('scene-gesture-fill'), '0%');
      card.classList.remove('done');
      this.lineDur = Infinity;
      // печать на двоих: два места — «Игрок 1» и «Игрок 2»
      $('scene-coop').hidden = !s.coop;
      this.coopMode = null;
      if (s.coop) this.paintCoop('none');
    }
    const portrait = $('scene-portrait');
    portrait.style.animation = 'none';
    void portrait.offsetWidth;
    portrait.style.animation = '';
    sfx.page();
  },

  skip(now) {
    if (!this.line) return;
    // жест ещё не сложен: клик или пробел засчитывают его (запасной путь для показа)
    if (this.wait && !this.wait.done) return SEALS[this.wait.seal].coop ? this.skipCoop(now) : this.gestureDone(now, null);
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

    if (this.wait) return this.updateGesture(now);

    // Жест «дальше»: раскрытые ладони (Змея), держать полсекунды
    const snake = classify(state.hands, ['snake'])[0];
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

Object.assign(scene, {
  /** Ждём сюжетный жест: оценка правил печати, красные пальцы и подсказка сенсея, удержание 0,6 с. */
  updateGesture(now) {
    const w = this.wait;
    if (w.done) {
      if (now - w.done > 1300) {
        this.wait = null;
        $('scene-gesture').hidden = true;
        document.querySelector('.skip-cue').style.visibility = '';
        this.showLine(now);
      }
      return;
    }
    const ev = evaluateSeal(w.seal, state.hands);
    if (SEALS[w.seal].coop) this.paintCoop(state.hands.length < 2 ? (state.hands.length ? 'one-hand' : 'none') : twoPlayers(state.hands));
    this.overlayTone = ev.passed ? 'pass' : ev.accuracy >= NEAR_ACCURACY ? 'near' : 'idle';
    this.overlayBad = ev.passed ? null : badFingers(ev);
    this.overlayGuide = !ev.passed && ev.accuracy >= NEAR_ACCURACY ? wantsBySide(ev) : null;
    if (ev.passed) {
      w.since ||= now;
      setWidth($('scene-gesture-fill'), pct(Math.min(1, (now - w.since) / 600)));
      if (now - w.since >= 600) this.gestureDone(now, ev.accuracy);
      return;
    }
    w.since = 0;
    setWidth($('scene-gesture-fill'), pct(Math.min(0.95, ev.accuracy) * 0.6));
    if (!reportFrameIssue(now) && ev.hint && now - this.lineStart > 1200) sensei.show(ev.hint, 'warn', now);
  },

  /** Печать на двоих пропущена (нет второго игрока): без эффектов и без кадра для манги. */
  skipCoop(now) {
    const w = this.wait;
    w.done = now;
    this.overlayBad = null;
    this.overlayGuide = null;
    sfx.page();
    $('scene-coop-note').textContent = 'Пропустили. Печать дружбы ждёт вас вдвоём в следующий раз';
    sensei.show('Ничего, Печать дружбы сложите вдвоём в следующий раз', 'info', now, { lock: 1100 });
  },

  /** Места игроков: none — никого, one-hand — одна рука, one — обе руки одного человека, two — вас двое. */
  paintCoop(mode) {
    if (mode === this.coopMode) return;
    this.coopMode = mode;
    const [p1, p2] = document.querySelectorAll('#scene-coop .coop-slot');
    const box = $('scene-coop');
    p1.dataset.state = mode === 'none' ? '' : 'on';
    p2.dataset.state = mode === 'two' ? 'on' : mode === 'one' ? 'bad' : '';
    box.classList.toggle('together', mode === 'two');
    box.classList.toggle('solo', mode === 'one');
    $('scene-coop-note').textContent = {
      none: 'Ждём двоих: встаньте рядом перед камерой',
      'one-hand': 'Игрок 1 на месте. Где второй? Позови друга',
      one: 'Это обе руки одного человека. Нужен второй игрок — каждый даёт правую руку',
      unknown: 'Покажите обе руки камере целиком — проверяю, что вас двое',
      two: 'Вас двое! Теперь сцепите мизинцы',
    }[mode];
  },

  gestureDone(now, accuracy) {
    const w = this.wait;
    w.done = now;
    this.overlayBad = null;
    this.overlayGuide = null;
    overlay.burst(SEALS[w.seal].kanji, state.hands, '#6fd08c');
    stamp($('stamp'), SEALS[w.seal].kanji);
    sfx.seal();
    sfx.success();
    $('scene-gesture').classList.add('done');
    setWidth($('scene-gesture-fill'), '100%');
    const fx = this.line.fx;
    if (fx === 'shield') (arena.shieldUp(), sfx.shield());
    if (fx === 'fire') (arena.label('火!', '#f0b64a'), sfx.fire());
    if (fx === 'ready') arena.label('準備!', '#6fd08c');
    if (fx === 'friend') {
      arena.label('友!', '#f0b64a');
      overlay.burst('友', state.hands, '#f0b64a');
      sfx.win();
    }
    // момент для главы манги (пропущенный жест в мангу не попадает)
    if (accuracy !== null) moment({
      who: 'Улагат',
      caption: fx === 'friend' ? 'Печать дружбы — вместе!' : `${SEALS[w.seal].name}!`,
      sfx: fx === 'friend' ? 'ギュッ!' : fx === 'fire' ? 'ゴォッ!' : fx === 'shield' ? 'キィン!' : 'パッ!',
      kanji: SEALS[w.seal].kanji,
      priority: fx === 'friend' ? 4 : 1,
      once: `g-${w.seal}`,
    });
    // accuracy = null — жест пропущен кликом или пробелом: не выдумываем «100%»
    sensei.show(
      accuracy === null
        ? `${SEALS[w.seal].name}: пропущено — история идёт дальше`
        : fx === 'friend'
          ? `Печать дружбы! Вы сложили её вдвоём — совпадение ${pct(accuracy)}`
          : `Отлично! ${SEALS[w.seal].name}: совпадение ${pct(accuracy)}`,
      'good',
      now,
      { lock: 1100 },
    );
  },
});

// «Пропустить» на печати вдвоём: кнопка внутри пузыря — клик не должен ещё и листать реплику
$('scene-coop-skip').addEventListener('click', (e) => {
  e.stopPropagation();
  if (scene.wait && !scene.wait.done) scene.skipCoop(performance.now());
});

registerScreen('scene', scene);
