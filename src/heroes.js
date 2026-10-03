// Герои Улагат, Таир, Данияр и сенсей Рю: у каждого свой силуэт (причёска, головной убор, одежда).

import { TAU, INK, outline, shape, shade } from './char-kit.js';

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
  ulagat: { style: 'spiky', hair: '#1d5a70', hairBack: '#17485a', shine: 'rgba(160,230,240,0.7)', scarf: '#c9302c', scarfDark: '#a82622', iris: '#e3a23a', jacket: '#2d3a5c' },
  tair: { style: 'long', hair: '#2b1d18', hairBack: '#1c120e', shine: 'rgba(200,170,150,0.55)', scarf: '#2f8a52', scarfDark: '#236b3f', iris: '#7fd88f', jacket: '#3a2f2a', scar: true },
  daniyar: { style: 'topknot', hair: '#b0452a', hairBack: '#8a3420', shine: 'rgba(255,200,170,0.6)', scarf: '#e0a93a', scarfDark: '#b8862a', iris: '#58d0ff', jacket: '#2a3a3a', topknot: true },
};

export function drawHero(ctx, t = 0, { mood = 'calm', hero = 'ulagat' } = {}) {
  const L = HERO_LOOKS[hero] ?? HERO_LOOKS.ulagat;
  const style = L.style ?? 'spiky';
  const sway = Math.sin(t * 2) * 1.5;
  ctx.save();
  ctx.translate(0, sway);

  if (style === 'spiky') {
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
  } else if (style === 'topknot') {
    // концы белой хатимаки
    const fl = Math.sin(t * 5) * 6;
    for (const [dy, len] of [[0, 1], [12, 0.8]]) {
      shape(ctx, '#f2ece0', () => {
        ctx.moveTo(60, -50 + dy);
        ctx.bezierCurveTo(92, -64 + dy + fl, 112 * len, -30 + dy - fl, 138 * len, -42 + dy - fl * 1.4);
        ctx.bezierCurveTo(110 * len, -20 + dy - fl, 90, -40 + dy + fl * 0.5, 62, -36 + dy);
        ctx.closePath();
      }, 3.5);
    }
  } else if (style === 'long') {
    // откинутый капюшон за плечами
    shape(ctx, shade(L.jacket, -18), () => {
      ctx.moveTo(-96, 96);
      ctx.quadraticCurveTo(-110, 30, -60, 40);
      ctx.quadraticCurveTo(0, 60, 60, 40);
      ctx.quadraticCurveTo(110, 30, 96, 96);
      ctx.closePath();
    });
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
  if (style === 'topknot') {
    // наплечник-содэ на левом плече: Данияр — тяжёлый боец
    for (let r = 0; r < 3; r++) {
      shape(ctx, r % 2 ? '#b8862a' : '#e0a93a', () => {
        ctx.moveTo(-124, 96 + r * 22);
        ctx.quadraticCurveTo(-92, 82 + r * 22, -56, 92 + r * 22);
        ctx.lineTo(-58, 114 + r * 22);
        ctx.quadraticCurveTo(-92, 104 + r * 22, -126, 118 + r * 22);
        ctx.closePath();
      }, 3.5);
    }
    ctx.strokeStyle = '#5a1e1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let r = 0; r < 3; r++) for (const x of [-110, -92, -74]) {
      ctx.moveTo(x, 98 + r * 22);
      ctx.lineTo(x + 3, 110 + r * 22);
    }
    ctx.stroke();
  }
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

  if (style === 'long') {
    // длинные прямые волосы до плеч и низкий хвост
    shape(ctx, L.hairBack, () => {
      ctx.moveTo(-74, 70);
      ctx.bezierCurveTo(-100, 20, -96, -90, -40, -112);
      ctx.quadraticCurveTo(0, -126, 40, -112);
      ctx.bezierCurveTo(96, -90, 100, 20, 74, 70);
      ctx.lineTo(56, 58);
      ctx.lineTo(44, 74);
      ctx.lineTo(-44, 74);
      ctx.lineTo(-56, 58);
      ctx.closePath();
    });
    ctx.strokeStyle = shade(L.hairBack, -25);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const x of [-70, -54, 54, 70]) {
      ctx.moveTo(x * 0.7, -100);
      ctx.quadraticCurveTo(x * 1.25, -20, x, 64);
    }
    ctx.stroke();
    // хвост, перехваченный зелёной лентой
    const sway2 = Math.sin(t * 2.5) * 6;
    shape(ctx, L.hairBack, () => {
      ctx.moveTo(60, 20);
      ctx.quadraticCurveTo(116 + sway2, 40, 104 + sway2, 128);
      ctx.lineTo(90 + sway2, 116);
      ctx.quadraticCurveTo(96, 54, 52, 36);
      ctx.closePath();
    });
  } else if (style === 'topknot') {
    // выбритые виски и короткие волосы, собранные в пучок-тёнмагэ
    shape(ctx, L.hairBack, () => {
      ctx.moveTo(-68, -30);
      ctx.quadraticCurveTo(-74, -104, 0, -112);
      ctx.quadraticCurveTo(74, -104, 68, -30);
      ctx.closePath();
    });
    shape(ctx, L.hairBack, () => {
      ctx.moveTo(-14, -108);
      ctx.quadraticCurveTo(-30, -150, 6, -164);
      ctx.quadraticCurveTo(40, -170, 34, -136);
      ctx.quadraticCurveTo(26, -120, 14, -108);
      ctx.closePath();
    });
    shape(ctx, L.scarf, () => ctx.roundRect(-10, -120, 28, 10, 3), 3);
  } else {
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

  if (style === 'spiky') {
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
  } else if (style === 'topknot') {
    // белая повязка-хатимаки с красным кругом
    shape(ctx, '#f2ece0', () => {
      ctx.moveTo(-70, -60);
      ctx.quadraticCurveTo(0, -76, 70, -60);
      ctx.lineTo(70, -40);
      ctx.quadraticCurveTo(0, -56, -70, -40);
      ctx.closePath();
    }, 4);
    ctx.fillStyle = '#cc3325';
    ctx.beginPath();
    ctx.arc(0, -56, 9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-60, -48);
    ctx.quadraticCurveTo(0, -62, 60, -48);
    ctx.stroke();
  }

  if (style === 'spiky') {
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
  } else if (style === 'long') {
    // косая чёлка набок: закрывает край правого глаза
    shape(ctx, L.hair, () => {
      ctx.moveTo(-70, -40);
      ctx.quadraticCurveTo(-74, -96, -20, -104);
      ctx.quadraticCurveTo(50, -108, 72, -56);
      ctx.quadraticCurveTo(66, -10, 58, 10);
      ctx.quadraticCurveTo(44, -26, 20, -40);
      ctx.quadraticCurveTo(-10, -52, -40, -46);
      ctx.quadraticCurveTo(-58, -44, -70, -40);
      ctx.closePath();
    });
    ctx.strokeStyle = shade(L.hair, -35);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const k of [0.2, 0.45, 0.7]) {
      ctx.moveTo(-50 + k * 60, -96);
      ctx.quadraticCurveTo(k * 70, -60, 30 + k * 34, -20 + k * 20);
    }
    ctx.stroke();
    ctx.strokeStyle = L.shine;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-40, -88);
    ctx.quadraticCurveTo(-10, -98, 20, -94);
    ctx.stroke();
  } else {
    // гладко зачёсанные назад волосы: линия роста и блик
    ctx.strokeStyle = shade(L.hairBack, -30);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const x of [-40, -20, 0, 20, 40]) {
      ctx.moveTo(x, -66);
      ctx.quadraticCurveTo(x * 0.7, -92, x * 0.3, -108);
    }
    ctx.stroke();
    ctx.strokeStyle = L.shine;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -40, 66, Math.PI * 1.3, Math.PI * 1.55);
    ctx.stroke();
    // щетина на выбритых висках
    ctx.fillStyle = 'rgba(90,60,50,0.25)';
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(d * 58, -30, 10, 18, 0, 0, TAU);
      ctx.fill();
    }
  }

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
  ctx.lineWidth = style === 'topknot' ? 9 : 6;
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

