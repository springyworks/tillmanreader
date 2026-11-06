/** Vector ink-line miniature a correct answer morphs into; drawn by `SemanticMorphEngine`. */
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
  | 'PLANE'
  | 'VELO'
  | 'BOAT'
  | 'TRAIN'
  | 'OWL'
  | 'DOG'
  | 'MILL'
  | 'SNAIL'
  | 'ROCKET';

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
        name: 'Stage 1: Losse Pop-Out Letters',
        desc: 'Heldere beginletters (A, M, S, O, K, R, Z, E) — bouwt een zekere letter-ankerbasis.',
        items: [
          {
            target: 'A',
            cue: 'A (appel)',
            morph: 'BALL',
            morphLabel: '✒️ A (appel)',
            distractors: ['O', 'X', 'T', 'S'],
          },
          {
            target: 'M',
            cue: 'M (maan)',
            morph: 'OWL',
            morphLabel: '🦉 M (maan)',
            distractors: ['O', 'A', 'X', 'I'],
          },
          {
            target: 'S',
            cue: 'S (slak)',
            morph: 'SNAIL',
            morphLabel: '🐌 S (slak)',
            distractors: ['X', 'O', 'T', 'A'],
          },
          {
            target: 'O',
            cue: 'O (zon)',
            morph: 'SUN',
            morphLabel: '☀️ O (zon)',
            distractors: ['X', 'T', 'I', 'M'],
          },
          {
            target: 'K',
            cue: 'K (kat)',
            morph: 'CAT',
            morphLabel: '🐱 K (kat)',
            distractors: ['O', 'S', 'M', 'E'],
          },
          {
            target: 'R',
            cue: 'R (raket)',
            morph: 'ROCKET',
            morphLabel: '🚀 R (raket)',
            distractors: ['O', 'I', 'S', 'T'],
          },
          {
            target: 'Z',
            cue: 'Z (zeilboot)',
            morph: 'BOAT',
            morphLabel: '⛵ Z (zeil)',
            distractors: ['O', 'M', 'A', 'U'],
          },
        ],
      },
      {
        id: 2,
        name: 'Stage 2: Spiegel- & Vormletters',
        desc: 'Onderscheid tussen spiegelletters (b/d/p/q en n/u/v/w) met rustige oriëntatie.',
        items: [
          {
            target: 'b',
            cue: 'b (bootje)',
            morph: 'BOAT',
            morphLabel: '⛵ b (buh-boing!)',
            distractors: ['d', 'p', 'q', 'h'],
          },
          {
            target: 'd',
            cue: 'd (dier)',
            morph: 'DOG',
            morphLabel: '🐶 d (duh-deng!)',
            distractors: ['b', 'q', 'p', 'g'],
          },
          {
            target: 'p',
            cue: 'p (plop!)',
            morph: 'CAT',
            morphLabel: '🍾 p (puh-POP!)',
            distractors: ['q', 'b', 'd', 'n'],
          },
          {
            target: 'q',
            cue: 'q (kjiuueehh!)',
            morph: 'VELO',
            morphLabel: '🚲 q (kjiuueehh!)',
            distractors: ['p', 'd', 'b', 'u'],
          },
          {
            target: 'n',
            cue: 'n (noot)',
            morph: 'SNAIL',
            morphLabel: '🎵 n (noot)',
            distractors: ['u', 'm', 'h', 'r'],
          },
          {
            target: 'u',
            cue: 'u (uil)',
            morph: 'OWL',
            morphLabel: '🦉 u (uil)',
            distractors: ['n', 'o', 'v', 'a'],
          },
        ],
      },
      {
        id: 3,
        name: 'Stage 3: Twee-Letter Woordjes & Klanken',
        desc: 'Eerste echte 2-letterwoordjes (ik, op, in, is, nu, zo, al) & tweetekenklanken (ui, oe, ij, eu).',
        items: [
          {
            target: 'ik',
            cue: 'ik (ikke!)',
            morph: 'VELO',
            morphLabel: '🚲 ik!',
            distractors: ['in', 'is', 'ok', 'al'],
          },
          {
            target: 'op',
            cue: 'op (bovenop)',
            morph: 'RABBIT',
            morphLabel: '🎩 op!',
            distractors: ['in', 'om', 'os', 'ap'],
          },
          {
            target: 'in',
            cue: 'in (erin)',
            morph: 'HOUSE',
            morphLabel: '🏠 in!',
            distractors: ['op', 'ik', 'is', 'an'],
          },
          {
            target: 'is',
            cue: 'is (dat is!)',
            morph: 'SUN',
            morphLabel: '☀️ is!',
            distractors: ['ik', 'in', 'os', 'as'],
          },
          {
            target: 'nu',
            cue: 'nu (meteen)',
            morph: 'TRAIN',
            morphLabel: '🚂 nu!',
            distractors: ['na', 'in', 'zo', 'ja'],
          },
          {
            target: 'zo',
            cue: 'zo (goed zo!)',
            morph: 'MILL',
            morphLabel: '🌷 zo!',
            distractors: ['nu', 'os', 'ja', 'op'],
          },
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
        name: 'Stage 4: Korte MKM Woordjes',
        desc: 'Klankzuivere korte woordjes tussen orthografische buren (let op de beginletter!).',
        items: [
          {
            target: 'bos',
            cue: 'bos (bomen)',
            morph: 'FOREST',
            morphLabel: '🌲 bos!',
            distractors: ['dos', 'los', 'vos', 'sok'],
          },
          {
            target: 'kat',
            cue: 'kat (poes)',
            morph: 'CAT',
            morphLabel: '🐱 kat!',
            distractors: ['rat', 'mat', 'tak', 'kas'],
          },
          {
            target: 'zon',
            cue: 'zon (warm)',
            morph: 'SUN',
            morphLabel: '☀️ zon!',
            distractors: ['ton', 'oom', 'nos', 'zin'],
          },
          {
            target: 'vis',
            cue: 'vis (zwemt)',
            morph: 'FISH',
            morphLabel: '🐟 vis!',
            distractors: ['mis', 'sis', 'vos', 'pit'],
          },
          {
            target: 'hond',
            cue: 'hond (woef!)',
            morph: 'DOG',
            morphLabel: '🐶 hond!',
            distractors: ['mond', 'rond', 'hand', 'bont'],
          },
          {
            target: 'boot',
            cue: 'boot (op zee)',
            morph: 'BOAT',
            morphLabel: '⛵ boot!',
            distractors: ['noot', 'poot', 'boom', 'rood'],
          },
          {
            target: 'trein',
            cue: 'trein (tsjoek!)',
            morph: 'TRAIN',
            morphLabel: '🚂 trein!',
            distractors: ['plein', 'klein', 'brein', 'tak'],
          },
        ],
      },
      {
        id: 5,
        name: 'Stage 5: Twee Lettergrepen',
        desc: 'Woordstukjes samenvoegen tot langere samenstellingen.',
        items: [
          {
            target: 'ko-nijn',
            cue: 'konijn (hup-hup)',
            morph: 'RABBIT',
            morphLabel: '🐰 konijn!',
            distractors: ['ko-ning', 'ka-non', 'ro-zijn', 'to-ren'],
          },
          {
            target: 'boom-hut',
            cue: 'boomhut (in de boom)',
            morph: 'TREEHOUSE',
            morphLabel: '🌳 boomhut!',
            distractors: ['boot-tocht', 'bos-pad', 'bier-dop', 'woon-boot'],
          },
          {
            target: 'vlieg-tuig',
            cue: 'vliegtuig (in de lucht)',
            morph: 'PLANE',
            morphLabel: '✈️ vliegtuig!',
            distractors: ['voet-bal', 'vuur-werk', 'zeil-boot', 'speel-goed'],
          },
          {
            target: 'wind-molen',
            cue: 'windmolen (draait)',
            morph: 'MILL',
            morphLabel: '🌷 molen!',
            distractors: ['zeil-boot', 'boom-hut', 'water-val', 'fiets-bel'],
          },
          {
            target: 'zeil-boot',
            cue: 'zeilboot (op het meer)',
            morph: 'BOAT',
            morphLabel: '⛵ zeilboot!',
            distractors: ['boom-hut', 'vlieg-tuig', 'stoom-trein', 'bak-fiets'],
          },
        ],
      },
      {
        id: 6,
        name: 'Stage 6: Zinnetjes & Begrip',
        desc: 'Kies het woord dat het verhaaltje kloppend maakt.',
        items: [
          {
            target: 'blaft',
            cue: 'De hond ___ vrolijk.',
            morph: 'DOG',
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
            cue: 'Het wiel rolt want het is ___.',
            morph: 'VELO',
            morphLabel: '🚲 rond!',
            distractors: ['vierkant', 'zwaar', 'blauw', 'koud'],
          },
          {
            target: 'vaart',
            cue: 'De boot ___ op het water.',
            morph: 'BOAT',
            morphLabel: '⛵ vaart!',
            distractors: ['fietst', 'slaapt', 'blaft', 'bakt'],
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
