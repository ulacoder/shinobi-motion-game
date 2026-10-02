// Сюжетные сцены в стиле манги: портрет, реплика с озвучкой, перелистывание жестом «раскрытые ладони».

import { classify } from '../seals.js';
import { ENEMIES, PLAYER_MAX_HP } from '../battle.js';
import { drawPortrait } from '../characters.js';
import { sfx, playVoice, preloadVoices, hasVoice, stopVoice } from '../audio.js';
import { music } from '../music.js';
import { $ } from '../ui.js';
import { arena, sensei, state, registerScreen, setText, setWidth, pct } from '../app/context.js';
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

registerScreen('scene', scene);
