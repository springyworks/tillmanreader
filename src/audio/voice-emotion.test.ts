import { describe, expect, it } from 'vitest';
import {
  VOICE_EMOTION_IDS,
  computeUtteranceProsody,
  selectBestDutchVoice,
  type VoiceEmotionControls,
} from './voice-emotion';

describe('voice-emotion prosody & neural Dutch voice selection', () => {
  const defaultControls: VoiceEmotionControls = {
    expressiveness: 1.05,
    speakingRateScale: 0.96,
    warmthBias: 0,
  };

  it('separates soothing comfort from joyful/playful celebration in pitch and rate', () => {
    const soothing = computeUtteranceProsody('SOOTHING_COMFORT', defaultControls, 0);
    const proud = computeUtteranceProsody('PROUD_CELEBRATE', defaultControls, 0);
    const playful = computeUtteranceProsody('PLAYFUL_GIGGLE', defaultControls, 0);

    expect(soothing.pitch).toBeLessThan(1.0);
    expect(proud.pitch).toBeGreaterThan(1.18);
    expect(playful.pitch).toBeGreaterThan(proud.pitch);
    expect(soothing.rate).toBeLessThan(proud.rate);
  });

  it('amplifies emotional contrast when expressiveness slider increases and varies with jitter', () => {
    const calmCtrl: VoiceEmotionControls = { ...defaultControls, expressiveness: 0.5 };
    const vividCtrl: VoiceEmotionControls = { ...defaultControls, expressiveness: 1.45 };

    const lowExpr = computeUtteranceProsody('PROUD_CELEBRATE', calmCtrl, 0);
    const highExpr = computeUtteranceProsody('PROUD_CELEBRATE', vividCtrl, 0);
    expect(highExpr.pitch).toBeGreaterThan(lowExpr.pitch);

    const jNeg = computeUtteranceProsody('WARM_ENCOURAGE', defaultControls, -0.8);
    const jPos = computeUtteranceProsody('WARM_ENCOURAGE', defaultControls, 0.8);
    expect(jPos.pitch).not.toBe(jNeg.pitch);
    expect(VOICE_EMOTION_IDS).toHaveLength(6);
  });

  it('prefers Microsoft Edge Natural / Google nl-NL voices over generic eSpeak nl voices', () => {
    const voices = [
      { name: 'eSpeak Dutch', lang: 'nl-NL', localService: true },
      { name: 'Google Nederlands', lang: 'nl-NL', localService: false },
      {
        name: 'Microsoft Fenna Online (Natural) - Dutch (Netherlands)',
        lang: 'nl-NL',
        localService: false,
      },
    ];
    const picked = selectBestDutchVoice(voices);
    expect(picked?.name).toContain('Fenna Online (Natural)');
  });
});
