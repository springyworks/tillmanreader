import { TimeStampUtil } from '../util/timestamp';
import type { GoalMemoryMode, Level } from '../types/arena';

/** Categories of decisions emitted by the built-in Embedded Tutor onto the live ticker stream. */
export type TutorTickerKind =
  | 'WELCOME'
  | 'STEADY_HOLD'
  | 'FADE_THROTTLE'
  | 'THROTTLE_BACK'
  | 'VOICE_PRAISE'
  | 'VOICE_ENCOURAGE'
  | 'STEP_BACK'
  | 'STEP_RETURN'
  | 'PROMOTE'
  | 'GIMBAL_ASSIST';

/** One chronological decision or spoken coaching event from the Embedded Tutor. */
export interface TutorTickerItem {
  readonly seq: number;
  readonly unixMs: number;
  readonly timeLabel: string;
  readonly kind: TutorTickerKind;
  readonly stageLabel: string;
  readonly summary: string;
  readonly dutchSpeech: string | null;
  readonly metricsTag: string;
}

/** Snapshot of the Embedded Tutor's live throttling state for HUD, JSON export and Human-Tutor feedback. */
export interface TutorStatusSnapshot {
  readonly enabled: boolean;
  readonly learnerName: string;
  readonly calmStreak: number;
  readonly consecutiveMisses: number;
  readonly requiredFadeBaselineHits: number;
  readonly fadeHoldMs: number;
  readonly fadeDurationMs: number;
  readonly fadeUnlocked: boolean;
  readonly temporaryStepBackTargetStage: number | null;
  readonly temporaryWarmupHitsRemaining: number;
  readonly steeringComfortPct: number;
  readonly lastDecision: string;
  readonly lastDutchSpeech: string;
}

export interface TrialTutorInput {
  readonly hit: boolean;
  readonly readingStage: number;
  readonly mtMs: number;
  readonly decodeMs: number;
  readonly distractorPullPx: number;
  readonly radialNormPct: number;
  readonly goalPeeks: number;
  readonly targetLabel: string;
}

export interface TrialTutorOutcome {
  readonly nextStage: number;
  readonly stageChanged: 'PROMOTED' | 'STEPPED_BACK' | 'RETURNED_UP' | 'STEADY';
  readonly fadeUnlocked: boolean;
  readonly fadeHoldMs: number;
  readonly fadeDurationMs: number;
  readonly recommendedFontScale: number | null;
  readonly dutchCoachLine: string | null;
  readonly ticker: TutorTickerItem;
}

/**
 * Child-centred Embedded Tutor:
 * - Throttles goal-memory fading gently (never unlocks after 1 hit; requires calm mastery and backs off on hesitation).
 * - Throttles reading stage progression and temporary 1-stage confidence warm-ups ("even een stapje terug").
 * - Adjusts gimbal/bubble scale comfort when steering scatter or empty drops rise.
 * - Generates warm Dutch ("beste leerling" / child nickname) spoken encouragement and logs live Tutor Tickers.
 */
export class EmbeddedTutorEngine {
  enabled = true;
  learnerName = 'beste leerling';
  calmStreak = 0;
  stageHitStreak = 0;
  consecutiveMisses = 0;
  emptyDropStreak = 0;
  steeringComfortPct = 88;
  temporaryStepBackTargetStage: number | null = null;
  temporaryWarmupHitsRemaining = 0;
  lastDecision = 'Rustige start: doel blijft volledig zichtbaar tot de basis zeker voelt.';
  lastDutchSpeech = '';
  private seqCounter = 0;
  private lastSpokenPraiseTrial = -3;
  private trialCounter = 0;
  readonly tickers: TutorTickerItem[] = [];

  /** Formats the vocative name in warm Dutch ("beste leerling" by default, or the child's nickname). */
  vocative(): string {
    const trimmed = this.learnerName.trim();
    if (!trimmed || trimmed.toLowerCase() === 'beste leerling') {
      return 'beste leerling';
    }
    return trimmed;
  }

  resetForLearner(nickname: string): void {
    this.learnerName = nickname.trim() || 'beste leerling';
    this.calmStreak = 0;
    this.stageHitStreak = 0;
    this.consecutiveMisses = 0;
    this.emptyDropStreak = 0;
    this.steeringComfortPct = 88;
    this.temporaryStepBackTargetStage = null;
    this.temporaryWarmupHitsRemaining = 0;
    this.trialCounter = 0;
    this.lastSpokenPraiseTrial = -3;
    const who = this.vocative();
    const speech = `Hoi ${who}! Pak het blauwe handvat bij het doel bovenaan en sleep rustig naar dezelfde letter.`;
    this.lastDecision = `Nieuw profiel actief (${who}) — rustige start zonder vervagen.`;
    this.pushTicker('WELCOME', 'Start', this.lastDecision, speech, 'fade=STEADY');
  }

