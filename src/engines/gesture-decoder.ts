import type { Point } from '../types/arena';

/** The pointer gestures the decoder recognises. */
export type GestureType = 'NO_SHAKE' | 'YES_NOD' | 'RAGE_SCRIBBLE';

/** Payload of `NO_SHAKE`: a wide, flat back-and-forth sweep. */
export interface NoShakeInfo {
  spanX: number;
  vxFlips: number;
  pathLen: number;
}

/** Payload of `YES_NOD`: a tall, narrow up-and-down sweep. */
export interface YesNodInfo {
  spanY: number;
  vyFlips: number;
  pathLen: number;
}

/** Payload of `RAGE_SCRIBBLE`: a long path that reverses on both axes. */
export interface RageScribbleInfo {
  pathLen: number;
}

/** Measurements of a recognised gesture; the shape depends on its `GestureType`. */
export type GestureInfo = NoShakeInfo | YesNodInfo | RageScribbleInfo;

export type GestureCallback = (type: GestureType, info: GestureInfo) => void;

/** Recognised gestures so far; `inspect` is bumped by the drawer bindings, not by the decoder. */
export interface GestureCounts {
  no: number;
  yes: number;
  rage: number;
  inspect: number;
}

/** A timestamped pointer position inside the decoder's sliding window. */
export interface GestureSample extends Point {
  t: number;
}

/** One point of the fading ribbon drawn after a gesture; the renderer decays `alpha`. */
export interface RibbonPoint extends Point {
  alpha: number;
}

/*************************************************************************
 * 5. EMBODIED GESTURE & USABILITY DECODER
 *************************************************************************/
export class GestureDecoder {
  readonly onGesture: GestureCallback;
  samples: GestureSample[];
  readonly counts: GestureCounts;
  lastTriggerTime: number;
  activeRibbon: RibbonPoint[];
  ribbonColor: string;
  lastSignSwapRate: number;
  lastAspectXY: number;

  constructor(onGestureCallback: GestureCallback) {
    this.onGesture = onGestureCallback;
    this.samples = [];
    this.counts = { no: 0, yes: 0, rage: 0, inspect: 0 };
    this.lastTriggerTime = 0;
    this.activeRibbon = [];
    this.ribbonColor = '#10b981';
    this.lastSignSwapRate = 0;
    this.lastAspectXY = 1.0;
  }

  pushSample(x: number, y: number, t: number): void {
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
