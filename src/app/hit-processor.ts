import { byId, maybeById } from '../util/dom';
import type { PointingTarget, PulseTarget, ReadingTarget, Target } from '../types/arena';
import type { LabApp } from './lab-app';
import { isPointingTarget, isPulseTarget } from './targets';

/** Scores arena hits, records pointing trials and tracks spiral steering and the top-goal hover sensor. */
export class HitProcessor {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  handleArenaClick(x: number, y: number, now: number): void {
    const { level, l1Mode, target } = this.app;
    if (level === 1) {
      if (l1Mode === 'zero' && isPulseTarget(target)) {
        this.tapPulseTarget(x, y, now, target);
      } else if (l1Mode === 'shrink' && isPointingTarget(target)) {
        this.tapShrinkingTarget(x, y, now, target);
      }
    } else if (level === 2 && isPointingTarget(target)) {
      this.tapFittsTarget(x, y, now, target);
    } else if (level === 3 && this.app.spiral.path.length > 0) {
      this.tapSpiralStart(x, y, now);
    } else if (level === 7) {
      this.tapReadingBubble(x, y, now);
    }
  }

  /** Level 1 pulse tap: a tap during the wait is a logged premature impulse, a tap after the green flash is scored. */
  private tapPulseTarget(x: number, y: number, now: number, target: PulseTarget): void {
    const d = Math.hypot(x - target.x, y - target.y);
    if (d <= target.r * 1.45) {
      if (this.app.l1WaitState === 'WAITING') {
        this.logPrematureTap(now, target);
      } else if (this.app.l1WaitState === 'READY_GREEN') {
        this.scorePulseTap(x, y, now, d, target);
      }
    }
  }

  private logPrematureTap(now: number, target: PulseTarget): void {
    clearTimeout(this.app.l1WaitTimer);
    const elapsedWait = now - this.app.l1WaitStartMs;
    this.app.fpEngine.recordPrematureClick(elapsedWait, this.app.l1WaitAssignedMs, target.fpDist);
    this.app.voiceEngine.playPreset('TSSJJ');
    const impEl = maybeById('pillImpulse');
    if (impEl) impEl.textContent = String(this.app.fpEngine.prematureCount);
    this.app.hud.showToast(
      '⚡ PREMATURE IMPULSE LOGGED',
      `Tapped after ${Math.round(elapsedWait)}ms (assigned ${this.app.l1WaitAssignedMs}ms). Preserved!`,
      'border-rose-500',
    );
    this.app.spawner.spawnForCurrentLevel();
  }

  private scorePulseTap(x: number, y: number, now: number, d: number, target: PulseTarget): void {
    const rt = Math.max(25, now - this.app.l1GreenTimestamp);
    const hw = Math.round(this.app.telemetry.inputToPhotonMs);
    const brain = Math.max(20, Math.round(rt - hw));
    if (rt < 2500) {
      this.app.telemetry.rt0BaselineMs = 0.78 * this.app.telemetry.rt0BaselineMs + 0.22 * rt;
    }
    this.app.fpEngine.recordValidHit(target.tw, rt, target.fpDist);
    this.app.voiceEngine.playPreset(rt < 260 ? 'FROG_SKEEE' : 'CHICKEN_TOK');

    const lockEl = maybeById('pillEntrain');
    if (lockEl) lockEl.textContent = `${this.app.fpEngine.entrainmentLockScore}%`;

    const radialErrPx = Number(d.toFixed(1));
    const normRadiusPct = Number(Math.min(1.0, d / Math.max(8, target.r)).toFixed(3));
    const hitAngleRad = Number(Math.atan2(y - target.y, x - target.x).toFixed(2));

    this.countCorrectTrial();
    this.app.telemetry.addTrial({
      id: 0.15,
      mt: rt,
      hw,
      brain,
      ballistic: 0,
      homing: 0,
      dockInspectionMs: Math.round(this.app.currentTrialDockMs),
      gestureTagged: this.app.currentTrialGesture,
      tw: target.tw,
      fpDist: target.fpDist,
      radialErrPx,
      normRadiusPct,
      hitAngleRad,
      goalPeeks: this.app.goalMemory.trialPeekCount,
      goalHoverMs: Math.round(this.app.goalMemory.trialHoverMs),
      goalMemoryMode: this.app.goalMemory.mode,
    });
    this.finishTrial();
  }