  /** Required unfaded calm hits before AUTO_PROG unlocks gentle goal fading. */
  requiredBaselineHits(rt0BaselineMs: number, trialCount: number): number {
    if (trialCount >= 8 && rt0BaselineMs < 520) {
      return 4;
    }
    return 5;
  }

  /** Computes gentle hold/fade durations for `GoalMemoryState` without abrupt jumps or target cloaking. */
  computeGoalFadeSchedule(
    mode: GoalMemoryMode,
    stageUnfadedStreak: number,
    rt0BaselineMs: number,
    trialCount: number,
  ): {
    requiredHits: number;
    calmFadeUnlocked: boolean;
    initialShowMs: number;
    fadeDurationMs: number;
    cloakTargets: boolean;
  } {
    const requiredHits = this.requiredBaselineHits(rt0BaselineMs, trialCount);
    if (mode === 'ALWAYS') {
      return {
        requiredHits,
        calmFadeUnlocked: false,
        initialShowMs: 999999,
        fadeDurationMs: 1200,
        cloakTargets: false,
      };
    }
    if (mode === 'PEEK_1200') {
      return {
        requiredHits,
        calmFadeUnlocked: true,
        initialShowMs: 1400,
        fadeDurationMs: 1200,
        cloakTargets: false,
      };
    }
    if (mode === 'MEM_500') {
      return {
        requiredHits,
        calmFadeUnlocked: true,
        initialShowMs: 650,
        fadeDurationMs: 750,
        cloakTargets: true,
      };
    }

    // AUTO_PROG: gentle child-safe throttle!
    if (!this.enabled || stageUnfadedStreak < requiredHits || this.consecutiveMisses > 0) {
      return {
        requiredHits,
        calmFadeUnlocked: false,
        initialShowMs: 999999,
        fadeDurationMs: 1600,
        cloakTargets: false,
      };
    }

    const extra = stageUnfadedStreak - requiredHits;
    // Gentle step-down: 2800ms -> 2300ms -> 1850ms -> 1450ms floor (never 420ms shock!)
    const initialShowMs = Math.max(1450, 2800 - extra * 250);
    const fadeDurationMs = Math.max(1250, 1800 - extra * 100);
    return {
      requiredHits,
      calmFadeUnlocked: true,
      initialShowMs,
      fadeDurationMs,
      cloakTargets: false,
    };
  }

  /** Records an empty-space drop of the Scoop-Visor and offers gentle steering guidance if repeated. */
  recordEmptyVisorDrop(
    level: Level,
    currentFontScale: number,
  ): {
    dutchSpeech: string | null;
    recommendedFontScale: number | null;
  } {
    this.emptyDropStreak++;
    this.steeringComfortPct = Math.max(40, this.steeringComfortPct - 8);
    if (this.emptyDropStreak >= 2) {
      const nextScale = Math.min(1.4, Number((currentFontScale + 0.08).toFixed(2)));
      const who = this.vocative();
      const speech = `Rustig aan, ${who}! Sleep het bovenste rondje precies op de letter en laat dan pas los.`;
      this.lastDecision = `Scoop losgelaten naast doel (${this.emptyDropStreak}x) — doelen iets groter (${Math.round(nextScale * 100)}%).`;
      this.pushTicker(
        'GIMBAL_ASSIST',
        `L${level}`,
        this.lastDecision,
        speech,
        `scale=${Math.round(nextScale * 100)}%`,
      );
      this.emptyDropStreak = 0;
      return { dutchSpeech: speech, recommendedFontScale: nextScale };
    }
    return { dutchSpeech: null, recommendedFontScale: null };
  }

