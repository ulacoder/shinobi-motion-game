// Кагэро, владыка клана Затмения — главный злодей в высокой детализации.
// Самурайский доспех о-ёрой: лаковый шлем-кабуто с рёбрами и заклёпками, наплечники-содэ
// из пластин со шнуровкой, нагрудник-до с гербом, юбка-кусадзури, маска-мэмпо с усами,
// рога-кувагата, гребень-корона затмения, катана за спиной и развевающийся плащ.
// Координаты как у остальных персонажей: (0, 0) — центр лица, рисунок от y≈-260 до y≈280.

const TAU = Math.PI * 2;
const INK = '#120c18';

function stroke(ctx, w = 4, color = INK) {
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Лак: вертикальный градиент тёмного металла с бликом сверху. */
function lacquer(ctx, y0, y1, base = ['#3b2d55', '#1e1630', '#0d0916']) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, base[0]);
  g.addColorStop(0.45, base[1]);
  g.addColorStop(1, base[2]);
  return g;
}

function gold(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#fff0b0');
  g.addColorStop(0.35, '#e6b84a');
  g.addColorStop(0.7, '#a8761f');
  g.addColorStop(1, '#f5d27a');
  return g;
}

/** Ряд пластин доспеха со шнуровкой (одоси). */
function plateRow(ctx, x, y, w, h, n, { tilt = 0, cord = '#9d3fd6' } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(0, h * 0.25, w / 2, 0);
  ctx.lineTo(w / 2 + 4, h);
  ctx.quadraticCurveTo(0, h * 1.25, -w / 2 - 4, h);
  ctx.closePath();
  ctx.fillStyle = lacquer(ctx, 0, h);
  ctx.fill();
  stroke(ctx, 3);
  // золотой кант по нижнему краю
  ctx.beginPath();
  ctx.moveTo(-w / 2 - 3, h - 3);
  ctx.quadraticCurveTo(0, h * 1.25 - 3, w / 2 + 3, h - 3);
  stroke(ctx, 2.5, '#d4a53a');
  // шнуровка: косые стежки
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + ((i + 0.5) * w) / n;
    const cy = h * 0.2 + Math.sin(((i + 0.5) / n) * Math.PI) * h * 0.18;
    ctx.moveTo(cx - 3, cy);
    ctx.lineTo(cx + 3, cy + h * 0.45);
  }
  stroke(ctx, 2.6, cord);
  // блик лака
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 6, h * 0.18);
  ctx.quadraticCurveTo(0, h * 0.4, w / 2 - 6, h * 0.18);
  stroke(ctx, 2, 'rgba(210,180,255,0.35)');
  ctx.restore();
}

