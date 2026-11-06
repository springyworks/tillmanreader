/** Traces a rounded-rectangle path on `ctx`; the caller decides whether to fill or stroke it. */
export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const safeW = Math.max(1, w);
  const safeH = Math.max(1, h);
  const safeR = Math.max(0, Math.min(r, safeW / 2, safeH / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeR, y);
  ctx.arcTo(x + safeW, y, x + safeW, y + safeH, safeR);
  ctx.arcTo(x + safeW, y + safeH, x, y + safeH, safeR);
  ctx.arcTo(x, y + safeH, x, y, safeR);
  ctx.arcTo(x, y, x + safeW, y, safeR);
  ctx.closePath();
}
