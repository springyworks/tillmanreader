import type { VoiceEmotionId } from '../audio/voice-emotion';
import type { GoalMemoryMode, Level } from '../types/arena';
import { TimeStampUtil } from '../util/timestamp';

/** Categories of decisions emitted by the built-in Embedded Tutor onto the live ticker stream. */
export type TutorTickerKind =
  | 'WELCOME'
  | 'BASELINE_CHECK'
  | 'STEADY_HOLD'
  | 'FADE_THROTTLE'
  | 'THROTTLE_BACK'
  | 'VOICE_PRAISE'
  | 'VOICE_ENCOURAGE'
  | 'STEP_BACK'
  | 'STEP_RETURN'
  | 'FIRST_LETTER_SCAFFOLD'
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

/** Multi-dimensional reading trial configuration scheduled by the Embedded Tutor. */
export interface ReadingVariationPlan {
  readonly distractorCount: number;
  readonly targetCount: 1 | 2;
  readonly politeFirstLetterScaffold: boolean;
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
  readonly baselineHitsRemaining: number;
  readonly activeDistractorCount: number;
  readonly activeTargetCount: 1 | 2;
  readonly politeFirstLetterScaffold: boolean;
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

const POLITE_FIRST_LETTER_LINES: readonly string[] = [
  'We proberen stap {STAGE} nu extra vriendelijk{, WHO}! Zie je de eerste letter {FIRST} van alle woordjes oplichten? Net als bij de losse letters zoeken we {TARGET}!',
  'Heerlijk opgewarmd{, WHO}! Kijk naar het gouden streepje onder de eerste letter {FIRST} van elk woordje — zie jij welk woordje met {FIRST} begint voor {TARGET}?',
  'Terug naar stap {STAGE}, maar nu extra rustig{, WHO}: zie je de beginletter {FIRST} van alle woordjes? Die ken je al van de losse letters — vang {TARGET} maar!',
];

const BASELINE_WELCOME_LINES: readonly string[] = [
  'Hoi {WHO}! We beginnen met drie groene Tillmann-rondjes om te voelen hoe fijn het op dit scherm dingen doen gaat.',
  'Welkom {WHO}! Pak het blauwe handvat bovenaan en vang eerst drie groene rondjes als rustige scherm-check.',
  'Gezellig dat je er bent, {WHO}! Eerst drie gewone rondjes vangen zodat we weten hoe soepel jouw vinger over dit scherm glijdt.',
];

const BASELINE_PERIODIC_START_LINES: readonly string[] = [
  'Even tussendoor twee gewone rondjes vangen{, WHO}, om te kijken hoe lekker ontspannen het op het scherm dingen doen gaat!',
  'Kom{, WHO}, we doen heel even twee groene scherm-rondjes tussendoor — kijken hoe soepel je over het scherm stuurt!',
  'Korte tussenstop met twee groene rondjes{, WHO}, zo meten we hoe fijn en rustig het bewegen op het scherm nu gaat!',
];

const BASELINE_INITIAL_COMPLETE_LINES: readonly string[] = [
  'Super{, WHO}! Kijk eens hoe goed het op het scherm dingen doen al gaat! Nu gaan we vrolijk letters en woordjes vangen.',
  'Wauw{, WHO}, wat stuur jij soepel over het scherm! De basis staat als een huis — op naar de letters!',
  'Helemaal top{, WHO}! Het mikken op dit scherm gaat hartstikke fijn. Laten we nu lekker woordjes en letters zoeken!',
];

const BASELINE_PERIODIC_COMPLETE_LINES: readonly string[] = [
  'Prachtig{, WHO}, wat gaat het op het scherm dingen doen lekker vast en ontspannen! We gaan weer vrolijk verder met lezen.',
  'Zie je hoe soepel je over het scherm beweegt{, WHO}? Helemaal super — hup, weer terug naar onze woordjes!',
  'Kijk dat eens{, WHO}: het mikken op het scherm gaat nog steeds als een zonnetje! We pakken onze woordjes weer op.',
];

const DUAL_TARGET_PROMPTS: readonly string[] = [
  'Dubbel feest: er staan nu twee bolletjes met {NEXT} — vang ze allebei!',
  'Kijk goed, er zijn nu twee doelen met {NEXT}! Pak eerst de ene en dan de tweede.',
  'Twee keer prijs! Zoek allebei de bolletjes met {NEXT}!',
];

const DUAL_FIRST_HIT_LINES: readonly string[] = [
  'Dat is één! Kun je nu ook de tweede {TARGET} vangen?',
  'Mooi, de eerste {TARGET} is binnen! Pak nu ook de andere {TARGET}!',
  'Eentje te pakken! Waar staat de tweede {TARGET}?',
];

const GIMBAL_ASSIST_LINES: readonly string[] = [
  'Bijna op het rondje{, WHO}! Zet het bovenste kijkertje midden op de letter en laat dán pas los.',
  'Rustig mikken: schuif het bovenste vizier precies op het rondje voordat je je vinger optilt.',
  'Ik maak de letters ietsje groter voor je{, WHO} — leg het bovenste rondje er maar bovenop!',
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
 * Child-centred Embedded Tutor with Tillmann Screen Baseline, Multi-Dimensional Variations & Voice Emotion:
 * - Launches on Level 2 (Tillmann Hit-Test) for a 3-circle motor baseline and periodically steps back
 *   for a 2-circle screen checkup with warm Dutch voice explanation (*"hoe goed het gaat met op het scherm dingen doen"*).
 * - Varies distraction (`2..4` distractors) and target multiplicity (`1` vs `2` targets).
 * - Steps back for 2 confident warm-up hits after 2 misses, then retries the harder stage politely with a
 *   First-Letter visual spotlight + Dutch voice bridge back to single letters.
 */
export class EmbeddedTutorEngine {
  enabled = true;
  learnerName = 'beste leerling';
  calmStreak = 0;
  stageHitStreak = 0;
  consecutiveMisses = 0;
  emptyDropStreak = 0;
  steeringComfortPct = 88;

  /** Tillmann Level 2 baseline reference & periodic motor checkup counters. */
  baselineHitsRemaining = 3;
  baselineTotalQuota = 3;
  isPeriodicBaselineCheck = false;
  readingHitsSinceBaseline = 0;
  baselineMeanMtMs = 1150;
  baselineMeanNormErr = 0.32;

  /** Controlled step-back & polite first-letter retry state. */
  temporaryStepBackTargetStage: number | null = null;
  temporaryWarmupHitsRemaining = 0;
  politeRetryPending = false;
  politeScaffoldTrialsLeft = 0;
  activeVariation: ReadingVariationPlan = {
    distractorCount: 3,
    targetCount: 1,
    politeFirstLetterScaffold: false,
  };

  lastDecision = 'Tillmann scherm-basismeting actief (3 groene rondjes) vóór het lezen.';
  lastDutchSpeech = '';
  lastVoiceEmotion: VoiceEmotionId = 'WARM_ENCOURAGE';

  private seqCounter = 0;
  private lastSpokenPraiseTrial = -3;
  private trialCounter = 0;
  private variationCounter = 0;
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
   * - Custom grandchild nickname (e.g. `"Sem"`) is used on milestones and mixed with affectionate Dutch pet names.
   * - Generic `"Beste leerling"` rotates across warm child-friendly expressions without robotic repeats.
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

  /** Picks a varied, natural Dutch follow-up question for the next reading target (supporting 2x Dual-Target). */
  pickNextTargetPrompt(nextTarget: string | null | undefined): string | null {
    const clean = (nextTarget || '').replace('-', '').trim();
    if (!clean) return null;
    if (this.activeVariation.targetCount === 2) {
      const dualTpl = this.pickDistinct(DUAL_TARGET_PROMPTS, this.recentPrompts, 2);
      return dualTpl.replace(/\{NEXT\}/g, clean);
    }
    const tpl = this.pickDistinct(NEXT_PROMPT_LINES, this.recentPrompts, 4);
    return tpl.replace(/\{NEXT\}/g, clean);
  }

  /** Encourages catching the second matching bubble during a Dual-Target (`targetCount === 2`) trial. */
  buildDualTargetFirstHitSpeech(targetText: string): string {
    const clean = targetText.replace('-', '').trim();
    const tpl = this.pickDistinct(DUAL_FIRST_HIT_LINES, this.recentPrompts, 2);
    return tpl.replace(/\{TARGET\}/g, clean);
  }

  resetForLearner(nickname: string): void {
    this.learnerName = nickname.trim() || 'beste leerling';
    this.calmStreak = 0;
    this.stageHitStreak = 0;
    this.consecutiveMisses = 0;
    this.emptyDropStreak = 0;
    this.steeringComfortPct = 88;
    this.baselineHitsRemaining = 3;
    this.baselineTotalQuota = 3;
    this.isPeriodicBaselineCheck = false;
    this.readingHitsSinceBaseline = 0;
    this.temporaryStepBackTargetStage = null;
    this.temporaryWarmupHitsRemaining = 0;
    this.politeRetryPending = false;
    this.politeScaffoldTrialsLeft = 0;
    this.activeVariation = {
      distractorCount: 2,
      targetCount: 1,
      politeFirstLetterScaffold: false,
    };
    this.trialCounter = 0;
    this.variationCounter = 0;
    this.lastSpokenPraiseTrial = -3;
    const who = this.isGenericLearner()
      ? this.pickDistinct(GENERIC_VOCATIVES, this.recentVocatives, 4)
      : this.learnerName.trim();
    const tpl = this.pickDistinct(BASELINE_WELCOME_LINES, this.recentTemplates, 2);
    const speech = tpl.replace(/\{WHO\}/g, who);
    this.lastDecision = `Profiel actief (${this.learnerName}) — start met 3 Tillmann scherm-rondjes als basisreferentie.`;
    this.pushTicker(
      'WELCOME',
      'L2-Basis',
      this.lastDecision,
      speech,
      'JOYFUL_SPARK',
      'baseline=0/3 • fade=STEADY',
    );
  }

  /** Arms either the initial 3-hit URL-open baseline or a periodic 2-hit screen checkup on Level 2. */
  startBaselineSession(
    quota = 3,
    isPeriodic = false,
  ): { dutchSpeech: string; voiceEmotion: VoiceEmotionId } {
    this.baselineTotalQuota = Math.max(1, quota);
    this.baselineHitsRemaining = this.baselineTotalQuota;
    this.isPeriodicBaselineCheck = isPeriodic;

    if (isPeriodic) {
      const speech = this.renderLine(BASELINE_PERIODIC_START_LINES, {
        forceVocative: true,
        preferRealName: !this.isGenericLearner(),
      });
      this.lastDecision = `Periodieke Tillmann scherm-check (${quota} rondjes) — kijken hoe ontspannen het sturen op het scherm gaat.`;
      this.pushTicker(
        'BASELINE_CHECK',
        'L2-Check',
        this.lastDecision,
        speech,
        'CURIOUS_WONDER',
        `quota=${quota}`,
      );
      return { dutchSpeech: speech, voiceEmotion: 'CURIOUS_WONDER' };
    }

    const who = this.vocative(true);
    const tpl = this.pickDistinct(BASELINE_WELCOME_LINES, this.recentTemplates, 2);
    const speech = tpl.replace(/\{WHO\}/g, who);
    return { dutchSpeech: speech, voiceEmotion: 'JOYFUL_SPARK' };
  }

  /** Records a Level 2 Tillmann pointing hit and announces warm Dutch screen-skill feedback on completion. */
  recordBaselineHit(
    mtMs: number,
    normRadiusPct: number,
  ): {
    completed: boolean;
    hitsDone: number;
    totalQuota: number;
    dutchSpeech: string | null;
    voiceEmotion: VoiceEmotionId;
  } {
    this.emptyDropStreak = 0;
    this.baselineMeanMtMs = Math.round(this.baselineMeanMtMs * 0.7 + mtMs * 0.3);
    this.baselineMeanNormErr = Number(
      (this.baselineMeanNormErr * 0.7 + normRadiusPct * 0.3).toFixed(3),
    );
    this.steeringComfortPct = Math.min(
      99,
      Math.round(this.steeringComfortPct * 0.8 + (normRadiusPct < 0.55 ? 96 : 84) * 0.2),
    );

    if (this.baselineHitsRemaining > 0) {
      this.baselineHitsRemaining--;
    }
    const hitsDone = this.baselineTotalQuota - this.baselineHitsRemaining;

    if (this.baselineHitsRemaining <= 0) {
      const wasPeriodic = this.isPeriodicBaselineCheck;
      this.isPeriodicBaselineCheck = false;
      this.readingHitsSinceBaseline = 0;
      const pool = wasPeriodic ? BASELINE_PERIODIC_COMPLETE_LINES : BASELINE_INITIAL_COMPLETE_LINES;
      const speech = this.renderLine(pool, {
        forceVocative: true,
        preferRealName: true,
      });
      this.lastDecision = wasPeriodic
        ? `Scherm-check geslaagd (${hitsDone}/${this.baselineTotalQuota}, gem. ${this.baselineMeanMtMs}ms) — terug naar lezen!`
        : `Tillmann basisreferentie vastgelegd (${hitsDone}/${this.baselineTotalQuota}, gem. ${this.baselineMeanMtMs}ms) — door naar lezen!`;
      this.pushTicker(
        'BASELINE_CHECK',
        'L2→L7',
        this.lastDecision,
        speech,
        'PROUD_CELEBRATE',
        `MT=${Math.round(mtMs)}ms • r=${Math.round(normRadiusPct * 100)}%`,
      );
      return {
        completed: true,
        hitsDone,
        totalQuota: this.baselineTotalQuota,
        dutchSpeech: speech,
        voiceEmotion: 'PROUD_CELEBRATE',
      };
    }

    const rem = this.baselineHitsRemaining;
    const interimSpeech =
      hitsDone === 1 && this.baselineTotalQuota >= 3
        ? `Mooi raak! Nog ${rem === 1 ? 'één groen rondje' : `${rem} groene rondjes`} voor onze scherm-check.`
        : null;
    this.lastDecision = `Tillmann basis-treffer ${hitsDone}/${this.baselineTotalQuota} (${Math.round(mtMs)}ms).`;
    return {
      completed: false,
      hitsDone,
      totalQuota: this.baselineTotalQuota,
      dutchSpeech: interimSpeech,
      voiceEmotion: 'JOYFUL_SPARK',
    };
  }

  /** Triggers a brief 2-circle Level 2 baseline checkup every 8 reading hits so motor baseline stays fresh. */
  shouldTriggerPeriodicBaselineCheck(): {
    trigger: boolean;
    dutchSpeech: string | null;
    voiceEmotion: VoiceEmotionId;
  } {
    if (
      !this.enabled ||
      this.temporaryStepBackTargetStage !== null ||
      this.politeScaffoldTrialsLeft > 0 ||
      this.readingHitsSinceBaseline < 8
    ) {
      return { trigger: false, dutchSpeech: null, voiceEmotion: 'WARM_ENCOURAGE' };
    }
    this.readingHitsSinceBaseline = 0;
    const started = this.startBaselineSession(2, true);
    return {
      trigger: true,
      dutchSpeech: started.dutchSpeech,
      voiceEmotion: started.voiceEmotion,
    };
  }

  /**
   * Schedules multi-dimensional reading trial parameters:
   * - Polite re-try after a 2-hit step-back: `distractorCount = 2`, `targetCount = 1`, and
   *   `politeFirstLetterScaffold = true` on 2+ letter items so the 1st letter lights up visually!
   * - Confident flow: scales distractors (`2 -> 3 -> 4`) and introduces Dual-Target (`targetCount = 2`) trials.
   */
  planNextReadingVariation(readingStage: number, targetText: string): ReadingVariationPlan {
    this.variationCounter++;
    const cleanLen = targetText.replace('-', '').trim().length;

    if (!this.enabled) {
      this.activeVariation = {
        distractorCount: 3,
        targetCount: 1,
        politeFirstLetterScaffold: false,
      };
      return this.activeVariation;
    }

    if (this.politeScaffoldTrialsLeft > 0) {
      this.politeScaffoldTrialsLeft--;
      this.activeVariation = {
        distractorCount: 2,
        targetCount: 1,
        politeFirstLetterScaffold: cleanLen >= 2,
      };
      return this.activeVariation;
    }

    if (this.temporaryStepBackTargetStage !== null) {
      this.activeVariation = {
        distractorCount: 2,
        targetCount: 1,
        politeFirstLetterScaffold: false,
      };
      return this.activeVariation;
    }

    const distractorCount = this.stageHitStreak === 0 ? 2 : this.stageHitStreak <= 2 ? 3 : 4;
    const useDualTargets =
      this.consecutiveMisses === 0 &&
      this.stageHitStreak >= 2 &&
      readingStage >= 1 &&
      this.variationCounter % 3 === 0;

    this.activeVariation = {
      distractorCount: useDualTargets ? Math.min(3, distractorCount) : distractorCount,
      targetCount: useDualTargets ? 2 : 1,
      politeFirstLetterScaffold: false,
    };
    return this.activeVariation;
  }

  /**
   * Builds a warm, explicit Dutch coaching line when returning from a 2-hit step-back into a polite
   * re-try, pointing out the highlighted first letter of every word and linking it to single letters.
   */
  buildPoliteFirstLetterSpeech(
    nextTargetText: string | null | undefined,
    stage: number,
  ): string | null {
    const clean = (nextTargetText ?? '').replace('-', '').trim();
    if (clean.length < 2) return null;
    const first = clean.charAt(0);
    const tpl = this.pickDistinct(POLITE_FIRST_LETTER_LINES, this.recentTemplates, 2);
    const useVocative = true;
    const whoSegment = useVocative ? `, ${this.vocative(true)}` : '';
    const line = tpl
      .replace(/\{, WHO\}/g, whoSegment)
      .replace(/\{STAGE\}/g, String(stage))
      .replace(/\{FIRST\}/g, first)
      .replace(/\{TARGET\}/g, clean);

    this.lastDecision = `Vriendelijke herstart op stap ${stage}/6 — eerste letter "${first}" oplichtend op alle woordjes ("${clean}").`;
    this.pushTicker(
      'FIRST_LETTER_SCAFFOLD',
      `S${stage}`,
      this.lastDecision,
      line,
      'CURIOUS_WONDER',
      `1e-letter="${first}" • distract=2`,
    );
    return line;
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
      if (this.temporaryStepBackTargetStage === null) {
        this.readingHitsSinceBaseline++;
      }
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
          if (this.politeRetryPending) {
            this.politeRetryPending = false;
            this.politeScaffoldTrialsLeft = 2;
          }
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
          this.lastDecision = `2 opwarm-treffers geslaagd — vriendelijke herstart op leesstap ${nextStage}/6 met eerste-letter hulp.`;
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
        this.politeRetryPending = true;
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
        this.lastDecision = `2 missers op rij — tijdelijk stapje terug (${input.readingStage}→${nextStage}) voor 2 succes-treffers, daarna vriendelijke herstart met eerste-letter hulp.`;
        this.lastSpokenPraiseTrial = this.trialCounter;
      } else {
        if (this.enabled && this.consecutiveMisses >= 2 && input.readingStage === 1) {
          this.politeScaffoldTrialsLeft = 2;
          recommendedFontScale = Math.min(1.4, Number((currentFontScale + 0.08).toFixed(2)));
        }
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
      baselineHitsRemaining: this.baselineHitsRemaining,
      activeDistractorCount: this.activeVariation.distractorCount,
      activeTargetCount: this.activeVariation.targetCount,
      politeFirstLetterScaffold: this.activeVariation.politeFirstLetterScaffold,
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
