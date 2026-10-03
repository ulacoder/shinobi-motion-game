// «Дуэль с тенью»: тень Кагэро складывает печать-загадку тёмной рукой — повтори её, пока не догорела кисть.
// 5 раундов, время всё короче; последняя загадка — твоя же печать из Кузницы, если она есть.
// Режим «ошибка» работает и здесь: красные пальцы, рука-призрак, подсказки сенсея.

import { SEALS, evaluateSeal } from '../seals.js';
import { wantsBySide } from '../ghost.js';
import { evaluateTemplate } from '../forge.js';
import { getForged } from '../storage.js';
import { ENEMIES } from '../battle.js';
import { sfx, senseiVoice } from '../audio.js';
import { music } from '../music.js';
import { sealIcon } from '../icons.js';
import { $, el, GestureChoice, stamp, drawHandForm } from '../ui.js';
import { arena, overlay, sensei, state, go, registerScreen, setText, setWidth, pct, badFingers, reportFrameIssue } from '../app/context.js';
import { ROUND_MS, duelRounds, duelRank } from '../duel.js';

const HOLD_MS = 350;
const PAUSE_MS = 1100;

export const duel = {
  enter() {
    const forged = getForged()[0];
    this.forged = forged?.tpl ? forged : null;
    this.rounds = duelRounds(Math.random, !!this.forged);
    this.results = [];
    this.i = -1;
    this.startAt = performance.now() + 2400;
    this.pauseUntil = 0;
    this.done = false;
    $('duel-result').hidden = true;
    $('duel-panel').hidden = false;
    $('duel-panel').classList.remove('won', 'lost');
    $('duel-title').textContent = 'Тень Кагэро';
    $('duel-sub').textContent = 'Повтори печать, пока не догорела кисть. 5 загадок';
    $('duel-shadow').innerHTML = '';
    $('duel-form').hidden = true;
    setWidth($('duel-fill'), '100%');
    this.renderDots();
    this.choice ??= new GestureChoice($('duel-result'), {
      snake: () => go('menu'),
      tiger: () => this.enter(),
    });
    arena.setPlace('eclipse');
    arena.showEnemy({ ...ENEMIES.boss });
    music.setPlace('eclipse');
    music.play('boss');
    sfx.roar();
    sensei.show('Тень Кагэро показывает печать — повтори её быстрее', 'info', performance.now(), { ttl: 2600 });
    senseiVoice('se_duel');
  },

  exit() {
    this.overlayBad = null;
    this.overlayGuide = null;
  },

  renderDots() {
    const ol = $('duel-dots');
    ol.replaceChildren();
    this.rounds.forEach((id, k) => {
      const r = this.results[k];
      const glyph = id === 'forged' ? this.forged?.kanji ?? '印' : SEALS[id].kanji;
      ol.append(el('li', r ? (r.won ? 'done' : 'miss') : k === this.i ? 'current' : '', r ? (r.won ? glyph : '✗') : String(k + 1)));
    });
  },

  /** Новая загадка: тень складывает печать тёмной рукой с красным свечением. */
  nextRound(now) {
    this.i += 1;
    if (this.i >= this.rounds.length) return this.finish(now);
    const id = this.rounds[this.i];
    this.round = { id, start: now, until: now + ROUND_MS[this.i], since: 0, armed: false };
    const panel = $('duel-panel');
    panel.classList.remove('won', 'lost');
    $('duel-title').textContent = `Загадка ${this.i + 1} из ${this.rounds.length}`;
    if (id === 'forged') {
      $('duel-shadow').innerHTML = '';
      const form = this.forged.form ?? { hands: [] };
      const mirrored = { hands: (form.hands ?? []).map((h) => h.map((p) => ({ x: -p.x, y: p.y }))) };
      $('duel-form').hidden = false;
      drawHandForm($('duel-form'), mirrored, { glow: 'rgba(156, 34, 25, 0.95)' });
      $('duel-sub').textContent = `Твоя же печать — «${this.forged.name}»! Тень украла её`;
    } else {
      $('duel-form').hidden = true;
      $('duel-shadow').innerHTML = sealIcon(id, { size: 220, title: false, skin: '#2a1f2e', ink: '#cc3325' });
      $('duel-sub').textContent = `«${SEALS[id].name}»: ${SEALS[id].how}`;
    }
    panel.classList.remove('pop');
    void panel.offsetWidth;
    panel.classList.add('pop');
    this.renderDots();
    sfx.page();
  },

  evaluate(id) {
    return id === 'forged' ? evaluateTemplate(this.forged.tpl, state.hands) : evaluateSeal(id, state.hands);
  },

  update(now) {
    if (this.done) {
      const active = this.choice.update(state.hands, now);
      this.overlayTone = active ? 'pass' : 'idle';
      return;
    }
    if (now < this.startAt) {
      const left = Math.ceil((this.startAt - now) / 800);
      setText($('duel-title'), left > 0 ? `Тень готовится… ${left}` : 'Начали!');
      this.overlayTone = 'idle';
      return;
    }
    if (this.i < 0 || (this.pauseUntil && now >= this.pauseUntil)) {
      this.pauseUntil = 0;
      return this.nextRound(now);
    }
    if (this.pauseUntil) return;

    const r = this.round;
    const issue = reportFrameIssue(now);
    const ev = this.evaluate(r.id);
    // печать прошлого раунда, которую ещё держат, не засчитываем: сначала «отпусти»
    if (!ev.passed) r.armed = true;
    this.overlayTone = ev.passed ? 'pass' : ev.accuracy >= 0.45 ? 'near' : 'idle';
    this.overlayBad = ev.passed ? null : badFingers(ev);
    this.overlayGuide = !ev.passed && ev.accuracy >= 0.45 && !ev.missingHands ? wantsBySide(ev) : null;
    setWidth($('duel-fill'), pct(Math.max(0, (r.until - now) / (r.until - r.start))));
    if (ev.passed && r.armed) {
      r.since ||= now;
      if (now - r.since >= HOLD_MS) return this.win(now, ev.accuracy);
    } else r.since = 0;
    if (!issue && !ev.passed && ev.hint && now - r.start > 1200) sensei.show(ev.hint, 'warn', now);
    if (now >= r.until) this.lose(now);
  },

  win(now, acc) {
    const r = this.round;
    const ms = now - r.start;
    this.results.push({ won: true, ms, acc });
    const glyph = r.id === 'forged' ? this.forged.kanji : SEALS[r.id].kanji;
    stamp($('stamp'), glyph);
    overlay.burst(glyph, state.hands, '#6fd08c');
    sfx.seal();
    sfx.hit();
    arena.label('斬!', '#6fd08c');
    if (arena.enemy) arena.enemy.state = 'stunned';
    $('duel-panel').classList.add('won');
    $('duel-title').textContent = `${(ms / 1000).toFixed(1).replace('.', ',')} с · ${pct(acc)}`;
    this.overlayBad = null;
    this.overlayGuide = null;
    this.pauseUntil = now + PAUSE_MS;
    this.renderDots();
    sensei.show('Быстрее тени!', 'good', now, { lock: 800 });
    senseiVoice('se_duel_win');
  },

  lose(now) {
    this.results.push({ won: false });
    sfx.hurt();
    arena.playerHit(false);
    $('duel-panel').classList.add('lost');
    $('duel-title').textContent = 'Тень успела первой';
    senseiVoice('se_duel_lose');
    this.overlayBad = null;
    this.overlayGuide = null;
    this.pauseUntil = now + PAUSE_MS;
    this.renderDots();
  },

  finish(now) {
    this.done = true;
    const rank = duelRank(this.results);
    $('duel-panel').hidden = true;
    $('duel-rank').textContent = rank.kanji;
    $('duel-rank-title').textContent = rank.title;
    $('duel-rank-line').textContent = rank.line;
    const ol = $('duel-list');
    ol.replaceChildren();
    this.rounds.forEach((id, k) => {
      const r = this.results[k];
      const name = id === 'forged' ? this.forged.name : SEALS[id].name;
      const text = r?.won ? `${name} — ${(r.ms / 1000).toFixed(1).replace('.', ',')} с, ${pct(r.acc)}` : `${name} — тень быстрее`;
      ol.append(el('li', r?.won ? 'ok' : 'miss', text));
    });
    $('duel-result').hidden = false;
    this.choice.reset();
    stamp($('stamp'), rank.kanji);
    sfx.win();
    sensei.show('Тигр — ещё раз, раскрытые ладони — в меню', 'info', now, { ttl: 4000 });
  },
};

registerScreen('duel', duel);
