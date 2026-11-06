/** Vector illustration a correct answer morphs into; the keys the SemanticMorphEngine draws. */
export type SemanticMorphKey =
  | 'BALL'
  | 'SUN'
  | 'FOREST'
  | 'HOUSE'
  | 'CAT'
  | 'BOOK'
  | 'ICECREAM'
  | 'FISH'
  | 'RABBIT'
  | 'TREEHOUSE'
  | 'PLANE';

/** One prompt of a reading stage: the grapheme or word to find among its distractors. */
export interface ReadingItem {
  readonly target: string;
  /** Spoken or written hint shown with the prompt. */
  readonly cue: string;
  readonly morph: SemanticMorphKey;
  readonly morphLabel: string;
  readonly distractors: readonly string[];
}

/** One rung of the adaptive reading ladder (zone of proximal development). */
export interface ReadingStage {
  readonly id: number;
  readonly name: string;
  readonly desc: string;
  readonly items: readonly ReadingItem[];
}

/** How `evaluateTrial` moved the learner: up a stage, back down one, or not at all. */
export type ReadingTrialStatus = 'PROMOTED' | 'SCAFFOLDED_DOWN' | 'STEADY';

export class AdaptiveReadingEngine {
  /** Current stage, 1 to 6. */
  stage: number;
  autoZPD: boolean;
  streak: number;
  uiFontScale: number;
  mirrorConfusionRate: number;
  lastDistractorPullPx: number;
  lastDecodeLatencyMs: number;
  readingAccuracy: number;
  hits: number;
  misses: number;
  zpdScore: number;
  readonly stages: readonly ReadingStage[];

  constructor() {
    this.stage = 1;
    this.autoZPD = true;
    this.streak = 0;
    this.uiFontScale = 1.0;
    this.mirrorConfusionRate = 8.0;
    this.lastDistractorPullPx = 0;
    this.lastDecodeLatencyMs = 260;
    this.readingAccuracy = 94.5;
    this.hits = 18;
    this.misses = 1;
    this.zpdScore = 72;

    this.stages = [
      {
        id: 1,
        name: 'Stage 1: Pre-Attentive Pop-Out',
        desc: 'Distinct graphemes (A, O, X, S, M, T) — builds fast visual-motor anchor.',
        items: [
          {
            target: 'A',
            cue: 'A (appel)',
            morph: 'BALL',
            morphLabel: '★ A (appel)',
            distractors: ['O', 'X', 'T', 'S'],
          },
          {
            target: 'M',
            cue: 'M (maan)',
            morph: 'BALL',
            morphLabel: '★ M (maan)',
            distractors: ['O', 'A', 'X', 'I'],
          },
          {
            target: 'S',
            cue: 'S (ster)',
            morph: 'BALL',
            morphLabel: '★ S (ster)',
            distractors: ['X', 'O', 'T', 'A'],
          },
          {
            target: 'O',
            cue: 'O (zon)',
            morph: 'SUN',
            morphLabel: '☀️ O (zon)',
            distractors: ['X', 'T', 'I', 'M'],
          },
        ],
      },
      {
        id: 2,
        name: 'Stage 2: Mirror-Letter b/d/p/q',
        desc: 'Tests left-right dorsal stream symmetry breaking & mirror inhibition.',
        items: [
          {
            target: 'b',
            cue: 'b (buh-boing!)',
            morph: 'FOREST',
            morphLabel: '🅱️ b (buh-boing!)',
            distractors: ['d', 'p', 'q', 'h'],
          },
          {
            target: 'd',
            cue: 'd (duh-deng!)',
            morph: 'HOUSE',
            morphLabel: '🐦 d (duh-deng!)',
            distractors: ['b', 'q', 'p', 'g'],
          },
          {
            target: 'p',
            cue: 'p (puh-POP!)',
            morph: 'CAT',
            morphLabel: '🍾 p (puh-POP!)',
            distractors: ['q', 'b', 'd', 'n'],
          },
          {
            target: 'q',
            cue: 'q (kjiuueehh!)',
            morph: 'BALL',
            morphLabel: '🤪 q (kjiuueehh!)',
            distractors: ['p', 'd', 'b', 'u'],
          },
        ],
      },
      {
        id: 3,
        name: 'Stage 3: Vowel Digraphs (klanken)',
        desc: 'Two-letter phoneme units (aa, oe, ui, ij, eu, ie) — measures unitization.',
        items: [
          {
            target: 'ui',
            cue: 'ui (huis)',
            morph: 'HOUSE',
            morphLabel: '🏠 huis!',
            distractors: ['iu', 'ie', 'oe', 'au'],
          },
          {
            target: 'oe',
            cue: 'oe (boek)',
            morph: 'BOOK',
            morphLabel: '📖 boek!',
            distractors: ['eo', 'oo', 'eu', 'ui'],
          },
          {
            target: 'ij',
            cue: 'ij (ijs)',
            morph: 'ICECREAM',
            morphLabel: '🍦 ijs!',
            distractors: ['ei', 'ie', 'ui', 'aa'],
          },
          {
            target: 'eu',
            cue: 'eu (neus)',
            morph: 'CAT',
            morphLabel: '🐱 neus!',
            distractors: ['ue', 'oe', 'ui', 'ee'],
          },
        ],
      },
      {
        id: 4,
        name: 'Stage 4: CVC Core Words (MKM)',
        desc: 'Whole-word orthographic decoding vs orthographic neighbors.',
        items: [
          {
            target: 'bos',
            cue: 'bos (forest)',
            morph: 'FOREST',
            morphLabel: '🌲 bos!',
            distractors: ['dos', 'los', 'vos', 'sok'],
          },
          {
            target: 'kat',
            cue: 'kat (cat)',
            morph: 'CAT',
            morphLabel: '🐱 kat!',
            distractors: ['rat', 'mat', 'tak', 'kas'],
          },
          {
            target: 'zon',
            cue: 'zon (sun)',
            morph: 'SUN',
            morphLabel: '☀️ zon!',
            distractors: ['ton', 'oom', 'nos', 'zin'],
          },
          {
            target: 'vis',
            cue: 'vis (fish)',
            morph: 'FISH',
            morphLabel: '🐟 vis!',
            distractors: ['mis', 'sis', 'vos', 'pit'],
          },
        ],
      },
      {
        id: 5,
        name: 'Stage 5: Two-Syllable Words',
        desc: 'Syllable boundary chunking & morphological recognition.',
        items: [
          {
            target: 'ko-nijn',
            cue: 'konijn (rabbit)',
            morph: 'RABBIT',
            morphLabel: '🐰 konijn!',
            distractors: ['ko-ning', 'ka-non', 'ro-zijn', 'to-ren'],
          },
          {
            target: 'boom-hut',
            cue: 'boomhut (treehouse)',
            morph: 'TREEHOUSE',
            morphLabel: '🌳 boomhut!',
            distractors: ['boot-tocht', 'bos-pad', 'bier-dop', 'woon-boot'],
          },
          {
            target: 'vlieg-tuig',
            cue: 'vliegtuig (plane)',
            morph: 'PLANE',
            morphLabel: '✈️ vliegtuig!',
            distractors: ['voet-bal', 'vuur-werk', 'zeil-boot', 'speel-goed'],
          },
        ],
      },
      {
        id: 6,
        name: 'Stage 6: Micro-Cloze Comprehension',
        desc: 'Semantic prediction & contextual reading fluency.',
        items: [
          {
            target: 'blaft',
            cue: 'De hond ___ hard.',
            morph: 'HOUSE',
            morphLabel: '🐶 blaft!',
            distractors: ['miauw', 'vliegt', 'zwemt', 'leest'],
          },
          {
            target: 'smelt',
            cue: 'Het ijsje ___ in de zon.',
            morph: 'ICECREAM',
            morphLabel: '🍦 smelt!',
            distractors: ['bevriest', 'springt', 'zingt', 'groeit'],
          },
          {
            target: 'rond',
            cue: 'De voetbal rolt want hij is ___.',
            morph: 'SUN',
            morphLabel: '⚽ rond!',
            distractors: ['vierkant', 'zwaar', 'blauw', 'koud'],
          },
        ],
      },
    ];
  }

