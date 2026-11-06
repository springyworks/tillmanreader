import { describe, expect, it } from 'vitest';
import { EmbeddedTutorEngine } from './embedded-tutor-engine';

describe('EmbeddedTutorEngine', () => {
  it('keeps AUTO_PROG goal steadily visible until 5 calm hits (including relaxed 6–9s child drags)', () => {
    const tutor = new EmbeddedTutorEngine();
    tutor.resetForLearner('Beste leerling');

    const before = tutor.computeGoalFadeSchedule('AUTO_PROG', 0, 780, 0);
    expect(before.calmFadeUnlocked).toBe(false);
    expect(before.initialShowMs).toBeGreaterThan(90000);
    expect(before.cloakTargets).toBe(false);

    // Simulate relaxed 5.8s - 9.1s child Scoop-Visor drags with low distractor pull (like live Android play)
    const childDragTimes = [9110, 8334, 5780, 4900];
    for (let i = 0; i < 4; i++) {
      const res = tutor.evaluateReadingTrial(
        {
          hit: true,
          readingStage: 1,
          mtMs: childDragTimes[i],
          decodeMs: 2400,
          distractorPullPx: i === 0 ? 41 : 0,
          radialNormPct: 0.25,
          goalPeeks: 0,
          targetLabel: 'A',
        },
        false,
        'AUTO_PROG',
        780,
        i,
        1.15,
      );
      expect(res.fadeUnlocked).toBe(false);
      expect(res.ticker.kind).not.toBe('THROTTLE_BACK');
    }

    const fifth = tutor.evaluateReadingTrial(
      {
        hit: true,
        readingStage: 1,
        mtMs: 3400,
        decodeMs: 950,
        distractorPullPx: 6,
        radialNormPct: 0.22,
        goalPeeks: 0,
        targetLabel: 'M',
      },
      false,
      'AUTO_PROG',
      780,
      4,
      1.15,
    );
    expect(fifth.fadeUnlocked).toBe(true);
    expect(fifth.fadeHoldMs).toBe(2800);
    expect(fifth.fadeDurationMs).toBe(1800);
    expect(fifth.voiceEmotion).toBe('CURIOUS_WONDER');
    expect(fifth.dutchCoachLine).toBeTruthy();
  });

  it('never repeats the same Dutch sentence back-to-back, varies emotions, and throttles vocatives naturally', () => {
    const tutor = new EmbeddedTutorEngine();
    tutor.resetForLearner('Beste leerling');

    const spokenLines: string[] = [];
    const emotions = new Set<string>();
    const prompts: string[] = [];

    for (let i = 0; i < 12; i++) {
      const res = tutor.evaluateReadingTrial(
        {
          hit: i !== 5,
          readingStage: 2,
          mtMs: 2600,
          decodeMs: 700,
          distractorPullPx: 10,
          radialNormPct: i % 3 === 0 ? 0.18 : 0.42,
          goalPeeks: i === 8 ? 1 : 0,
          targetLabel: ['O', 'M', 'S', 'A'][i % 4],
        },
        false,
        'AUTO_PROG',
        720,
        i,
        1.15,
      );
      emotions.add(res.voiceEmotion);
      if (res.dutchCoachLine) {
        spokenLines.push(res.dutchCoachLine);
      }
      const nextQ = tutor.pickNextTargetPrompt('S');
      if (nextQ) prompts.push(nextQ);
    }

    // No two adjacent spoken lines or adjacent target prompts may be identical
    for (let i = 1; i < spokenLines.length; i++) {
      expect(spokenLines[i]).not.toBe(spokenLines[i - 1]);
    }
    for (let i = 1; i < prompts.length; i++) {
      expect(prompts[i]).not.toBe(prompts[i - 1]);
    }

    // "beste leerling" must NOT appear in more than 1 spoken line across 12 trials
    const besteLeerlingMentions = spokenLines.filter((l) =>
      l.toLowerCase().includes('beste leerling'),
    ).length;
    expect(besteLeerlingMentions).toBeLessThanOrEqual(1);

    // Multiple distinct emotions were activated dynamically
    expect(emotions.size).toBeGreaterThanOrEqual(3);
  });

  it('steps back temporarily for 2 warm-up hits after 2 misses and announces it soothingly in Dutch', () => {
    const tutor = new EmbeddedTutorEngine();
    tutor.resetForLearner('Daan');

    tutor.evaluateReadingTrial(
      {
        hit: false,
        readingStage: 3,
        mtMs: 2100,
        decodeMs: 900,
        distractorPullPx: 50,
        radialNormPct: 0.6,
        goalPeeks: 0,
        targetLabel: 'ui',
      },
      true,
      'AUTO_PROG',
      720,
      4,
      1.15,
    );

    const stepBack = tutor.evaluateReadingTrial(
      {
        hit: false,
        readingStage: 3,
        mtMs: 2200,
        decodeMs: 950,
        distractorPullPx: 65,
        radialNormPct: 0.7,
        goalPeeks: 0,
        targetLabel: 'ui',
      },
      true,
      'AUTO_PROG',
      720,
      5,
      1.15,
    );

    expect(stepBack.stageChanged).toBe('STEPPED_BACK');
    expect(stepBack.nextStage).toBe(2);
    expect(stepBack.voiceEmotion).toBe('SOOTHING_COMFORT');
    expect(stepBack.dutchCoachLine).toContain('Daan');
    expect(stepBack.dutchCoachLine).toContain('stapje terug');

    const warm1 = tutor.evaluateReadingTrial(
      {
        hit: true,
        readingStage: 2,
        mtMs: 1300,
        decodeMs: 450,
        distractorPullPx: 12,
        radialNormPct: 0.3,
        goalPeeks: 0,
        targetLabel: 'b',
      },
      true,
      'AUTO_PROG',
      720,
      6,
      1.23,
    );
    expect(warm1.nextStage).toBe(2);

    const warm2 = tutor.evaluateReadingTrial(
      {
        hit: true,
        readingStage: 2,
        mtMs: 1250,
        decodeMs: 420,
        distractorPullPx: 10,
        radialNormPct: 0.25,
        goalPeeks: 0,
        targetLabel: 'p',
      },
      true,
      'AUTO_PROG',
      720,
      7,
      1.23,
    );
    expect(warm2.stageChanged).toBe('RETURNED_UP');
    expect(warm2.nextStage).toBe(3);
    expect(warm2.voiceEmotion).toBe('PROUD_CELEBRATE');
    expect(warm2.dutchCoachLine).toContain('terug naar stap 3');
  });
});
