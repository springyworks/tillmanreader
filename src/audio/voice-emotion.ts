import type {
  JokeToneOptions,
  TractNoteOptions,
  FricativeOptions,
} from './vocal-tract-formant-engine';

/** Expressive affective states driving both parametric 3-formant gestures and Dutch speech prosody. */
export const VOICE_EMOTION_IDS = [
  'WARM_ENCOURAGE',
  'JOYFUL_SPARK',
  'PROUD_CELEBRATE',
  'PLAYFUL_GIGGLE',
  'SOOTHING_COMFORT',
  'CURIOUS_WONDER',
] as const;

export type VoiceEmotionId = (typeof VOICE_EMOTION_IDS)[number];

export function isVoiceEmotionId(val: string | undefined): val is VoiceEmotionId {
  return VOICE_EMOTION_IDS.some((id) => id === val);
}

/** Continuous human-tunable affect parameters (adjustable live from the Human-Tutor modal). */
export interface VoiceEmotionControls {
  /** Scales pitch excursions, formant glides and vibrato depth (`0.4` calm .. `1.6` theatrical, default `1.08`). */
  expressiveness: number;
  /** Overall Dutch speaking rate multiplier (`0.78` slow .. `1.18` brisk, default `0.96`). */
  speakingRateScale: number;
  /** Shifts vocal colour deeper/warmer (`-0.15`) vs. brighter/lighter (`+0.15`), default `0`. */
  warmthBias: number;
}

export interface UtteranceProsody {
  readonly pitch: number;
  readonly rate: number;
  readonly volume: number;
}

export interface EmotionGestureSpec {
  readonly id: VoiceEmotionId;
  readonly badge: string;
  readonly shortLabel: string;
  readonly sampleLine: string;
  readonly basePitch: number;
  readonly pitchSpread: number;
  readonly baseRate: number;
  readonly rateSpread: number;
  readonly volume: number;
  readonly tractNotes: readonly TractNoteOptions[];
  readonly fricatives?: readonly FricativeOptions[];
  readonly chimes?: readonly JokeToneOptions[];
}

