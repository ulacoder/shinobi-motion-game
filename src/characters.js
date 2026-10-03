// Персонажи игры — свои, нарисованные кодом на canvas в аниме-стиле:
// толстый контур, заливка «под cel-shading», яркие глаза.
// Координаты: (0, 0) — центр лица, масштаб 1 ≈ портрет высотой ~260 px.

import { drawKagero } from './kagero.js';

const TAU = Math.PI * 2;
const INK = '#1a1320';

function outline(ctx, w = 5) {
  ctx.lineWidth = w;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function shape(ctx, fill, draw, w = 5) {
  ctx.beginPath();
  draw();
  ctx.fillStyle = fill;
  ctx.fill();
  outline(ctx, w);
}

function animeEye(ctx, x, y, dir, { iris = '#e8a93a', w = 22, h = 13, angry = true, glow = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  // белок
  ctx.beginPath();
  ctx.moveTo(-w, 2);
  ctx.quadraticCurveTo(-w * 0.2, -h, w, angry ? -h * 0.2 : -2);
  ctx.quadraticCurveTo(w * 0.2, h * 0.9, -w, 2);
  ctx.fillStyle = '#fbf6ee';
  ctx.fill();
  // радужка
  ctx.save();
  ctx.clip();
  if (glow) {
    ctx.shadowColor = iris;
    ctx.shadowBlur = 18 * glow;
  }
  // радужка с градиентом: тёмная сверху, светлая снизу — глаз «блестит»
  const ig = ctx.createLinearGradient(0, -h, 0, h);
  ig.addColorStop(0, shade(iris, -70));
  ig.addColorStop(0.55, iris);
  ig.addColorStop(1, shade(iris, 60));
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.ellipse(w * 0.1, -1, h * 0.8, h * 1.05, 0, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = shade(iris, -90);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(w * 0.12, -1, h * 0.38, h * 0.62, 0, 0, TAU);
  ctx.fill();
  // тень века на белке
  ctx.fillStyle = 'rgba(80,60,90,0.22)';
  ctx.fillRect(-w, -h, w * 2, h * 0.55);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(w * 0.28, -h * 0.35, h * 0.22, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-w * 0.06, h * 0.42, h * 0.1, 0, TAU);
  ctx.fill();
  ctx.restore();
  // нижнее веко — тонкий штрих
  ctx.beginPath();
  ctx.moveTo(-w * 0.55, h * 0.55);
  ctx.quadraticCurveTo(w * 0.1, h * 0.85, w * 0.7, h * 0.3);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(26,19,32,0.55)';
  ctx.stroke();
  // верхнее веко — толстая линия
  ctx.beginPath();
  ctx.moveTo(-w - 2, 3);
  ctx.quadraticCurveTo(-w * 0.2, -h - 2, w + 3, angry ? -h * 0.25 : -3);
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // ресница-«хвостик» во внешнем углу
  ctx.beginPath();
  ctx.moveTo(w + 1, angry ? -h * 0.25 : -3);
  ctx.lineTo(w + 8, angry ? -h * 0.55 : -8);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

// ---------- герои: Улагат, Таир, Данияр ----------

export const HERO_LOOKS = {
  ulagat: { hair: '#1d5a70', hairBack: '#17485a', shine: 'rgba(160,230,240,0.7)', scarf: '#c9302c', scarfDark: '#a82622', iris: '#e3a23a', jacket: '#2d3a5c' },
  tair: { hair: '#2b1d18', hairBack: '#1c120e', shine: 'rgba(200,170,150,0.55)', scarf: '#2f8a52', scarfDark: '#236b3f', iris: '#7fd88f', jacket: '#3a2f2a', scar: true },
  daniyar: { hair: '#b0452a', hairBack: '#8a3420', shine: 'rgba(255,200,170,0.6)', scarf: '#e0a93a', scarfDark: '#b8862a', iris: '#58d0ff', jacket: '#2a3a3a', topknot: true },
};

export function drawHero(ctx, t = 0, { mood = 'calm', hero = 'ulagat' } = {}) {
  const L = HERO_LOOKS[hero] ?? HERO_LOOKS.ulagat;
  const sway = Math.sin(t * 2) * 1.5;
  ctx.save();
  ctx.translate(0, sway);

  // концы повязки развеваются за головой — сужаются к кончику
  const flutter = Math.sin(t * 5) * 6;
  for (const [dy, len] of [[0, 1], [12, 0.82]]) {
    shape(ctx, '#1f2a44', () => {
      ctx.moveTo(58, -60 + dy);
      ctx.bezierCurveTo(90, -74 + dy + flutter, 110 * len, -40 + dy - flutter, 140 * len, -52 + dy - flutter * 1.4);
      ctx.bezierCurveTo(112 * len, -30 + dy - flutter, 92, -50 + dy + flutter * 0.5, 60, -46 + dy);
      ctx.closePath();
    }, 3.5);
  }

  // плечи и куртка
  shape(ctx, L.jacket, () => {
    ctx.moveTo(-120, 190);
    ctx.quadraticCurveTo(-110, 90, -40, 78);
    ctx.lineTo(40, 78);
    ctx.quadraticCurveTo(110, 90, 120, 190);
    ctx.closePath();
  });
  // тень на правой стороне куртки, швы, молния и ремень с подсумком
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-120, 190);
  ctx.quadraticCurveTo(-110, 90, -40, 78);
  ctx.lineTo(40, 78);
  ctx.quadraticCurveTo(110, 90, 120, 190);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(30, 70, 100, 130);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(-110, 90, 30, 100);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-86, 100);
  ctx.quadraticCurveTo(-74, 140, -78, 190);
  ctx.moveTo(86, 100);
  ctx.quadraticCurveTo(74, 140, 78, 190);
  ctx.moveTo(4, 120);
  ctx.lineTo(4, 190);
  ctx.stroke();
  ctx.restore();
  shape(ctx, '#4a3426', () => {
    ctx.moveTo(-96, 120);
    ctx.lineTo(70, 190);
    ctx.lineTo(96, 190);
    ctx.lineTo(-90, 104);
    ctx.closePath();
  }, 3);
  shape(ctx, '#c9a24a', () => ctx.roundRect(-40, 132, 16, 12, 2), 2.5);
  shape(ctx, '#3a2a20', () => ctx.roundRect(36, 158, 26, 30, 4), 3);
  // шарф
  shape(ctx, L.scarf, () => {
    ctx.moveTo(-58, 62);
    ctx.quadraticCurveTo(0, 96, 58, 62);
    ctx.lineTo(62, 92);
    ctx.quadraticCurveTo(0, 124, -62, 92);
    ctx.closePath();
  });
  shape(ctx, L.scarfDark, () => {
    ctx.moveTo(30, 96);
    ctx.lineTo(62, 170);
    ctx.lineTo(40, 176);
    ctx.lineTo(14, 104);
    ctx.closePath();
  }, 4);
  // складки и полоса на шарфе
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-40, 84);
  ctx.quadraticCurveTo(-20, 100, -6, 104);
  ctx.moveTo(18, 104);
  ctx.quadraticCurveTo(36, 98, 48, 86);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-56, 78);
  ctx.quadraticCurveTo(0, 108, 56, 78);
  ctx.stroke();

  // шея
  shape(ctx, '#e9bf98', () => {
    ctx.rect(-18, 40, 36, 30);
  }, 4);
  ctx.fillStyle = 'rgba(160,90,70,0.35)';
  ctx.fillRect(-16, 42, 32, 12);

  // волосы сзади — острые пряди
  ctx.beginPath();
  const back = [[-86, 10], [-118, -20], [-92, -40], [-120, -80], [-80, -84], [-96, -130], [-44, -108], [-30, -150], [8, -112], [40, -150], [48, -104], [96, -126], [82, -80], [120, -70], [90, -36], [116, -8], [84, 12]];
  ctx.moveTo(back[0][0], back[0][1]);
  for (const [x, y] of back.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = L.hairBack;
  ctx.fill();
  outline(ctx, 5);
  // пряди внутри шапки волос
  ctx.strokeStyle = shade(L.hairBack, -25);
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const [x, y] of back.filter((_, i) => i % 2)) {
    ctx.moveTo(x * 0.35, -60 + y * 0.2);
    ctx.quadraticCurveTo(x * 0.6, y * 0.7 - 10, x * 0.85, y * 0.85);
  }
  ctx.stroke();
  if (L.topknot) {
    // пучок на макушке
    shape(ctx, L.hairBack, () => ctx.ellipse(0, -150, 30, 24, 0, 0, TAU));
    shape(ctx, L.scarf, () => ctx.rect(-16, -132, 32, 10), 3);
  }

  // уши
  for (const d of [-1, 1]) {
    shape(ctx, '#ebbd96', () => ctx.ellipse(d * 66, -2, 11, 17, d * 0.2, 0, TAU), 4);
    ctx.strokeStyle = 'rgba(150,80,60,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(d * 66, -2, 6, d > 0 ? -1.2 : 1.9, d > 0 ? 1.2 : 4.3);
    ctx.stroke();
  }

  // лицо
  shape(ctx, '#f1c9a5', () => {
    ctx.moveTo(-64, -40);
    ctx.quadraticCurveTo(-68, 20, -30, 52);
    ctx.quadraticCurveTo(0, 70, 30, 52);
    ctx.quadraticCurveTo(68, 20, 64, -40);
    ctx.closePath();
  });
  // тень под волосами
  ctx.fillStyle = 'rgba(190,120,90,0.35)';
  ctx.beginPath();
  ctx.moveTo(-62, -36);
  ctx.quadraticCurveTo(0, -18, 62, -36);
  ctx.lineTo(62, -22);
  ctx.quadraticCurveTo(0, -6, -62, -22);
  ctx.fill();
  // объём лица: тень по правой скуле и подбородку, румянец, блик на носу
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-64, -40);
  ctx.quadraticCurveTo(-68, 20, -30, 52);
  ctx.quadraticCurveTo(0, 70, 30, 52);
  ctx.quadraticCurveTo(68, 20, 64, -40);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = 'rgba(190,110,85,0.22)';
  ctx.beginPath();
  ctx.moveTo(44, -40);
  ctx.quadraticCurveTo(58, 10, 20, 62);
  ctx.lineTo(80, 62);
  ctx.lineTo(80, -40);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(235,120,110,0.22)';
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(d * 36, 24, 13, 6, 0, 0, TAU);
    ctx.fill();
  }

  // повязка со своим знаком (три волны)
  shape(ctx, '#1f2a44', () => {
    ctx.moveTo(-70, -64);
    ctx.quadraticCurveTo(0, -80, 70, -64);
    ctx.lineTo(70, -40);
    ctx.quadraticCurveTo(0, -56, -70, -40);
    ctx.closePath();
  }, 4);
  shape(ctx, '#b9c3cf', () => {
    ctx.roundRect(-30, -74, 60, 28, 4);
  }, 4);
  // фаска и заклёпки на металлической пластине
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-26, -70);
  ctx.lineTo(26, -70);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,50,70,0.5)';
  ctx.beginPath();
  ctx.moveTo(-26, -50);
  ctx.lineTo(26, -50);
  ctx.stroke();
  ctx.fillStyle = '#6b7686';
  for (const [x, y] of [[-24, -68], [24, -68], [-24, -52], [24, -52]]) {
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#4b5566';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const y = -66 + i * 7;
    ctx.moveTo(-18, y);
    ctx.bezierCurveTo(-9, y - 5, -3, y + 5, 6, y);
    ctx.bezierCurveTo(12, y - 4, 16, y + 3, 20, y);
    ctx.stroke();
  }

  // чёлка
  ctx.beginPath();
  const bangs = [[-70, -60], [-58, -20], [-44, -52], [-30, -10], [-16, -54], [0, -16], [14, -56], [30, -14], [42, -52], [58, -22], [70, -60], [40, -96], [-40, -96]];
  ctx.moveTo(bangs[0][0], bangs[0][1]);
  for (const [x, y] of bangs.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = L.hair;
  ctx.fill();
  outline(ctx, 5);
  // пряди чёлки: тёмные штрихи от корней к кончикам
  ctx.strokeStyle = shade(L.hair, -35);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 1; i < 10; i += 2) {
    const [x, y] = bangs[i];
    ctx.moveTo(x * 0.6, -84);
    ctx.quadraticCurveTo(x * 0.85, (y - 84) / 2 - 20, x, y - 6);
  }
  ctx.stroke();
  // «кольцо» блика на волосах из коротких штрихов
  ctx.strokeStyle = L.shine;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const x = -42 + i * 16;
    ctx.moveTo(x, -82 + Math.abs(i - 2.5) * 1.5);
    ctx.lineTo(x + 8, -86 + Math.abs(i - 2.5) * 1.5);
  }
  ctx.stroke();

  // глаза
  const angry = mood !== 'calm';
  animeEye(ctx, -28, 4, -1, { iris: L.iris, angry });
  animeEye(ctx, 28, 4, 1, { iris: L.iris, angry });
  if (L.scar) {
    // шрам на щеке
    ctx.strokeStyle = '#b5705a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(34, 18);
    ctx.lineTo(48, 34);
    ctx.moveTo(36, 30);
    ctx.lineTo(44, 24);
    ctx.stroke();
  }
  // брови
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d * 14, angry ? -12 : -16);
    ctx.lineTo(d * 48, angry ? -22 : -20);
    ctx.stroke();
  }
  // нос и рот
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(2, 18);
  ctx.lineTo(-3, 26);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-2, 14, 2, 4, 0.3, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (mood === 'shout') {
    ctx.moveTo(-14, 36);
    ctx.quadraticCurveTo(0, 56, 14, 36);
    ctx.closePath();
    ctx.fillStyle = '#5b1e22';
    ctx.fill();
  } else {
    ctx.moveTo(-10, 38);
    ctx.quadraticCurveTo(2, 34, 12, 36);
  }
  ctx.stroke();
  ctx.restore();
}

