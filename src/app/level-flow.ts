import { byId, maybeById } from '../util/dom';
import type { LabApp } from './lab-app';

/** Level and envelope-tutor progression: stepping between levels, grounding to reading, stage UI sync. */
export class LevelFlow {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  /**
   * Smart Envelope-Flying Tutor:
   * Counts successful trials in the current Tillmann grounding phase and automatically advances
   * from Pulse Tap (1A) -> Shrinking Circle (1B) -> Tillmann Pointing (L2) -> Spiral Flight (L3) -> Adaptive Reading (L7).
   * Once in Reading or when doing well, Auto-Fade memory progressively engages!
   */
  advanceEnvelopeTutor(): boolean {
    this.app.phaseProgress++;
    const cfg = this.app.levelSteps[this.app.currentStepIdx];
    const quota = cfg ? cfg.quota : 4;

    if (this.app.autoScenarioEnabled && this.app.phaseProgress >= quota) {
      if (this.app.currentStepIdx < 4) {
        this.app.phaseProgress = 0;
        this.app.currentStepIdx++;
        if (this.app.currentStepIdx === 4) {
          this.app.groundingComplete = true;
          this.app.hud.showToast(
            '🎓 GROUNDING COMPLETE → READING FLIGHT!',
            `Calibrated RT0=${Math.round(this.app.telemetry.rt0BaselineMs)}ms & We=${Math.round(this.app.telemetry.effectiveWidthRatio * 100)}%W. Auto-Fade Memory active!`,
            'border-emerald-400',
          );
        } else {
          const nextCfg = this.app.levelSteps[this.app.currentStepIdx];
          this.app.hud.showToast(
            `✈️ ENVELOPE NEXT: ${nextCfg.badge.split('•')[1].trim()}`,
            'Smart Tutor advancing your Tillmann grounding scenario...',
            'border-cyan-400',
          );
        }
        this.applyStepIndex(this.app.currentStepIdx, true);
        return true;
      } else {
        // In Phase 5 (Reading): keep flying within the ZPD & memory envelope!
        this.app.phaseProgress = 0;
      }
    }
    this.syncStageUI();
    return false;
  }

  stepLevel(delta: number) {
    if (this.app.currentStepIdx === 4) {
      if (delta > 0 && this.app.reading.stage < 6) {
        this.app.reading.stage++;
        this.app.goalMemory.stageUnfadedStreak = 0;
        this.app.goalMemory.calmFadeUnlocked = false;
        this.app.tutor.calmStreak = 0;
        this.app.tutor.stageHitStreak = 0;
        this.app.tutor.temporaryStepBackTargetStage = null;
        this.syncStageUI();
        this.app.spawner.spawnForCurrentLevel();
        return;
      } else if (delta < 0 && this.app.reading.stage > 1) {
        this.app.reading.stage--;
        this.app.goalMemory.stageUnfadedStreak = 0;
        this.app.goalMemory.calmFadeUnlocked = false;
        this.app.tutor.calmStreak = 0;
        this.app.tutor.stageHitStreak = 0;
        this.app.tutor.temporaryStepBackTargetStage = null;
        this.syncStageUI();
        this.app.spawner.spawnForCurrentLevel();
        return;
      }
    }
    const total = this.app.levelSteps.length;
    this.app.currentStepIdx = (this.app.currentStepIdx + delta + total) % total;
    this.applyStepIndex(this.app.currentStepIdx, false);
  }

  applyStepIndex(idx: number, fromAutoTutor = false) {
    this.app.currentStepIdx = Math.max(0, Math.min(this.app.levelSteps.length - 1, idx));
    if (!fromAutoTutor) {
      this.app.phaseProgress = 0;
    }
    // Reset per-stage unfaded baseline check whenever entering a new game phase
    this.app.goalMemory.stageUnfadedStreak = 0;
    this.app.goalMemory.calmFadeUnlocked = false;
    const cfg = this.app.levelSteps[this.app.currentStepIdx];
    this.app.level = cfg.level;
    this.app.l1Mode = cfg.l1Mode;
    this.app.scope3Mode =
      this.app.level === 1 && this.app.l1Mode === 'zero' ? 'PUT_HAZARD' : 'BULLSEYE_MAP';
    this.syncStageUI();
    this.app.spawner.spawnForCurrentLevel();
    this.app.persistence.saveToBrowser(this.app);
  }

