/**
 * Compact Tiny-MIDI-Byte Sequencer & Parametric Fender-Rhodes <-> Human-Voice Choir Morphing Synth
 * playing 1-bar micro-presents from J.S. Bach's "Gloria in excelsis Deo" (BWV 232, D Major).
 *
 * Each note is packed into 4 MIDI bytes: `[midiNote, startStep16th, durStep16th, velocityAndRole]`
 * where `velocityAndRole >= 100` marks the sparkling soprano/lead voice and `< 100` marks warm
 * 3-part baroque continuo/chorale harmony.
 */

export interface DuckingEnvelopeTarget {
  readonly gain: number;
  readonly lowpassHz: number;
  readonly timeConstantSec: number;
}

/**
 * Computes Near/Far Automatic Gain Control (AGC) targets so background music & FX step softly
 * "far away" (`lowpassHz = 820Hz`, low gain) whenever the foreground Dutch tutor voice speaks,
 * and bloom "close by" (`lowpassHz = 4600Hz`, warm present gain) once speech finishes.
 */
export function computeAutoDuckTargets(
  voiceSpeaking: boolean,
  nominalMusicGain = 0.22,
): DuckingEnvelopeTarget {
  if (voiceSpeaking) {
    return {
      gain: Number(Math.max(0.035, nominalMusicGain * 0.24).toFixed(4)),
      lowpassHz: 820,
      timeConstantSec: 0.045,
    };
  }
  return {
    gain: Number(Math.max(0.05, Math.min(0.45, nominalMusicGain)).toFixed(4)),
    lowpassHz: 4600,
    timeConstantSec: 0.22,
  };
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * 8 sequential 1-bar micro-phrases of J.S. Bach's *Gloria in excelsis Deo* (BWV 232, D major, 3/8 -> 6 steps/bar).
 * Packed as tiny `Uint8Array` 4-byte tuples: `[midiNote, stepStart, stepDur, roleVel]`.
 */
export const BACH_GLORIA_BARS: readonly Uint8Array[] = [
  // Bar 1: D-major jubilant "Glo-ri-a!" triad arpeggio + warm D-A-F# chorale cushion
  new Uint8Array([
    50, 0, 6, 72, 57, 0, 6, 70, 66, 0, 6, 74, 74, 0, 2, 112, 76, 2, 1, 106, 78, 3, 2, 116, 81, 5, 2,
    120,
  ]),
  // Bar 2: Sparkling A-major answer (E5-F#5-G5-A5-E5-C#5 over A-E-G-C#)
  new Uint8Array([
    45, 0, 6, 70, 57, 0, 6, 70, 61, 0, 6, 72, 76, 0, 2, 112, 78, 2, 1, 106, 79, 3, 1, 110, 81, 4, 2,
    118, 73, 6, 2, 108,
  ]),
  // Bar 3: Rising B-minor / D6 baroque sequence (F#5-G5-A5-B5-F#5)
  new Uint8Array([
    47, 0, 6, 72, 54, 0, 6, 70, 62, 0, 6, 74, 78, 0, 2, 112, 79, 2, 1, 108, 81, 3, 1, 114, 83, 4, 3,
    122,
  ]),
  // Bar 4: Warm F#m -> Gmaj7 suspension ("in ex-cel-sis")
  new Uint8Array([
    43, 0, 6, 74, 55, 0, 6, 72, 59, 0, 6, 74, 66, 0, 3, 76, 67, 3, 4, 78, 81, 0, 3, 116, 79, 3, 2,
    112, 78, 5, 2, 110,
  ]),
  // Bar 5: Parallel baroque tenths in D/F# -> Em7
  new Uint8Array([
    54, 0, 3, 72, 62, 0, 3, 74, 52, 3, 4, 72, 59, 3, 4, 74, 79, 0, 2, 114, 78, 2, 2, 112, 76, 4, 3,
    115,
  ]),
  // Bar 6: Luminous subdominant IV -> V6/5 lift
  new Uint8Array([
    55, 0, 3, 72, 62, 0, 3, 74, 57, 3, 4, 74, 64, 3, 4, 76, 74, 0, 1, 108, 76, 1, 1, 110, 78, 2, 2,
    114, 79, 4, 2, 116, 81, 6, 2, 120,
  ]),
  // Bar 7: Dominant cadential ornament (A7 -> D)
  new Uint8Array([
    45, 0, 6, 74, 55, 0, 6, 72, 61, 0, 6, 74, 78, 0, 2, 114, 76, 2, 2, 112, 74, 4, 1, 108, 73, 5, 2,
    114,
  ]),
  // Bar 8: Golden D-major "De-o!" plagal-authentic resolution bloom
  new Uint8Array([
    50, 0, 8, 78, 57, 0, 8, 76, 62, 0, 8, 78, 69, 1, 7, 82, 74, 0, 3, 118, 79, 3, 2, 112, 78, 5, 5,
    122,
  ]),
];

// Choir vowel formants [F1, F2, F3] for warm "Ooo" -> open "Aaa" Gloria bloom
const CHOIR_OO: readonly [number, number, number] = [420, 810, 2420];
const CHOIR_AA: readonly [number, number, number] = [710, 1210, 2540];

export class BachGloriaSynth {
  barCursor = 0;
  /**
   * `0.0` = pure crystal Fender-Rhodes Mark I tine piano,
   * `0.5` = dynamic Rhodes attack blooming into singing Human Choir (default `0.52`),
   * `1.0` = pure angelic Human-Voice "Ooo-Aah" Formant Choir.
   */
  rhodesToVoiceMorph = 0.52;

  /** Schedules the next 1-bar Bach *Gloria* musical gift onto `destNode` and returns the bar index (1..8). */
  playNextPresent(ctx: AudioContext, destNode: AudioNode, startDelaySec = 0.04): number {
    const barIdx = this.barCursor % BACH_GLORIA_BARS.length;
    this.barCursor = (this.barCursor + 1) % BACH_GLORIA_BARS.length;
    const bytes = BACH_GLORIA_BARS[barIdx];
    const stepSec = 0.145; // Gently buoyant 3/8 vivace (~138 eighth-notes/min, ~1.15s per bar + warm bloom)
    const now = ctx.currentTime + startDelaySec;

    for (let i = 0; i + 3 < bytes.length; i += 4) {
      const midi = bytes[i];
      const stepStart = bytes[i + 1];
      const stepDur = bytes[i + 2];
      const roleVel = bytes[i + 3];
      const isLead = roleVel >= 100;
      const velNorm = isLead ? (roleVel - 80) / 45 : roleVel / 110;

      this.scheduleMorphNote(
        ctx,
        destNode,
        midiToHz(midi),
        now + stepStart * stepSec,
        Math.max(0.24, stepDur * stepSec * 1.18),
        Math.max(0.15, Math.min(1.0, velNorm)),
        isLead,
      );
    }
    return barIdx + 1;
  }

  /**
   * Voices a single note with continuous parameter-controlled timbre morphing between:
   * - **Fender Rhodes Mark I**: sinusoidal warm tonebar + 7x FM bell-tine attack chime
   * - **Human-Voice Choir**: mellowed glottal source with 5.4 Hz vibrato through 3 morphing OO->AA formants
   */
  private scheduleMorphNote(
    ctx: AudioContext,
    destNode: AudioNode,
    freqHz: number,
    t0: number,
    dur: number,
    vel: number,
    isLead: boolean,
  ): void {
    const morph = Math.max(0, Math.min(1, this.rhodesToVoiceMorph));
    const noteOut = ctx.createGain();
    const peakGain = (isLead ? 0.24 : 0.13) * vel;
    noteOut.gain.setValueAtTime(0.0008, t0);
    noteOut.gain.linearRampToValueAtTime(peakGain, t0 + 0.018);
    noteOut.gain.setValueAtTime(peakGain * 0.84, t0 + dur * 0.55);
    noteOut.gain.exponentialRampToValueAtTime(0.0008, t0 + dur + 0.16);
    noteOut.connect(destNode);

    // --- POLE A: FENDER RHODES TINE + TONEBAR ---
    const rhodesWeightStart = Math.max(0.08, 1 - morph * 0.65);
    const rhodesWeightEnd = Math.max(0.04, (1 - morph) * 0.85);
    const rhodesGain = ctx.createGain();
    rhodesGain.gain.setValueAtTime(rhodesWeightStart, t0);
    rhodesGain.gain.linearRampToValueAtTime(rhodesWeightEnd, t0 + dur);
    rhodesGain.connect(noteOut);

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freqHz, t0);

    // Classic Rhodes 7th-harmonic crystalline tine bell FM on attack
    const tineMod = ctx.createOscillator();
    tineMod.type = 'sine';
    tineMod.frequency.setValueAtTime(freqHz * (isLead ? 7.0 : 4.0), t0);
    const tineIndex = ctx.createGain();
    tineIndex.gain.setValueAtTime(freqHz * (isLead ? 1.35 : 0.55), t0);
    tineIndex.gain.exponentialRampToValueAtTime(0.5, t0 + Math.min(0.16, dur * 0.5));
    tineMod.connect(tineIndex);
    tineIndex.connect(carrier.frequency);

    carrier.connect(rhodesGain);
    tineMod.start(t0);
    carrier.start(t0);
    tineMod.stop(t0 + dur + 0.18);
    carrier.stop(t0 + dur + 0.18);

    // --- POLE B: ANGELIC HUMAN-VOICE "OOO -> AAA" FORMANT CHOIR ---
    if (morph > 0.04) {
      const choirGain = ctx.createGain();
      // Gentle vocal bloom: enters softly behind the Rhodes tine strike, then sings warmly!
      choirGain.gain.setValueAtTime(0.02 + morph * 0.25, t0);
      choirGain.gain.linearRampToValueAtTime(morph * 0.95, t0 + Math.min(0.18, dur * 0.45));
      choirGain.gain.linearRampToValueAtTime(morph * 0.75, t0 + dur + 0.12);
      choirGain.connect(noteOut);

      const glottal = ctx.createOscillator();
      glottal.type = 'sawtooth';
      glottal.frequency.setValueAtTime(freqHz * 1.002, t0);

      // Natural choir vibrato (5.3 Hz)
      const vib = ctx.createOscillator();
      const vibDepth = ctx.createGain();
      vib.frequency.setValueAtTime(5.3, t0);
      vibDepth.gain.setValueAtTime(freqHz * 0.009 * morph, t0);
      vib.connect(vibDepth);
      vibDepth.connect(glottal.frequency);

      // Soft spectral-tilt rolloff so the choir is velvety, never buzzy
      const tilt = ctx.createBiquadFilter();
      tilt.type = 'lowpass';
      tilt.frequency.setValueAtTime(2400, t0);
      glottal.connect(tilt);

      const weights = [0.95, 0.72, 0.35];
      const qs = [6.5, 8.0, 9.5];
      for (let f = 0; f < 3; f++) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = qs[f];
        bp.frequency.setValueAtTime(CHOIR_OO[f], t0);
        bp.frequency.exponentialRampToValueAtTime(CHOIR_AA[f], t0 + dur);
        const fg = ctx.createGain();
        fg.gain.value = weights[f] * 0.55;
        tilt.connect(bp);
        bp.connect(fg);
        fg.connect(choirGain);
      }

      vib.start(t0);
      glottal.start(t0);
      vib.stop(t0 + dur + 0.18);
      glottal.stop(t0 + dur + 0.18);
    }
  }
}