// ---------- сенсей: Рю ----------

export function drawSensei(ctx, t = 0) {
  const sway = Math.sin(t * 1.5) * 1.2;
  ctx.save();
  ctx.translate(0, sway);
  shape(ctx, '#6b4a33', () => {
    ctx.moveTo(-124, 190);
    ctx.quadraticCurveTo(-112, 84, -40, 72);
    ctx.lineTo(40, 72);
    ctx.quadraticCurveTo(112, 84, 124, 190);
    ctx.closePath();
  });
  shape(ctx, '#e8dcc0', () => {
    ctx.moveTo(-40, 72);
    ctx.lineTo(0, 150);
    ctx.lineTo(40, 72);
    ctx.closePath();
  }, 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-80, 110);
  ctx.quadraticCurveTo(-70, 150, -76, 190);
  ctx.moveTo(80, 110);
  ctx.quadraticCurveTo(70, 150, 76, 190);
  ctx.stroke();
  // голова (лысая)
  shape(ctx, '#e7bf98', () => {
    ctx.ellipse(0, -14, 64, 76, 0, 0, TAU);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-20, -66, 18, 9, -0.4, 0, TAU);
  ctx.fill();
  // борода
  shape(ctx, '#f2efe6', () => {
    ctx.moveTo(-50, 20);
    ctx.quadraticCurveTo(-40, 110, 0, 140);
    ctx.quadraticCurveTo(40, 110, 50, 20);
    ctx.quadraticCurveTo(0, 48, -50, 20);
    ctx.closePath();
  }, 4);
  // длинные брови
  for (const d of [-1, 1]) {
    shape(ctx, '#f2efe6', () => {
      ctx.moveTo(d * 8, -22);
      ctx.quadraticCurveTo(d * 40, -40, d * 86, -8);
      ctx.quadraticCurveTo(d * 44, -22, d * 10, -12);
      ctx.closePath();
    }, 3);
  }
  // закрытые глаза
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d * 16, 0);
    ctx.quadraticCurveTo(d * 30, 8, d * 44, 0);
    ctx.stroke();
  }
  // морщины на лбу и у глаз
  ctx.strokeStyle = 'rgba(120,70,50,0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (const y of [-58, -48]) {
    ctx.moveTo(-26, y);
    ctx.quadraticCurveTo(0, y - 5, 26, y);
  }
  for (const d of [-1, 1]) {
    ctx.moveTo(d * 48, 4);
    ctx.lineTo(d * 56, 10);
    ctx.moveTo(d * 47, 10);
    ctx.lineTo(d * 54, 16);
  }
  ctx.stroke();
  // пряди бороды
  ctx.strokeStyle = 'rgba(150,140,130,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) {
    ctx.moveTo(i * 10, 40);
    ctx.quadraticCurveTo(i * 9, 90, i * 5, 128);
  }
  ctx.stroke();
  // чётки на шее
  for (let i = 0; i < 13; i++) {
    const a = Math.PI * (0.12 + (i / 12) * 0.76);
    const x = Math.cos(a) * 74;
    const y = 86 + Math.sin(a) * 52;
    shape(ctx, i === 6 ? '#c9302c' : '#5a3a22', () => ctx.arc(x, y, i === 6 ? 8 : 6, 0, TAU), 2.5);
  }
  ctx.restore();
}

