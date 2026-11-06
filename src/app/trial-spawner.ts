// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import type { LabApp } from './lab-app';

/** Spawns the target, spiral or reading items for the current level and arms the trial timers. */
export class TrialSpawner {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  spawnForCurrentLevel() {
    clearTimeout(this.app.l1WaitTimer);
    this.app.flow.configureGoalMemoryParameters();
    const { cx, cy, safeLeft, safeTop, safeRight, safeBottom, safeW, safeH, isMobile } =
      this.app.layout.getSafeArenaCenter(true);

    this.app.trialStartTime = performance.now();
    this.app.trialStartPos = { x: this.app.cursor.x, y: this.app.cursor.y };
    this.app.moveOnsetTime = 0;
    this.app.peakVelTime = 0;
    this.app.trialPeakSpeed = 0;
    this.app.decelOnsetTime = 0;
    this.app.currentTrialDockMs = 0;
    this.app.currentTrialGesture = null;
    this.app.goalMemory.trialPeekCount = 0;
    this.app.goalMemory.trialHoverMs = 0;
    this.app.goalMemory.revealAlpha = 1.0;

    const ffpReserve =
      this.app.scoopVisor.enabled && !(this.app.level === 1 && this.app.l1Mode === 'zero')
        ? this.app.scoopVisor.offsetY + this.app.scoopVisor.handleR + 10
        : 0;
    const playBottom = Math.max(safeTop + 90, safeBottom - ffpReserve);

    if (this.app.level === 1) {
      if (this.app.l1Mode === 'zero') {
        this.app.l1WaitState = 'WAITING';
        const fp = this.app.fpEngine.nextForeperiod();
        this.app.l1WaitStartMs = performance.now();
        this.app.l1WaitAssignedMs = fp.tw;
        const r = Math.min(
          Math.min(safeW, safeH) * 0.22,
          Math.round(70 * this.app.reading.uiFontScale),
        );
        this.app.target = {
          x: cx,
          y: cy,
          r: Math.max(28, r),
          color: '#f59e0b',
          label: `WAIT (${fp.dist.slice(0, 4)})`,
          subLabel: `h(tw)=${fp.hazard}/s`,
          id: 0.15,
          tw: fp.tw,
          fpDist: fp.dist,
        };
        this.app.l1WaitTimer = setTimeout(() => {
          this.app.l1WaitState = 'READY_GREEN';
          this.app.l1GreenTimestamp = performance.now();
          this.app.trialStartTime = this.app.l1GreenTimestamp;
          if (this.app.target) {
            this.app.target.color = '#10b981';
            this.app.target.label = 'TAP NOW!';
            this.app.target.subLabel = `Waited ${fp.tw}ms`;
          }
        }, fp.tw);
      } else {
        const r = Math.max(14, Math.min(this.app.shrinkRadius, Math.min(safeW, safeH) * 0.2));
        const margin = r + 14;
        const tx = safeLeft + margin + Math.random() * Math.max(20, safeW - 2 * margin);
        const ty =
          safeTop + margin + Math.random() * Math.max(20, (playBottom - safeTop) * 0.75 - margin);
        const dist = Math.hypot(tx - this.app.cursor.x, ty - this.app.cursor.y);
        const id = Math.log2(dist / (2 * r) + 1);
        this.app.target = {
          x: tx,
          y: ty,
          r,
          color: '#06b6d4',
          label: `${Math.round(r * 2)}px`,
          id: Math.max(0.4, id),
          startX: this.app.cursor.x,
          startY: this.app.cursor.y,
        };
        this.app.layout.resetScoopVisorPosition();
      }
    } else if (this.app.level === 2) {
      const r = Math.max(16, Math.round((18 + Math.random() * 28) * this.app.reading.uiFontScale));
      const margin = r + 16;
      const tx = safeLeft + margin + Math.random() * Math.max(20, safeW - 2 * margin);
      const ty =
        safeTop + margin + Math.random() * Math.max(20, (playBottom - safeTop) * 0.78 - margin);
      const dist = Math.hypot(tx - this.app.cursor.x, ty - this.app.cursor.y);
      const id = Math.log2(dist / (2 * r) + 1);
      this.app.target = {
        x: tx,
        y: ty,
        r,
        color: '#10b981',
        label: `ID ${id.toFixed(1)}`,
        id: Math.max(0.5, id),
        startX: this.app.cursor.x,
        startY: this.app.cursor.y,
      };
      this.app.layout.resetScoopVisorPosition();
    } else if (this.app.level === 3) {
      this.buildSpiral(cx, cy, Math.min(safeW, playBottom - safeTop) * 0.4);
      this.app.layout.resetScoopVisorPosition();
    } else if (this.app.level === 7) {
      this.spawnReadingTrial(safeLeft, safeTop, safeRight, playBottom, isMobile);
      this.app.layout.resetScoopVisorPosition();
    }
    this.app.layout.enforceOnScreenGuard();
  }

  buildSpiral(cx, cy, maxR) {
    const pts = [];
    const turns = 2.2;
    const steps = 150;
    const safeMaxR = Math.max(55, maxR);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      // Rotate phase so outer GOAL (u=1) lands right at the 12 o'clock top (-PI/2)
      const theta = u * turns * Math.PI * 2 - turns * Math.PI * 2 - Math.PI / 2;
      const rad = 20 + u * (safeMaxR - 20);
      const tw = Math.max(14, (30 - u * 12) * this.app.reading.uiFontScale);
      pts.push({ x: cx + rad * Math.cos(theta), y: cy + rad * Math.sin(theta), w: tw });
    }
    this.app.spiral = {
      active: false,
      progress: 0,
      startTime: 0,
      insideSamples: 0,
      totalSamples: 0,
      path: pts,
    };
    this.app.target = null;
  }

  spawnReadingTrial(safeLeft, safeTop, safeRight, playBottom, isMobile) {
    const st = this.app.reading.getCurrentStageConfig();
    const item = st.items[Math.floor(Math.random() * st.items.length)];
    this.app.activeReadingItem = item;
    this.app.voiceEngine.speakReadingItem(item, 'ASKING');

    const safeW = safeRight - safeLeft;
    const safeH = playBottom - safeTop;
    const promptReserveH = Math.min(
      safeH * 0.3,
      Math.round((isMobile ? 74 : 96) * this.app.reading.uiFontScale),
    );
    const minTargetY = safeTop + promptReserveH;
    const availH = Math.max(80, playBottom - minTargetY);

    const baseR = Math.max(
      18,
      Math.min(
        Math.min(safeW, availH) * 0.14,
        Math.round((st.id >= 5 ? 36 : 30) * this.app.reading.uiFontScale),
      ),
    );
    const allTexts = [item.target, ...item.distractors];
    this.app.readingTargets = [];

    for (let i = 0; i < allTexts.length; i++) {
      let tx = safeLeft + safeW / 2;
      let ty = minTargetY + availH / 2;
      const m = baseR + 8;
      for (let a = 0; a < 40; a++) {
        tx = safeLeft + m + Math.random() * Math.max(20, safeW - 2 * m);
        ty = minTargetY + m + Math.random() * Math.max(20, availH - 2 * m);
        if (this.app.readingTargets.every((o) => Math.hypot(tx - o.x, ty - o.y) > baseR * 2.35))
          break;
      }
      this.app.readingTargets.push({
        text: allTexts[i],
        isTarget: i === 0,
        x: tx,
        y: ty,
        r: baseR,
      });
    }
    this.app.target = this.app.readingTargets[0];
  }
}
