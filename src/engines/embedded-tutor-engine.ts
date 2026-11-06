import type { VoiceEmotionId } from '../audio/voice-emotion';
import type { GoalMemoryMode, Level } from '../types/arena';
import { TimeStampUtil } from '../util/timestamp';

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
  readonly voiceEmotion: VoiceEmotionId | null;
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
  readonly lastVoiceEmotion: VoiceEmotionId;
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
  readonly voiceEmotion: VoiceEmotionId;
  readonly ticker: TutorTickerItem;
}

const GENERIC_VOCATIVES: readonly string[] = [
  'kanjer',
  'speurneus',
  'toppertje',
  'knappe lezer',
  'beste leerling',
  'slimmerik',
  'knapperd',
  'held',
];

const BULLSEYE_LINES: readonly string[] = [
  'Zo hé{, WHO}! Precies midden op {TARGET}!',
  'Bam, recht in de roos{, WHO}!',
  'Wauw, wat mik jij netjes midden in het rondje!',
  'Kijk dat eens, pal op {TARGET} geland!',
  'Scherp gezien én superstrak gestuurd{, WHO}!',
  'Hoppa, precies in het hartje van {TARGET}!',
];

const CALM_PRAISE_LINES: readonly string[] = [
  'Ja hoor, dat is {TARGET}!',
  'Helemaal goed gevonden{, WHO}!',
  'Lekker rustig gesleept, keurig!',
  'Kijk eens hoe soepel dat gaat{, WHO}!',
  'Hatsiekiedee, die heb je mooi te pakken!',
  'Netjes gelezen, dat klopt als een bus!',
  'Mooi gedaan{, WHO}, je zag {TARGET} meteen staan!',
  'Top! Rustig gekeken en meteen raak.',
  'Jaaa, hebbes! Dat was inderdaad {TARGET}.',
  'Wat gaat dat lekker vlot zeg{, WHO}!',
];

const PEEK_PRAISE_LINES: readonly string[] = [
  'Slim dat je even bovenin ging spieken{, WHO}! En meteen goed!',
  'Goed gecheckt bij het doel bovenin, dat is inderdaad {TARGET}!',
  'Even spieken mag altijd — mooi gevonden!',
  'Knap opgelost door even bovenin te kijken{, WHO}!',
];

const CORRECTED_PULL_LINES: readonly string[] = [
  'Oeh, je liet je niet foppen en koos toch knap {TARGET}!',
  'Goed bijgestuurd naar {TARGET}{, WHO}, knap verbeterd!',
  'Bijna bij die andere gekeken, maar je koos helemaal de goeie!',
  'Scherp opgelet{, WHO}, je stuurde mooi terug naar {TARGET}!',
];

const CAREFUL_SLOW_LINES: readonly string[] = [
  'Rustig gezocht en helemaal goed gevonden{, WHO}!',
  'Goed de tijd genomen, dat is inderdaad {TARGET}.',
  'Kijk, rustig speuren werkt altijd — mooi raak!',
  'Netjes hoor, we nemen lekker de tijd die nodig is.',
];

const FADE_UNLOCK_LINES: readonly string[] = [
  'Dat gaat zó lekker{, WHO}! Het voorbeeld bovenin dimt nu zachtjes. Beweeg omhoog als je wilt spieken.',
  'Knap op dreef{, WHO}! Het doelvakje bovenin gaat nu heel rustig een beetje vervagen.',
  'Je herkent ze al supergoed{, WHO}! Het doel bovenin dimt straks zachtjes, maar spieken mag altijd.',
];

const PROMOTE_LINES: readonly string[] = [
  'Hoera{, WHO}! Wat lees jij knap! Zullen we samen naar stap {STAGE} kijken?',
  'Fantastisch gedaan{, WHO}! Vier op een rij — op naar stap {STAGE}!',
  'Wauw{, WHO}, dat ging als een speer! Tijd voor een nieuw avontuur in stap {STAGE}!',
];

const MISS_ENCOURAGE_LINES: readonly string[] = [
  'Oeps, bijna{, WHO}! Kijk nog eens rustig bovenin naar {TARGET}.',
  'Geeft helemaal niks! We zoeken {TARGET}, kijk maar in het vakje bovenaan.',
  'Dat was een andere — probeer {TARGET} nog eens rustig te vangen.',
  'Bijna goed{, WHO}! Kijk nog eens goed naar de vorm van {TARGET} bovenin.',
  'Rustig maar, die leek er een beetje op! Zoek maar naar {TARGET}.',
];