export function drawKagero(ctx, t = 0, { state = 'idle', charge = 0, phase2 = false } = {}) {
  const charging = state === 'charging';
  const stunned = state === 'stunned';
  const fire = phase2 ? '#b46bff' : '#ff6a3a';
  ctx.save();

  // ---------- плащ ----------
  const flap = Math.sin(t * 2.4) * 12;
  const flap2 = Math.sin(t * 3.1 + 1) * 8;
  ctx.beginPath();
  ctx.moveTo(-100, 30);
  ctx.bezierCurveTo(-190, 100, -215 - flap, 200, -200 - flap, 275);
  // рваный край
  const teeth = 12;
  for (let i = 0; i <= teeth; i++) {
    const k = i / teeth;
    const x = -200 - flap + (400 + flap + flap2) * k;
    const y = 275 + (i % 2 ? -26 : 4) + Math.sin(t * 4 + i * 1.7) * 6;
    ctx.lineTo(x, y);
  }
  ctx.bezierCurveTo(215 + flap2, 200, 190, 100, 100, 30);
  ctx.closePath();
  const cg = ctx.createLinearGradient(0, 30, 0, 280);
  cg.addColorStop(0, '#4a0f1c');
  cg.addColorStop(1, '#22050c');
  ctx.fillStyle = cg;
  ctx.fill();
  stroke(ctx, 5);
  // алая подкладка и золотой узор по краю
  ctx.beginPath();
  ctx.moveTo(-108, 48);
  ctx.bezierCurveTo(-180, 120, -196 - flap, 210, -186 - flap, 262);
  ctx.lineTo(-150 - flap * 0.6, 254);
  ctx.bezierCurveTo(-150, 190, -140, 110, -86, 52);
  ctx.closePath();
  ctx.fillStyle = '#a3182c';
  ctx.fill();
  stroke(ctx, 3);
  // золотые бусины-кисти вдоль подкладки
  ctx.fillStyle = '#d4a53a';
  for (let i = 0; i < 8; i++) {
    const k = (i + 0.5) / 8;
    const x = -100 + (-62 - flap * 0.6) * k;
    const y = 60 + 190 * k;
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, TAU);
    ctx.fill();
  }

  // ---------- катана за спиной ----------
  ctx.save();
  ctx.translate(-70, 30);
  ctx.rotate(-0.95);
  // ножны
  ctx.beginPath();
  ctx.roundRect(-6, 0, 16, 150, 6);
  ctx.fillStyle = '#1a1020';
  ctx.fill();
  stroke(ctx, 3);
  // цуба
  ctx.beginPath();
  ctx.ellipse(2, -4, 16, 6, 0, 0, TAU);
  ctx.fillStyle = gold(ctx, -16, -8, 16, 4);
  ctx.fill();
  stroke(ctx, 3);
  // рукоять с ромбовидной обмоткой
  ctx.beginPath();
  ctx.roundRect(-6, -96, 16, 90, 5);
  ctx.fillStyle = '#2a1a2e';
  ctx.fill();
  stroke(ctx, 3);
  ctx.beginPath();
  for (let y = -92; y < -10; y += 12) {
    ctx.moveTo(-5, y);
    ctx.lineTo(9, y + 10);
    ctx.moveTo(9, y);
    ctx.lineTo(-5, y + 10);
  }
  stroke(ctx, 2, '#c9a24a');
  ctx.beginPath();
  ctx.roundRect(-7, -104, 18, 10, 3);
  ctx.fillStyle = '#d4a53a';
  ctx.fill();
  stroke(ctx, 2.5);
  ctx.restore();

  // ---------- юбка-кусадзури ----------
  for (const [x, tilt] of [[-62, 0.08], [0, 0], [62, -0.08]]) {
    for (let r = 0; r < 3; r++) plateRow(ctx, x, 196 + r * 22, 62, 24, 4, { tilt });
  }

  // ---------- нагрудник-до ----------
  ctx.beginPath();
  ctx.moveTo(-84, 46);
  ctx.quadraticCurveTo(-96, 130, -76, 206);
  ctx.quadraticCurveTo(0, 222, 76, 206);
  ctx.quadraticCurveTo(96, 130, 84, 46);
  ctx.quadraticCurveTo(0, 30, -84, 46);
  ctx.closePath();
  ctx.fillStyle = lacquer(ctx, 40, 220);
  ctx.fill();
  stroke(ctx, 5);
  // горизонтальные пластины со шнуровкой
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    const y = 96 + i * 24;
    ctx.beginPath();
    ctx.moveTo(-100, y);
    ctx.quadraticCurveTo(0, y + 10, 100, y);
    stroke(ctx, 3);
    ctx.beginPath();
    ctx.moveTo(-100, y + 2);
    ctx.quadraticCurveTo(0, y + 12, 100, y + 2);
    stroke(ctx, 1.5, 'rgba(210,180,255,0.25)');
    ctx.beginPath();
    for (let x = -80; x <= 80; x += 16) {
      ctx.moveTo(x - 2, y + 6);
      ctx.lineTo(x + 3, y + 18);
    }
    stroke(ctx, 2.4, '#9d3fd6');
  }
  // широкий блик лака слева
  const hl = ctx.createLinearGradient(-90, 0, -40, 0);
  hl.addColorStop(0, 'rgba(220,200,255,0.22)');
  hl.addColorStop(1, 'rgba(220,200,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(-100, 40, 60, 180);
  ctx.restore();
  // герб на груди: кольцо затмения
  ctx.save();
  ctx.translate(0, 70);
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, TAU);
  ctx.fillStyle = gold(ctx, -17, -17, 17, 17);
  ctx.fill();
  stroke(ctx, 3);
  ctx.beginPath();
  ctx.arc(2, -1, 11, 0, TAU);
  ctx.fillStyle = '#0d0916';
  ctx.fill();
  ctx.restore();
  // пояс с узлом
  ctx.beginPath();
  ctx.roundRect(-82, 180, 164, 18, 4);
  ctx.fillStyle = '#5a1622';
  ctx.fill();
  stroke(ctx, 3.5);
  ctx.beginPath();
  ctx.ellipse(30, 189, 14, 10, 0.3, 0, TAU);
  ctx.fillStyle = '#7a1d2a';
  ctx.fill();
  stroke(ctx, 3);

  // ---------- горловой щиток ----------
  plateRow(ctx, 0, 34, 120, 22, 6);

  // ---------- наплечники-содэ ----------
  for (const d of [-1, 1]) {
    ctx.save();
    ctx.translate(d * 104, 46);
    ctx.rotate(d * 0.22);
    for (let r = 0; r < 4; r++) plateRow(ctx, d * (6 + r * 4), r * 24, 92, 26, 5);
    // золотая окантовка верхней пластины и заклёпки
    ctx.fillStyle = '#e6b84a';
    for (const x of [-34, -12, 12, 34]) {
      ctx.beginPath();
      ctx.arc(x, 6, 3.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- шлем: назатыльник-сикоро ----------
  for (let r = 3; r >= 0; r--) {
    const wd = 196 + r * 26;
    const y = -24 + r * 17;
    ctx.beginPath();
    ctx.moveTo(-wd / 2 + 18, y - 8);
    ctx.quadraticCurveTo(0, y - 26, wd / 2 - 18, y - 8);
    ctx.lineTo(wd / 2, y + 16);
    ctx.quadraticCurveTo(0, y - 6, -wd / 2, y + 16);
    ctx.closePath();
    ctx.fillStyle = lacquer(ctx, y - 26, y + 16);
    ctx.fill();
    stroke(ctx, 3.5);
    ctx.beginPath();
    ctx.moveTo(-wd / 2 + 4, y + 12);
    ctx.quadraticCurveTo(0, y - 10, wd / 2 - 4, y + 12);
    stroke(ctx, 2.2, '#d4a53a');
  }

  // ---------- отвороты-фукигаэси с гербом ----------
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d * 88, -40);
    ctx.quadraticCurveTo(d * 140, -50, d * 150, -6);
    ctx.quadraticCurveTo(d * 128, 6, d * 96, -6);
    ctx.closePath();
    ctx.fillStyle = lacquer(ctx, -50, 6);
    ctx.fill();
    stroke(ctx, 3.5);
    ctx.beginPath();
    ctx.arc(d * 124, -22, 8, 0, TAU);
    ctx.fillStyle = gold(ctx, d * 116, -30, d * 132, -14);
    ctx.fill();
    stroke(ctx, 2);
  }

  // ---------- купол шлема ----------
  ctx.beginPath();
  ctx.moveTo(-98, -20);
  ctx.bezierCurveTo(-104, -120, -40, -140, 0, -140);
  ctx.bezierCurveTo(40, -140, 104, -120, 98, -20);
  ctx.closePath();
  ctx.fillStyle = lacquer(ctx, -140, -20, ['#4a3a6a', '#251b3c', '#120c20']);
  ctx.fill();
  stroke(ctx, 5);
  ctx.save();
  ctx.clip();
  // рёбра купола (судзи) и заклёпки (хоси)
  for (let i = -5; i <= 5; i++) {
    const x = i * 17;
    ctx.beginPath();
    ctx.moveTo(x * 0.25, -140);
    ctx.quadraticCurveTo(x * 0.9, -90, x * 1.15, -20);
    stroke(ctx, 2.2, 'rgba(0,0,0,0.45)');
    ctx.beginPath();
    ctx.moveTo(x * 0.25 + 2, -138);
    ctx.quadraticCurveTo(x * 0.9 + 2, -90, x * 1.15 + 2, -22);
    stroke(ctx, 1.2, 'rgba(200,170,255,0.25)');
    for (let k = 1; k <= 4; k++) {
      const q = k / 5;
      const px = x * 0.25 + (x * 1.15 - x * 0.25) * q * q;
      const py = -140 + 120 * q;
      ctx.beginPath();
      ctx.arc(px + 8, py, 2.2, 0, TAU);
      ctx.fillStyle = '#c9a24a';
      ctx.fill();
    }
  }
  // большой лаковый блик
  ctx.beginPath();
  ctx.ellipse(-36, -100, 34, 12, -0.5, 0, TAU);
  ctx.fillStyle = 'rgba(230,215,255,0.22)';
  ctx.fill();
  ctx.restore();

  // козырёк с золотым кантом
  ctx.beginPath();
  ctx.moveTo(-112, -22);
  ctx.quadraticCurveTo(0, -52, 112, -22);
  ctx.lineTo(104, -10);
  ctx.quadraticCurveTo(0, -38, -104, -10);
  ctx.closePath();
  ctx.fillStyle = '#1a1228';
  ctx.fill();
  stroke(ctx, 4);
  ctx.beginPath();
  ctx.moveTo(-108, -20);
  ctx.quadraticCurveTo(0, -49, 108, -20);
  stroke(ctx, 3, gold(ctx, -108, 0, 108, 0));

  // ---------- рога-кувагата ----------
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d * 26, -96);
    ctx.bezierCurveTo(d * 120, -120, d * 170, -170, d * 176, -236);
    ctx.bezierCurveTo(d * 150, -180, d * 110, -140, d * 36, -116);
    ctx.closePath();
    ctx.fillStyle = gold(ctx, d * 26, -96, d * 176, -236);
    ctx.fill();
    stroke(ctx, 4);
    // гравировка
    ctx.beginPath();
    ctx.moveTo(d * 44, -108);
    ctx.bezierCurveTo(d * 118, -132, d * 152, -168, d * 166, -218);
    stroke(ctx, 1.8, 'rgba(120,70,10,0.7)');
  }

  // ---------- гребень: корона затмения ----------
  ctx.save();
  ctx.translate(0, -176);
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  // языки короны
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + t * 0.4;
    const r1 = 40;
    const r2 = 56 + (i % 2 ? 6 : 14) + pulse * 4;
    ctx.moveTo(Math.cos(a - 0.12) * r1, Math.sin(a - 0.12) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.lineTo(Math.cos(a + 0.12) * r1, Math.sin(a + 0.12) * r1);
  }
  ctx.fillStyle = gold(ctx, -60, -60, 60, 60);
  ctx.fill();
  stroke(ctx, 2.5);
  ctx.shadowColor = phase2 ? '#c38bff' : '#ffcf6a';
  ctx.shadowBlur = 24 + pulse * 14 + (phase2 ? 18 : 0);
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, TAU);
  stroke(ctx, 9, '#f0c35a');
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, TAU);
  ctx.fillStyle = '#06030a';
  ctx.fill();
  stroke(ctx, 3);
  // тонкий серп света внутри
  ctx.beginPath();
  ctx.arc(-4, 2, 32, Math.PI * 0.6, Math.PI * 1.1);
  stroke(ctx, 2, 'rgba(255,220,140,0.6)');
  ctx.restore();
  // стойка гребня
  ctx.beginPath();
  ctx.roundRect(-9, -134, 18, 26, 3);
  ctx.fillStyle = gold(ctx, -9, -134, 9, -108);
  ctx.fill();
  stroke(ctx, 3);

  // ---------- маска-мэмпо ----------
  // тень под козырьком
  ctx.beginPath();
  ctx.moveTo(-74, -18);
  ctx.quadraticCurveTo(0, -36, 74, -18);
  ctx.lineTo(66, 66);
  ctx.quadraticCurveTo(0, 96, -66, 66);
  ctx.closePath();
  ctx.fillStyle = '#07040c';
  ctx.fill();
  stroke(ctx, 4);
  // маска: лоб-морщины, нос, щёки
  ctx.beginPath();
  ctx.moveTo(-64, 8);
  ctx.quadraticCurveTo(-30, -2, -8, 8);
  ctx.lineTo(0, 0);
  ctx.lineTo(8, 8);
  ctx.quadraticCurveTo(30, -2, 64, 8);
  ctx.lineTo(56, 64);
  ctx.quadraticCurveTo(0, 100, -56, 64);
  ctx.closePath();
  const mg = ctx.createLinearGradient(0, 0, 0, 96);
  mg.addColorStop(0, '#a12a38');
  mg.addColorStop(1, '#4e0d18');
  ctx.fillStyle = mg;
  ctx.fill();
  stroke(ctx, 4);
  // нос
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.quadraticCurveTo(10, 24, 4, 34);
  ctx.quadraticCurveTo(0, 36, -4, 34);
  stroke(ctx, 2.5);
  // морщины-складки маски
  ctx.beginPath();
  for (const d of [-1, 1]) {
    ctx.moveTo(d * 16, 30);
    ctx.quadraticCurveTo(d * 30, 42, d * 26, 56);
    ctx.moveTo(d * 40, 18);
    ctx.quadraticCurveTo(d * 52, 30, d * 48, 46);
  }
  stroke(ctx, 2, 'rgba(20,4,10,0.7)');
  // рот с клыками
  ctx.beginPath();
  ctx.moveTo(-36, 50);
  ctx.quadraticCurveTo(0, 42 + (charging ? -8 : 0), 36, 50);
  ctx.quadraticCurveTo(0, 84 + (charging ? 8 : 0), -36, 50);
  ctx.closePath();
  ctx.fillStyle = '#12040a';
  ctx.fill();
  stroke(ctx, 3);
  ctx.fillStyle = '#efe6cf';
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 9 - 4, 50);
    ctx.lineTo(i * 9, 60 + (i % 2 ? 0 : 6));
    ctx.lineTo(i * 9 + 4, 50);
    ctx.fill();
  }
  // белые усы из прядей
  for (const d of [-1, 1]) {
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      ctx.moveTo(d * 10, 42 + k * 1.5);
      ctx.bezierCurveTo(d * 40, 40 + k * 3, d * 60, 52 + k * 5, d * (74 + k * 3), 70 + k * 6 + Math.sin(t * 2 + k) * 2);
    }
    stroke(ctx, 2, '#e8e2d6');
  }

  // ---------- глаза ----------
  const glow = 0.7 + (charging ? charge * 0.9 : 0) + (phase2 ? 0.5 : 0);
  for (const d of [-1, 1]) {
    if (stunned) {
      ctx.beginPath();
      ctx.moveTo(d * 32 - 10, -12);
      ctx.lineTo(d * 32 + 10, 4);
      ctx.moveTo(d * 32 + 10, -12);
      ctx.lineTo(d * 32 - 10, 4);
      stroke(ctx, 6, '#efe6cf');
      continue;
    }
    ctx.save();
    ctx.shadowColor = phase2 ? '#c38bff' : '#ff8a5a';
    ctx.shadowBlur = 22 * glow;
    ctx.fillStyle = phase2 ? '#f0e0ff' : '#fff0d8';
    ctx.beginPath();
    ctx.moveTo(d * 10, -6);
    ctx.lineTo(d * 54, -20);
    ctx.lineTo(d * 48, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // светящиеся «хвосты» из глаз, когда он копит удар или во второй фазе
    if (charging || phase2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = phase2 ? 'rgba(190,140,255,0.6)' : 'rgba(255,140,90,0.6)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(d * 52, -16);
      ctx.bezierCurveTo(d * 80, -24 + Math.sin(t * 6) * 6, d * 100, -40, d * (124 + Math.sin(t * 5 + d) * 10), -44 + Math.sin(t * 4) * 8);
      ctx.stroke();
      ctx.restore();
    }
  }

  // уголья, срывающиеся с доспеха
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const p = (t * 0.5 + i / 8) % 1;
    const x = Math.sin(i * 12.9) * 120 + Math.sin(t * 2 + i) * 10;
    const y = 200 - p * 380;
    ctx.globalAlpha = (1 - p) * 0.9;
    ctx.fillStyle = fire;
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  ctx.restore();
  ctx.restore();
}

