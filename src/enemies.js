// Пешки клана Затмения: подпешка-ниндзя и Близнец Пепла в маске Они. Кагэро — src/kagero.js.

import { TAU, INK, outline, shape, shade } from './char-kit.js';


/** Подпешка: ниндзя в капюшоне и маске. Полный рост, лицо в (0,0). */
export function drawScout(ctx, t = 0, { tint = '#6d7a8c', state = 'idle', charge = 0 } = {}) {
  const crouch = state === 'charging' ? charge * 10 : 0;
  ctx.save();
  ctx.translate(0, crouch);
  // тело
  shape(ctx, shade(tint, -30), () => {
    ctx.moveTo(-70, 60);
    ctx.lineTo(-96, 230);
    ctx.lineTo(-30, 230);
    ctx.lineTo(0, 150);
    ctx.lineTo(30, 230);
    ctx.lineTo(96, 230);
    ctx.lineTo(70, 60);
    ctx.closePath();
  });
  // обмотки на ногах: косые полосы
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-70, 60);
  ctx.lineTo(-96, 230);
  ctx.lineTo(-30, 230);
  ctx.lineTo(0, 150);
  ctx.lineTo(30, 230);
  ctx.lineTo(96, 230);
  ctx.lineTo(70, 60);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let y = 160; y < 232; y += 12) {
    ctx.moveTo(-100, y);
    ctx.lineTo(-20, y + 8);
    ctx.moveTo(20, y + 8);
    ctx.lineTo(100, y);
  }
  ctx.stroke();
  // сетчатая кольчуга под одеждой на груди
  ctx.strokeStyle = 'rgba(200,210,230,0.18)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = -60; x <= 60; x += 9) {
    ctx.moveTo(x, 62);
    ctx.lineTo(x + 30, 116);
    ctx.moveTo(x + 30, 62);
    ctx.lineTo(x, 116);
  }
  ctx.stroke();
  ctx.restore();
  // ступни в таби
  for (const d of [-1, 1]) shape(ctx, '#22202c', () => ctx.roundRect(d * 63 - 26, 222, 52, 16, 6), 4);
  // пояс
  shape(ctx, '#2a2233', () => ctx.rect(-74, 118, 148, 18), 4);
  // подсумки на поясе
  for (const x of [10, 40]) {
    shape(ctx, '#3a3044', () => ctx.roundRect(x, 130, 22, 26, 4), 3);
    ctx.fillStyle = '#c9a24a';
    ctx.beginPath();
    ctx.arc(x + 11, 138, 2.5, 0, TAU);
    ctx.fill();
  }
  // сюрикен на поясе
  ctx.save();
  ctx.translate(-40, 127);
  ctx.rotate(t * 0.5);
  shape(ctx, '#c9d1dc', () => {
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4;
      ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
      ctx.lineTo(Math.cos(a + 0.3) * 13, Math.sin(a + 0.3) * 13);
      ctx.lineTo(Math.cos(a + 0.9) * 4, Math.sin(a + 0.9) * 4);
    }
  }, 2.5);
  ctx.restore();
  // складки одежды
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-50, 150);
  ctx.lineTo(-62, 220);
  ctx.moveTo(50, 150);
  ctx.lineTo(62, 220);
  ctx.stroke();
  // шарф-лоскуты за спиной
  const wave = Math.sin(t * 6) * 10;
  shape(ctx, '#8b2a2a', () => {
    ctx.moveTo(40, 50);
    ctx.quadraticCurveTo(110, 40 + wave, 150, 70 - wave);
    ctx.lineTo(140, 86);
    ctx.quadraticCurveTo(100, 70, 44, 72);
    ctx.closePath();
  }, 4);
  // рука с кунаем (занесена при заряде)
  const armUp = state === 'charging' ? charge : 0;
  ctx.save();
  ctx.translate(76, 80);
  ctx.rotate(-0.6 - armUp * 1.6);
  shape(ctx, shade(tint, -30), () => ctx.roundRect(-10, 0, 20, 80, 8), 4);
  // наруч-тэкко с пластиной
  shape(ctx, '#3b3646', () => ctx.roundRect(-12, 40, 24, 34, 5), 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 46);
  ctx.lineTo(-8, 68);
  ctx.stroke();
  shape(ctx, '#c9d1dc', () => {
    ctx.moveTo(0, 80);
    ctx.lineTo(-8, 96);
    ctx.lineTo(0, 140);
    ctx.lineTo(8, 96);
    ctx.closePath();
  }, 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, 100);
  ctx.lineTo(0, 132);
  ctx.stroke();
  // кольцо на рукояти
  ctx.beginPath();
  ctx.arc(0, 78, 6, 0, TAU);
  outline(ctx, 3);
  ctx.restore();
  // голова в капюшоне
  shape(ctx, tint, () => {
    ctx.moveTo(-70, 60);
    ctx.quadraticCurveTo(-86, -70, 0, -90);
    ctx.quadraticCurveTo(86, -70, 70, 60);
    ctx.quadraticCurveTo(0, 80, -70, 60);
    ctx.closePath();
  });
  // складки капюшона
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-60, -40);
  ctx.quadraticCurveTo(-72, 0, -60, 50);
  ctx.moveTo(60, -40);
  ctx.quadraticCurveTo(72, 0, 60, 50);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(-8, -10, 74, Math.PI * 1.15, Math.PI * 1.4);
  ctx.stroke();
  // налобная пластина-хатиганэ поверх капюшона
  shape(ctx, '#3b4250', () => {
    ctx.moveTo(-46, -62);
    ctx.quadraticCurveTo(0, -78, 46, -62);
    ctx.lineTo(42, -46);
    ctx.quadraticCurveTo(0, -60, -42, -46);
    ctx.closePath();
  }, 3.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-36, -62);
  ctx.quadraticCurveTo(0, -74, 36, -62);
  ctx.stroke();
  ctx.fillStyle = '#cc3325';
  ctx.beginPath();
  ctx.arc(0, -60, 5, 0, TAU);
  ctx.fill();
  // лицо в тени
  shape(ctx, '#2b2130', () => {
    ctx.moveTo(-48, -30);
    ctx.quadraticCurveTo(0, -50, 48, -30);
    ctx.quadraticCurveTo(52, 30, 0, 48);
    ctx.quadraticCurveTo(-52, 30, -48, -30);
    ctx.closePath();
  }, 4);
  // маска на нижней части лица
  shape(ctx, shade(tint, -45), () => {
    ctx.moveTo(-50, 6);
    ctx.quadraticCurveTo(0, 0, 50, 6);
    ctx.quadraticCurveTo(46, 40, 0, 50);
    ctx.quadraticCurveTo(-46, 40, -50, 6);
    ctx.closePath();
  }, 4);
  // глаза-щёлки
  const glow = 0.5 + (state === 'charging' ? charge : 0.2);
  for (const d of [-1, 1]) {
    ctx.save();
    ctx.shadowColor = `rgba(255,240,180,${glow})`;
    ctx.shadowBlur = 14 + charge * 20;
    ctx.fillStyle = state === 'stunned' ? '#aaa' : '#fff6cf';
    ctx.beginPath();
    ctx.moveTo(d * 8, -14);
    ctx.lineTo(d * 38, -22);
    ctx.lineTo(d * 34, -10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Пешка: Близнец Пепла — маска Они и капюшон. */
export function drawOni(ctx, t = 0, { tint = '#cc3325', state = 'idle', charge = 0 } = {}) {
  const charging = state === 'charging';
  ctx.save();
  // плащ
  shape(ctx, '#15131f', () => {
    ctx.moveTo(-90, 30);
    ctx.quadraticCurveTo(-150, 140, -120, 240);
    for (let i = 0; i <= 8; i++) ctx.lineTo(-120 + i * 30, 240 + (i % 2 ? -24 : 6) + Math.sin(t * 3 + i) * 6);
    ctx.quadraticCurveTo(150, 140, 90, 30);
    ctx.closePath();
  });
  // тлеющий край плаща
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,110,50,${0.35 + 0.2 * Math.sin(t * 5)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const x = -120 + i * 30;
    const y = 240 + (i % 2 ? -24 : 6) + Math.sin(t * 3 + i) * 6;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  // складки плаща
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-70, 70);
  ctx.quadraticCurveTo(-90, 160, -80, 230);
  ctx.moveTo(60, 80);
  ctx.quadraticCurveTo(80, 160, 70, 228);
  ctx.stroke();
  // пепельные волосы
  shape(ctx, '#b8b3ae', () => {
    ctx.moveTo(-96, 40);
    ctx.lineTo(-110, -40);
    ctx.lineTo(-80, -100);
    ctx.lineTo(-30, -130);
    ctx.lineTo(30, -130);
    ctx.lineTo(80, -100);
    ctx.lineTo(110, -40);
    ctx.lineTo(96, 40);
    ctx.closePath();
  });
  // пряди волос
  ctx.strokeStyle = 'rgba(80,74,70,0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = -4; i <= 4; i++) {
    ctx.moveTo(i * 10, -126);
    ctx.quadraticCurveTo(i * 22, -60, i * 26, 36);
  }
  ctx.stroke();
  // рога
  for (const d of [-1, 1]) {
    shape(ctx, '#efe6cf', () => {
      ctx.moveTo(d * 44, -80);
      ctx.quadraticCurveTo(d * 104, -130, d * 92, -196);
      ctx.quadraticCurveTo(d * 76, -136, d * 18, -100);
      ctx.closePath();
    });
  }
  // кольца на рогах
  ctx.strokeStyle = 'rgba(120,100,80,0.6)';
  ctx.lineWidth = 2.5;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    for (let i = 1; i <= 4; i++) {
      const k = i / 5;
      const x = d * (44 + (92 - 44) * k * 1.1);
      const y = -80 - 110 * k;
      ctx.moveTo(x - 10 * d, y + 6);
      ctx.lineTo(x + 12 * d, y - 4);
    }
    ctx.stroke();
  }
  // маска
  shape(ctx, tint, () => {
    ctx.moveTo(0, -110);
    ctx.bezierCurveTo(80, -110, 96, -30, 88, 20);
    ctx.bezierCurveTo(80, 80, 40, 110, 0, 112);
    ctx.bezierCurveTo(-40, 110, -80, 80, -88, 20);
    ctx.bezierCurveTo(-96, -30, -80, -110, 0, -110);
  }, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(10, -108);
  ctx.bezierCurveTo(80, -100, 96, -30, 88, 20);
  ctx.bezierCurveTo(80, 80, 40, 110, 10, 112);
  ctx.bezierCurveTo(50, 60, 60, -40, 10, -108);
  ctx.fill();
  // трещина на маске и блик лака
  ctx.strokeStyle = 'rgba(20,10,15,0.7)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-30, -104);
  ctx.lineTo(-22, -84);
  ctx.lineTo(-34, -70);
  ctx.lineTo(-26, -56);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(-6, -10, 80, Math.PI * 1.1, Math.PI * 1.32);
  ctx.stroke();
  // брови
  for (const d of [-1, 1]) {
    shape(ctx, INK, () => {
      ctx.moveTo(d * 14, -34);
      ctx.lineTo(d * 70, -58);
      ctx.lineTo(d * 66, -42);
      ctx.lineTo(d * 16, -24);
      ctx.closePath();
    }, 2);
  }
  // глаза
  for (const d of [-1, 1]) {
    if (state === 'stunned') {
      ctx.strokeStyle = '#efe6cf';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(d * 44 - 12, -12);
      ctx.lineTo(d * 44 + 12, 8);
      ctx.moveTo(d * 44 + 12, -12);
      ctx.lineTo(d * 44 - 12, 8);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(255,220,120,0.9)';
      ctx.shadowBlur = 16 + (charging ? charge * 30 : 0);
      ctx.fillStyle = '#ffe28a';
      ctx.beginPath();
      ctx.ellipse(d * 44, -4, 16, 9 + (charging ? 3 : 0), d * -0.25, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  // золотые обводы маски вокруг глаз
  ctx.strokeStyle = '#d4a53a';
  ctx.lineWidth = 3;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(d * 44, -4, 24, 15, d * -0.25, 0, TAU);
    ctx.stroke();
  }
  // рот с клыками
  shape(ctx, INK, () => {
    ctx.moveTo(-46, 46);
    ctx.quadraticCurveTo(0, 30 + (charging ? -10 : 0), 46, 46);
    ctx.quadraticCurveTo(0, 86, -46, 46);
  }, 2);
  for (const d of [-1, 1]) {
    ctx.fillStyle = '#efe6cf';
    ctx.beginPath();
    ctx.moveTo(d * 30, 42);
    ctx.lineTo(d * 22, 64);
    ctx.lineTo(d * 14, 40);
    ctx.fill();
  }
  // чётки из крупных бусин на шее
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * (0.1 + (i / 10) * 0.8);
    const x = Math.cos(a) * 92;
    const y = 112 + Math.sin(a) * 40;
    shape(ctx, i === 5 ? '#cc3325' : '#3a2a22', () => ctx.arc(x, y, i === 5 ? 12 : 9, 0, TAU), 3);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 2.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Главный злодей Кагэро нарисован отдельно и подробно — src/kagero.js

