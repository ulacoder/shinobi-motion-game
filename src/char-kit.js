// Общие кисти для персонажей: контур тушью, заливка с контуром, оттенок цвета.

export const TAU = Math.PI * 2;
export const INK = '#1a1320';

export function outline(ctx, w = 5) {
  ctx.lineWidth = w;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function shape(ctx, fill, draw, w = 5) {
  ctx.beginPath();
  draw();
  ctx.fillStyle = fill;
  ctx.fill();
  outline(ctx, w);
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  const r = c(n >> 16);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return `rgb(${r},${g},${b})`;
}

/** Рисует любого персонажа. who: ulagat | tair | daniyar | hero | sensei | scout | oni | warlord */