const STEP_BACK_LINES: readonly string[] = [
  'Geeft niks{, WHO}! We doen heel even een stapje terug naar stap {STAGE} om lekker op te warmen.',
  'Kom{, WHO}, we doen even een stapje terug naar stap {STAGE}, lekker ontspannen in het ritme komen.',
  'Helemaal oké{, WHO}! Even een stapje terug naar stap {STAGE}, dan gaat het zo weer vanzelf.',
];

const STEP_RETURN_LINES: readonly string[] = [
  'Zie je wel{, WHO}? Dat ging super! We gaan weer lekker terug naar stap {STAGE}.',
  'Heerlijk opgewarmd{, WHO}! Hup, weer terug naar stap {STAGE}!',
  'Kijk eens hoe goed dat ging{, WHO}! We pakken het weer op bij terug naar stap {STAGE}.',
];

const GIMBAL_ASSIST_LINES: readonly string[] = [
  'Bijna op het rondje{, WHO}! Zet het bovenste kijkertje midden op de letter en laat dán pas los.',
  'Rustig mikken: schuif het bovenste vizier precies op het rondje voordat je je vinger optilt.',
  'Ik maak de letters ietsje groter voor je{, WHO} — leg het bovenste rondje er maar bovenop!',
];

const WELCOME_LINES: readonly string[] = [
  'Hoi {WHO}! Pak het blauwe handvat bij het doel bovenaan en sleep rustig naar dezelfde letter.',
  'Welkom {WHO}! Sleep het kijkertje vanaf het vakje bovenin rustig naar de goede letter.',
  'Gezellig dat je er bent, {WHO}! Pak het blauwe handvat bovenaan en zoek dezelfde letter.',
];

const NEXT_PROMPT_LINES: readonly string[] = [
  'Waar zie jij nu {NEXT}?',
  'Kun je {NEXT} vinden?',
  'En waar staat {NEXT}?',
  'Zie je {NEXT} al staan?',
  'Op zoek naar {NEXT}!',
  'Welke is {NEXT}?',
  'Waar verstopt {NEXT} zich?',
];

