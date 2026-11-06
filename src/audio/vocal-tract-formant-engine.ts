import { BachGloriaSynth, computeAutoDuckTargets } from './bach-gloria-synth';
import {
  VOICE_EMOTION_PROFILES,
  computeUtteranceProsody,
  selectBestDutchVoice,
  type VoiceEmotionControls,
  type VoiceEmotionId,
} from './voice-emotion';

/** Vowel and diphthong keys of the formant table. */
export type VowelName = 'AA' | 'OO' | 'OE' | 'UU' | 'UI' | 'IJ' | 'IE' | 'EU' | 'EH' | 'UH' | 'MM';

/** Centre frequencies of the first three formants (F1, F2, F3) in Hz. */
export type FormantTriple = readonly [f1: number, f2: number, f3: number];

/** Expressive and animal-imitation sounds that `playPreset` can voice. */
export const VOCAL_PRESET_NAMES = [
  'OH_WOOW',
  'GRRRR',
  'TSSJJ',
  'HIHI',
  'CHICKEN_TOK',
  'FROG_SKEEE',
  'ASK_GLISS',
  'CAT_MIAUW',
] as const;

export type VocalPresetName = (typeof VOCAL_PRESET_NAMES)[number];

/** Narrows a DOM string (such as a `data-vfx` attribute) to a preset `playPreset` can voice. */
export function isVocalPresetName(value: string | undefined): value is VocalPresetName {
  return VOCAL_PRESET_NAMES.some((name) => name === value);
}

/** `ASKING` voices a prompt with a rising question inflection; `CELEBRATE` plays the full phonetic joke. */
export type SpeakMode = 'ASKING' | 'CELEBRATE';

/** The part of a reading-game item that gets voiced: the grapheme or word to say. */
export interface SpeakableReadingItem {
  readonly target: string;
}

/** Timing and loudness shared by every synthesized sound; all times are in seconds. */
export interface SoundEventOptions {
  /** Delay from now until the sound starts. */
  readonly startDelay?: number;
  /** Length of the sound. */
  readonly dur?: number;
  /** Peak gain of the amplitude envelope. */
  readonly gainLevel?: number;
}

/** One glottal note shaped by the three-formant filter bank; pitches and frequencies are in Hz. */
export interface TractNoteOptions extends SoundEventOptions {
  readonly f0Start?: number;
  /** Optional pitch waypoint reached at about half of the note. */
  readonly f0Mid?: number | null;
  readonly f0End?: number;
  /** Vowels whose formants the filter bank glides between. */
  readonly vowelStart?: VowelName;
  readonly vowelEnd?: VowelName;
  /** Growl FM; only applied when both the rate and the depth are positive. */
  readonly growlHz?: number;
  readonly growlDepth?: number;
  /** Pitch vibrato rate and depth; applied only when the depth is positive. */
  readonly vibratoHz?: number;
  readonly vibratoDepth?: number;
}

/** A band-passed noise burst (fricative, sibilant or plosive); frequencies are in Hz. */
export interface FricativeOptions extends SoundEventOptions {
  readonly freqStart?: number;
  readonly freqEnd?: number;
  /** Quality factor of the band-pass filter. */
  readonly q?: number;
}

/** A comic oscillator glide such as a boing, cork pop or bubble; frequencies are in Hz. */
export interface JokeToneOptions extends SoundEventOptions {
  readonly fStart?: number;
  readonly fEnd?: number;
  /** Never `'custom'`: that waveform needs a periodic wave and cannot be set through `type`. */
  readonly type?: Exclude<OscillatorType, 'custom'>;
}

/*************************************************************************
 * 6. ADAPTIVE 6-STAGE LEARNING-TO-READ ENGINE, VOCAL-TRACT FORMANT
 *    SYNTHESIZER & SEMANTIC SVG MORPHING
 *************************************************************************/
export class VocalTractFormantEngine {
  enabled: boolean;
  ctx: AudioContext | null;
  masterGain: GainNode | null;
  bgDuckGain: GainNode | null;
  bgDistanceFilter: BiquadFilterNode | null;
  readonly bachGloria: BachGloriaSynth;
  isSpeechDuckingActive: boolean;
  noiseBuffer: AudioBuffer | null;
  utteranceCount: number;
  lastPresetPlayed: VocalPresetName | 'NONE';
  lastEmotionPlayed: VoiceEmotionId;
  emotionControls: VoiceEmotionControls;
  lastPhoneticSubtitle: string;
  nlVoice: SpeechSynthesisVoice | null;
  readonly formants: Record<VowelName, FormantTriple>;
  /** Stays `undefined` in browsers without speech synthesis, where `initSpeechSynthesisVoices` returns early. */
  _voicesLoaded: boolean | undefined;
  private suppressHumanSpeech = false;
  private activeSpeechCount = 0;
  private duckSafetyTimer: number | undefined;

