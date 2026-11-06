import { describe, expect, it } from 'vitest';
import {
  BACH_GLORIA_BARS,
  BachGloriaSynth,
  computeAutoDuckTargets,
  midiToHz,
} from './bach-gloria-synth';

describe('BachGloriaSynth & Near/Far Auto-Ducking AGC', () => {
  it('packs 8 valid 4-byte MIDI micro-phrases of Bach Gloria in D major', () => {
    expect(BACH_GLORIA_BARS).toHaveLength(8);
    for (const bar of BACH_GLORIA_BARS) {
      expect(bar.length % 4).toBe(0);
      expect(bar.length).toBeGreaterThanOrEqual(16);
      for (let i = 0; i < bar.length; i += 4) {
        expect(bar[i]).toBeGreaterThanOrEqual(40);
        expect(bar[i]).toBeLessThanOrEqual(90);
        expect(bar[i + 2]).toBeGreaterThanOrEqual(1);
      }
    }
    expect(midiToHz(69)).toBeCloseTo(440, 2);
    const synth = new BachGloriaSynth();
    expect(synth.rhodesToVoiceMorph).toBeGreaterThan(0);
  });

  it('ducks gain and low-passes background music ("far away") while speech is active, then restores ("close by")', () => {
    const speaking = computeAutoDuckTargets(true, 0.24);
    const quiet = computeAutoDuckTargets(false, 0.24);

    expect(speaking.gain).toBeLessThan(quiet.gain * 0.35);
    expect(speaking.lowpassHz).toBeLessThan(1000);
    expect(quiet.lowpassHz).toBeGreaterThan(4000);
    expect(speaking.timeConstantSec).toBeLessThan(quiet.timeConstantSec);
  });
});
