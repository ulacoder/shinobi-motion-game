// Кат-ин техники: формы твоих печатей влетают, вспышка — и появляется название приёма.

import { drawHero } from '../characters.js';
import { playVoice } from '../audio.js';
import { $, drawHandForm } from '../ui.js';

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
export function cutin(tech, forms = []) {
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