  syncStageUI() {
    const cfg = this.app.levelSteps[this.app.currentStepIdx];
    const quota = cfg ? cfg.quota : 4;
    const stageBadge = maybeById('activeStageBadge');
    if (stageBadge) {
      stageBadge.textContent =
        this.app.level === 7
          ? `Phase 5/5 • Reading Stage ${this.app.reading.stage}/6 (${this.app.reading.getCurrentStageConfig().name.split(':')[1].trim()})`
          : cfg.badge;
    }

    const envPill = maybeById('envelopePhasePill');
    if (envPill) {
      const reqHits = this.app.goalMemory.RequiredBaselineHits || 1;
      let memTag = '👁️ STEADY (NO FADE)';
      if (this.app.goalMemory.mode !== 'ALWAYS') {
        if (this.app.goalMemory.calmFadeUnlocked) {
          memTag = `🌅 FADE ACTIVE (${(this.app.goalMemory.initialShowMs / 1000).toFixed(2)}s hold → ${(this.app.goalMemory.fadeDurationMs / 1000).toFixed(1)}s fade)`;
        } else {
          memTag = `👁️ BASELINE CHECK (${this.app.goalMemory.stageUnfadedStreak}/${reqHits} unfaded)`;
        }
      }
      envPill.textContent = this.app.autoScenarioEnabled
        ? `STEP ${this.app.currentStepIdx + 1}/5 (${this.app.phaseProgress}/${quota}) • ${memTag}`
        : `MANUAL MODE • ${memTag}`;
    }

    document.querySelectorAll<HTMLElement>('.lvl-btn').forEach((b) => {
      b.classList.toggle('active', parseInt(b.dataset.step ?? '', 10) === this.app.currentStepIdx);
    });
    byId('navReadBadge').textContent = `S${this.app.reading.stage}`;
    byId('l7StageName').textContent = this.app.reading.getCurrentStageConfig().name;

    const btnZero = byId('btnL1Zero');
    const btnShrink = byId('btnL1Shrink');
    if (this.app.l1Mode === 'zero') {
      btnZero.className = 'ergo-sub-btn active';
      btnShrink.className = 'ergo-sub-btn';
    } else {
      btnShrink.className = 'ergo-sub-btn active';
      btnZero.className = 'ergo-sub-btn';
    }
    const learnerLbl = maybeById('learnerNameLabel');
    if (learnerLbl) learnerLbl.textContent = this.app.persistence.activeNickname;
    const tutorCountLbl = maybeById('btnHumanTutorBadge');
    if (tutorCountLbl) tutorCountLbl.textContent = String(this.app.tutor.tickers.length);

    this.app.hud.updateHUDText();
    setTimeout(() => {
      this.app.guiEngine.scanDOMElements();
      this.app.layout.clampActiveTargetsToSafeView();
    }, 60);
  }

  /**
   * Configures Goal Memory fade timing & working-memory parameters via the Embedded Tutor's
   * child-safe throttle (never unlocks after 1 hit or drops to a 420ms shock!).
   */
  configureGoalMemoryParameters() {
    const gm = this.app.goalMemory;
    const sched = this.app.tutor.computeGoalFadeSchedule(
      gm.mode,
      gm.stageUnfadedStreak,
      this.app.telemetry.rt0BaselineMs,
      this.app.telemetry.trials.length,
    );
    gm.RequiredBaselineHits = sched.requiredHits;
    gm.calmFadeUnlocked = sched.calmFadeUnlocked;
    gm.initialShowMs = sched.initialShowMs;
    gm.fadeDurationMs = sched.fadeDurationMs;
    gm.cloakTargets = sched.cloakTargets;
  }
}