  /**
   * Pure Parametric Articulatory & Formant Vocal-Tract Synthesizer + Clear Human Speech
   * + Signature Tiny Vocal/Musical Joke Engine (Zero External WAVs!).
   *
   * Every single letter, mirror letter, digraph, and word has its own distinct phonetic
   * articulation AND a tiny playful vocal joke:
   *  - 'q' / 'Q': Phonetically articulated as "kjiuueehh!" (velar burst 'k' + palatal glide 'j'
   *    + rounded front vowel 'uu' + breathy 'eehh' downward slide-whistle + cheeky lip-pop!)
   *  - 'b': Deep bilabial voice-bar hum (115Hz) + bouncy "buh-boing!" bass spring joke
   *  - 'd': Crisp alveolar tap ("duh-deng!") + tiny woodpecker double-tap rhythm
   *  - 'p': Cheeky puffed-cheek plosive ("puh... POP!") with cork-pop formant resonance
   *  - 'ui': Clear "ui" diphthong + tiny "Hatsjoe!" onion-sneeze joke
   *  - 'oe': Clear "oe" + owl "Oeeee-hoe!" hoot
   *  - 'ij': Clear "ij" + shivering "Brrr-ijsje!" teeth-chatter
   *  - 'eu': Clear "eu" + honking "Tuuut-neus!" clown-nose squeeze
   *  - Stage 4-6 words ('bos', 'kat', 'zon', 'vis', 'ko-nijn', 'boom-hut', 'vlieg-tuig', 'blaft', 'smelt', 'rond'):
   *    Crystal-clear Dutch human speech + formant articulation + tiny semantic joke stinger!
   */
  constructor() {
    this.enabled = false; // Strictly DEFAULT OFF until user taps Hero Audio Button!
    this.ctx = null;
    this.masterGain = null;
    this.bgDuckGain = null;
    this.bgDistanceFilter = null;
    this.bachGloria = new BachGloriaSynth();
    this.isSpeechDuckingActive = false;
    this.noiseBuffer = null;
    this.utteranceCount = 0;
    this.lastPresetPlayed = 'NONE';
    this.lastEmotionPlayed = 'WARM_ENCOURAGE';
    this.emotionControls = {
      expressiveness: 1.08,
      speakingRateScale: 0.96,
      warmthBias: 0,
    };
    this.lastPhoneticSubtitle = '';
    this.nlVoice = null;

    // Vowel & Diphthong Formant Table [F1, F2, F3] in Hz (Expressive Human Vocal Tract)
    this.formants = {
      AA: [780, 1280, 2550], // 'aa', 'kat', 'A'
      OO: [450, 820, 2450], // 'oo', 'bos', 'rond', 'O'
      OE: [320, 700, 2350], // 'oe', 'boek', owl hoot
      UU: [300, 1680, 2400], // Dutch 'uu' in "kjiuueehh"
      UI: [540, 1480, 2500], // 'ui', 'huis'
      IJ: [580, 1950, 2650], // 'ij', 'ijs'
      IE: [290, 2380, 3050], // 'ie', palatal glide 'j', 'vis', 'hihi'
      EU: [430, 1600, 2500], // 'eu', 'neus'
      EH: [540, 1780, 2580], // 'eehh' trailing schwa-eh in "kjiuueehh!"
      UH: [510, 1180, 2450], // schwa / neutral voice bar
      MM: [280, 950, 2250], // nasal murmur 'M'
    };

    this.initSpeechSynthesisVoices();
  }