  /** Level 1 shrinking circle: every hit makes the next circle smaller until it resets. */
  private tapShrinkingTarget(x: number, y: number, now: number, target: PointingTarget): void {
    const d = Math.hypot(x - target.x, y - target.y);
    if (d <= target.r * 1.25) {
      this.recordPointingSuccess(now, target.id, x, y, target);
      this.app.voiceEngine.playPreset(d < target.r * 0.3 ? 'OH_WOOW' : 'CHICKEN_TOK');
      this.app.shrinkRadius =
        this.app.shrinkRadius > 14 ? Math.max(12, this.app.shrinkRadius * 0.84) : 78;
      this.countCorrectTrial();
      this.finishTrial();
    }
  }

  /** Level 2 Fitts pointing at a circle or a square target. */
  private tapFittsTarget(x: number, y: number, now: number, target: PointingTarget): void {
    const d = Math.hypot(x - target.x, y - target.y);
    const hit =
      this.app.l2Shape === 'circle'
        ? d <= target.r * 1.25
        : Math.abs(x - target.x) <= target.r * 1.25 && Math.abs(y - target.y) <= target.r * 1.25;
    if (hit) {
      this.recordPointingSuccess(now, target.id, x, y, target);
      this.app.voiceEngine.playPreset(d < target.r * 0.3 ? 'OH_WOOW' : 'FROG_SKEEE');
      this.countCorrectTrial();
      this.finishTrial();
    }
  }

  /** Level 3: touching the START disc arms the steering tunnel. */
  private tapSpiralStart(x: number, y: number, now: number): void {
    const spiral = this.app.spiral;
    const startPt = spiral.path[0];
    if (!spiral.active && Math.hypot(x - startPt.x, y - startPt.y) <= startPt.w * 1.6) {
      spiral.active = true;
      spiral.startTime = now;
      spiral.progress = 0;
      spiral.insideSamples = 1;
      spiral.totalSamples = 1;
      this.app.trialStartTime = now;
    }
  }

  /** Level 7: the first bubble under the tap is evaluated by the adaptive reading engine. */
  private tapReadingBubble(x: number, y: number, now: number): void {
    const rt = this.app.readingTargets.find((b) => Math.hypot(x - b.x, y - b.y) <= b.r * 1.28);
    if (!rt) return;

    const mt = Math.max(80, now - this.app.trialStartTime);
    const hw = Math.round(this.app.telemetry.inputToPhotonMs);
    const brain =
      this.app.moveOnsetTime > this.app.trialStartTime
        ? Math.max(70, Math.round(this.app.moveOnsetTime - this.app.trialStartTime - hw))
        : Math.round(Math.min(mt * 0.42, this.app.telemetry.rt0BaselineMs + 160));

    const status = this.app.reading.evaluateTrial(rt.isTarget, brain, this.distractorPull(), mt);
    byId('navReadBadge').textContent = `S${this.app.reading.stage}`;
    byId('l7StageName').textContent = this.app.reading.getCurrentStageConfig().name;

    if (rt.isTarget) {
      this.celebrateCorrectBubble(rt, x, y, now, status === 'PROMOTED');
    } else {
      this.bumpDistractor(rt);
    }
  }

  /** Largest pull (px of overlap with the 95 px halo) the recent trail showed towards any distractor. */
  private distractorPull(): number {
    let maxPull = 0;
    const distractors = this.app.readingTargets.filter((item) => !item.isTarget);
    for (const p of this.app.trail.slice(-25)) {
      for (const distItem of distractors) {
        const distD = Math.hypot(p.x - distItem.x, p.y - distItem.y);
        if (distD < 95) maxPull = Math.max(maxPull, 95 - distD);
      }
    }
    return maxPull;
  }

