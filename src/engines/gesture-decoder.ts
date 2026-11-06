// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.

/*************************************************************************
 * 5. EMBODIED GESTURE & USABILITY DECODER
 *************************************************************************/
export class GestureDecoder {
  constructor(onGestureCallback) {
    this.onGesture = onGestureCallback;
    this.samples = [];
    this.counts = { no: 0, yes: 0, rage: 0, inspect: 0 };
    this.lastTriggerTime = 0;
    this.activeRibbon = [];
    this.ribbonColor = '#10b981';
    this.lastSignSwapRate = 0;
    this.lastAspectXY = 1.0;
  }

  pushSample(x, y, t) {
    this.samples.push({ x, y, t });
    const cutoff = t - 440;
    while (this.samples.length > 0 && this.samples[0].t < cutoff) {
      this.samples.shift();
    }
    if (this.samples.length < 10) return;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    let pathLen = 0;
    let vxFlips = 0,
      vyFlips = 0;
    let prevVxSign = 0,
      prevVySign = 0;

    for (let i = 1; i < this.samples.length; i++) {
      const p0 = this.samples[i - 1],
        p1 = this.samples[i];
      const dx = p1.x - p0.x,
        dy = p1.y - p0.y;
      const dt = Math.max(1, p1.t - p0.t);
      pathLen += Math.hypot(dx, dy);

      if (p1.x < minX) minX = p1.x;
      if (p1.x > maxX) maxX = p1.x;
      if (p1.y < minY) minY = p1.y;
      if (p1.y > maxY) maxY = p1.y;

      const vx = dx / dt,
        vy = dy / dt;
      if (Math.abs(vx) > 0.42) {
        const s = Math.sign(vx);
        if (prevVxSign !== 0 && s !== prevVxSign) vxFlips++;
        prevVxSign = s;
      }
      if (Math.abs(vy) > 0.42) {
        const s = Math.sign(vy);
        if (prevVySign !== 0 && s !== prevVySign) vyFlips++;
        prevVySign = s;
      }
    }

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    this.lastSignSwapRate = (vxFlips + vyFlips) / 0.44;
    this.lastAspectXY = spanX / Math.max(1, spanY);

    if (t - this.lastTriggerTime < 900) return;

    if (vxFlips >= 3 && spanX > 95 && spanX > spanY * 1.65 && pathLen > 240) {
      this.counts.no++;
      this.lastTriggerTime = t;
      this.activeRibbon = this.samples.map((s) => ({ x: s.x, y: s.y, alpha: 1.0 }));
      this.ribbonColor = '#f43f5e';
      this.onGesture('NO_SHAKE', { spanX, vxFlips, pathLen });
      this.samples = [];
      return;
    }

    if (vyFlips >= 3 && spanY > 95 && spanY > spanX * 1.65 && pathLen > 240) {
      this.counts.yes++;
      this.lastTriggerTime = t;
      this.activeRibbon = this.samples.map((s) => ({ x: s.x, y: s.y, alpha: 1.0 }));
      this.ribbonColor = '#10b981';
      this.onGesture('YES_NOD', { spanY, vyFlips, pathLen });
      this.samples = [];
      return;
    }

    if (vxFlips >= 3 && vyFlips >= 3 && pathLen > 520 && spanX > 80 && spanY > 80) {
      this.counts.rage++;
      this.lastTriggerTime = t;
      this.activeRibbon = this.samples.map((s) => ({ x: s.x, y: s.y, alpha: 1.0 }));
      this.ribbonColor = '#f59e0b';
      this.onGesture('RAGE_SCRIBBLE', { pathLen });
      this.samples = [];
    }
  }
}
