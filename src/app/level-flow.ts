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
   * from Pulse Tap (1A) -> Shrinking Circle (1B) -> Tillmann Pointing (L2) -> Adaptive Reading (L7).
   */
  advanceEnvelopeTutor(): boolean {
    this.app.phaseProgress++;
    const cfg = this.app.levelSteps[this.app.currentStepIdx];
    const quota = cfg ? cfg.quota : 4;

    if (this.app.autoScenarioEnabled && this.app.phaseProgress >= quota) {
      if (this.app.currentStepIdx < 4) {
        this.app.phaseProgress = 0;
        // Jump straight from Level 2 Tillmann Baseline (step 2) to Level 7 Reading (step 4)
        this.app.currentStepIdx = this.app.currentStepIdx === 2 ? 4 : this.app.currentStepIdx + 1;
        if (this.app.currentStepIdx === 4) {
          this.app.groundingComplete = true;
          this.app.hud.showToast(
            '🎓 SCHERM-BASIS KLAAR → LEZEN!',
            `Gekalibreerd RT0=${Math.round(this.app.telemetry.rt0BaselineMs)}ms & We=${Math.round(this.app.telemetry.effectiveWidthRatio * 100)}%W.`,
            'border-emerald-400',
          );
        } else {
          const nextCfg = this.app.levelSteps[this.app.currentStepIdx];
          this.app.hud.showToast(
            `✈️ ENVELOPE NEXT: ${nextCfg.badge.split('•')[1].trim()}`,
            'Smart Tutor schakelt door naar de volgende stap...',
            'border-cyan-400',
          );
        }
        this.applyStepIndex(this.app.currentStepIdx, true);
        return true;
      } else {
        this.app.phaseProgress = 0;
      }
    }
    this.syncStageUI();
    return false;
  }

  /**
   * Always-present top-left `◀` / `▶` controls:
   * - `◀` (`delta < 0`): immediate safety step-back (steps back 1 reading stage with polite scaffold,
   *   or from Reading Stage 1 directly to Level 2 Tillmann Hit-Test circles!).
   * - `▶` (`delta > 0`): steps forward through Reading Stages 1..6, or jumps directly from Level 2
   *   Tillmann Baseline into Reading Stage 1!
   */
  stepLevel(delta: number) {
    if (this.app.currentStepIdx === 4) {
      if (delta > 0 && this.app.reading.stage < 6) {
        this.app.reading.stage++;
        this.app.goalMemory.stageUnfadedStreak = 0;
        this.app.goalMemory.calmFadeUnlocked = false;
        this.app.tutor.calmStreak = 0;
        this.app.tutor.stageHitStreak = 0;
        this.app.tutor.consecutiveMisses = 0;
        this.app.tutor.temporaryStepBackTargetStage = null;
        this.syncStageUI();
        this.app.spawner.spawnForCurrentLevel();
        return;
      } else if (delta < 0) {
        this.app.goalMemory.stageUnfadedStreak = 0;
        this.app.goalMemory.calmFadeUnlocked = false;
        this.app.goalMemory.revealAlpha = 1.0;
        this.app.tutor.calmStreak = 0;
        this.app.tutor.stageHitStreak = 0;
        this.app.tutor.consecutiveMisses = 0;
        this.app.tutor.temporaryStepBackTargetStage = null;

        if (this.app.reading.stage > 1) {
          this.app.reading.stage--;
          this.app.tutor.politeScaffoldTrialsLeft = 1;
          const speech = `Even rustig een stapje terug naar stap ${this.app.reading.stage}.`;
          this.app.tutor.logExternalEvent(
            'STEP_BACK',
            `S${this.app.reading.stage}`,
            `Handmatig veilig stapje terug (◀) naar leesstap ${this.app.reading.stage}/6.`,
            speech,
            'manual=◀',
            'SOOTHING_COMFORT',
          );
          this.syncStageUI();
          this.app.spawner.spawnForCurrentLevel(true);
          this.app.hud.showToast(
            `🛡️ STAPJE TERUG (STAP ${this.app.reading.stage}/6)`,
            'Rustiger tempo met volledig zichtbaar doel!',
            'border-amber-400',
          );
          if (this.app.voiceEngine.enabled && this.app.firstTouchUnlocked) {
            const nextQ = this.app.tutor.pickNextTargetPrompt(this.app.activeReadingItem?.target);
            this.app.voiceEngine.speakDutchTutor(speech, nextQ, 'SOOTHING_COMFORT');
          }
          return;
        } else {
          // From Reading Stage 1, safety step-back `◀` goes straight to calm Level 2 Tillmann circles!
          const started = this.app.tutor.startBaselineSession(2, true);
          this.applyStepIndex(2, false, true);
          this.app.hud.showToast(
            '🛡️ TERUG NAAR TILLMANN RONDJES',
            started.dutchSpeech,
            'border-cyan-400',
          );
          if (this.app.voiceEngine.enabled && this.app.firstTouchUnlocked) {
            this.app.voiceEngine.speakDutchTutor(started.dutchSpeech, null, started.voiceEmotion);
          }
          return;
        }
      }
    }

    if (this.app.currentStepIdx === 2 && delta > 0) {
      this.app.tutor.baselineHitsRemaining = 0;
      this.app.tutor.isPeriodicBaselineCheck = false;
      this.app.groundingComplete = true;
      this.applyStepIndex(4, false);
      return;
    }

    const total = this.app.levelSteps.length;
    this.app.currentStepIdx = (this.app.currentStepIdx + delta + total) % total;
    this.applyStepIndex(this.app.currentStepIdx, false);
  }

  /** Unified 10-rung curriculum index (`0=1A, 1=1B, 2=L2, 3=L3, 4=S1 .. 9=S6`). */
  getUnifiedRung(): number {
    if (this.app.currentStepIdx < 4) {
      return Math.max(0, Math.min(3, this.app.currentStepIdx));
    }
    return 3 + Math.max(1, Math.min(6, this.app.reading.stage));
  }

  /** Short badge code (`1A`, `1B`, `L2`, `L3`, `S1`..`S6`) for the top-left tiny level stepper. */
  getShortLevelCode(): string {
    const rung = this.getUnifiedRung();
    const codes = ['1A', '1B', 'L2', 'L3', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
    return codes[rung] ?? 'L2';
  }

  /**
   * Compact `▲` / `▼` Level Up & Down Stepper (right of `◀` / `▶`):
   * Steps strictly up (`+1`) or down (`-1`) across the 10 curriculum rungs (`1A`..`S6`) without wrapping.
   */
  stepCurriculumRung(delta: 1 | -1): void {
    const prevRung = this.getUnifiedRung();
    const nextRung = Math.max(0, Math.min(9, prevRung + delta));
    if (nextRung === prevRung) {
      this.app.hud.showToast(
        delta > 0 ? '🔝 HOOGSTE LEVEL (S6)' : '🛡️ LAAGSTE BASISLEVEL (1A)',
        delta > 0
          ? 'Je zit al op Leesstap 6/6.'
          : 'Je zit al op de meest elementaire basisoefening (1A Pulse Tap).',
        'border-amber-400',
      );
      return;
    }

    this.app.tutor.calmStreak = 0;
    this.app.tutor.stageHitStreak = 0;
    this.app.tutor.fluentProbeStreak = 0;
    this.app.tutor.consecutiveMisses = 0;
    this.app.tutor.temporaryStepBackTargetStage = null;
    this.app.goalMemory.stageUnfadedStreak = 0;
    this.app.goalMemory.calmFadeUnlocked = false;
    this.app.goalMemory.revealAlpha = 1.0;

    if (nextRung < 4) {
      if (nextRung === 2) {
        this.app.tutor.startBaselineSession(2, true);
      } else {
        this.app.tutor.baselineHitsRemaining = 0;
        this.app.tutor.isPeriodicBaselineCheck = false;
      }
      this.applyStepIndex(nextRung, false, true);
    } else {
      this.app.tutor.baselineHitsRemaining = 0;
      this.app.tutor.isPeriodicBaselineCheck = false;
      this.app.groundingComplete = true;
      this.app.reading.stage = nextRung - 3;
      this.applyStepIndex(4, false, true);
    }

    const code = this.getShortLevelCode();
    const label =
      nextRung >= 4
        ? `Leesstap ${this.app.reading.stage}/6 (${this.app.reading.getCurrentStageConfig().name.split(':')[1].trim()})`
        : (this.app.levelSteps[nextRung]?.badge.split('•')[1]?.trim() ?? code);
    this.app.tutor.logExternalEvent(
      delta > 0 ? 'PROMOTE' : 'STEP_BACK',
      code,
      `Handmatige level-stap (${delta > 0 ? '▲ omhoog' : '▼ omlaag'}) → ${code}: ${label}.`,
      null,
      `rung=${nextRung + 1}/10`,
    );
    this.app.hud.showToast(
      `${delta > 0 ? '⬆️ LEVEL OMHOOG' : '⬇️ LEVEL OMLAAG'} → ${code}`,
      label,
      delta > 0 ? 'border-emerald-400' : 'border-cyan-400',
    );
  }

  applyStepIndex(idx: number, fromAutoTutor = false, silentPrompt = false) {
    this.app.currentStepIdx = Math.max(0, Math.min(this.app.levelSteps.length - 1, idx));
    if (!fromAutoTutor) {
      this.app.phaseProgress = 0;
    }
    this.app.goalMemory.stageUnfadedStreak = 0;
    this.app.goalMemory.calmFadeUnlocked = false;
    const cfg = this.app.levelSteps[this.app.currentStepIdx];
    this.app.level = cfg.level;
    this.app.l1Mode = cfg.l1Mode;
    this.app.scope3Mode =
      this.app.level === 1 && this.app.l1Mode === 'zero' ? 'PUT_HAZARD' : 'BULLSEYE_MAP';
    this.syncStageUI();
    this.app.spawner.spawnForCurrentLevel(silentPrompt);
    this.app.persistence.saveToBrowser(this.app);
  }

  syncStageUI() {
    const cfg = this.app.levelSteps[this.app.currentStepIdx];
    const quota = cfg ? cfg.quota : 4;
    const stageBadge = maybeById('activeStageBadge');
    const baseRem = this.app.tutor.baselineHitsRemaining;
    const baseTotal = Math.max(1, this.app.tutor.baselineTotalQuota);
    const baseDone = Math.max(0, baseTotal - baseRem);

    if (stageBadge) {
      if (this.app.level === 2 && baseRem > 0) {
        stageBadge.textContent = `Tillmann Scherm-Basis • Rondje ${baseDone}/${baseTotal} (Motorische Referentie)`;
      } else if (this.app.level === 7) {
        stageBadge.textContent = `Phase 5/5 • Reading Stage ${this.app.reading.stage}/6 (${this.app.reading.getCurrentStageConfig().name.split(':')[1].trim()})`;
      } else {
        stageBadge.textContent = cfg.badge;
      }
    }

    const envPill = maybeById('envelopePhasePill');
    if (envPill) {
      if (this.app.level === 2 && baseRem > 0) {
        envPill.textContent = `🎯 SCHERM-BASIS (${baseDone}/${baseTotal} rondjes) • VAST DOEL`;
      } else {
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
    const tinyLvl = maybeById('tinyLevelIndicator');
    if (tinyLvl) tinyLvl.textContent = this.getShortLevelCode();
    const tutorCountLbl = maybeById('btnHumanTutorBadge');
    if (tutorCountLbl) {
      const entryCount = this.app.feedback.entries.length;
      tutorCountLbl.textContent =
        entryCount > 0 ? `${entryCount}📋` : String(this.app.tutor.tickers.length);
    }

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