  private celebrateCorrectBubble(
    rt: ReadingTarget,
    x: number,
    y: number,
    now: number,
    promoted: boolean,
  ): void {
    const item = this.app.activeReadingItem;
    const jokeSub = this.app.voiceEngine.speakGraphemeOrWord(rt.text, 'CELEBRATE');
    if (this.app.semanticMorphEnabled && item) {
      this.app.activeMorphs.push({
        x: rt.x,
        y: rt.y,
        r: rt.r,
        startTime: now,
        durationMs: 1350,
        semanticKey: item.morph || 'BALL',
        label: jokeSub || item.morphLabel || rt.text,
        gazeDwellMs: 0,
      });
    }
    this.countCorrectTrial();

    if (promoted) {
      this.app.goalMemory.stageUnfadedStreak = 0;
      this.app.goalMemory.calmFadeUnlocked = false;
      this.app.hud.showToast(
        `🎉 PROMOTED TO STAGE ${this.app.reading.stage}!`,
        this.app.reading.getCurrentStageConfig().name,
        'border-emerald-400',
      );
    }

    const chord = Math.max(
      30,
      Math.hypot(rt.x - this.app.trialStartPos.x, rt.y - this.app.trialStartPos.y),
    );
    const id = Math.log2(chord / (2 * rt.r) + 1);
    this.recordPointingSuccess(now, id, x, y, rt);
    this.finishTrial();
  }

  /** A wrong bubble resets the fade streak so the top goal re-illuminates to scaffold the learner. */
  private bumpDistractor(rt: ReadingTarget): void {
    const gm = this.app.goalMemory;
    this.app.voiceEngine.speakDistractorBump(rt.text);
    gm.autoStreak = 0;
    gm.stageUnfadedStreak = 0;
    gm.calmFadeUnlocked = false;
    gm.revealAlpha = 1.0;
    this.app.flow.configureGoalMemoryParameters();
    this.app.flow.syncStageUI();
    this.app.hud.showToast(
      `🛡️ TRY AGAIN: Look for "${this.app.activeReadingItem ? this.app.activeReadingItem.target : ''}"`,
      'Top goal re-illuminated steadily to help!',
      'border-amber-400',
    );
  }

  private countCorrectTrial(): void {
    this.app.goalMemory.stageUnfadedStreak++;
    this.app.goalMemory.autoStreak++;
  }

  /** Persists the session, then lets the envelope tutor advance or spawns the next trial. */
  private finishTrial(): void {
    this.app.persistence.saveToBrowser(this.app);
    this.advanceOrRespawn();
  }

  private advanceOrRespawn(): void {
    if (!this.app.flow.advanceEnvelopeTutor()) {
      this.app.spawner.spawnForCurrentLevel();
    }
  }

  recordPointingSuccess(
    now: number,
    id: number,
    clickX: number,
    clickY: number,
    targetObj: Target,
  ): void {
    const mt = Math.max(60, now - this.app.trialStartTime);
    const hw = Math.round(this.app.telemetry.inputToPhotonMs);
    let brain =
      this.app.moveOnsetTime > this.app.trialStartTime
        ? Math.round(this.app.moveOnsetTime - this.app.trialStartTime - hw)
        : Math.round(Math.min(mt * 0.35, this.app.telemetry.rt0BaselineMs));
    brain = Math.max(70, Math.min(mt - 40, brain));

    const motorTime = Math.max(30, mt - hw - brain);
    let ballistic = Math.round(motorTime * 0.45);
    if (this.app.decelOnsetTime > this.app.moveOnsetTime && this.app.decelOnsetTime < now) {
      ballistic = Math.round(
        Math.max(45, Math.min(motorTime * 0.85, this.app.decelOnsetTime - this.app.moveOnsetTime)),
      );
    }
    const homing = Math.max(10, Math.round(motorTime - ballistic));

    const tr = Math.max(8, targetObj.r);
    const radialErrPx = Number(Math.hypot(clickX - targetObj.x, clickY - targetObj.y).toFixed(1));
    const normRadiusPct = Number(Math.min(1.0, radialErrPx / tr).toFixed(3));
    const hitAngleRad = Number(Math.atan2(clickY - targetObj.y, clickX - targetObj.x).toFixed(2));

    this.app.telemetry.lastRadialErrPx = radialErrPx;
    this.app.telemetry.addTrial({
      id: Number(id.toFixed(3)),
      mt,
      hw,
      brain,
      ballistic,
      homing,
      dockInspectionMs: Math.round(this.app.currentTrialDockMs),
      gestureTagged: this.app.currentTrialGesture,
      radialErrPx,
      normRadiusPct,
      hitAngleRad,
      goalPeeks: this.app.goalMemory.trialPeekCount,
      goalHoverMs: Math.round(this.app.goalMemory.trialHoverMs),
      goalMemoryMode: this.app.goalMemory.mode,
      semanticMorphActive: this.app.semanticMorphEnabled,
    });
  }

