import { describe, expect, it } from 'vitest';
import { EmbeddedTutorEngine } from './embedded-tutor-engine';

describe('EmbeddedTutorEngine', () => {
  it('keeps AUTO_PROG goal steadily visible until 5 calm hits are completed', () => {
    const tutor = new EmbeddedTutorEngine();
    tutor.resetForLearner('Beste leerling');

    const before = tutor.computeGoalFadeSchedule('AUTO_PROG', 0, 780, 0);
    expect(before.calmFadeUnlocked).toBe(false);
    expect(before.initialShowMs).toBeGreaterThan(90000);
    expect(before.cloakTargets).toBe(false);

    for (let i = 0; i < 4; i++) {
      const res = tutor.evaluateReadingTrial(
        {
          hit: true,
          readingStage: 1,
          mtMs: 1200,
          decodeMs: 420,
          distractorPullPx: 8,
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
    }

    const fifth = tutor.evaluateReadingTrial(
      {
        hit: true,
        readingStage: 1,
        mtMs: 1180,
        decodeMs: 400,
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
    expect(fifth.dutchCoachLine).toContain('beste leerling');
  });

  it('steps back temporarily for 2 warm-up hits after 2 misses and announces it in Dutch', () => {
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
    expect(stepBack.dutchCoachLine).toContain('Daan');
    expect(stepBack.dutchCoachLine).toContain('stapje terug');

    // First warm-up hit stays on stage 2
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

    // Second warm-up hit returns learner to stage 3!
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
    expect(warm2.dutchCoachLine).toContain('terug naar stap 3');
  });
});
