import type { SafeArena, SpiralPoint } from '../types/arena';
import type { LabApp } from './lab-app';
import { isPointingTarget } from './targets';

/** Spawns the target, spiral or reading items for the current level and arms the trial timers. */
export class TrialSpawner {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  spawnForCurrentLevel(silentPrompt = false) {
    clearTimeout(this.app.l1WaitTimer);
    this.app.flow.configureGoalMemoryParameters();
    const arena = this.app.layout.getSafeArenaCenter(true);
    const { cx, cy, safeLeft, safeTop, safeRight, safeBottom, safeW, safeH } = arena;

    this.app.trialStartTime = performance.now();
    this.app.moveOnsetTime = 0;
    this.app.peakVelTime = 0;
    this.app.trialPeakSpeed = 0;
    this.app.decelOnsetTime = 0;
    this.app.currentTrialDockMs = 0;
    this.app.currentTrialGesture = null;
    this.app.goalMemory.trialPeekCount = 0;
    this.app.goalMemory.trialHoverMs = 0;
    this.app.goalMemory.isHoveringTopGoal = false;
    this.app.goalMemory.revealAlpha = 1.0;

    const ffpReserve =
      this.app.scoopVisor.enabled && !(this.app.level === 1 && this.app.l1Mode === 'zero')
        ? this.app.scoopVisor.offsetY + this.app.scoopVisor.handleR + 8
        : 0;
    const playBottom = Math.max(safeTop + 80, safeBottom - ffpReserve);

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
        this.app.trialStartPos = { x: cx, y: cy };
        this.app.l1WaitTimer = setTimeout(() => {
          this.app.l1WaitState = 'READY_GREEN';
          this.app.l1GreenTimestamp = performance.now();
          this.app.trialStartTime = this.app.l1GreenTimestamp;
          const waiting = this.app.target;
          if (isPointingTarget(waiting)) {
            waiting.color = '#10b981';
            waiting.label = 'TAP NOW!';
            waiting.subLabel = `Waited ${fp.tw}ms`;
          }
        }, fp.tw);
      } else {
        this.app.layout.resetScoopVisorPosition();
        const r = Math.max(14, Math.min(this.app.shrinkRadius, Math.min(safeW, safeH) * 0.18));
        const pos = this.pickNonOverlappingTargetPos(arena, playBottom, r);
        const startX = this.app.scoopVisor.visorX;
        const startY = this.app.scoopVisor.visorY;
        const dist = Math.hypot(pos.x - startX, pos.y - startY);
        const id = Math.log2(dist / (2 * r) + 1);
        this.app.target = {
          x: pos.x,
          y: pos.y,
          r,
          color: '#06b6d4',
          label: `${Math.round(r * 2)}px`,
          id: Math.max(0.4, id),
          startX,
          startY,
        };
        this.app.trialStartPos = { x: startX, y: startY };
      }
    } else if (this.app.level === 2) {
      this.app.layout.resetScoopVisorPosition();
      const r = Math.max(16, Math.round((18 + Math.random() * 26) * this.app.reading.uiFontScale));
      const pos = this.pickNonOverlappingTargetPos(arena, playBottom, r);
      const startX = this.app.scoopVisor.visorX;
      const startY = this.app.scoopVisor.visorY;
      const dist = Math.hypot(pos.x - startX, pos.y - startY);
      const id = Math.log2(dist / (2 * r) + 1);
      this.app.target = {
        x: pos.x,
        y: pos.y,
        r,
        color: '#10b981',
        label: `ID ${id.toFixed(1)}`,
        id: Math.max(0.5, id),
        startX,
        startY,
      };
      this.app.trialStartPos = { x: startX, y: startY };
    } else if (this.app.level === 3) {
      this.buildSpiral(cx, cy, Math.min(safeW, playBottom - safeTop) * 0.4);
      this.app.layout.resetScoopVisorPosition();
      this.app.trialStartPos = { x: this.app.scoopVisor.visorX, y: this.app.scoopVisor.visorY };
    } else if (this.app.level === 7) {
      this.app.layout.resetScoopVisorPosition();
      this.spawnReadingTrial(arena, safeLeft, safeTop, safeRight, playBottom, silentPrompt);
      this.app.trialStartPos = { x: this.app.scoopVisor.visorX, y: this.app.scoopVisor.visorY };
    }
    this.app.layout.enforceOnScreenGuard();
  }

  private pickNonOverlappingTargetPos(
    arena: SafeArena,
    playBottom: number,
    r: number,
  ): { x: number; y: number } {
    const { safeLeft, safeTop, safeW, cx } = arena;
    const margin = r + 14;
    const usableH = Math.max(24, playBottom - safeTop - 2 * margin);
    for (let a = 0; a < 45; a++) {
      const tx = safeLeft + margin + Math.random() * Math.max(20, safeW - 2 * margin);
      const ty = safeTop + margin + Math.random() * usableH;
      if (!this.app.layout.overlapsGoalDock(tx, ty, r, arena)) {
        return { x: tx, y: ty };
      }
    }
    return {
      x: cx + (Math.random() < 0.5 ? -1 : 1) * Math.min(safeW * 0.32, 140),
      y: Math.max(safeTop + margin, playBottom - margin),
    };
  }

  buildSpiral(cx: number, cy: number, maxR: number) {
    const pts: SpiralPoint[] = [];
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

  spawnReadingTrial(
    arena: SafeArena,
    safeLeft: number,
    safeTop: number,
    safeRight: number,
    playBottom: number,
    silentPrompt = false,
  ) {
    const st = this.app.reading.getCurrentStageConfig();
    const item = st.items[Math.floor(Math.random() * st.items.length)];
    this.app.activeReadingItem = item;
    if (!silentPrompt) {
      this.app.voiceEngine.speakReadingItem(item, 'ASKING');
    }

    const safeW = safeRight - safeLeft;
    const availTotalH = Math.max(70, playBottom - safeTop);
    const dock = this.app.layout.getGoalCenterDock(arena);
    const cr = dock.cardRect;
    const belowDockY = cr.y + cr.h + 12;

    const baseR = Math.max(
      17,
      Math.min(
        safeW * 0.115,
        availTotalH * 0.145,
        Math.round((st.id >= 5 ? 34 : 28) * this.app.reading.uiFontScale),
      ),
    );
    const allTexts = [item.target, ...item.distractors];
    // Shuffle placement order via deterministic index permutation while keeping `isTarget` linked to index 0
    const indices = allTexts.map((_, idx) => idx);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }

    // Precompute 5 clean fallback slots (left wing, lower-left, bottom-center, lower-right, right wing)
    // guaranteed outside the Goal Center box & Scoop Dock on both portrait and landscape viewports!
    const m = baseR + 8;
    const wingY = Math.min(playBottom - m, Math.max(safeTop + m + 18, cr.y + cr.h * 0.65));
    const lowY = Math.max(safeTop + m + 28, playBottom - m - 4);
    const midLowY = Math.round((wingY + lowY) * 0.54);
    const fallbackSlots = [
      { x: Math.max(safeLeft + m, cr.x - baseR - 26), y: wingY },
      { x: Math.min(safeRight - m, cr.x + cr.w + baseR + 26), y: wingY },
      { x: Math.max(safeLeft + m, safeLeft + safeW * 0.24), y: midLowY },
      { x: Math.min(safeRight - m, safeLeft + safeW * 0.76), y: midLowY },
      { x: arena.cx, y: lowY },
    ];

    const placed: Array<{ idx: number; x: number; y: number }> = [];
    const tallArena = playBottom - belowDockY >= baseR * 2.6 + 24;

    for (let slotIdx = 0; slotIdx < indices.length; slotIdx++) {
      const itemIdx = indices[slotIdx];
      let chosen: { x: number; y: number } | null = null;
      const minSpawnY = tallArena ? belowDockY + m : safeTop + m + 8;
      const spanY = Math.max(12, playBottom - m - minSpawnY);

      for (let a = 0; a < 65; a++) {
        const tx = safeLeft + m + Math.random() * Math.max(16, safeW - 2 * m);
        const ty = minSpawnY + Math.random() * spanY;
        if (this.app.layout.overlapsGoalDock(tx, ty, baseR, arena)) continue;
        if (placed.every((o) => Math.hypot(tx - o.x, ty - o.y) >= baseR * 2.3)) {
          chosen = { x: tx, y: ty };
          break;
        }
      }

      if (!chosen) {
        const fb = fallbackSlots[slotIdx % fallbackSlots.length];
        chosen = { x: fb.x, y: fb.y };
      }
      placed.push({ idx: itemIdx, x: chosen.x, y: chosen.y });
    }

    placed.sort((a, b) => a.idx - b.idx);
    this.app.readingTargets = placed.map((p) => ({
      text: allTexts[p.idx],
      isTarget: p.idx === 0,
      x: p.x,
      y: p.y,
      r: baseR,
    }));
    this.app.target = this.app.readingTargets[0];
  }
}