  /** Evaluates a reading trial with child-friendly throttling, Dutch encouragement and temporary step-back logic. */
  evaluateReadingTrial(
    input: TrialTutorInput,
    autoZPD: boolean,
    goalMode: GoalMemoryMode,
    rt0BaselineMs: number,
    trialCount: number,
    currentFontScale: number,
  ): TrialTutorOutcome {
    this.trialCounter++;
    this.emptyDropStreak = 0;
    const who = this.vocative();
    let nextStage = input.readingStage;
    let stageChanged: TrialTutorOutcome['stageChanged'] = 'STEADY';
    let recommendedFontScale: number | null = null;
    let dutchCoachLine: string | null = null;
    let kind: TutorTickerKind = 'STEADY_HOLD';

    const hesitant =
      input.mtMs > 4200 ||
      input.decodeMs > 1550 ||
      input.distractorPullPx > 42 ||
      input.goalPeeks > 0;

    if (input.hit) {
      this.consecutiveMisses = 0;
      this.stageHitStreak++;
      this.steeringComfortPct = Math.min(
        99,
        Math.round(this.steeringComfortPct * 0.85 + (input.radialNormPct < 0.55 ? 96 : 82) * 0.15),
      );

      if (hesitant) {
        // Hit succeeded, but learner hesitated or peeked -> keep or restore calm visibility!
        this.calmStreak = Math.max(1, this.calmStreak - 1);
        kind = 'THROTTLE_BACK';
        this.lastDecision = `Goed geraakt ("${input.targetLabel}"), maar met lichte twijfel/spieken — doel blijft langer zichtbaar.`;
        if (this.trialCounter - this.lastSpokenPraiseTrial >= 2) {
          dutchCoachLine = `Goed gevonden, ${who}! We nemen rustig de tijd.`;
          this.lastSpokenPraiseTrial = this.trialCounter;
        }
      } else {
        this.calmStreak++;
      }

      // Check if learner was in a temporary warm-up step-back and is ready to return!
      if (this.temporaryStepBackTargetStage !== null && this.temporaryWarmupHitsRemaining > 0) {
        this.temporaryWarmupHitsRemaining--;
        if (this.temporaryWarmupHitsRemaining <= 0) {
          nextStage = this.temporaryStepBackTargetStage;
          this.temporaryStepBackTargetStage = null;
          this.stageHitStreak = 0;
          this.calmStreak = 1;
          stageChanged = 'RETURNED_UP';
          kind = 'STEP_RETURN';
          dutchCoachLine = `Zie je wel, ${who}? Dat ging super! We gaan weer lekker terug naar stap ${nextStage}.`;
          this.lastDecision = `Warm-up geslaagd — terug naar leesstap ${nextStage}/6 met rustig vast doel.`;
          this.lastSpokenPraiseTrial = this.trialCounter;
        }
      } else if (
        autoZPD &&
        this.enabled &&
        this.stageHitStreak >= 4 &&
        !hesitant &&
        input.readingStage < 6
      ) {
        nextStage = input.readingStage + 1;
        this.stageHitStreak = 0;
        this.calmStreak = 0;
        stageChanged = 'PROMOTED';
        kind = 'PROMOTE';
        dutchCoachLine = `Hoera, ${who}! Wat lees jij knap! We gaan naar stap ${nextStage}.`;
        this.lastDecision = `4 vlotte, rustige treffers op rij — door naar leesstap ${nextStage}/6!`;
        this.lastSpokenPraiseTrial = this.trialCounter;
      } else if (!hesitant) {
        const reqHits = this.requiredBaselineHits(rt0BaselineMs, trialCount);
        if (this.calmStreak === reqHits && goalMode === 'AUTO_PROG') {
          kind = 'FADE_THROTTLE';
          dutchCoachLine = `Super gedaan, ${who}! Het doel bovenin vervaagt nu heel rustig. Beweeg omhoog als je wilt spieken.`;
          this.lastDecision = `Rustige basis bereikt (${this.calmStreak}/${reqHits}) — zachte vervaging (2.8s → 1.8s) gestart.`;
          this.lastSpokenPraiseTrial = this.trialCounter;
        } else if (this.calmStreak > reqHits && goalMode === 'AUTO_PROG') {
          kind = 'FADE_THROTTLE';
          this.lastDecision = `Vlotte treffer #${this.calmStreak} — geheugen-venster rustig gedoseerd.`;
          if (this.trialCounter - this.lastSpokenPraiseTrial >= 3) {
            dutchCoachLine = this.pickDutchPraise(who, input.radialNormPct);
            this.lastSpokenPraiseTrial = this.trialCounter;
          }
        } else {
          kind = 'VOICE_PRAISE';
          this.lastDecision = `Rustige opbouw (${this.calmStreak}/${reqHits} voor zachte fade) — doel blijft helder staan.`;
          if (this.trialCounter === 1 || this.trialCounter - this.lastSpokenPraiseTrial >= 2) {
            dutchCoachLine = this.pickDutchPraise(who, input.radialNormPct);
            this.lastSpokenPraiseTrial = this.trialCounter;
          }
        }
      }
    } else {
      // Distractor tapped (miss)
      this.consecutiveMisses++;
      this.stageHitStreak = 0;
      this.calmStreak = 0;
      this.steeringComfortPct = Math.max(45, this.steeringComfortPct - 10);

      if (autoZPD && this.enabled && this.consecutiveMisses >= 2 && input.readingStage > 1) {
        this.temporaryStepBackTargetStage = input.readingStage;
        this.temporaryWarmupHitsRemaining = 2;
        nextStage = input.readingStage - 1;
        this.consecutiveMisses = 0;
        recommendedFontScale = Math.min(1.4, Number((currentFontScale + 0.08).toFixed(2)));
        stageChanged = 'STEPPED_BACK';
        kind = 'STEP_BACK';
        dutchCoachLine = `Geeft niks, ${who}! We doen heel even een stapje terug naar stap ${nextStage} om lekker op te warmen.`;
        this.lastDecision = `2 missers op rij — tijdelijk stapje terug (${input.readingStage}→${nextStage}) voor 2 succes-treffers + groter doel.`;
        this.lastSpokenPraiseTrial = this.trialCounter;
      } else {
        kind = 'VOICE_ENCOURAGE';
        dutchCoachLine = `Bijna, ${who}! Kijk nog eens rustig bovenaan naar "${input.targetLabel.replace('-', '')}".`;
        this.lastDecision = `Afleider geraakt — vervaging gepauzeerd, doel "${input.targetLabel}" blijft 100% verlicht.`;
      }
    }

    const sched = this.computeGoalFadeSchedule(
      goalMode,
      this.calmStreak,
      rt0BaselineMs,
      trialCount,
    );
    const metricsTag = `MT=${Math.round(input.mtMs)}ms • pull=${Math.round(input.distractorPullPx)}px • hold=${sched.initialShowMs > 90000 ? 'STEADY' : `${(sched.initialShowMs / 1000).toFixed(1)}s`}`;
    const ticker = this.pushTicker(
      kind,
      `S${nextStage}`,
      this.lastDecision,
      dutchCoachLine,
      metricsTag,
    );

    return {
      nextStage,
      stageChanged,
      fadeUnlocked: sched.calmFadeUnlocked,
      fadeHoldMs: sched.initialShowMs,
      fadeDurationMs: sched.fadeDurationMs,
      recommendedFontScale,
      dutchCoachLine,
      ticker,
    };
  }

