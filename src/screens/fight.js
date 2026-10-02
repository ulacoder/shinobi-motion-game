// Экран боя: печати → цепочки-техники, ультимейты (круг и «ладонь вверх-вниз»), удары врага, комбо.

import { NEAR_ACCURACY } from '../seals.js';
import { SealDetector } from '../detector.js';
import { CircleTracker, isPointing } from '../air.js';
import { ChopDetector } from '../chop.js';
import { Battle, TECHNIQUES, EXTRA_TECHNIQUES, ENEMIES, STAGE_NAMES, PLAYER_MAX_HP } from '../battle.js';
import { drawPortrait } from '../characters.js';
import { sfx, playVoice } from '../audio.js';
import { music } from '../music.js';
import { $, el, renderTechList, renderChain, snapshotHands, snapshotPath, drawHandForm } from '../ui.js';
import {
  arena, overlay, sensei, state, registerScreen, setText, setWidth, pct, camSeal, showCamSeal, badFingers, reportFrameIssue,
} from '../app/context.js';
import { nextStep, finishRun } from '../app/story.js';
import { cutin } from './cutin.js';
import { evaluateTemplate, forgedTechnique } from '../forge.js';
import { getForged } from '../storage.js';

export const fight = {
  detector: new SealDetector(),
  circle: new CircleTracker(),
  chop: new ChopDetector(),

  /** Какие техники показать в списке: базовые + открытые в сундуках. */
  techOpts(extra) {
    const techs = [...Object.values(TECHNIQUES), ...state.run.unlocked.filter((id) => EXTRA_TECHNIQUES[id]).map((id) => EXTRA_TECHNIQUES[id])];
    const forged = this.forged ? { name: this.forged.tech.name, kanji: this.forged.tech.glyph } : null;
    return { techs, dragon: state.run.unlocked.includes('dragon'), forged, ...extra };
  },

  enter(step) {
    this.step = step;
    // Своя печать из Кузницы (последняя выкованная) — техника в любом бою
    const seal = getForged()[0];
    this.forged = seal?.tpl ? { seal, tech: forgedTechnique(seal) } : null;
    this.forgedArmed = true;
    this.forgedSince = 0;
    this.steal = null;
    this.stealDone = false;
    this.phase2At = 0;
    $('steal').hidden = true;
    // в быстром демо у Кагэро меньше здоровья, чтобы бой укладывался в минуту-полторы
    this.enemy = step.hp ? { ...ENEMIES[step.enemy], hp: step.hp } : ENEMIES[step.enemy];
    this.battle = null;
    const story = state.run.story;
    const firstFight = story.findIndex((s) => s.type === 'fight') === state.run.step;
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
    this.chop.reset();
    this.heartAt = 0;
    this.wasDrawing = false;
    setTimeout(() => sfx.enemy(), 250);
    renderChain($('chain'), []);
    renderTechList($('battle-techs'), this.techOpts({ ultimateReady: state.run.chakra >= 100 }));

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
    for (const s of story) {
      if (s.type !== 'fight') continue;
      const before = story.indexOf(s) < state.run.step;
      const i = el('i', s === step ? 'now' : k < state.run.stats.defeated || ((state.run.quick || state.run.chapter > 1) && before) ? 'done' : '');
      dots.append(i);
      k++;
    }
    this.hud();
    sensei.show(`${this.enemy.name} — ${this.enemy.title}. Техники — на свитке, серии дают комбо`, 'info', performance.now(), { ttl: 3000 });
    $('countdown').hidden = false;
  },

  exit() {
    $('countdown').hidden = true;
    $('steal').hidden = true;
  },

  handle(events, now) {
    const b = this.battle;
    for (const e of events) {
      switch (e.type) {
        case 'chain':
          this.chainForms = e.chain.length ? this.chainForms.slice(-e.chain.length) : [];
          renderChain($('chain'), e.chain, this.chainForms);
          renderTechList($('battle-techs'), this.techOpts({ chain: e.chain, ultimateReady: b.ultimateReady }));
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
          if (id === 'wind') (arena.wind(e.power), sfx.wind());
          if (id === 'dragon') (arena.dragon(e.power), sfx.dragon());
          // своя печать: эффект по её стихии
          const fx = id === 'forged' ? e.tech.effect : id;
          if (id === 'forged') {
            if (fx === 'fire') (arena.fireball(e.power), sfx.fire());
            else if (fx === 'lightning') (arena.lightning(e.power), sfx.lightning());
            else if (fx === 'sphere') (arena.sphere(e.power), sfx.sphere());
            else if (fx === 'dragon') (arena.dragon(e.power), sfx.dragon());
            else (arena.wind(e.power), sfx.wind());
          }
          const hitDelay = { sphere: 900, fire: 550, wind: 500, dragon: 850 }[fx] ?? 420;
          if (e.damage) setTimeout(() => (arena.damageText(e.damage), sfx.hit()), hitDelay);
          const weakHint = this.weakHint();
          if (e.power < 0.9 && weakHint) {
            sensei.show(`${e.tech.name}: сила ${pct(e.power)}. ${weakHint}`, 'info', now, { lock: 1500, ttl: 3200 });
          } else {
            sensei.show(`${e.tech.name}! Сила ${pct(e.power)}`, 'good', now, { lock: 900 });
          }
          renderChain($('chain'), []);
          renderTechList($('battle-techs'), this.techOpts({ chain: [], ultimateReady: b.ultimateReady }));
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
          renderTechList($('battle-techs'), this.techOpts({ chain: b.chain, ultimateReady: true }));
          sensei.show(
            state.run.unlocked.includes('dragon')
              ? 'Чакра полная! Подними ладонь и опусти — Удар дракона. Или нарисуй пальцем круг'
              : 'Чакра полная! Оставь одну руку и нарисуй указательным пальцем круг',
            'good',
            now,
            { lock: 2000, ttl: 4000 },
          );
          break;
        case 'enemy-down':
          setTimeout(() => (arena.smoke(), sfx.win()), 500);
          state.run.playerHp = b.playerHp;
          state.run.chakra = b.chakra;
          sensei.show(`${this.enemy.name} повержен!`, 'good', now, { lock: 2000, ttl: 2400 });
          this.endAt = now + 2300;
          this.endAction = () => nextStep();
          break;
        case 'player-down':
          sfx.lose();
          state.run.playerHp = 0;
          sensei.show('Улагат пал в бою…', 'warn', now, { lock: 2500, ttl: 2600 });
          this.endAt = now + 2300;
          this.endAction = () => finishRun(false, `Поражение в бою с противником ${this.enemy.name}`);
          break;
      }
    }
  },

  /**
   * Своя печать: если жест совпал с эталоном из Кузницы (и это не встроенная печать) и держится 0,4 с — техника.
   * Повтор — только после того, как жест «отпустили». Возвращает true, пока жест совпадает (тогда молчат подсказки печатей).
   */
  updateForged(now, best) {
    if (!this.forged) return false;
    const ev = evaluateTemplate(this.forged.seal.tpl, state.hands);
    const match = ev.passed && !best?.passed;
    if (!match) {
      this.forgedSince = 0;
      if (ev.accuracy < 0.55) this.forgedArmed = true;
      return false;
    }
    this.overlayTone = 'pass';
    camSeal.hidden = true;
    if (!this.forgedArmed) return true;
    if (!this.forgedSince) this.forgedSince = now;
    if (now - this.forgedSince < 400) return true;
    this.forgedArmed = false;
    this.forgedSince = 0;
    if (this.steal) {
      this.resolveSteal(true, ev.accuracy, now);
      return true;
    }
    const events = this.battle.onForged(this.forged.tech, ev.accuracy, now);
    if (!events.length) {
      sensei.show(`${this.forged.tech.name} перезаряжается — через пару секунд`, 'info', now, { lock: 900 });
      return true;
    }
    sfx.seal();
    const form = snapshotHands(state.hands);
    for (const e of events) if (e.type === 'cast') e.forms = [form];
    this.handle(events, now);
    return true;
  },

  /** Кагэро показывает украденную печать красными руками: у игрока 5 секунд, чтобы повторить её первым. */
  startSteal(now) {
    const b = this.battle;
    this.steal = { start: now, until: now + 5000 };
    b.holdFoe(now + 6500);
    const box = $('steal');
    box.classList.remove('won');
    box.querySelector('.steal-title').textContent = 'Кагэро украл твою печать!';
    $('steal-sub').textContent = `Повтори «${this.forged.tech.name}» быстрее него — или поставь щит`;
    // форма печати — зеркально, как будто её складывает сам Кагэро
    const form = this.forged.seal.form ?? { hands: [] };
    const mirrored = { hands: (form.hands ?? []).map((h) => h.map((p) => ({ x: -p.x, y: p.y }))) };
    drawHandForm($('steal-hands'), mirrored, { ink: '#ff4d3a', glow: 'rgba(255, 40, 30, 0.95)', tips: '#ffe1d6' });
    box.hidden = false;
    sfx.roar();
    arena.label('奪!', '#ff4d3a');
    sensei.show('Кагэро: «Твоя печать теперь моя!» Повтори её первым!', 'warn', now, { lock: 2500, ttl: 5000 });
  },

  resolveSteal(won, accuracy, now) {
    const b = this.battle;
    this.steal = null;
    this.stealDone = true;
    const box = $('steal');
    if (won) {
      b.forgedAt = -Infinity; // перезарядка не мешает вернуть печать
      const tech = { ...this.forged.tech, damage: 30 };
      const events = [...b.onForged(tech, accuracy, now), ...b.stunFoe(2600, now)];
      const form = snapshotHands(state.hands);
      for (const e of events) if (e.type === 'cast') e.forms = [form];
      box.classList.add('won');
      box.querySelector('.steal-title').textContent = 'Печать возвращена!';
      $('steal-sub').textContent = 'Кагэро оглушён своей же жадностью';
      arena.label('返!', '#6fd08c');
      this.handle(events, now);
      sensei.show('Печать возвращена! Кагэро оглушён — бей!', 'good', now, { lock: 2000, ttl: 3000 });
    } else {
      const events = b.stolenHit(22, now);
      box.querySelector('.steal-title').textContent = 'Украдено!';
      $('steal-sub').textContent = 'Кагэро ударил твоей же печатью';
      const hint = 'Кагэро украл печать: повтори её сразу, как только увидишь красные руки';
      b.noteMistake(hint, now);
      this.handle(events, now);
      sensei.show(hint, 'warn', now, { lock: 2200, ttl: 3500 });
    }
    setTimeout(() => (box.hidden = true), 1400);
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
    const playerHp = b ? b.playerHp : state.run.playerHp;
    const enemyHp = b ? b.enemyHp : this.enemy.hp;
    setWidth($('hp-enemy'), pct(enemyHp / this.enemy.hp));
    setWidth($('hp-player'), pct(playerHp / PLAYER_MAX_HP));
    const chakra = b ? b.chakra : state.run.chakra;
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
          playerHp: state.run.playerHp,
          chakra: state.run.chakra,
          stats: state.run.stats,
          mistakes: state.run.mistakes,
          combo: state.run.combo,
          unlocked: state.run.unlocked,
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
    // Удар дракона: рубящий удар ладонью при полной чакре
    if (b.ultimateReady && state.run.unlocked.includes('dragon') && !this.circle.drawing) {
      for (const e of this.chop.update(state.hands, now, state.handsStamp)) {
        if (e.type === 'chop') {
          sfx.chop(e.power);
          this.handle(b.onChop(e.power, now), now);
        } else if (!issue) {
          b.noteMistake(e.hint, now);
          sensei.show(e.hint, 'warn', now, { lock: 1400, ttl: 2600 });
        }
      }
    }
    const drawingMode = b.ultimateReady && state.hands.length === 1 && (isPointing(state.hands[0]) || this.circle.drawing);
    if (drawingMode || (this.circle.drawing && b.ultimateReady)) {
      this.overlayTone = 'near';
      camSeal.hidden = true;
      const r = this.circle.update(state.hands, now);
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
      const res = this.detector.update(state.hands, now);
      const best = res.best;
      showCamSeal(best);
      const forgedNow = this.updateForged(now, best);
      this.overlayTone = best?.passed ? 'pass' : best && best.accuracy >= NEAR_ACCURACY ? 'near' : 'idle';
      if (best && !best.passed && best.accuracy >= NEAR_ACCURACY) this.overlayBad = badFingers(best);
      for (const e of res.events) {
        if (e.type === 'seal') {
          sfx.seal();
          this.lastEval = e.evaluation;
          const form = snapshotHands(state.hands);
          this.chainForms.push(form);
          const best = state.run.bestForms[e.seal];
          if (!best || e.accuracy > best.accuracy) state.run.bestForms[e.seal] = { form, accuracy: e.accuracy };
          this.handle(b.onSeal(e.seal, e.accuracy, now), now);
        } else if (e.type === 'hint' && !issue && !forgedNow) {
          b.noteMistake(e.hint, now);
          sensei.show(e.hint, 'warn', now);
        }
      }
    }

    this.handle(b.tick(now), now);

    // Музыка разгоняется по ходу боя
    const hpLeft = b.enemyHp / this.enemy.hp;
    music.setIntensity(hpLeft < 0.25 ? 3 : hpLeft < 0.55 || b.phase2 ? 2 : 1);

    if (b.phase2 && !this.warnedPhase2) {
      this.warnedPhase2 = true;
      arena.speedLines = 1;
      arena.sfx('ゴゴゴゴ…', arena.w * 0.75, arena.h * 0.3, { color: '#c38bff', size: 70 });
      sfx.roar();
      music.setIntensity(2);
      sensei.show('Кагэро в ярости! Теперь он заряжает удары быстрее', 'warn', now, { lock: 2200, ttl: 3000 });
      this.phase2At = now;
    }

    // В ярости Кагэро крадёт печать, которую игрок выковал в Кузнице
    if (this.enemy.boss && this.forged && b.phase2 && !this.stealDone && !this.steal && this.phase2At && now - this.phase2At > 2600) {
      this.startSteal(now);
    }
    if (this.steal) {
      const left = Math.max(0, (this.steal.until - now) / (this.steal.until - this.steal.start));
      setWidth($('steal-fill'), pct(left));
      if (now >= this.steal.until) this.resolveSteal(false, 0, now);
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

registerScreen('battle', fight);