/**
 * Child-centred Embedded Tutor with Anti-Repetition Phrase Decks & Voice Emotion Steering:
 * - Throttles goal-memory fading gently (never unlocks after 1 hit; respects normal 5–10s child drag pacing).
 * - Throttles reading stage progression and temporary 1-stage confidence warm-ups ("even een stapje terug").
 * - Varies Dutch phrasing, omits vocatives on ~65% of ordinary lines so speech feels genuinely human,
 *   rotates affectionate Dutch terms without repeats, and pairs every reaction with a `VoiceEmotionId`.
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
  lastVoiceEmotion: VoiceEmotionId = 'WARM_ENCOURAGE';

  private seqCounter = 0;
  private lastSpokenPraiseTrial = -3;
  private trialCounter = 0;
  private spokenUtteranceCounter = 0;
  private readonly poolCursors = new Map<readonly string[], number>();
  private readonly recentTemplates: string[] = [];
  private readonly recentVocatives: string[] = [];
  private readonly recentPrompts: string[] = [];
  readonly tickers: TutorTickerItem[] = [];

  private isGenericLearner(): boolean {
    const trimmed = this.learnerName.trim().toLowerCase();
    return !trimmed || trimmed === 'beste leerling';
  }

  /**
   * Returns a warm, non-repeating Dutch vocative:
   * - If a custom grandchild nickname is set (e.g. `"Sem"`), uses `"Sem"` on milestones and mixes in
   *   affectionate Dutch pet names (`"kanjer"`, `"speurneus"`, `"toppertje"`) on casual moments.
   * - If generic (`"Beste leerling"`), rotates across warm Dutch child-friendly expressions without repeats.
   */
  vocative(preferRealName = false): string {
    if (!this.isGenericLearner()) {
      const custom = this.learnerName.trim();
      if (preferRealName || this.spokenUtteranceCounter % 2 === 0) {
        return custom;
      }
    }
    return this.pickDistinct(GENERIC_VOCATIVES, this.recentVocatives, 5);
  }

  /** Picks a varied, natural Dutch follow-up question for the next reading target (never `"Zoek nu"` every time). */
  pickNextTargetPrompt(nextTarget: string | null | undefined): string | null {
    const clean = (nextTarget || '').replace('-', '').trim();
    if (!clean) return null;
    const tpl = this.pickDistinct(NEXT_PROMPT_LINES, this.recentPrompts, 4);
    return tpl.replace(/\{NEXT\}/g, clean);
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
    const who = this.isGenericLearner()
      ? this.pickDistinct(GENERIC_VOCATIVES, this.recentVocatives, 4)
      : this.learnerName.trim();
    const tpl = this.pickDistinct(WELCOME_LINES, this.recentTemplates, 2);
    const speech = tpl.replace(/\{WHO\}/g, who);
    this.lastDecision = `Profiel actief (${this.learnerName}) — rustige start zonder vervagen.`;
    this.pushTicker('WELCOME', 'Start', this.lastDecision, speech, 'JOYFUL_SPARK', 'fade=STEADY');
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
    voiceEmotion: VoiceEmotionId;
    recommendedFontScale: number | null;
  } {
    this.emptyDropStreak++;
    this.steeringComfortPct = Math.max(40, this.steeringComfortPct - 8);
    if (this.emptyDropStreak >= 2) {
      const nextScale = Math.min(1.4, Number((currentFontScale + 0.08).toFixed(2)));
      const speech = this.renderLine(GIMBAL_ASSIST_LINES, { forceVocative: false });
      this.lastDecision = `Scoop losgelaten naast doel (${this.emptyDropStreak}x) — doelen iets groter (${Math.round(nextScale * 100)}%).`;
      this.pushTicker(
        'GIMBAL_ASSIST',
        `L${level}`,
        this.lastDecision,
        speech,
        'WARM_ENCOURAGE',
        `scale=${Math.round(nextScale * 100)}%`,
      );
      this.emptyDropStreak = 0;
      return {
        dutchSpeech: speech,
        voiceEmotion: 'WARM_ENCOURAGE',
        recommendedFontScale: nextScale,
      };
    }
    return { dutchSpeech: null, voiceEmotion: 'WARM_ENCOURAGE', recommendedFontScale: null };
  }

  /** Evaluates a reading trial with child-paced throttling, varied Dutch speech and dynamic emotion selection. */
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
    let nextStage = input.readingStage;
    let stageChanged: TrialTutorOutcome['stageChanged'] = 'STEADY';
    let recommendedFontScale: number | null = null;
    let dutchCoachLine: string | null = null;
    let voiceEmotion: VoiceEmotionId = 'WARM_ENCOURAGE';
    let kind: TutorTickerKind = 'STEADY_HOLD';

    const cleanTarget = input.targetLabel.replace('-', '');
    const peeked = input.goalPeeks > 0;
    const distracted = input.distractorPullPx > 52;
    const veryLongSearch = input.mtMs > 12500;
    const hesitant = peeked || distracted || veryLongSearch;

    if (input.hit) {
      this.consecutiveMisses = 0;
      this.stageHitStreak++;
      this.steeringComfortPct = Math.min(
        99,
        Math.round(this.steeringComfortPct * 0.85 + (input.radialNormPct < 0.55 ? 96 : 82) * 0.15),
      );

      if (hesitant) {
        this.calmStreak = Math.max(1, this.calmStreak - 1);
        kind = 'THROTTLE_BACK';
        if (peeked) {
          voiceEmotion = 'CURIOUS_WONDER';
          this.lastDecision = `Goed geraakt ("${cleanTarget}") na even spieken bovenin — doel blijft rustig langer staan.`;
        } else if (distracted) {
          voiceEmotion = 'WARM_ENCOURAGE';
          this.lastDecision = `Goed hersteld naar "${cleanTarget}" na trek richting afleider (${Math.round(input.distractorPullPx)}px) — tempo blijft kalm.`;
        } else {
          voiceEmotion = 'WARM_ENCOURAGE';
          this.lastDecision = `Rustig gezocht (${(input.mtMs / 1000).toFixed(1)}s) en "${cleanTarget}" gevonden — geen haast.`;
        }
        if (this.trialCounter === 1 || this.trialCounter - this.lastSpokenPraiseTrial >= 2) {
          const pool = peeked
            ? PEEK_PRAISE_LINES
            : distracted
              ? CORRECTED_PULL_LINES
              : CAREFUL_SLOW_LINES;
          dutchCoachLine = this.renderLine(pool, { target: cleanTarget, forceVocative: false });
          this.lastSpokenPraiseTrial = this.trialCounter;
        }
      } else {
        this.calmStreak++;
      }

      if (this.temporaryStepBackTargetStage !== null && this.temporaryWarmupHitsRemaining > 0) {
        this.temporaryWarmupHitsRemaining--;
        if (this.temporaryWarmupHitsRemaining <= 0) {
          nextStage = this.temporaryStepBackTargetStage;
          this.temporaryStepBackTargetStage = null;
          this.stageHitStreak = 0;
          this.calmStreak = 1;
          stageChanged = 'RETURNED_UP';
          kind = 'STEP_RETURN';
          voiceEmotion = 'PROUD_CELEBRATE';
          dutchCoachLine = this.renderLine(STEP_RETURN_LINES, {
            stage: nextStage,
            forceVocative: true,
            preferRealName: true,
          });
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
        voiceEmotion = 'PROUD_CELEBRATE';
        dutchCoachLine = this.renderLine(PROMOTE_LINES, {
          stage: nextStage,
          forceVocative: true,
          preferRealName: true,
        });
        this.lastDecision = `4 vlotte treffers op rij — door naar leesstap ${nextStage}/6!`;
        this.lastSpokenPraiseTrial = this.trialCounter;
      } else if (!hesitant) {
        const reqHits = this.requiredBaselineHits(rt0BaselineMs, trialCount);
        if (this.calmStreak === reqHits && goalMode === 'AUTO_PROG') {
          kind = 'FADE_THROTTLE';
          voiceEmotion = 'CURIOUS_WONDER';
          dutchCoachLine = this.renderLine(FADE_UNLOCK_LINES, {
            forceVocative: true,
            preferRealName: !this.isGenericLearner(),
          });
          this.lastDecision = `Rustige basis bereikt (${this.calmStreak}/${reqHits}) — zachte vervaging (2.8s → 1.8s) gestart.`;
          this.lastSpokenPraiseTrial = this.trialCounter;
        } else if (this.calmStreak > reqHits && goalMode === 'AUTO_PROG') {
          kind = 'FADE_THROTTLE';
          voiceEmotion = this.pickHitEmotion(input.radialNormPct);
          this.lastDecision = `Vlotte treffer "${cleanTarget}" (#${this.calmStreak}) — geheugen-venster rustig gedoseerd.`;
          if (this.trialCounter - this.lastSpokenPraiseTrial >= 2) {
            dutchCoachLine = this.pickVariedPraise(cleanTarget, input.radialNormPct);
            this.lastSpokenPraiseTrial = this.trialCounter;
          }
        } else {
          kind = 'VOICE_PRAISE';
          voiceEmotion = this.pickHitEmotion(input.radialNormPct);
          this.lastDecision = `Mooi raak op "${cleanTarget}" (${this.calmStreak}/${reqHits} richting zachte fade) — doel blijft helder.`;
          if (this.trialCounter === 1 || this.trialCounter - this.lastSpokenPraiseTrial >= 2) {
            dutchCoachLine = this.pickVariedPraise(cleanTarget, input.radialNormPct);
            this.lastSpokenPraiseTrial = this.trialCounter;
          }
        }
      }
    } else {
      this.consecutiveMisses++;
      this.stageHitStreak = 0;
      this.calmStreak = 0;
      this.steeringComfortPct = Math.max(45, this.steeringComfortPct - 10);
      voiceEmotion = 'SOOTHING_COMFORT';

      if (autoZPD && this.enabled && this.consecutiveMisses >= 2 && input.readingStage > 1) {
        this.temporaryStepBackTargetStage = input.readingStage;
        this.temporaryWarmupHitsRemaining = 2;
        nextStage = input.readingStage - 1;
        this.consecutiveMisses = 0;
        recommendedFontScale = Math.min(1.4, Number((currentFontScale + 0.08).toFixed(2)));
        stageChanged = 'STEPPED_BACK';
        kind = 'STEP_BACK';
        dutchCoachLine = this.renderLine(STEP_BACK_LINES, {
          stage: nextStage,
          forceVocative: true,
          preferRealName: true,
        });
        this.lastDecision = `2 missers op rij — tijdelijk stapje terug (${input.readingStage}→${nextStage}) voor 2 succes-treffers + groter doel.`;
        this.lastSpokenPraiseTrial = this.trialCounter;
      } else {
        kind = 'VOICE_ENCOURAGE';
        dutchCoachLine = this.renderLine(MISS_ENCOURAGE_LINES, {
          target: cleanTarget,
          forceVocative: false,
        });
        this.lastDecision = `Afleider geraakt — vervaging gepauzeerd, doel "${cleanTarget}" blijft 100% verlicht.`;
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
      dutchCoachLine ? voiceEmotion : null,
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
      voiceEmotion,
      ticker,
    };
  }

  /** Logs a manual, emotion-preview or gesture-driven tutor adjustment onto the live ticker stream. */
  logExternalEvent(
    kind: TutorTickerKind,
    stageLabel: string,
    summary: string,
    dutchSpeech: string | null = null,
    metricsTag = '',
    voiceEmotion: VoiceEmotionId | null = null,
  ): TutorTickerItem {
    this.lastDecision = summary;
    if (dutchSpeech) this.lastDutchSpeech = dutchSpeech;
    if (voiceEmotion) this.lastVoiceEmotion = voiceEmotion;
    return this.pushTicker(kind, stageLabel, summary, dutchSpeech, voiceEmotion, metricsTag);
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
      lastVoiceEmotion: this.lastVoiceEmotion,
    };
  }

  private pickHitEmotion(radialNormPct: number): VoiceEmotionId {
    if (radialNormPct <= 0.26) {
      return this.trialCounter % 2 === 0 ? 'PROUD_CELEBRATE' : 'PLAYFUL_GIGGLE';
    }
    if (this.calmStreak >= 3) {
      const cycle: readonly VoiceEmotionId[] = [
        'PLAYFUL_GIGGLE',
        'JOYFUL_SPARK',
        'PROUD_CELEBRATE',
      ];
      return cycle[this.calmStreak % cycle.length];
    }
    return this.trialCounter % 2 === 0 ? 'WARM_ENCOURAGE' : 'JOYFUL_SPARK';
  }

  private pickVariedPraise(cleanTarget: string, radialNormPct: number): string {
    const pool =
      radialNormPct <= 0.28 && this.trialCounter % 2 === 1 ? BULLSEYE_LINES : CALM_PRAISE_LINES;
    return this.renderLine(pool, { target: cleanTarget, forceVocative: false });
  }

  /**
   * Renders a phrase template with anti-repetition selection and natural human vocative throttling:
   * - Casual lines omit `{, WHO}` ~67% of the time so the voice never sounds like robotic mail-merge.
   * - Milestone lines (`forceVocative: true`) include a warm rotated vocative (or custom child name).
   */
  private renderLine(
    pool: readonly string[],
    opts: {
      readonly target?: string;
      readonly stage?: number;
      readonly forceVocative?: boolean;
      readonly preferRealName?: boolean;
    },
  ): string {
    this.spokenUtteranceCounter++;
    const tpl = this.pickDistinct(
      pool,
      this.recentTemplates,
      Math.max(1, Math.min(6, pool.length - 1)),
    );
    const useVocative = Boolean(opts.forceVocative) || this.spokenUtteranceCounter % 3 === 0;
    const whoSegment = useVocative ? `, ${this.vocative(Boolean(opts.preferRealName))}` : '';

    return tpl
      .replace(/\{, WHO\}/g, whoSegment)
      .replace(/\{TARGET\}/g, opts.target ?? '')
      .replace(/\{STAGE\}/g, String(opts.stage ?? ''));
  }

  private pickDistinct(pool: readonly string[], history: string[], recentWindow: number): string {
    const startIdx = this.poolCursors.get(pool) ?? 0;
    let chosen = pool[startIdx % pool.length];
    let nextCursor = startIdx + 1;

    for (let offset = 0; offset < pool.length; offset++) {
      const candidate = pool[(startIdx + offset) % pool.length];
      if (!history.includes(candidate)) {
        chosen = candidate;
        nextCursor = startIdx + offset + 1;
        break;
      }
    }

    this.poolCursors.set(pool, nextCursor % pool.length);
    history.push(chosen);
    while (history.length > recentWindow) {
      history.shift();
    }
    return chosen;
  }

  private pushTicker(
    kind: TutorTickerKind,
    stageLabel: string,
    summary: string,
    dutchSpeech: string | null,
    voiceEmotion: VoiceEmotionId | null,
    metricsTag: string,
  ): TutorTickerItem {
    this.seqCounter++;
    if (dutchSpeech) this.lastDutchSpeech = dutchSpeech;
    if (voiceEmotion) this.lastVoiceEmotion = voiceEmotion;
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
      voiceEmotion,
      metricsTag,
    };
    this.tickers.unshift(item);
    if (this.tickers.length > 45) {
      this.tickers.pop();
    }
    return item;
  }
}