export const VOICE_EMOTION_PROFILES: Record<VoiceEmotionId, EmotionGestureSpec> = {
  WARM_ENCOURAGE: {
    id: 'WARM_ENCOURAGE',
    badge: '🥰 Warm',
    shortLabel: 'Warm & Rustig',
    sampleLine: 'Mooi rustig gekeken hoor, dat gaat helemaal goed zo.',
    basePitch: 1.01,
    pitchSpread: 0.04,
    baseRate: 0.92,
    rateSpread: 0.03,
    volume: 0.91,
    tractNotes: [
      {
        startDelay: 0,
        dur: 0.24,
        f0Start: 176,
        f0Mid: 224,
        f0End: 204,
        vowelStart: 'MM',
        vowelEnd: 'AA',
        vibratoHz: 5.4,
        vibratoDepth: 6,
        gainLevel: 0.34,
      },
    ],
    chimes: [
      { startDelay: 0.02, dur: 0.14, fStart: 392, fEnd: 494, type: 'triangle', gainLevel: 0.18 },
    ],
  },

  JOYFUL_SPARK: {
    id: 'JOYFUL_SPARK',
    badge: '🤩 Blij',
    shortLabel: 'Blij & Vlot',
    sampleLine: 'Jaaa, hebbes! Die had je lekker vlot te pakken!',
    basePitch: 1.16,
    pitchSpread: 0.05,
    baseRate: 1.0,
    rateSpread: 0.03,
    volume: 0.95,
    tractNotes: [
      {
        startDelay: 0,
        dur: 0.22,
        f0Start: 235,
        f0Mid: 355,
        f0End: 315,
        vowelStart: 'IE',
        vowelEnd: 'AA',
        vibratoHz: 6.8,
        vibratoDepth: 9,
        gainLevel: 0.38,
      },
    ],
    chimes: [
      { startDelay: 0, dur: 0.09, fStart: 523, fEnd: 659, type: 'triangle', gainLevel: 0.22 },
      { startDelay: 0.09, dur: 0.12, fStart: 659, fEnd: 784, type: 'triangle', gainLevel: 0.22 },
    ],
  },

  PROUD_CELEBRATE: {
    id: 'PROUD_CELEBRATE',
    badge: '🏆 Trots',
    shortLabel: 'Supertrots',
    sampleLine: 'Wauw, recht in de roos! Wat lees jij dat knap zeg!',
    basePitch: 1.22,
    pitchSpread: 0.05,
    baseRate: 0.98,
    rateSpread: 0.03,
    volume: 0.97,
    tractNotes: [
      {
        startDelay: 0,
        dur: 0.3,
        f0Start: 205,
        f0Mid: 415,
        f0End: 295,
        vowelStart: 'OO',
        vowelEnd: 'AA',
        vibratoHz: 6.6,
        vibratoDepth: 11,
        gainLevel: 0.42,
      },
    ],
    chimes: [
      { startDelay: 0, dur: 0.08, fStart: 523, fEnd: 523, type: 'triangle', gainLevel: 0.2 },
      { startDelay: 0.08, dur: 0.08, fStart: 659, fEnd: 659, type: 'triangle', gainLevel: 0.21 },
      { startDelay: 0.16, dur: 0.14, fStart: 784, fEnd: 1046, type: 'triangle', gainLevel: 0.23 },
    ],
  },

  PLAYFUL_GIGGLE: {
    id: 'PLAYFUL_GIGGLE',
    badge: '🤭 Speels',
    shortLabel: 'Speels & Grappig',
    sampleLine: 'Hihi, hatsiekiedee! Jij laat je echt niet foppen hè?',
    basePitch: 1.25,
    pitchSpread: 0.06,
    baseRate: 1.02,
    rateSpread: 0.04,
    volume: 0.94,
    fricatives: [
      { startDelay: 0, dur: 0.03, freqStart: 3200, freqEnd: 2500, q: 4, gainLevel: 0.18 },
      { startDelay: 0.12, dur: 0.03, freqStart: 3400, freqEnd: 2700, q: 4, gainLevel: 0.18 },
    ],
    tractNotes: [
      {
        startDelay: 0.015,
        dur: 0.09,
        f0Start: 315,
        f0End: 365,
        vowelStart: 'IE',
        vowelEnd: 'IJ',
        vibratoHz: 8,
        vibratoDepth: 8,
        gainLevel: 0.36,
      },
      {
        startDelay: 0.135,
        dur: 0.14,
        f0Start: 355,
        f0End: 425,
        vowelStart: 'IE',
        vowelEnd: 'AA',
        vibratoHz: 8.5,
        vibratoDepth: 10,
        gainLevel: 0.38,
      },
    ],
  },

  SOOTHING_COMFORT: {
    id: 'SOOTHING_COMFORT',
    badge: '💛 Troost',
    shortLabel: 'Zacht & Geruststellend',
    sampleLine: 'Geeft helemaal niks hoor. Haal rustig adem en kijk nog eens bovenin.',
    basePitch: 0.93,
    pitchSpread: 0.03,
    baseRate: 0.86,
    rateSpread: 0.02,
    volume: 0.86,
    tractNotes: [
      {
        startDelay: 0,
        dur: 0.28,
        f0Start: 218,
        f0Mid: 184,
        f0End: 158,
        vowelStart: 'OO',
        vowelEnd: 'MM',
        vibratoHz: 4.6,
        vibratoDepth: 5,
        gainLevel: 0.34,
      },
    ],
    chimes: [
      { startDelay: 0.03, dur: 0.18, fStart: 349, fEnd: 330, type: 'sine', gainLevel: 0.18 },
    ],
  },

  CURIOUS_WONDER: {
    id: 'CURIOUS_WONDER',
    badge: '🧐 Vraag',
    shortLabel: 'Nieuwsgierig',
    sampleLine: 'Oeh, spannend... waar zou de volgende zich verstoppen?',
    basePitch: 1.12,
    pitchSpread: 0.04,
    baseRate: 0.94,
    rateSpread: 0.03,
    volume: 0.92,
    tractNotes: [
      {
        startDelay: 0,
        dur: 0.24,
        f0Start: 188,
        f0Mid: 215,
        f0End: 348,
        vowelStart: 'MM',
        vowelEnd: 'UI',
        vibratoHz: 5.5,
        vibratoDepth: 6,
        gainLevel: 0.33,
      },
    ],
  },
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes organic Dutch utterance prosody (`pitch`, `rate`, `volume`) from an emotion profile,
 * continuous user controls, and a deterministic/random jitter `[-1..+1]` so consecutive sentences
 * never sound mechanically identical.
 */
export function computeUtteranceProsody(
  emotion: VoiceEmotionId,
  controls: VoiceEmotionControls,
  jitterUnit = Math.random() * 2 - 1,
): UtteranceProsody {
  const spec = VOICE_EMOTION_PROFILES[emotion];
  const expr = clamp(controls.expressiveness, 0.35, 1.65);
  const rateScale = clamp(controls.speakingRateScale, 0.75, 1.25);
  const warmth = clamp(controls.warmthBias, -0.2, 0.2);
  const j = clamp(jitterUnit, -1, 1);

  const pitchExcursion = (spec.basePitch - 1.0) * expr;
  const pitch = clamp(1.0 + pitchExcursion + warmth + j * spec.pitchSpread * expr, 0.74, 1.48);

  const rateExcursion = (spec.baseRate - 0.95) * (0.65 + 0.35 * expr);
  const rate = clamp((0.95 + rateExcursion + j * spec.rateSpread) * rateScale, 0.72, 1.24);

  const volume = clamp(spec.volume + (expr - 1.0) * 0.05, 0.65, 1.0);
  return {
    pitch: Number(pitch.toFixed(3)),
    rate: Number(rate.toFixed(3)),
    volume: Number(volume.toFixed(3)),
  };
}

/**
 * Ranks browser `SpeechSynthesisVoice` candidates so Neural / Natural Dutch voices
 * (e.g. Microsoft Edge `Colette` / `Fenna` / `Maarten Online (Natural)` or `Google Nederlands`)
 * are chosen ahead of stiff offline fallback voices.
 */
export function scoreDutchVoice(voice: {
  readonly name?: string;
  readonly lang?: string;
  readonly localService?: boolean;
}): number {
  const lang = (voice.lang || '').toLowerCase();
  const name = (voice.name || '').toLowerCase();
  if (!lang.startsWith('nl')) {
    if (lang.startsWith('de')) return 5;
    return 0;
  }
  let score = lang.startsWith('nl-nl') ? 100 : 85;
  if (name.includes('natural') || name.includes('neural')) score += 60;
  if (name.includes('online')) score += 25;
  if (name.includes('colette') || name.includes('fenna') || name.includes('maarten')) score += 30;
  if (name.includes('google')) score += 22;
  if (name.includes('espeak') || name.includes('compact')) score -= 35;
  return score;
}

export function selectBestDutchVoice<
  T extends { readonly name?: string; readonly lang?: string; readonly localService?: boolean },
>(voices: readonly T[]): T | null {
  if (voices.length === 0) return null;
  let best = voices[0];
  let bestScore = scoreDutchVoice(best);
  for (let i = 1; i < voices.length; i++) {
    const sc = scoreDutchVoice(voices[i]);
    if (sc > bestScore) {
      bestScore = sc;
      best = voices[i];
    }
  }
  return best;
}
