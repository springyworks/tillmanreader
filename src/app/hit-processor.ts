// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import type { LabApp } from './lab-app';

/** Scores arena hits, records pointing trials and tracks spiral steering and the top-goal hover sensor. */
export class HitProcessor {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  handleArenaClick(x, y, now) {
    if (this.app.level === 1) {
      if (this.app.l1Mode === 'zero' && this.app.target) {
        const d = Math.hypot(x - this.app.target.x, y - this.app.target.y);
        if (d <= this.app.target.r * 1.45) {
          if (this.app.l1WaitState === 'WAITING') {
            clearTimeout(this.app.l1WaitTimer);
            const elapsedWait = now - this.app.l1WaitStartMs;
            this.app.fpEngine.recordPrematureClick(
              elapsedWait,
              this.app.l1WaitAssignedMs,
              this.app.target.fpDist,
            );
            this.app.voiceEngine.playPreset('TSSJJ');
            const impEl = document.getElementById('pillImpulse');
            if (impEl) impEl.textContent = String(this.app.fpEngine.prematureCount);
            this.app.hud.showToast(
              '⚡ PREMATURE IMPULSE LOGGED',
              `Tapped after ${Math.round(elapsedWait)}ms (assigned ${this.app.l1WaitAssignedMs}ms). Preserved!`,
              'border-rose-500',
            );
            this.app.spawner.spawnForCurrentLevel();
          } else if (this.app.l1WaitState === 'READY_GREEN') {
            const rt = Math.max(25, now - this.app.l1GreenTimestamp);
            const hw = Math.round(this.app.telemetry.inputToPhotonMs);
            const brain = Math.max(20, Math.round(rt - hw));
            if (rt < 2500) {
              this.app.telemetry.rt0BaselineMs =
                0.78 * this.app.telemetry.rt0BaselineMs + 0.22 * rt;
            }
            this.app.fpEngine.recordValidHit(this.app.target.tw, rt, this.app.target.fpDist);
            this.app.voiceEngine.playPreset(rt < 260 ? 'FROG_SKEEE' : 'CHICKEN_TOK');

            const lockEl = document.getElementById('pillEntrain');
            if (lockEl) lockEl.textContent = `${this.app.fpEngine.entrainmentLockScore}%`;

            const radialErrPx = Number(d.toFixed(1));
            const normRadiusPct = Number(
              Math.min(1.0, d / Math.max(8, this.app.target.r)).toFixed(3),
            );
            const hitAngleRad = Number(
              Math.atan2(y - this.app.target.y, x - this.app.target.x).toFixed(2),
            );

            this.app.goalMemory.stageUnfadedStreak++;
            this.app.goalMemory.autoStreak++;

            this.app.telemetry.addTrial({
              id: 0.15,
              mt: rt,
              hw,
              brain,
              ballistic: 0,
              homing: 0,
              dockInspectionMs: Math.round(this.app.currentTrialDockMs),
              gestureTagged: this.app.currentTrialGesture,
              tw: this.app.target.tw,
              fpDist: this.app.target.fpDist,
              radialErrPx,
              normRadiusPct,
              hitAngleRad,
              goalPeeks: this.app.goalMemory.trialPeekCount,
              goalHoverMs: Math.round(this.app.goalMemory.trialHoverMs),
              goalMemoryMode: this.app.goalMemory.mode,
            });

            this.app.persistence.saveToBrowser(this.app);
            if (!this.app.flow.advanceEnvelopeTutor()) {
              this.app.spawner.spawnForCurrentLevel();
            }
          }
        }
      } else if (this.app.l1Mode === 'shrink' && this.app.target) {
        const d = Math.hypot(x - this.app.target.x, y - this.app.target.y);
        if (d <= this.app.target.r * 1.25) {
          this.recordPointingSuccess(now, this.app.target.id, x, y, this.app.target);
          this.app.voiceEngine.playPreset(d < this.app.target.r * 0.3 ? 'OH_WOOW' : 'CHICKEN_TOK');
          this.app.shrinkRadius =
            this.app.shrinkRadius > 14 ? Math.max(12, this.app.shrinkRadius * 0.84) : 78;
          this.app.goalMemory.stageUnfadedStreak++;
          this.app.goalMemory.autoStreak++;
          this.app.persistence.saveToBrowser(this.app);
          if (!this.app.flow.advanceEnvelopeTutor()) {
            this.app.spawner.spawnForCurrentLevel();
          }
        }
      }
    } else if (this.app.level === 2 && this.app.target) {
      const d = Math.hypot(x - this.app.target.x, y - this.app.target.y);
      const hit =
        this.app.l2Shape === 'circle'
          ? d <= this.app.target.r * 1.25
          : Math.abs(x - this.app.target.x) <= this.app.target.r * 1.25 &&
            Math.abs(y - this.app.target.y) <= this.app.target.r * 1.25;
      if (hit) {
        this.recordPointingSuccess(now, this.app.target.id, x, y, this.app.target);
        this.app.voiceEngine.playPreset(d < this.app.target.r * 0.3 ? 'OH_WOOW' : 'FROG_SKEEE');
        this.app.goalMemory.stageUnfadedStreak++;
        this.app.goalMemory.autoStreak++;
        this.app.persistence.saveToBrowser(this.app);
        if (!this.app.flow.advanceEnvelopeTutor()) {
          this.app.spawner.spawnForCurrentLevel();
        }
      }
    } else if (this.app.level === 3 && this.app.spiral.path.length > 0) {
      const startPt = this.app.spiral.path[0];
      if (!this.app.spiral.active && Math.hypot(x - startPt.x, y - startPt.y) <= startPt.w * 1.6) {
        this.app.spiral.active = true;
        this.app.spiral.startTime = now;
        this.app.spiral.progress = 0;
        this.app.spiral.insideSamples = 1;
        this.app.spiral.totalSamples = 1;
        this.app.trialStartTime = now;
      }
    } else if (this.app.level === 7) {
      for (const rt of this.app.readingTargets) {
        const d = Math.hypot(x - rt.x, y - rt.y);
        if (d <= rt.r * 1.28) {
          const mt = Math.max(80, now - this.app.trialStartTime);
          const hw = Math.round(this.app.telemetry.inputToPhotonMs);
          const brain =
            this.app.moveOnsetTime > this.app.trialStartTime
              ? Math.max(70, Math.round(this.app.moveOnsetTime - this.app.trialStartTime - hw))
              : Math.round(Math.min(mt * 0.42, this.app.telemetry.rt0BaselineMs + 160));

          let maxPull = 0;
          const distractors = this.app.readingTargets.filter((item) => !item.isTarget);
          for (const p of this.app.trail.slice(-25)) {
            for (const distItem of distractors) {
              const distD = Math.hypot(p.x - distItem.x, p.y - distItem.y);
              if (distD < 95) maxPull = Math.max(maxPull, 95 - distD);
            }
          }

          const status = this.app.reading.evaluateTrial(rt.isTarget, brain, maxPull, mt);
          document.getElementById('navReadBadge').textContent = `S${this.app.reading.stage}`;
          document.getElementById('l7StageName').textContent =
            this.app.reading.getCurrentStageConfig().name;

          if (rt.isTarget) {
            const jokeSub = this.app.voiceEngine.speakGraphemeOrWord(rt.text, 'CELEBRATE');
            if (this.app.semanticMorphEnabled && this.app.activeReadingItem) {
              this.app.activeMorphs.push({
                x: rt.x,
                y: rt.y,
                r: rt.r,
                startTime: now,
                durationMs: 1350,
                semanticKey: this.app.activeReadingItem.morph || 'BALL',
                label: jokeSub || this.app.activeReadingItem.morphLabel || rt.text,
                gazeDwellMs: 0,
              });
            }
            this.app.goalMemory.stageUnfadedStreak++;
            this.app.goalMemory.autoStreak++;

            if (status === 'PROMOTED') {
              this.app.goalMemory.stageUnfadedStreak = 0;
              this.app.goalMemory.calmFadeUnlocked = false;
              this.app.hud.showToast(
                `🎉 PROMOTED TO STAGE ${this.app.reading.stage}!`,
                this.app.reading.getCurrentStageConfig().name,
                'border-emerald-400',
              );
            }

            const startX = this.app.trialStartPos ? this.app.trialStartPos.x : x;
            const startY = this.app.trialStartPos ? this.app.trialStartPos.y : y;
            const chord = Math.max(30, Math.hypot(rt.x - startX, rt.y - startY));
            const id = Math.log2(chord / (2 * rt.r) + 1);
            this.recordPointingSuccess(now, id, x, y, rt);
            this.app.persistence.saveToBrowser(this.app);
            if (!this.app.flow.advanceEnvelopeTutor()) {
              this.app.spawner.spawnForCurrentLevel();
            }
          } else {
            // Distractor hit: reset fade streak so Top Goal re-illuminates steadily to scaffold the learner
            this.app.voiceEngine.speakDistractorBump(rt.text);
            this.app.goalMemory.autoStreak = 0;
            this.app.goalMemory.stageUnfadedStreak = 0;
            this.app.goalMemory.calmFadeUnlocked = false;
            this.app.goalMemory.revealAlpha = 1.0;
            this.app.flow.configureGoalMemoryParameters();
            this.app.flow.syncStageUI();
            this.app.hud.showToast(
              `🛡️ TRY AGAIN: Look for "${this.app.activeReadingItem ? this.app.activeReadingItem.target : ''}"`,
              'Top goal re-illuminated steadily to help!',
              'border-amber-400',
            );
          }
          break;
        }
      }
    }
  }