  updateSpiralProgress(now: number): void {
    const spiral = this.app.spiral;
    const path = spiral.path;
    if (path.length === 0) return;
    let bestIdx = spiral.progress;
    let bestDist = Infinity;
    const limit = Math.min(path.length - 1, spiral.progress + 18);
    for (let i = Math.max(0, spiral.progress - 3); i <= limit; i++) {
      const d = Math.hypot(this.app.cursor.x - path[i].x, this.app.cursor.y - path[i].y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    spiral.progress = Math.max(spiral.progress, bestIdx);
    spiral.totalSamples++;
    if (bestDist <= path[spiral.progress].w) {
      spiral.insideSamples++;
    }
    if (spiral.progress >= path.length - 2) {
      spiral.active = false;
      const mt = Math.max(300, now - spiral.startTime);
      const hw = Math.round(this.app.telemetry.inputToPhotonMs);
      const brain = Math.round(Math.min(mt * 0.25, this.app.telemetry.rt0BaselineMs));
      const rem = Math.max(40, mt - hw - brain);
      this.app.voiceEngine.playPreset('FROG_SKEEE');
      this.app.telemetry.addTrial({
        id: 6.8,
        mt,
        hw,
        brain,
        ballistic: Math.round(rem * 0.52),
        homing: Math.round(rem * 0.48),
        dockInspectionMs: Math.round(this.app.currentTrialDockMs),
        normRadiusPct: 0.2,
        hitAngleRad: 0,
      });
      this.app.persistence.saveToBrowser(this.app);
      setTimeout(() => {
        this.advanceOrRespawn();
      }, 320);
    }
  }

  /** Tracks non-click hover or Scoop-Visor checkbacks into the top goal sensor bar. */
  updateTopGoalHoverSensor(_x: number, y: number, now: number): void {
    const { topSafeY } = this.app.layout.getSafeArenaCenter();
    const gm = this.app.goalMemory;
    const inTopZone = y <= topSafeY + 26;

    if (inTopZone) {
      if (!gm.isHoveringTopGoal) {
        gm.isHoveringTopGoal = true;
        gm.hoverEnterTime = now;
        if (gm.revealAlpha < 0.85) {
          gm.trialPeekCount++;
          this.app.telemetry.goalPeekCount++;
          const pkEl = maybeById('pillGoalPeeks');
          if (pkEl) pkEl.textContent = String(this.app.telemetry.goalPeekCount);
        }
      } else if (gm.hoverEnterTime > 0) {
        const dt = Math.min(50, Math.max(0, now - gm.hoverEnterTime));
        gm.trialHoverMs += dt;
        this.app.telemetry.totalGoalHoverMs += dt;
        gm.hoverEnterTime = now;
      }
      gm.revealAlpha = Math.min(1.0, gm.revealAlpha + 0.18);
    } else {
      gm.isHoveringTopGoal = false;
      gm.hoverEnterTime = 0;
    }
  }
}
