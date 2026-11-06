import { describe, expect, it } from 'vitest';
import { AdaptiveReadingEngine } from './adaptive-reading-engine';

describe('AdaptiveReadingEngine', () => {
  it('defines 6 progressive reading stages with non-overlapping distractors', () => {
    const engine = new AdaptiveReadingEngine();
    expect(engine.stages).toHaveLength(6);

    for (const stage of engine.stages) {
      expect(stage.items.length).toBeGreaterThan(0);
      for (const item of stage.items) {
        expect(item.distractors).not.toContain(item.target);
      }
    }
  });

  it('promotes the learner after 3 fast low-pull hits when autoZPD is enabled', () => {
    const engine = new AdaptiveReadingEngine();
    engine.stage = 1;

    expect(engine.evaluateTrial(true, 320, 10, 720)).toBe('STEADY');
    expect(engine.evaluateTrial(true, 310, 12, 700)).toBe('STEADY');
    expect(engine.evaluateTrial(true, 295, 8, 680)).toBe('PROMOTED');
    expect(engine.stage).toBe(2);
  });

  it('scaffolds down on repeated misses and tracks mirror confusion on Stage 2', () => {
    const engine = new AdaptiveReadingEngine();
    engine.stage = 2;
    engine.misses = 0;
    const initialMirror = engine.mirrorConfusionRate;

    expect(engine.evaluateTrial(false, 900, 65, 1600)).toBe('STEADY');
    expect(engine.mirrorConfusionRate).toBeGreaterThan(initialMirror);

    expect(engine.evaluateTrial(false, 950, 70, 1700)).toBe('SCAFFOLDED_DOWN');
    expect(engine.stage).toBe(1);
  });
});
