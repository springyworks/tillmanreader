// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.

export function drawRoundRect(ctx, x, y, w, h, r) {
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