  recordPointingSuccess(now, id, clickX, clickY, targetObj) {
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

    const tx = targetObj ? targetObj.x : clickX;
    const ty = targetObj ? targetObj.y : clickY;
    const tr = targetObj ? Math.max(8, targetObj.r) : 30;
    const radialErrPx = Number(Math.hypot(clickX - tx, clickY - ty).toFixed(1));
    const normRadiusPct = Number(Math.min(1.0, radialErrPx / tr).toFixed(3));
    const hitAngleRad = Number(Math.atan2(clickY - ty, clickX - tx).toFixed(2));

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

  updateSpiralProgress(now) {
    const path = this.app.spiral.path;
    if (!path || path.length === 0) return;
    let bestIdx = this.app.spiral.progress;
    let bestDist = Infinity;
    const limit = Math.min(path.length - 1, this.app.spiral.progress + 18);
    for (let i = Math.max(0, this.app.spiral.progress - 3); i <= limit; i++) {
      const d = Math.hypot(this.app.cursor.x - path[i].x, this.app.cursor.y - path[i].y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    this.app.spiral.progress = Math.max(this.app.spiral.progress, bestIdx);
    this.app.spiral.totalSamples++;
    if (bestDist <= path[this.app.spiral.progress].w) {
      this.app.spiral.insideSamples++;
    }
    if (this.app.spiral.progress >= path.length - 2) {
      this.app.spiral.active = false;
      const mt = Math.max(300, now - this.app.spiral.startTime);
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
        if (!this.app.flow.advanceEnvelopeTutor()) {
          this.app.spawner.spawnForCurrentLevel();
        }
      }, 320);
    }
  }

  /**
   * Tracks non-click hover or Scoop-Visor checkbacks into the top Goal Sensor bar
   */
  updateTopGoalHoverSensor(x, y, now) {
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
          const pkEl = document.getElementById('pillGoalPeeks');
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
