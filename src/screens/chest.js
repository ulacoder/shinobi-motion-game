// Бамбуковый сундук: три раза поднять ладонь и опустить — внутри новый приём.

import { ChopDetector, bladeScore } from '../chop.js';
import { REWARDS } from '../battle.js';
import { sfx } from '../audio.js';
import { music } from '../music.js';
import { $ } from '../ui.js';
import { arena, sensei, state, registerScreen, setText, setWidth, pct, reportFrameIssue } from '../app/context.js';
import { nextStep } from '../app/story.js';
import { cutin } from './cutin.js';

export const chest = {
  detector: new ChopDetector(),

  enter(step) {
    this.step = step;
    this.reward = REWARDS[step.reward];
    this.hits = 0;
    this.need = 3;
    this.doneAt = 0;
    this.detector.reset();
    arena.setPlace(step.place);
    arena.showEnemy(null);
    arena.showChest();
    music.setPlace(step.place);
    music.play('chest');
    music.setIntensity(1);
    this.render();
    sfx.title();
    sensei.show('Бамбуковый сундук! Подними ладонь и опусти вниз — три раза, и он откроется', 'info', performance.now(), { ttl: 4000, lock: 1500 });
    this.onClick ??= () => this.hit(0.8, performance.now());
    $('screen-chest').addEventListener('click', this.onClick);
  },

  exit() {
    arena.hideChest();
    $('screen-chest').removeEventListener('click', this.onClick);
    $('chest-reward').hidden = true;
  },

  render() {
    setText($('chest-count'), `Ударов: ${this.hits} из ${this.need}`);
    setWidth($('chest-meter'), pct(this.hits / this.need));
  },

  hit(power, now) {
    if (this.doneAt || this.hits >= this.need) return;
    this.hits += 1;
    sfx.chop(power);
    arena.chestHit(power);
    this.render();
    if (this.hits >= this.need) this.open(now);
    else sensei.show(this.hits === 1 ? 'Трещит! Ещё удар!' : 'Почти! Последний удар!', 'good', now, { lock: 700 });
  },

  open(now) {
    arena.chestBreak();
    sfx.chestBreak();
    state.run.stats.chests = (state.run.stats.chests ?? 0) + 1;
    if (!state.run.unlocked.includes(this.step.reward)) state.run.unlocked.push(this.step.reward);
    const r = this.reward;
    setTimeout(() => {
      cutin(r.tech);
      $('chest-reward-kanji').textContent = r.tech.glyph;
      $('chest-reward-name').textContent = r.tech.name;
      $('chest-reward-kind').textContent = r.kind === 'ultimate' ? 'Новый ультимейт' : 'Новый приём';
      $('chest-reward-how').textContent = `Как: ${r.how}`;
      $('chest-reward-desc').textContent = r.tech.desc;
      $('chest-reward').hidden = false;
      sfx.win();
    }, 600);
    sensei.show(`Сундук открыт! Новый приём: ${r.tech.name}`, 'good', now, { lock: 3000, ttl: 5000 });
    this.doneAt = now + 5200;
  },

  update(now) {
    this.overlayTone = 'idle';
    if (this.doneAt) {
      if (now >= this.doneAt) {
        this.doneAt = 0;
        nextStep();
      }
      return;
    }
    const issue = reportFrameIssue(now);
    const hand = state.hands[0];
    this.overlayTone = hand && bladeScore(hand).score > 0.6 ? 'near' : 'idle';
    for (const e of this.detector.update(state.hands, now, state.handsStamp)) {
      if (e.type === 'chop') this.hit(e.power, now);
      else if (!issue) {
        sfx.hint();
        state.run.mistakes && state.run.mistakes.set(e.hint, (state.run.mistakes.get(e.hint) ?? 0) + 1);
        sensei.show(e.hint, 'warn', now, { lock: 1500, ttl: 3000 });
      }
    }
    if (!state.hands.length && !issue) sensei.show('Подними ладонь над головой и опусти вниз', 'info', now);
  },
};

registerScreen('chest', chest);
