import type { VoiceEmotionId } from '../audio/voice-emotion';
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
      this.app.voiceEngine.playBachGloriaPresent(0.03);
      this.app.shrinkRadius =
        this.app.shrinkRadius > 14 ? Math.max(12, this.app.shrinkRadius * 0.84) : 78;
      this.countCorrectTrial();
      this.finishTrial();
    }
  }

  /** Level 2 Tillmann Fitts pointing: establishes initial/periodic screen baseline with Dutch feedback & morph reward. */
  private tapFittsTarget(x: number, y: number, now: number, target: PointingTarget): void {
    const d = Math.hypot(x - target.x, y - target.y);
    const hit =
      this.app.l2Shape === 'circle'
        ? d <= target.r * 1.25
        : Math.abs(x - target.x) <= target.r * 1.25 && Math.abs(y - target.y) <= target.r * 1.25;
    if (!hit) return;

    const mt = Math.max(60, now - this.app.trialStartTime);
    const normRadiusPct = Math.min(1.0, d / Math.max(8, target.r));
    this.recordPointingSuccess(now, target.id, x, y, target);
    this.app.voiceEngine.playBachGloriaPresent(0.03);

    if (this.app.semanticMorphEnabled) {
      this.app.activeMorphs.push({
        x: target.x,
        y: target.y,
        r: target.r,
        startTime: now,
        durationMs: 1850,
        semanticKey: 'BALL',
        label: '✨ Raak!',
        gazeDwellMs: 0,
        variantSeed: this.app.morphCounter++,
      });
    }

    if (this.app.tutor.baselineHitsRemaining > 0) {
      const baseOut = this.app.tutor.recordBaselineHit(mt, normRadiusPct);
      if (baseOut.retrainBasicStepIdx !== null) {
        this.app.phaseProgress = 0;
        this.app.flow.applyStepIndex(baseOut.retrainBasicStepIdx, true, true);
        const retrainMsg =
          baseOut.dutchSpeech ||
          'Laten we eerst even met één groot krimp-rondje in het midden oefenen!';
        this.app.hud.showToast(
          '🛡️ BASIS-MIKKEN OEFENEN (KRIMP-CIRKEL)',
          retrainMsg,
          'border-amber-400',
        );
        this.app.voiceEngine.speakDutchTutor(retrainMsg, null, baseOut.voiceEmotion, 0.16);
        return;
      }
      if (baseOut.completed) {
        this.app.groundingComplete = true;
        this.app.phaseProgress = 0;
        this.app.flow.applyStepIndex(4, true, true);
        const msg =
          baseOut.dutchSpeech ||
          'Super! Het op het scherm dingen doen gaat hartstikke soepel — nu gaan we lezen!';
        this.app.hud.showToast(
          `🎯 SCHERM-BASIS KLAAR → LEZEN (STAP ${this.app.reading.stage}/6)!`,
          msg,
          'border-emerald-400',
        );
        const nextPrompt = this.app.tutor.pickNextTargetPrompt(this.app.activeReadingItem?.target);
        this.app.voiceEngine.speakDutchTutor(msg, nextPrompt, baseOut.voiceEmotion, 0.18);
        return;
      }

      this.app.phaseProgress = baseOut.hitsDone;
      this.app.persistence.saveToBrowser(this.app);
      this.app.spawner.spawnForCurrentLevel(true);
      this.app.flow.syncStageUI();
      if (baseOut.dutchSpeech) {
        this.app.hud.showToast(
          `🎯 RONDJE ${baseOut.hitsDone}/${baseOut.totalQuota} RAAK!`,
          baseOut.dutchSpeech,
          'border-emerald-400',
        );
        this.app.voiceEngine.speakDutchTutor(baseOut.dutchSpeech, null, baseOut.voiceEmotion, 0.14);
      } else {
        this.app.voiceEngine.playPreset(d < target.r * 0.3 ? 'OH_WOOW' : 'FROG_SKEEE');
      }
      return;
    }

    this.app.voiceEngine.playPreset(d < target.r * 0.3 ? 'OH_WOOW' : 'FROG_SKEEE');
    this.countCorrectTrial();
    this.finishTrial();
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

  /** Level 7: evaluates single or Dual-Target (`2x`) drops with the Embedded Tutor & Adaptive Reading Engine. */
  private tapReadingBubble(x: number, y: number, now: number): void {
    const rt = this.app.readingTargets.find((b) => Math.hypot(x - b.x, y - b.y) <= b.r * 1.28);
    if (!rt) return;

    // Dual-Target intermediate catch: if 2 matching targets exist, celebrate #1 and invite catching #2!
    const remainingTargets = this.app.readingTargets.filter((b) => b.isTarget);
    if (rt.isTarget && remainingTargets.length > 1) {
      const chord = Math.max(
        30,
        Math.hypot(rt.x - this.app.trialStartPos.x, rt.y - this.app.trialStartPos.y),
      );
      const id = Math.log2(chord / (2 * rt.r) + 1);
      this.recordPointingSuccess(now, id, x, y, rt);

      this.app.readingTargets = this.app.readingTargets.filter((b) => b !== rt);
      this.app.target =
        this.app.readingTargets.find((b) => b.isTarget) ?? this.app.readingTargets[0];
      this.app.layout.resetScoopVisorPosition();
      this.app.trialStartPos = { x: this.app.scoopVisor.visorX, y: this.app.scoopVisor.visorY };

      this.app.voiceEngine.playBachGloriaPresent(0.04);
      if (this.app.semanticMorphEnabled) {
        this.app.activeMorphs.push({
          x: rt.x,
          y: rt.y,
          r: rt.r,
          startTime: now,
          durationMs: 1850,
          semanticKey: this.app.activeReadingItem?.morph || 'BALL',
          label: `1/2 ${rt.text}`,
          gazeDwellMs: 0,
          variantSeed: this.app.morphCounter++,
        });
      }
      const firstHitSpeech = this.app.tutor.buildDualTargetFirstHitSpeech(rt.text);
      this.app.hud.showToast('🎯 1 VAN DE 2 GEVANGEN!', firstHitSpeech, 'border-emerald-400');
      this.app.voiceEngine.speakDutchTutor(firstHitSpeech, null, 'PLAYFUL_GIGGLE', 0.16);
      return;
    }

    const mt = Math.max(80, now - this.app.trialStartTime);
    const hw = Math.round(this.app.telemetry.inputToPhotonMs);
    const brain =
      this.app.moveOnsetTime > this.app.trialStartTime
        ? Math.max(70, Math.round(this.app.moveOnsetTime - this.app.trialStartTime - hw))
        : Math.round(Math.min(mt * 0.42, this.app.telemetry.rt0BaselineMs + 160));
    const pull = this.distractorPull(rt);
    const radialNormPct = Math.min(1.0, Math.hypot(x - rt.x, y - rt.y) / Math.max(8, rt.r));

    const prevAuto = this.app.reading.autoZPD;
    this.app.reading.autoZPD = false;
    this.app.reading.evaluateTrial(rt.isTarget, brain, pull, mt);
    this.app.reading.autoZPD = prevAuto;

    const targetLabel = this.app.activeReadingItem ? this.app.activeReadingItem.target : rt.text;
    const outcome = this.app.tutor.evaluateReadingTrial(
      {
        hit: rt.isTarget,
        readingStage: this.app.reading.stage,
        mtMs: mt,
        decodeMs: brain,
        distractorPullPx: pull,
        radialNormPct,
        goalPeeks: this.app.goalMemory.trialPeekCount,
        targetLabel,
      },
      this.app.reading.autoZPD,
      this.app.goalMemory.mode,
      this.app.telemetry.rt0BaselineMs,
      this.app.telemetry.trials.length,
      this.app.reading.uiFontScale,
    );

    this.app.reading.stage = outcome.nextStage;
    this.app.goalMemory.stageUnfadedStreak = this.app.tutor.calmStreak;
    this.app.goalMemory.autoStreak = this.app.tutor.calmStreak;
    this.app.goalMemory.calmFadeUnlocked = outcome.fadeUnlocked;
    this.app.goalMemory.initialShowMs = outcome.fadeHoldMs;
    this.app.goalMemory.fadeDurationMs = outcome.fadeDurationMs;

    if (outcome.recommendedFontScale !== null) {
      this.app.reading.uiFontScale = outcome.recommendedFontScale;
      const lbl = maybeById('lblUiScale');
      if (lbl) lbl.textContent = `${Math.round(outcome.recommendedFontScale * 100)}%`;
    }

    byId('navReadBadge').textContent = `S${this.app.reading.stage}`;
    byId('l7StageName').textContent = this.app.reading.getCurrentStageConfig().name;

    if (rt.isTarget) {
      this.celebrateCorrectBubble(
        rt,
        x,
        y,
        now,
        outcome.stageChanged,
        outcome.ticker.kind === 'PRIOR_KNOWLEDGE_JUMP',
        outcome.dutchCoachLine,
        outcome.voiceEmotion,
      );
    } else {
      this.bumpDistractor(
        rt,
        outcome.stageChanged,
        outcome.retrainBasicStepIdx,
        outcome.dutchCoachLine,
        outcome.voiceEmotion,
      );
    }
  }

  /**
   * True lateral pull (px) toward any distractor beyond the straight `trialStartPos -> target` corridor.
   * Passing by a distractor that simply lies along the straight path to the target counts as 0px pull.
   */
  private distractorPull(target: ReadingTarget): number {
    let maxPull = 0;
    const sx = this.app.trialStartPos.x;
    const sy = this.app.trialStartPos.y;
    const dx = target.x - sx;
    const dy = target.y - sy;
    const segLenSq = dx * dx + dy * dy;
    const distractors = this.app.readingTargets.filter((item) => !item.isTarget);

    for (const distItem of distractors) {
      let chordDist = Math.hypot(distItem.x - sx, distItem.y - sy);
      if (segLenSq > 1) {
        const t = Math.max(
          0,
          Math.min(1, ((distItem.x - sx) * dx + (distItem.y - sy) * dy) / segLenSq),
        );
        chordDist = Math.hypot(distItem.x - (sx + t * dx), distItem.y - (sy + t * dy));
      }
      const baselineCorridorOverlap = Math.max(0, 95 - chordDist);
      for (const p of this.app.trail.slice(-25)) {
        const distD = Math.hypot(p.x - distItem.x, p.y - distItem.y);
        if (distD < 95) {
          const lateralPull = Math.max(0, 95 - distD - baselineCorridorOverlap);
          maxPull = Math.max(maxPull, lateralPull);
        }
      }
    }
    return maxPull;
  }

  private celebrateCorrectBubble(
    rt: ReadingTarget,
    x: number,
    y: number,
    now: number,
    stageChanged: 'PROMOTED' | 'STEPPED_BACK' | 'RETURNED_UP' | 'STEADY',
    isPriorKnowledgeJump: boolean,
    dutchCoachLine: string | null,
    voiceEmotion: VoiceEmotionId,
  ): void {
    const prevItem = this.app.activeReadingItem;

    const chord = Math.max(
      30,
      Math.hypot(rt.x - this.app.trialStartPos.x, rt.y - this.app.trialStartPos.y),
    );
    const id = Math.log2(chord / (2 * rt.r) + 1);
    this.recordPointingSuccess(now, id, x, y, rt);
    this.app.persistence.saveToBrowser(this.app);

    // Reward with a gentle 1-bar J.S. Bach Gloria (Fender-Rhodes ↔ Human-Voice Choir) musical present!
    this.app.voiceEngine.playBachGloriaPresent(0.05);

    if (this.app.semanticMorphEnabled && prevItem) {
      this.app.activeMorphs.push({
        x: rt.x,
        y: rt.y,
        r: rt.r,
        startTime: now,
        durationMs: 2050,
        semanticKey: prevItem.morph || 'BALL',
        label: prevItem.morphLabel || rt.text,
        gazeDwellMs: 0,
        variantSeed: this.app.morphCounter++,
      });
    }

    // Periodic 2-circle Tillmann screen checkup after every 8 calm reading hits
    if (stageChanged === 'STEADY') {
      const periodic = this.app.tutor.shouldTriggerPeriodicBaselineCheck();
      if (periodic.trigger) {
        this.app.flow.applyStepIndex(2, true, true);
        const checkMsg =
          periodic.dutchSpeech ||
          'Even tussendoor twee groene rondjes vangen om te kijken hoe soepel het op het scherm gaat!';
        this.app.hud.showToast(
          '🎯 EVEN TUSSENDOOR: SCHERM-CHECK (2 RONDJES)',
          checkMsg,
          'border-cyan-400',
        );
        this.app.voiceEngine.speakDutchTutor(checkMsg, null, periodic.voiceEmotion, 0.22);
        return;
      }
    }

    // Spawn next trial silently first so we know the next target (and whether First-Letter Spotlight is active!)
    if (!this.app.flow.advanceEnvelopeTutor()) {
      this.app.spawner.spawnForCurrentLevel(true);
    }
    this.app.flow.syncStageUI();

    let effectiveCoachLine = dutchCoachLine;
    let effectiveEmotion = voiceEmotion;
    let nextPrompt =
      this.app.level === 7
        ? this.app.tutor.pickNextTargetPrompt(this.app.activeReadingItem?.target)
        : null;

    // When returning up after 2 warm-up hits, explain the visual First-Letter Spotlight in Dutch!
    if (
      stageChanged === 'RETURNED_UP' &&
      this.app.tutor.activeVariation.politeFirstLetterScaffold
    ) {
      const bridgeLine = this.app.tutor.buildPoliteFirstLetterSpeech(
        this.app.activeReadingItem?.target,
        this.app.reading.stage,
      );
      if (bridgeLine) {
        effectiveCoachLine = bridgeLine;
        effectiveEmotion = 'CURIOUS_WONDER';
        nextPrompt = null;
      }
    }

    const jokeSub = this.app.voiceEngine.speakGraphemeOrWord(rt.text, 'CELEBRATE', {
      skipHumanSpeech: Boolean(effectiveCoachLine),
      nextPromptLine: effectiveCoachLine ? null : nextPrompt,
    });
    if (jokeSub && this.app.activeMorphs.length > 0) {
      this.app.activeMorphs[this.app.activeMorphs.length - 1].label = jokeSub;
    }

    if (stageChanged === 'PROMOTED') {
      this.app.hud.showToast(
        isPriorKnowledgeJump
          ? `⚡ VOORKENNIS HERKEND → STAP ${this.app.reading.stage}/6!`
          : `🎉 KNAP GELEZEN! DOOR NAAR STAP ${this.app.reading.stage}/6!`,
        effectiveCoachLine || this.app.reading.getCurrentStageConfig().name,
        'border-emerald-400',
      );
    } else if (stageChanged === 'RETURNED_UP') {
      this.app.hud.showToast(
        `🔎 VRIENDELIJKE HERSTART OP STAP ${this.app.reading.stage}/6!`,
        effectiveCoachLine || 'Kijk naar de eerste letter van elk woordje!',
        'border-amber-400',
      );
    } else if (effectiveCoachLine) {
      this.app.hud.showToast('🗣️ NEDERLANDSE TUTOR', effectiveCoachLine, 'border-emerald-400');
    }

    if (effectiveCoachLine) {
      this.app.voiceEngine.speakDutchTutor(effectiveCoachLine, nextPrompt, effectiveEmotion, 0.34);
    }
  }

  /** A wrong bubble resets the fade streak, docks the visor at Goal Center, and scaffolds soothingly in Dutch. */
  private bumpDistractor(
    rt: ReadingTarget,
    stageChanged: 'PROMOTED' | 'STEPPED_BACK' | 'RETURNED_UP' | 'STEADY',
    retrainBasicStepIdx: number | null,
    dutchCoachLine: string | null,
    voiceEmotion: VoiceEmotionId,
  ): void {
    const gm = this.app.goalMemory;
    this.app.voiceEngine.speakDistractorBump(rt.text);
    gm.revealAlpha = 1.0;
    this.app.layout.resetScoopVisorPosition();

    if (retrainBasicStepIdx !== null) {
      this.app.flow.applyStepIndex(retrainBasicStepIdx, true, true);
      const basicMsg =
        dutchCoachLine ||
        'Kom, we doen eerst even twee ontspannen groene basis-rondjes op het scherm!';
      this.app.hud.showToast(
        '🛡️ EVEN TERUG NAAR DE BASIS (2 GROENE RONDJES)',
        basicMsg,
        'border-cyan-400',
      );
      this.app.voiceEngine.speakDutchTutor(basicMsg, null, voiceEmotion, 0.22);
      return;
    }

    if (stageChanged === 'STEPPED_BACK') {
      this.app.spawner.spawnForCurrentLevel(true);
      this.app.flow.syncStageUI();
      this.app.persistence.saveToBrowser(this.app);
      const msg =
        dutchCoachLine ||
        `Even een stapje terug naar stap ${this.app.reading.stage} om lekker op te warmen!`;
      this.app.hud.showToast(
        `💛 EVEN EEN STAPJE TERUG (STAP ${this.app.reading.stage}/6)`,
        msg,
        'border-amber-400',
      );
      const nextPrompt = this.app.tutor.pickNextTargetPrompt(this.app.activeReadingItem?.target);
      this.app.voiceEngine.speakDutchTutor(msg, nextPrompt, voiceEmotion, 0.2);
      return;
    }

    this.app.flow.configureGoalMemoryParameters();
    this.app.flow.syncStageUI();
    const targetTxt = this.app.activeReadingItem ? this.app.activeReadingItem.target : '';
    const msg = dutchCoachLine || `Bijna! Kijk rustig bovenaan naar "${targetTxt}".`;
    this.app.hud.showToast(`🛡️ NOG EEN KEER: Zoek "${targetTxt}"`, msg, 'border-amber-400');
    this.app.voiceEngine.speakDutchTutor(msg, null, voiceEmotion, 0.2);
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
      this.app.voiceEngine.playBachGloriaPresent(0.03);
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

  /** Tracks non-click hover or Scoop-Visor checkbacks into the top goal banner or faded Goal Center box. */
  updateTopGoalHoverSensor(x: number, y: number, now: number): void {
    const { topSafeY } = this.app.layout.getSafeArenaCenter();
    const gm = this.app.goalMemory;
    const goalCard = this.app.arenaRenderer.lastGoalCenterRect;
    const inGoalCardAfterFade =
      gm.revealAlpha < 0.9 &&
      goalCard !== null &&
      x >= goalCard.x - 8 &&
      x <= goalCard.x + goalCard.w + 8 &&
      y >= goalCard.y - 8 &&
      y <= goalCard.y + goalCard.h + 8;
    const inTopZone = y <= topSafeY - 2 || inGoalCardAfterFade;

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