  /** Logs a manual or gesture-driven tutor adjustment onto the live ticker stream. */
  logExternalEvent(
    kind: TutorTickerKind,
    stageLabel: string,
    summary: string,
    dutchSpeech: string | null = null,
    metricsTag = '',
  ): TutorTickerItem {
    this.lastDecision = summary;
    if (dutchSpeech) this.lastDutchSpeech = dutchSpeech;
    return this.pushTicker(kind, stageLabel, summary, dutchSpeech, metricsTag);
  }

  getStatusSnapshot(
    goalMode: GoalMemoryMode,
    rt0BaselineMs: number,
    trialCount: number,
  ): TutorStatusSnapshot {
    const sched = this.computeGoalFadeSchedule(
      goalMode,
      this.calmStreak,
      rt0BaselineMs,
      trialCount,
    );
    return {
      enabled: this.enabled,
      learnerName: this.learnerName,
      calmStreak: this.calmStreak,
      consecutiveMisses: this.consecutiveMisses,
      requiredFadeBaselineHits: sched.requiredHits,
      fadeHoldMs: sched.initialShowMs,
      fadeDurationMs: sched.fadeDurationMs,
      fadeUnlocked: sched.calmFadeUnlocked,
      temporaryStepBackTargetStage: this.temporaryStepBackTargetStage,
      temporaryWarmupHitsRemaining: this.temporaryWarmupHitsRemaining,
      steeringComfortPct: this.steeringComfortPct,
      lastDecision: this.lastDecision,
      lastDutchSpeech: this.lastDutchSpeech,
    };
  }

  private pickDutchPraise(who: string, radialNormPct: number): string {
    if (radialNormPct <= 0.28) {
      return `Knap gemikt, ${who}! Precies midden in de letter!`;
    }
    const lines = [
      `Goed zo, ${who}! Dat gaat heel mooi rustig!`,
      `Super gedaan, ${who}! Ga zo door!`,
      `Heel knap gelezen, ${who}!`,
      `Top hoor, ${who}! Je hebt hem helemaal goed!`,
    ];
    return lines[this.trialCounter % lines.length];
  }

  private pushTicker(
    kind: TutorTickerKind,
    stageLabel: string,
    summary: string,
    dutchSpeech: string | null,
    metricsTag: string,
  ): TutorTickerItem {
    this.seqCounter++;
    if (dutchSpeech) this.lastDutchSpeech = dutchSpeech;
    const ts = TimeStampUtil.nowPacket();
    const d = new Date(ts.unixMs);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const item: TutorTickerItem = {
      seq: this.seqCounter,
      unixMs: ts.unixMs,
      timeLabel: `${hh}:${mm}:${ss}`,
      kind,
      stageLabel,
      summary,
      dutchSpeech,
      metricsTag,
    };
    this.tickers.unshift(item);
    if (this.tickers.length > 45) {
      this.tickers.pop();
    }
    return item;
  }
}
