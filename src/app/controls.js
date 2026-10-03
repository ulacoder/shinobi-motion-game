// Управление без мыши: «окей» двумя руками — в меню, одной рукой — действие экрана
// (записать заново / пропустить урок / пропустить печать на двоих), и звук, который браузер
// разрешает только после клика или клавиши.

import { sfx, unlockAudio, setSound, isSoundOn, audioLocked } from '../audio.js';
import { $ } from '../ui.js';
import { backIcon, okOneIcon } from '../icons.js';
import { isOkSign } from '../fingers.js';
import { app, state, go } from './context.js';
import { scene } from '../screens/scene.js';

// Звук
const soundBtn = $('btn-sound');
soundBtn.addEventListener('click', () => {
  // если браузер ещё не пустил звук — первый клик только включает его, а не выключает
  if (audioLocked()) {
    unlockAudio();
    setSound(true);
  } else setSound(!isSoundOn());
  soundBtn.setAttribute('aria-pressed', String(isSoundOn()));
});
// Звук разрешается только после действия человека: клик, касание или клавиша.
// Если камера была разрешена раньше, игра стартует сама — поэтому ловим любое первое действие.
for (const type of ['pointerdown', 'keydown', 'touchstart']) addEventListener(type, () => unlockAudio(), { capture: true, passive: true });
const soundHint = $('sound-hint');
soundHint.addEventListener('click', () => unlockAudio());
let soundHintAt = 0;
export function updateSoundHint(now) {
  if (now - soundHintAt < 500) return;
  soundHintAt = now;
  const screen = app.dataset.screen;
  soundHint.hidden = !(audioLocked() && isSoundOn() && screen !== 'intro' && screen !== 'error');
}

// ---------- «Окей» двумя руками — в меню: навигация только руками с любого экрана ----------
// Жест нарочно непривычный: так руки случайно не держат, и он не совпадает ни с одной печатью.
const BACK_HOLD_MS = 1200;
const backCue = $('back-cue');
const backRing = $('back-ring');
$('back-icon').innerHTML = backIcon({ size: 38 });
let backSince = 0;
let oneSince = 0;
let oneArmed = false;
for (const icon of document.querySelectorAll('[data-cue-icon]')) icon.innerHTML = icon.dataset.cueIcon === 'one' ? okOneIcon({ size: 38 }) : backIcon({ size: 38 });
// экраны, где внизу свои подсказки-жесты: «окей» одной рукой — действие экрана, двумя — в меню
const CUE_SCREENS = ['forge', 'dojo'];

function paintCue(screen, cue, p) {
  for (const btn of document.querySelectorAll(`#screen-${screen} [data-cue="${cue}"]`)) {
    btn.classList.toggle('active', p > 0);
    const circle = btn.querySelector('.ring circle');
    if (circle) circle.style.strokeDashoffset = String(119.4 * (1 - p));
  }
}

/** На экране есть своя карточка «В меню» — тогда отдельная всплывающая подсказка не нужна. */
function hasMenuCard(screen) {
  return [...document.querySelectorAll(`#screen-${screen} .choice[data-cue="both"]`)].some((b) => b.offsetParent !== null);
}

export function updateBackGesture(now) {
  const screen = app.dataset.screen;
  // «окей» нельзя выковать в Кузнице, поэтому жест работает и во время записи
  const allowed = !['intro', 'error', 'menu'].includes(screen);
  const okBoth = allowed && state.hands.length === 2 && state.hands.every(isOkSign);
  backSince = okBoth ? backSince || now : 0;
  const p = backSince ? Math.min(1, (now - backSince) / BACK_HOLD_MS) : 0;
  // на печати вдвоём в сцене тоже есть «пропустить» — «окей» одной рукой
  const coopSkip = screen === 'scene' && scene.wait && !scene.wait.done && !$('scene-coop').hidden;
  const cues = CUE_SCREENS.includes(screen) || coopSkip;
  // подсказку видно всегда на спокойных экранах и только во время удержания — в бою и сценах
  // (на итогах, манге и свитке есть свои кнопки — там подсказка появляется только во время удержания)
  const calm = ['chapters'].includes(screen);
  const card = allowed && hasMenuCard(screen);
  backCue.hidden = !allowed || CUE_SCREENS.includes(screen) || card || (!calm && !p);
  backCue.classList.toggle('active', p > 0);
  backCue.classList.toggle('dim', p === 0);
  backRing.style.strokeDashoffset = String(119.4 * (1 - p));
  if (cues || card) paintCue(screen, 'both', p);

  // «окей» одной рукой — действие экрана (записать заново / пропустить урок); после срабатывания
  // ждём, пока руку опустят, чтобы не повторялось
  const okOne = cues && state.hands.length === 1 && isOkSign(state.hands[0]);
  if (!okOne) oneArmed = true;
  oneSince = okOne && oneArmed ? oneSince || now : 0;
  const q = oneSince ? Math.min(1, (now - oneSince) / BACK_HOLD_MS) : 0;
  if (cues) paintCue(screen, 'one', q);
  if (q >= 1) {
    oneSince = 0;
    oneArmed = false;
    sfx.success();
    document.querySelector(`#screen-${screen} [data-cue="one"]`)?.click();
  }

  if (p >= 1) {
    backSince = 0;
    sfx.success();
    go('menu');
  }
}