  initSpeechSynthesisVoices(): void {
    if (!('speechSynthesis' in window)) return;
    this._voicesLoaded = false;
    const pickVoice = () => {
      try {
        const voices = window.speechSynthesis.getVoices() || [];
        if (voices.length > 0) {
          this._voicesLoaded = true;
          this.nlVoice = selectBestDutchVoice(voices);
        }
      } catch {
        // Voice lookup is best effort; the formant synth works without a spoken voice.
      }
    };
    pickVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = pickVoice;
    }
  }

  /**
   * Enqueues or replaces a Dutch spoken clause in Web Speech API with explicit pitch, rate & volume.
   * Passing `flushQueue = false` queues a second clause (e.g. a curious follow-up question) right
   * behind an emotional praise clause without cancelling it!
   */
  enqueueUtterance(
    spokenText: string,
    pitch = 1.1,
    rate = 0.96,
    volume = 0.92,
    flushQueue = true,
  ): void {
    if (
      !this.enabled ||
      this.suppressHumanSpeech ||
      !('speechSynthesis' in window) ||
      !spokenText.trim()
    ) {
      return;
    }
    try {
      if (flushQueue) {
        window.speechSynthesis.cancel();
        this.activeSpeechCount = 0;
        clearTimeout(this.duckSafetyTimer);
      }
      const utter = new SpeechSynthesisUtterance(spokenText);
      if (this.nlVoice) utter.voice = this.nlVoice;
      utter.lang = this.nlVoice && this.nlVoice.lang ? this.nlVoice.lang : 'nl-NL';
      utter.pitch = pitch;
      utter.rate = rate;
      utter.volume = Math.min(1, Math.max(0.88, volume));

      this.activeSpeechCount++;
      this.applyAutoDuck(true);
      let settled = false;
      const onDone = () => {
        if (settled) return;
        settled = true;
        this.activeSpeechCount = Math.max(0, this.activeSpeechCount - 1);
        if (this.activeSpeechCount === 0) {
          this.applyAutoDuck(false);
        }
      };
      utter.onend = onDone;
      utter.onerror = onDone;

      clearTimeout(this.duckSafetyTimer);
      const estMs = Math.max(950, Math.min(6200, spokenText.length * 72 + 550));
      this.duckSafetyTimer = window.setTimeout(() => {
        this.activeSpeechCount = 0;
        this.applyAutoDuck(false);
      }, estMs);

      window.speechSynthesis.speak(utter);
    } catch {
      // Speech is an optional extra on top of the synthesized voice; never let it interrupt the sounds.
      this.applyAutoDuck(false);
    }
  }

  /**
   * Speaks clear human Dutch/phonetic articulation via Web Speech API synchronized
   * with our parametric formant vocal-tract engine so words are 100% intelligible
   * AND accompanied by our formant character + tiny joke!
   */
  speakClearHumanText(spokenText: string, pitch = 1.12, rate = 0.96, flushQueue = true): void {
    this.enqueueUtterance(spokenText, pitch, rate, 0.92, flushQueue);
  }

  /**
   * Plays an affective 3-formant vocal-tract gesture (`"Mmmm-hm"`, `"Oooo-wauw!"`, `"Hihi!"`,
   * `"Oooo-mm..."`, `"Hmm-oeh?"`) modulated by `this.emotionControls`.
   */
  playEmotionGesture(emotion: VoiceEmotionId, startDelay = 0): void {
    if (!this.enabled) return;
    this.ensureContext();
    this.lastEmotionPlayed = emotion;
    const spec = VOICE_EMOTION_PROFILES[emotion];
    const expr = Math.max(0.4, Math.min(1.6, this.emotionControls.expressiveness));
    const f0Scale = 1 + this.emotionControls.warmthBias * 0.55;

    for (const note of spec.tractNotes) {
      const baseStart = (note.f0Start ?? 210) * f0Scale;
      const rawEnd = (note.f0End ?? 250) * f0Scale;
      const scaledEnd = baseStart + (rawEnd - baseStart) * expr;
      const scaledMid =
        note.f0Mid !== undefined && note.f0Mid !== null
          ? baseStart + (note.f0Mid * f0Scale - baseStart) * expr
          : null;
      this.synthesizeTract({
        ...note,
        startDelay: startDelay + (note.startDelay ?? 0),
        f0Start: baseStart,
        f0Mid: scaledMid,
        f0End: scaledEnd,
        vibratoDepth: (note.vibratoDepth ?? 6) * (0.65 + 0.35 * expr),
      });
    }
    for (const fric of spec.fricatives ?? []) {
      this.synthesizeFricative({
        ...fric,
        startDelay: startDelay + (fric.startDelay ?? 0),
      });
    }
    for (const chime of spec.chimes ?? []) {
      this.synthesizeJokeTone({
        ...chime,
        startDelay: startDelay + (chime.startDelay ?? 0),
      });
    }
  }

  /**
   * Speaks a warm, emotionally modulated Dutch Embedded-Tutor line, optionally followed by a
   * second clause with inquisitive `CURIOUS_WONDER` prosody for the next target so praise and
   * prompt each carry natural human intonation without cutting each other off.
   */
  speakDutchTutor(
    coachLine: string,
    nextPromptOrTarget?: string | null,
    emotion: VoiceEmotionId = 'WARM_ENCOURAGE',
    gestureDelaySec = 0,
  ): void {
    if (!this.enabled) return;
    this.ensureContext();
    this.utteranceCount++;
    this.lastEmotionPlayed = emotion;

    const rawNext = (nextPromptOrTarget || '').trim();
    let nextClause = '';
    if (rawNext) {
      nextClause = rawNext.includes(' ') ? rawNext : `Waar zie jij nu ${rawNext.replace('-', '')}?`;
    }

    const badge = VOICE_EMOTION_PROFILES[emotion].badge;
    const fullLine = nextClause ? `${coachLine} ${nextClause}` : coachLine;
    this.lastPhoneticSubtitle = `${badge} ${fullLine}`;

    this.playEmotionGesture(emotion, gestureDelaySec);

    const mainProsody = computeUtteranceProsody(emotion, this.emotionControls);
    this.enqueueUtterance(coachLine, mainProsody.pitch, mainProsody.rate, mainProsody.volume, true);

    if (nextClause) {
      const askProsody = computeUtteranceProsody('CURIOUS_WONDER', this.emotionControls);
      this.enqueueUtterance(
        nextClause,
        askProsody.pitch,
        askProsody.rate,
        askProsody.volume,
        false,
      );
    }
  }

  /** Enables audio if needed and auditions a specific emotion profile live (for Human-Tutor tuning). */
  previewEmotion(emotion: VoiceEmotionId, customLine?: string): string {
    this.enabled = true;
    this.ensureContext();
    const line = customLine?.trim() || VOICE_EMOTION_PROFILES[emotion].sampleLine;
    this.speakDutchTutor(line, null, emotion, 0);
    return line;
  }

  /**
   * Near/Far Automatic Gain Control (AGC): ducks background Bach music & ambient layers softly
   * "far away" (low gain + warm 820 Hz lowpass) while the foreground Dutch voice speaks, then
   * gently brings them "close by" (4600 Hz + full delicate gift gain) once speech finishes.
   */
  applyAutoDuck(voiceSpeaking: boolean): void {
    this.isSpeechDuckingActive = voiceSpeaking;
    if (!this.ctx || !this.bgDuckGain || !this.bgDistanceFilter) return;
    const target = computeAutoDuckTargets(voiceSpeaking, 0.22);
    const now = this.ctx.currentTime;
    this.bgDuckGain.gain.cancelScheduledValues(now);
    this.bgDuckGain.gain.setTargetAtTime(target.gain, now, target.timeConstantSec);
    this.bgDistanceFilter.frequency.cancelScheduledValues(now);
    this.bgDistanceFilter.frequency.setTargetAtTime(target.lowpassHz, now, target.timeConstantSec);
  }

  /**
   * Unwraps the next 1-bar J.S. Bach *Gloria* musical present on the Fender-Rhodes <-> Human-Voice
   * morphing synth routed through the Near/Far Auto-Ducking AGC bus.
   */
  playBachGloriaPresent(startDelaySec = 0.04): number {
    if (!this.enabled) return 0;
    this.ensureContext();
    if (!this.ctx || !this.bgDistanceFilter) return 0;
    return this.bachGloria.playNextPresent(this.ctx, this.bgDistanceFilter, startDelaySec);
  }

  ensureContext(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Gentle mastering AGC / limiter so foreground formants + background chords never clip
      const agcCompressor = this.ctx.createDynamicsCompressor();
      agcCompressor.threshold.value = -14;
      agcCompressor.knee.value = 18;
      agcCompressor.ratio.value = 4;
      agcCompressor.attack.value = 0.005;
      agcCompressor.release.value = 0.16;
      agcCompressor.connect(this.ctx.destination);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.44;
      this.masterGain.connect(agcCompressor);

      // Background Music & Present Bus with Near/Far Lowpass + Auto-Ducking Gain
      this.bgDuckGain = this.ctx.createGain();
      this.bgDuckGain.gain.value = 0.22;
      this.bgDuckGain.connect(agcCompressor);

      this.bgDistanceFilter = this.ctx.createBiquadFilter();
      this.bgDistanceFilter.type = 'lowpass';
      this.bgDistanceFilter.frequency.value = 4600;
      this.bgDistanceFilter.Q.value = 0.7;
      this.bgDistanceFilter.connect(this.bgDuckGain);

      const sr = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sr * 2, sr);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  toggleAudio(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.ensureContext();
      this.speakGraphemeOrWord('q', 'CELEBRATE');
    }
    return this.enabled;
  }

  /**
   * Core Articulatory Tract Note:
   * Drives glottal source + optional growl FM through 3 parallel Formant filters (F1, F2, F3)
   * with full continuous glissando on both Pitch (F0) and Formants (vowel morphing).
   */
  synthesizeTract({
    startDelay = 0,
    dur = 0.35,
    f0Start = 210,
    f0End = 260,
    f0Mid = null,
    vowelStart = 'OO',
    vowelEnd = 'AA',
    growlHz = 0,
    growlDepth = 0,
    vibratoHz = 6,
    vibratoDepth = 8,
    gainLevel = 0.55,
  }: TractNoteOptions): void {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime + startDelay;

    const fmStart = this.formants[vowelStart] || this.formants.AA;
    const fmEnd = this.formants[vowelEnd] || fmStart;

    const glottis = this.ctx.createOscillator();
    glottis.type = 'sawtooth';
    glottis.frequency.setValueAtTime(Math.max(45, f0Start), now);
    if (f0Mid !== null) {
      glottis.frequency.exponentialRampToValueAtTime(Math.max(45, f0Mid), now + dur * 0.52);
    }
    glottis.frequency.exponentialRampToValueAtTime(Math.max(45, f0End), now + dur);

    if (vibratoDepth > 0) {
      const vib = this.ctx.createOscillator();
      const vibGain = this.ctx.createGain();
      vib.frequency.value = vibratoHz;
      vibGain.gain.value = vibratoDepth;
      vib.connect(vibGain);
      vibGain.connect(glottis.frequency);
      vib.start(now);
      vib.stop(now + dur);
    }

    if (growlHz > 0 && growlDepth > 0) {
      const growlOsc = this.ctx.createOscillator();
      const growlGain = this.ctx.createGain();
      growlOsc.type = 'sawtooth';
      growlOsc.frequency.setValueAtTime(growlHz, now);
      growlGain.gain.setValueAtTime(growlDepth, now);
      growlOsc.connect(growlGain);
      growlGain.connect(glottis.frequency);
      growlOsc.start(now);
      growlOsc.stop(now + dur);
    }

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(gainLevel, now + Math.min(0.03, dur * 0.18));
    env.gain.setValueAtTime(gainLevel, now + dur * 0.72);
    env.gain.exponentialRampToValueAtTime(0.001, now + dur);

    const qValues = [7.5, 9.5, 11.0];
    const ampWeights = [1.0, 0.78, 0.42];

    for (let i = 0; i < 3; i++) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = qValues[i];
      bp.frequency.setValueAtTime(fmStart[i], now);
      bp.frequency.exponentialRampToValueAtTime(fmEnd[i], now + dur);

      const fGain = this.ctx.createGain();
      fGain.gain.value = ampWeights[i];

      glottis.connect(bp);
      bp.connect(fGain);
      fGain.connect(env);
    }

    env.connect(this.masterGain);
    glottis.start(now);
    glottis.stop(now + dur + 0.01);
  }

  /**
   * Synthesizes Fricative / Sibilant / Plosive Buccal Noise ("tssjj", "tok", "k", "p", "s")
   */
  synthesizeFricative({
    startDelay = 0,
    dur = 0.22,
    freqStart = 4800,
    freqEnd = 2200,
    q = 3.5,
    gainLevel = 0.45,
  }: FricativeOptions): void {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime + startDelay;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freqStart, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(200, freqEnd), now + dur);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(gainLevel, now + Math.min(0.018, dur * 0.22));
    env.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    src.start(now);
    src.stop(now + dur + 0.01);
  }

  /**
   * Synthesizes a playful musical/comic tone stinger (e.g., boing spring, cork pop, cuckoo interval, water bubble)
   */
  synthesizeJokeTone({
    startDelay = 0,
    dur = 0.16,
    fStart = 300,
    fEnd = 600,
    type = 'sine',
    gainLevel = 0.35,
  }: JokeToneOptions): void {
    if (!this.enabled) return;
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime + startDelay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, fStart), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, fEnd), now + dur);

    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(gainLevel, now + Math.min(0.02, dur * 0.2));
    env.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  /**
   * DISTINCT FUNNY PHONETIC LETTER & WORD SYNTHESIZER + CLEAR HUMAN SPEECH + TINY JOKE
   * Every single letter and word has its own unmistakable acoustic signature!
   * Returns a subtitle string (e.g. `🤪 "kjiuueehh!" (lip-pop!)`) for visual reinforcement.
   */
  speakGraphemeOrWord(
    rawKey: string | null | undefined,
    mode: SpeakMode = 'CELEBRATE',
    options?: { readonly skipHumanSpeech?: boolean; readonly nextPromptLine?: string | null },
  ): string {
    if (!this.enabled) return '';
    this.ensureContext();
    this.utteranceCount++;
    this.suppressHumanSpeech = Boolean(options?.skipHumanSpeech);
    try {
      return this.speakGraphemeOrWordInner(rawKey, mode, options?.nextPromptLine);
    } finally {
      this.suppressHumanSpeech = false;
    }
  }

  private speakGraphemeOrWordInner(
    rawKey: string | null | undefined,
    mode: SpeakMode,
    nextPromptLine?: string | null,
  ): string {
    const clean = String(rawKey || '').trim();
    const key = clean.toLowerCase();
    let subtitle: string;

    // If mode === 'ASKING' (when prompt spawns), speak clearly with a gentle rising question inflection
    if (mode === 'ASKING') {
      if (key === 'q') {
        this.speakClearHumanText('kjuu?', 1.25, 0.9);
        this.synthesizeFricative({
          startDelay: 0,
          dur: 0.035,
          freqStart: 2600,
          freqEnd: 1800,
          q: 6.0,
          gainLevel: 0.5,
        });
        this.synthesizeTract({
          startDelay: 0.025,
          dur: 0.3,
          f0Start: 220,
          f0Mid: 260,
          f0End: 390,
          vowelStart: 'IE',
          vowelEnd: 'UU',
          vibratoHz: 6,
          vibratoDepth: 8,
          gainLevel: 0.55,
        });
        return '❓ "kjiuueehh?"';
      }
      const spokenPrompt = clean.replace('-', '');
      this.speakClearHumanText(spokenPrompt, 1.15, 0.92);
      this.synthesizeTract({
        startDelay: 0.02,
        dur: 0.24,
        f0Start: 215,
        f0End: 340,
        vowelStart: 'UH',
        vowelEnd: 'AA',
        vibratoHz: 5,
        vibratoDepth: 5,
        gainLevel: 0.35,
      });
      return `❓ "${spokenPrompt}?"`;
    }

    // CELEBRATE MODE: Distinct Funny Phonetic Articulation + Clear Human Voice + Tiny Joke!
    switch (key) {
      case 'q': {
        // THE SIGNATURE "kjiuueehh!" PHONETIC ARTICULATION:
        // 1. Sharp velar plosive burst 'k' (2.4kHz burst)
        // 2. High palatal glide 'j' (IE formant F2=2380Hz) -> rounded front vowel 'uu' (UU formant F1=300, F2=1680Hz)
        // 3. Trailing breathy comical schwa-eh 'eehh!' with slide-whistle glissando + cheeky cork-pop!
        subtitle = '🤪 "kjiuueehh!" (lip-pop!)';
        this.speakClearHumanText('kjuu-eehh!', 1.32, 0.85);
        // (a) Velar 'k' plosive burst
        this.synthesizeFricative({
          startDelay: 0,
          dur: 0.045,
          freqStart: 2800,
          freqEnd: 1700,
          q: 7.0,
          gainLevel: 0.68,
        });
        // (b) Palatal 'ji' -> 'uu' glide with upward pitch swoop
        this.synthesizeTract({
          startDelay: 0.035,
          dur: 0.24,
          f0Start: 240,
          f0Mid: 420,
          f0End: 350,
          vowelStart: 'IE',
          vowelEnd: 'UU',
          vibratoHz: 7,
          vibratoDepth: 12,
          gainLevel: 0.65,
        });
        // (c) Trailing comical breathy "...eehhhh!" slide-whistle droop
        this.synthesizeTract({
          startDelay: 0.26,
          dur: 0.34,
          f0Start: 350,
          f0Mid: 210,
          f0End: 135,
          vowelStart: 'UU',
          vowelEnd: 'EH',
          growlHz: 28,
          growlDepth: 18,
          vibratoHz: 9,
          vibratoDepth: 16,
          gainLevel: 0.62,
        });
        this.synthesizeFricative({
          startDelay: 0.3,
          dur: 0.26,
          freqStart: 1900,
          freqEnd: 950,
          q: 3.5,
          gainLevel: 0.28,
        });
        // (d) Tiny cheeky lip-pop stinger at the end!
        this.synthesizeJokeTone({
          startDelay: 0.61,
          dur: 0.07,
          fStart: 280,
          fEnd: 920,
          type: 'sine',
          gainLevel: 0.48,
        });
        break;
      }

      case 'b': {
        // 'b': Deep bilabial voice-bar hum (115Hz) + bouncy "buh-boing!" bass spring joke
        subtitle = '🅱️ "buh... BOING!"';
        this.speakClearHumanText('buh, boing!', 0.95, 0.95);
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.14,
          f0Start: 110,
          f0End: 135,
          vowelStart: 'MM',
          vowelEnd: 'UH',
          vibratoDepth: 0,
          gainLevel: 0.62,
        });
        this.synthesizeTract({
          startDelay: 0.13,
          dur: 0.38,
          f0Start: 130,
          f0Mid: 340,
          f0End: 165,
          vowelStart: 'OO',
          vowelEnd: 'IJ',
          vibratoHz: 14,
          vibratoDepth: 28,
          gainLevel: 0.65,
        });
        break;
      }

      case 'd': {
        // 'd': Crisp alveolar tap ("duh-deng!") + tiny woodpecker double-tap rhythm
        subtitle = '🐦 "duh-deng! (tok-tok!)"';
        this.speakClearHumanText('duh! tok-tok!', 1.15, 1.0);
        this.synthesizeFricative({
          startDelay: 0,
          dur: 0.025,
          freqStart: 3800,
          freqEnd: 2400,
          q: 6.0,
          gainLevel: 0.55,
        });
        this.synthesizeTract({
          startDelay: 0.02,
          dur: 0.18,
          f0Start: 230,
          f0End: 190,
          vowelStart: 'UH',
          vowelEnd: 'EH',
          gainLevel: 0.6,
        });
        // Woodpecker double-tap joke
        [0.24, 0.33, 0.42].forEach((d, idx) => {
          this.synthesizeJokeTone({
            startDelay: d,
            dur: 0.045,
            fStart: 780 + idx * 90,
            fEnd: 420,
            type: 'triangle',
            gainLevel: 0.45,
          });
        });
        break;
      }

      case 'p': {
        // 'p': Cheeky puffed-cheek plosive ("puh... POP!") with cork-pop formant resonance
        subtitle = '🍾 "puh... POP!"';
        this.speakClearHumanText('puh! plop!', 1.28, 1.0);
        this.synthesizeFricative({
          startDelay: 0,
          dur: 0.04,
          freqStart: 900,
          freqEnd: 450,
          q: 8.0,
          gainLevel: 0.65,
        });
        this.synthesizeTract({
          startDelay: 0.035,
          dur: 0.15,
          f0Start: 280,
          f0End: 220,
          vowelStart: 'UH',
          vowelEnd: 'OO',
          gainLevel: 0.55,
        });
        // Cork-pop joke stinger
        this.synthesizeJokeTone({
          startDelay: 0.22,
          dur: 0.08,
          fStart: 220,
          fEnd: 1080,
          type: 'sine',
          gainLevel: 0.55,
        });
        this.synthesizeJokeTone({
          startDelay: 0.31,
          dur: 0.09,
          fStart: 540,
          fEnd: 880,
          type: 'triangle',
          gainLevel: 0.4,
        });
        break;
      }

      case 'a': {
        // 'A': Warm open opera singer "Aaaah-haha!" with a tiny vibrato flourish
        subtitle = '🎭 "Aaaah-haha!"';
        this.speakClearHumanText('Aaa, haha!', 1.18, 0.92);
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.36,
          f0Start: 240,
          f0Mid: 320,
          f0End: 295,
          vowelStart: 'AA',
          vowelEnd: 'AA',
          vibratoHz: 7.5,
          vibratoDepth: 16,
          gainLevel: 0.62,
        });
        [0.38, 0.49].forEach((d, i) => {
          this.synthesizeTract({
            startDelay: d,
            dur: 0.09,
            f0Start: 360 + i * 60,
            f0End: 310,
            vowelStart: 'AA',
            vowelEnd: 'IE',
            gainLevel: 0.52,
          });
        });
        break;
      }

      case 'o': {
        // 'O': Surprised round "Oooo-hoop!" with rising question-mark squeak
        subtitle = '😮 "Oooo-wiiie!"';
        this.speakClearHumanText('Oooo, wiiie!', 1.22, 0.95);
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.32,
          f0Start: 195,
          f0Mid: 240,
          f0End: 460,
          vowelStart: 'OO',
          vowelEnd: 'OE',
          vibratoHz: 6,
          vibratoDepth: 10,
          gainLevel: 0.62,
        });
        this.synthesizeJokeTone({
          startDelay: 0.34,
          dur: 0.14,
          fStart: 460,
          fEnd: 820,
          type: 'sine',
          gainLevel: 0.42,
        });
        break;
      }

      case 's': {
        // 'S': Sneaking snake "Sssss-hihi!"
        subtitle = '🐍 "Sssss-hihi!"';
        this.speakClearHumanText('Sssss, hihi!', 1.25, 0.95);
        this.synthesizeFricative({
          startDelay: 0,
          dur: 0.28,
          freqStart: 6400,
          freqEnd: 4800,
          q: 5.5,
          gainLevel: 0.55,
        });
        this.synthesizeTract({
          startDelay: 0.29,
          dur: 0.16,
          f0Start: 410,
          f0End: 490,
          vowelStart: 'IE',
          vowelEnd: 'IE',
          vibratoHz: 9,
          vibratoDepth: 12,
          gainLevel: 0.52,
        });
        break;
      }

      case 'm': {
        // 'M': Tasty nasal hum "Mmmmm-jammie!"
        subtitle = '😋 "Mmmmm-jammie!"';
        this.speakClearHumanText('Mmmmm, jammie!', 1.12, 0.95);
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.3,
          f0Start: 185,
          f0Mid: 235,
          f0End: 195,
          vowelStart: 'MM',
          vowelEnd: 'AA',
          vibratoHz: 5.5,
          vibratoDepth: 8,
          gainLevel: 0.6,
        });
        this.synthesizeJokeTone({
          startDelay: 0.32,
          dur: 0.08,
          fStart: 380,
          fEnd: 620,
          type: 'triangle',
          gainLevel: 0.4,
        });
        break;
      }

      case 'x':
      case 't': {
        // Beatbox hi-hat zip "T-t-tsjak!"
        subtitle = `⚡ "${clean}-tsjak!"`;
        this.speakClearHumanText(key === 'x' ? 'iks, tsjak!' : 'tee, tsjak!', 1.2, 1.0);
        this.synthesizeFricative({
          startDelay: 0,
          dur: 0.04,
          freqStart: 7200,
          freqEnd: 3500,
          q: 4.5,
          gainLevel: 0.6,
        });
        this.synthesizeFricative({
          startDelay: 0.08,
          dur: 0.14,
          freqStart: 5200,
          freqEnd: 1400,
          q: 3.8,
          gainLevel: 0.55,
        });
        this.synthesizeJokeTone({
          startDelay: 0.22,
          dur: 0.09,
          fStart: 520,
          fEnd: 260,
          type: 'sawtooth',
          gainLevel: 0.38,
        });
        break;
      }

      // STAGE 3 DIGRAPHS (KLANKEN):
      case 'ui': {
        // 'ui': Clear "ui" diphthong + tiny "Hatsjoe!" onion-sneeze joke!
        subtitle = '🧅 "ui... Hatsjoe!"';
        this.speakClearHumanText('ui! hatsjoe!', 1.18, 0.95);
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.28,
          f0Start: 220,
          f0End: 310,
          vowelStart: 'UI',
          vowelEnd: 'UU',
          gainLevel: 0.62,
        });
        // Tiny comic sneeze "Ha-tsjoe!"
        this.synthesizeTract({
          startDelay: 0.32,
          dur: 0.11,
          f0Start: 290,
          f0End: 460,
          vowelStart: 'AA',
          vowelEnd: 'IE',
          gainLevel: 0.55,
        });
        this.synthesizeFricative({
          startDelay: 0.43,
          dur: 0.18,
          freqStart: 5600,
          freqEnd: 1800,
          q: 3.2,
          gainLevel: 0.62,
        });
        break;
      }

      case 'oe': {
        // 'oe': Clear "oe" + playful owl "Oeeee-hoe!" hoot
        subtitle = '🦉 "oe... Oeee-hoe!"';
        this.speakClearHumanText('oe! oehoe!', 1.08, 0.92);
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.26,
          f0Start: 240,
          f0Mid: 290,
          f0End: 220,
          vowelStart: 'OE',
          vowelEnd: 'OE',
          vibratoHz: 6,
          vibratoDepth: 9,
          gainLevel: 0.62,
        });
        this.synthesizeTract({
          startDelay: 0.3,
          dur: 0.3,
          f0Start: 320,
          f0Mid: 380,
          f0End: 250,
          vowelStart: 'OE',
          vowelEnd: 'OO',
          vibratoHz: 7,
          vibratoDepth: 12,
          gainLevel: 0.58,
        });
        break;
      }

      case 'ij': {
        // 'ij': Clear "ij" glide + shivering "Brrr-ijsje!" ice-cream teeth-chatter
        subtitle = '🍦 "ij... Brrr-lekker!"';
        this.speakClearHumanText('ij! brrr, ijsje!', 1.2, 0.95);
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.26,
          f0Start: 230,
          f0End: 325,
          vowelStart: 'EH',
          vowelEnd: 'IE',
          gainLevel: 0.6,
        });
        // Shivering vibrato "Brrrr!"
        this.synthesizeTract({
          startDelay: 0.29,
          dur: 0.28,
          f0Start: 260,
          f0End: 290,
          vowelStart: 'UH',
          vowelEnd: 'UU',
          growlHz: 24,
          growlDepth: 35,
          vibratoHz: 18,
          vibratoDepth: 24,
          gainLevel: 0.56,
        });
        break;
      }

      case 'eu': {
        // 'eu': Clear "eu" + honking "Tuuut-neus!" clown-nose squeeze
        subtitle = '🤡 "eu... Tuuut-tuut!"';
        this.speakClearHumanText('eu! tuut-neus!', 1.15, 0.95);
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.25,
          f0Start: 225,
          f0End: 275,
          vowelStart: 'EU',
          vowelEnd: 'UU',
          gainLevel: 0.6,
        });
        // Two cheeky clown-nose honks
        [0.28, 0.41].forEach((d, idx) => {
          this.synthesizeJokeTone({
            startDelay: d,
            dur: 0.09,
            fStart: 440 + idx * 80,
            fEnd: 410 + idx * 80,
            type: 'sawtooth',
            gainLevel: 0.36,
          });
        });
        break;
      }

      // STAGE 4-6 WORDS (CLEAR HUMAN VOICE + TINY SEMANTIC JOKE):
      case 'bos': {
        // 'bos': Clear "bos" + cuckoo bird "koe-koek!" major/minor third interval
        subtitle = '🌲 "bos! (koe-koek! 🐦)"';
        this.speakClearHumanText('bos! koekoek!', 1.12, 0.95);
        this.synthesizeJokeTone({
          startDelay: 0.28,
          dur: 0.14,
          fStart: 660,
          fEnd: 660,
          type: 'sine',
          gainLevel: 0.45,
        });
        this.synthesizeJokeTone({
          startDelay: 0.45,
          dur: 0.22,
          fStart: 528,
          fEnd: 520,
          type: 'sine',
          gainLevel: 0.45,
        });
        break;
      }

      case 'kat': {
        // 'kat': Clear "kat" + purring trill & cheeky "miauw!" formant bend
        subtitle = '🐱 "kat! (prrr-miauw!)"';
        this.speakClearHumanText('kat! miauw!', 1.22, 0.95);
        this.synthesizeTract({
          startDelay: 0.25,
          dur: 0.42,
          f0Start: 350,
          f0Mid: 510,
          f0End: 260,
          vowelStart: 'IE',
          vowelEnd: 'OE',
          vibratoHz: 6.5,
          vibratoDepth: 12,
          gainLevel: 0.6,
        });
        break;
      }

      case 'zon': {
        // 'zon': Clear "zon" + shimmering sunbeam arpeggio & contented "aaah!"
        subtitle = '☀️ "zon! (straal-aaah!)"';
        this.speakClearHumanText('zon! heerlijk!', 1.15, 0.95);
        [523, 659, 784, 1046].forEach((freq, idx) => {
          this.synthesizeJokeTone({
            startDelay: 0.22 + idx * 0.06,
            dur: 0.12,
            fStart: freq,
            fEnd: freq * 1.02,
            type: 'triangle',
            gainLevel: 0.35,
          });
        });
        break;
      }

      case 'vis': {
        // 'vis': Clear "vis" + underwater "blub-blub-blub!" bubble-pop glissando
        subtitle = '🐟 "vis! (blub-blub-blub!)"';
        this.speakClearHumanText('vis! blub-blub!', 1.18, 0.96);
        [0.24, 0.34, 0.44].forEach((d, idx) => {
          this.synthesizeJokeTone({
            startDelay: d,
            dur: 0.075,
            fStart: 260 + idx * 90,
            fEnd: 720 + idx * 140,
            type: 'sine',
            gainLevel: 0.48,
          });
        });
        break;
      }

      case 'ko-nijn': {
        // 'ko-nijn': Clear "konijn" + 3 bunny-sniff nose twitches & "hop-hop-boing!"
        subtitle = '🐰 "konijn! (snuf-hop-boing!)"';
        this.speakClearHumanText('konijn! hup-hup!', 1.2, 0.96);
        [0.28, 0.4].forEach((d, idx) => {
          this.synthesizeJokeTone({
            startDelay: d,
            dur: 0.09,
            fStart: 220 + idx * 80,
            fEnd: 580 + idx * 120,
            type: 'triangle',
            gainLevel: 0.45,
          });
        });
        break;
      }

      case 'boom-hut': {
        // 'boom-hut': Clear "boomhut" + knock-knock secret password tap "tok-tok-tok!"
        subtitle = '🌳 "boomhut! (klop-klop!)"';
        this.speakClearHumanText('boomhut! klop-klop!', 1.1, 0.95);
        [0.28, 0.38, 0.52].forEach((d, i) => {
          this.synthesizeFricative({
            startDelay: d,
            dur: 0.03,
            freqStart: 1100 + i * 200,
            freqEnd: 550,
            q: 9.0,
            gainLevel: 0.62,
          });
        });
        break;
      }

      case 'vlieg-tuig': {
        // 'vlieg-tuig': Clear "vliegtuig" + Doppler jet/propeller "niii-aooouw!" flyby
        subtitle = '✈️ "vliegtuig! (niii-aouw!)"';
        this.speakClearHumanText('vliegtuig! zoefff!', 1.16, 0.96);
        this.synthesizeTract({
          startDelay: 0.26,
          dur: 0.48,
          f0Start: 490,
          f0Mid: 340,
          f0End: 155,
          vowelStart: 'IE',
          vowelEnd: 'OO',
          growlHz: 38,
          growlDepth: 22,
          gainLevel: 0.58,
        });
        break;
      }

      case 'blaft': {
        // 'blaft': Clear "blaft" + playful double dog bark "woef-woef!"
        subtitle = '🐶 "blaft! (woef-woef!)"';
        this.speakClearHumanText('blaft! woef-woef!', 1.05, 0.96);
        [0.26, 0.42].forEach((d, i) => {
          this.synthesizeTract({
            startDelay: d,
            dur: 0.13,
            f0Start: 185 + i * 35,
            f0End: 115,
            vowelStart: 'OE',
            vowelEnd: 'AA',
            growlHz: 30,
            growlDepth: 35,
            gainLevel: 0.62,
          });
        });
        break;
      }

      case 'smelt': {
        // 'smelt': Clear "smelt" + comical melting downward droop "slurp-plop!"
        subtitle = '🫠 "smelt! (sluuurp-plop!)"';
        this.speakClearHumanText('smelt! blub!', 1.12, 0.92);
        this.synthesizeTract({
          startDelay: 0.25,
          dur: 0.42,
          f0Start: 380,
          f0Mid: 220,
          f0End: 95,
          vowelStart: 'IJ',
          vowelEnd: 'OO',
          vibratoHz: 11,
          vibratoDepth: 20,
          gainLevel: 0.58,
        });
        break;
      }

      case 'rond': {
        // 'rond': Clear "rond" + spinning pinwheel arpeggio "woeeesj-boing!"
        subtitle = '⚽ "rond! (woeeesj-boing!)"';
        this.speakClearHumanText('rond! hoppa!', 1.15, 0.96);
        this.synthesizeJokeTone({
          startDelay: 0.26,
          dur: 0.28,
          fStart: 240,
          fEnd: 760,
          type: 'sine',
          gainLevel: 0.45,
        });
        break;
      }

      default: {
        const spoken = clean.replace('-', '');
        subtitle = `🔊 "${spoken}!"`;
        this.speakClearHumanText(spoken, 1.15, 0.95);
        this.playPreset('OH_WOOW');
        break;
      }
    }

    if (!this.suppressHumanSpeech && nextPromptLine) {
      const askProsody = computeUtteranceProsody('CURIOUS_WONDER', this.emotionControls);
      this.enqueueUtterance(
        nextPromptLine,
        askProsody.pitch,
        askProsody.rate,
        askProsody.volume,
        false,
      );
    }

    this.lastPhoneticSubtitle = subtitle;
    return subtitle;
  }

  /**
   * Plays Human Expressive & Animal Imitation Presets
   */
  playPreset(presetName: VocalPresetName): void {
    if (!this.enabled) return;
    this.utteranceCount++;
    this.lastPresetPlayed = presetName;

    switch (presetName) {
      case 'OH_WOOW':
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.22,
          f0Start: 220,
          f0End: 295,
          vowelStart: 'OO',
          vowelEnd: 'OO',
          vibratoHz: 5,
          vibratoDepth: 6,
          gainLevel: 0.55,
        });
        this.synthesizeTract({
          startDelay: 0.24,
          dur: 0.52,
          f0Start: 195,
          f0Mid: 380,
          f0End: 215,
          vowelStart: 'OE',
          vowelEnd: 'AA',
          vibratoHz: 6.5,
          vibratoDepth: 12,
          gainLevel: 0.65,
        });
        break;

      case 'GRRRR':
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.58,
          f0Start: 125,
          f0Mid: 155,
          f0End: 105,
          vowelStart: 'UH',
          vowelEnd: 'OO',
          growlHz: 32,
          growlDepth: 48,
          vibratoHz: 14,
          vibratoDepth: 15,
          gainLevel: 0.62,
        });
        break;

      case 'TSSJJ':
        this.synthesizeFricative({
          startDelay: 0,
          dur: 0.04,
          freqStart: 7000,
          freqEnd: 5500,
          q: 6.0,
          gainLevel: 0.6,
        });
        this.synthesizeFricative({
          startDelay: 0.03,
          dur: 0.34,
          freqStart: 5200,
          freqEnd: 1650,
          q: 3.2,
          gainLevel: 0.52,
        });
        break;

      case 'HIHI':
        [0, 0.14, 0.28, 0.42].forEach((delay, idx) => {
          const basePitch = 340 + idx * 42;
          this.synthesizeFricative({
            startDelay: delay,
            dur: 0.035,
            freqStart: 3200,
            freqEnd: 2600,
            q: 4.0,
            gainLevel: 0.25,
          });
          this.synthesizeTract({
            startDelay: delay + 0.015,
            dur: idx === 3 ? 0.22 : 0.1,
            f0Start: basePitch,
            f0End: basePitch * 1.18,
            vowelStart: 'IE',
            vowelEnd: 'IJ',
            vibratoHz: 8,
            vibratoDepth: 10,
            gainLevel: 0.55,
          });
        });
        break;

      case 'CHICKEN_TOK':
        [0, 0.15, 0.3].forEach((delay, i) => {
          this.synthesizeFricative({
            startDelay: delay,
            dur: 0.028,
            freqStart: 1200,
            freqEnd: 650,
            q: 9.0,
            gainLevel: 0.65,
          });
          this.synthesizeTract({
            startDelay: delay + 0.01,
            dur: 0.085,
            f0Start: 310 + (i % 2) * 35,
            f0End: 190,
            vowelStart: 'OO',
            vowelEnd: 'AA',
            vibratoDepth: 0,
            gainLevel: 0.6,
          });
        });
        this.synthesizeTract({
          startDelay: 0.47,
          dur: 0.32,
          f0Start: 240,
          f0Mid: 520,
          f0End: 340,
          vowelStart: 'OO',
          vowelEnd: 'AA',
          growlHz: 42,
          growlDepth: 22,
          gainLevel: 0.65,
        });
        break;

      case 'FROG_SKEEE':
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.18,
          f0Start: 115,
          f0End: 185,
          vowelStart: 'OO',
          vowelEnd: 'AA',
          growlHz: 26,
          growlDepth: 45,
          gainLevel: 0.58,
        });
        this.synthesizeFricative({
          startDelay: 0.2,
          dur: 0.05,
          freqStart: 5800,
          freqEnd: 4200,
          q: 5.0,
          gainLevel: 0.45,
        });
        this.synthesizeTract({
          startDelay: 0.23,
          dur: 0.46,
          f0Start: 340,
          f0Mid: 680,
          f0End: 790,
          vowelStart: 'IJ',
          vowelEnd: 'IE',
          vibratoHz: 9,
          vibratoDepth: 18,
          gainLevel: 0.62,
        });
        break;

      case 'ASK_GLISS':
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.38,
          f0Start: 195,
          f0Mid: 210,
          f0End: 390,
          vowelStart: 'UH',
          vowelEnd: 'UI',
          vibratoHz: 5.5,
          vibratoDepth: 7,
          gainLevel: 0.55,
        });
        break;

      case 'CAT_MIAUW':
        // "Miaaa-uw!" continuous formant & pitch glissando (IE -> AA -> OE)
        this.synthesizeTract({
          startDelay: 0,
          dur: 0.48,
          f0Start: 330,
          f0Mid: 470,
          f0End: 240,
          vowelStart: 'IE',
          vowelEnd: 'OE',
          vibratoHz: 6,
          vibratoDepth: 11,
          gainLevel: 0.58,
        });
        break;
    }
  }

  /**
   * Speaks/vocalizes a Reading Target or Semantic Morph Reward with expressive prosody
   */
  speakReadingItem(
    item: SpeakableReadingItem | null | undefined,
    style: SpeakMode = 'ASKING',
  ): string {
    if (!this.enabled || !item) return '';
    return this.speakGraphemeOrWord(item.target, style);
  }

  /**
   * Gentle, non-punitive soft cushion vocalization when a distractor bubble is tapped
   * (warm downward formant sigh instead of a scary growl!).
   */
  speakDistractorBump(_text = ''): void {
    if (!this.enabled) return;
    this.utteranceCount++;
    this.playEmotionGesture('SOOTHING_COMFORT', 0);
  }
}
