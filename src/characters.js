// Персонажи игры — свои, нарисованные кодом на canvas в аниме-стиле:
// толстый контур, заливка «под cel-shading», яркие глаза.
// Координаты: (0, 0) — центр лица, масштаб 1 ≈ портрет высотой ~260 px.

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
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(w * 0.1, -1, h * 0.8, h * 1.05, 0, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(w * 0.12, -1, h * 0.38, h * 0.62, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(w * 0.28, -h * 0.35, h * 0.22, 0, TAU);
  ctx.fill();
  ctx.restore();
  // верхнее веко — толстая линия
  ctx.beginPath();
  ctx.moveTo(-w - 2, 3);
  ctx.quadraticCurveTo(-w * 0.2, -h - 2, w + 3, angry ? -h * 0.25 : -3);
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
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

  // плечи и куртка
  shape(ctx, L.jacket, () => {
    ctx.moveTo(-120, 190);
    ctx.quadraticCurveTo(-110, 90, -40, 78);
    ctx.lineTo(40, 78);
    ctx.quadraticCurveTo(110, 90, 120, 190);
    ctx.closePath();
  });
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

  // шея
  shape(ctx, '#e9bf98', () => {
    ctx.rect(-18, 40, 36, 30);
  }, 4);

  // волосы сзади — острые пряди
  ctx.beginPath();
  const back = [[-86, 10], [-118, -20], [-92, -40], [-120, -80], [-80, -84], [-96, -130], [-44, -108], [-30, -150], [8, -112], [40, -150], [48, -104], [96, -126], [82, -80], [120, -70], [90, -36], [116, -8], [84, 12]];
  ctx.moveTo(back[0][0], back[0][1]);
  for (const [x, y] of back.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = L.hairBack;
  ctx.fill();
  outline(ctx, 5);
  if (L.topknot) {
    // пучок на макушке
    shape(ctx, L.hairBack, () => ctx.ellipse(0, -150, 30, 24, 0, 0, TAU));
    shape(ctx, L.scarf, () => ctx.rect(-16, -132, 32, 10), 3);
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
  // блик на волосах
  ctx.strokeStyle = L.shine;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-30, -84);
  ctx.lineTo(-8, -80);
  ctx.moveTo(10, -84);
  ctx.lineTo(28, -82);
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
  // пояс
  shape(ctx, '#2a2233', () => ctx.rect(-74, 118, 148, 18), 4);
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
  shape(ctx, '#c9d1dc', () => {
    ctx.moveTo(0, 80);
    ctx.lineTo(-8, 96);
    ctx.lineTo(0, 140);
    ctx.lineTo(8, 96);
    ctx.closePath();
  }, 3);
  ctx.restore();
  // голова в капюшоне
  shape(ctx, tint, () => {
    ctx.moveTo(-70, 60);
    ctx.quadraticCurveTo(-86, -70, 0, -90);
    ctx.quadraticCurveTo(86, -70, 70, 60);
    ctx.quadraticCurveTo(0, 80, -70, 60);
    ctx.closePath();
  });
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
  // рога
  for (const d of [-1, 1]) {
    shape(ctx, '#efe6cf', () => {
      ctx.moveTo(d * 44, -80);
      ctx.quadraticCurveTo(d * 104, -130, d * 92, -196);
      ctx.quadraticCurveTo(d * 76, -136, d * 18, -100);
      ctx.closePath();
    });
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
  ctx.restore();
}

/** Главный злодей Кагэро: самурайский шлем с гербом-затмением, светящиеся глаза. */
export function drawWarlord(ctx, t = 0, { state = 'idle', charge = 0, phase2 = false } = {}) {
  const charging = state === 'charging';
  ctx.save();
  // плащ
  const flap = Math.sin(t * 2.4) * 10;
  shape(ctx, '#5a1622', () => {
    ctx.moveTo(-110, 40);
    ctx.quadraticCurveTo(-200, 160, -170 - flap, 260);
    ctx.lineTo(170 + flap, 260);
    ctx.quadraticCurveTo(200, 160, 110, 40);
    ctx.closePath();
  });
  // доспех торса
  shape(ctx, '#241a33', () => {
    ctx.moveTo(-80, 50);
    ctx.lineTo(-70, 230);
    ctx.lineTo(70, 230);
    ctx.lineTo(80, 50);
    ctx.closePath();
  });
  ctx.strokeStyle = '#6b2fb3';
  ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-72, 100 + i * 32);
    ctx.lineTo(72, 100 + i * 32);
    ctx.stroke();
  }
  // наплечники
  for (const d of [-1, 1]) {
    shape(ctx, '#2f2342', () => {
      ctx.moveTo(d * 60, 40);
      ctx.lineTo(d * 170, 70);
      ctx.lineTo(d * 150, 150);
      ctx.lineTo(d * 70, 120);
      ctx.closePath();
    });
    ctx.strokeStyle = '#d4a53a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(d * 72, 70);
    ctx.lineTo(d * 158, 92);
    ctx.stroke();
  }
  // шлем
  shape(ctx, '#2f2342', () => {
    ctx.moveTo(-96, 0);
    ctx.quadraticCurveTo(-100, -110, 0, -118);
    ctx.quadraticCurveTo(100, -110, 96, 0);
    ctx.lineTo(120, 30);
    ctx.lineTo(-120, 30);
    ctx.closePath();
  });
  // герб-затмение
  ctx.save();
  ctx.translate(0, -150);
  ctx.shadowColor = '#f0c35a';
  ctx.shadowBlur = 20 + (phase2 ? 20 : 0);
  ctx.strokeStyle = '#f0c35a';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, TAU);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0d0a14';
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, TAU);
  ctx.fill();
  outline(ctx, 3);
  ctx.restore();
  shape(ctx, '#2f2342', () => ctx.rect(-10, -118, 20, 30), 4);
  // лицо в тени и маска-мэмпо
  shape(ctx, '#0d0a14', () => {
    ctx.moveTo(-70, -30);
    ctx.quadraticCurveTo(0, -46, 70, -30);
    ctx.lineTo(62, 60);
    ctx.quadraticCurveTo(0, 90, -62, 60);
    ctx.closePath();
  }, 4);
  shape(ctx, '#7a1d2a', () => {
    ctx.moveTo(-60, 14);
    ctx.quadraticCurveTo(0, 4, 60, 14);
    ctx.lineTo(52, 60);
    ctx.quadraticCurveTo(0, 92, -52, 60);
    ctx.closePath();
  }, 4);
  ctx.fillStyle = '#efe6cf';
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 12 - 5, 40);
    ctx.lineTo(i * 12, 52 + (i % 2 ? 0 : 6));
    ctx.lineTo(i * 12 + 5, 40);
    ctx.fill();
  }
  // глаза — фиолетовое свечение
  const glow = 0.7 + (charging ? charge * 0.8 : 0) + (phase2 ? 0.4 : 0);
  for (const d of [-1, 1]) {
    if (state === 'stunned') {
      ctx.strokeStyle = '#efe6cf';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(d * 32 - 10, -14);
      ctx.lineTo(d * 32 + 10, 2);
      ctx.moveTo(d * 32 + 10, -14);
      ctx.lineTo(d * 32 - 10, 2);
      ctx.stroke();
      continue;
    }
    ctx.save();
    ctx.shadowColor = '#c38bff';
    ctx.shadowBlur = 20 * glow;
    ctx.fillStyle = '#e6d0ff';
    ctx.beginPath();
    ctx.moveTo(d * 10, -8);
    ctx.lineTo(d * 52, -20);
    ctx.lineTo(d * 46, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // рога шлема
  for (const d of [-1, 1]) {
    shape(ctx, '#d4a53a', () => {
      ctx.moveTo(d * 60, -80);
      ctx.quadraticCurveTo(d * 150, -110, d * 170, -200);
      ctx.quadraticCurveTo(d * 120, -130, d * 40, -100);
      ctx.closePath();
    }, 4);
  }
  ctx.restore();
}

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
  if (who === 'warlord') return drawWarlord(ctx, t, opts);
}

/**
 * Портрет в рамке для диалогов и HUD: фон-«манга» с линиями скорости и персонаж по грудь.
 */
export function drawPortrait(canvas, who, { t = 0, tint, mood, bg = '#2b2f6a', lines = true } = {}) {
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
  const s = (Math.min(w, h) / 300) * (who === 'warlord' ? 0.72 : who === 'oni' ? 0.85 : 1);
  const offsetY = who === 'warlord' ? 0.6 : who === 'scout' ? 0.46 : who === 'oni' ? 0.56 : 0.5;
  ctx.translate(w / 2, h * offsetY);
  ctx.scale(s, s);
  drawCharacter(ctx, who, t, { tint, mood });
  ctx.restore();
}