// ---------- враги ----------

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

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  const r = c(n >> 16);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return `rgb(${r},${g},${b})`;
}

/** Рисует любого персонажа. who: ulagat | tair | daniyar | hero | sensei | scout | oni | warlord */
export function drawCharacter(ctx, who, t, opts = {}) {
  if (who === 'hero') return drawHero(ctx, t, opts);
  if (HERO_LOOKS[who]) return drawHero(ctx, t, { ...opts, hero: who });
  if (who === 'sensei') return drawSensei(ctx, t);
  if (who === 'scout') return drawScout(ctx, t, opts);
  if (who === 'oni') return drawOni(ctx, t, opts);
  if (who === 'warlord') return drawKagero(ctx, t, opts);
}

/**
 * Портрет в рамке для диалогов и HUD: фон-«манга» с линиями скорости и персонаж по грудь.
 */
export function drawPortrait(canvas, who, { t = 0, tint, mood, bg = '#2b2f6a', lines = true, close = false } = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, bg);
  g.addColorStop(1, '#0f1030');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // свет за головой — персонаж отделяется от фона
  const rim = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, w * 0.6);
  rim.addColorStop(0, 'rgba(255,240,210,0.28)');
  rim.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, w, h);
  // полутоновые точки, как в манге
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  const step = Math.max(6, Math.round(w / 34));
  for (let y = 0; y < h; y += step) {
    for (let x = (y / step) % 2 ? step / 2 : 0; x < w; x += step) {
      const r = (step / 2) * (y / h) * 0.8;
      if (r < 0.4) continue;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  }
  if (lines) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * w * 0.25, h * 0.45 + Math.sin(a) * h * 0.25);
      ctx.lineTo(w / 2 + Math.cos(a) * w, h * 0.45 + Math.sin(a) * h);
      ctx.stroke();
    }
  }
  // иконка в HUD — крупный план лица; в диалоге — по грудь
  const zoom = close ? 1.5 : 1;
  const s = (Math.min(w, h) / 300) * (who === 'warlord' ? 0.72 : who === 'oni' ? 0.85 : 1) * zoom;
  const offsetY = close ? (who === 'warlord' ? 0.66 : who === 'oni' ? 0.58 : who === 'scout' ? 0.56 : 0.62) : who === 'warlord' ? 0.6 : who === 'scout' ? 0.46 : who === 'oni' ? 0.56 : 0.5;
  ctx.save();
  ctx.translate(w / 2, h * offsetY);
  ctx.scale(s, s);
  drawCharacter(ctx, who, t, { tint, mood });
  ctx.restore();
  if (close) {
    // рамка-оттиск: тушь и тонкая золотая линия внутри
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(3, w * 0.05);
    ctx.strokeRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(240,182,74,0.9)';
    ctx.lineWidth = Math.max(1.5, w * 0.018);
    const inset = w * 0.06;
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  }
  ctx.restore();
}