  getCurrentStageConfig(): ReadingStage {
    return this.stages[this.stage - 1] || this.stages[0];
  }

  evaluateTrial(
    hit: boolean,
    decodeMs: number,
    distractorPullPx: number,
    totalMt: number,
  ): ReadingTrialStatus {
    this.lastDecodeLatencyMs = Math.max(120, Math.min(2500, decodeMs));
    this.lastDistractorPullPx = distractorPullPx;

    if (hit) {
      this.hits++;
      this.streak++;
      if (this.stage === 2) {
        this.mirrorConfusionRate = Math.max(
          1,
          this.mirrorConfusionRate * 0.85 + (distractorPullPx > 28 ? 12 : 1),
        );
      }
      if (this.autoZPD && this.streak >= 3 && decodeMs < 950 && distractorPullPx < 38) {
        if (this.stage < 6) {
          this.stage++;
          this.streak = 0;
          return 'PROMOTED';
        }
      }
    } else {
      this.misses++;
      this.streak = 0;
      if (this.stage === 2) {
        this.mirrorConfusionRate = Math.min(85, this.mirrorConfusionRate + 15);
      }
      if (this.autoZPD && this.misses % 2 === 0 && this.stage > 1) {
        this.stage--;
        return 'SCAFFOLDED_DOWN';
      }
    }

    this.readingAccuracy = (this.hits / Math.max(1, this.hits + this.misses)) * 100;
    const speedScore = Math.max(0, Math.min(100, 100 - (totalMt - 650) / 35));
    this.zpdScore = Math.round(0.6 * this.readingAccuracy + 0.4 * speedScore);
    return 'STEADY';
  }
}