/**
 * Аура босса: языки тёмного пламени вокруг силуэта. Рисуется на сцене за персонажем.
 */
export function drawKageroAura(ctx, t, { phase2 = false, charge = 0, scale = 1 } = {}) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const n = 18;
  const base = phase2 ? [150, 70, 255] : [220, 50, 40];
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (0.95 + (i / (n - 1)) * 1.1);
    const flick = Math.sin(t * 7 + i * 1.9) * 0.5 + 0.5;
    const r0 = 150 * scale;
    const len = (70 + flick * 60 + charge * 90 + (phase2 ? 40 : 0)) * scale;
    const x0 = Math.cos(a) * r0;
    const y0 = Math.sin(a) * r0 * 1.15 + 40 * scale;
    const x1 = Math.cos(a) * (r0 + len) + Math.sin(t * 3 + i) * 12 * scale;
    const y1 = Math.sin(a) * (r0 + len) * 1.15 + 40 * scale - len * 0.35;
    const wd = (16 + flick * 10) * scale;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(${base.join(',')},${0.32 + charge * 0.3})`);
    g.addColorStop(1, `rgba(${base.join(',')},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 - Math.sin(a) * wd, y0 + Math.cos(a) * wd);
    ctx.quadraticCurveTo((x0 + x1) / 2 + Math.sin(t * 5 + i) * 14 * scale, (y0 + y1) / 2, x1, y1);
    ctx.quadraticCurveTo((x0 + x1) / 2 - Math.sin(t * 4 + i) * 14 * scale, (y0 + y1) / 2, x0 + Math.sin(a) * wd, y0 - Math.cos(a) * wd);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
