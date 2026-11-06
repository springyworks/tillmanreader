import { describe, expect, it } from 'vitest';
import { checkpointTag, parseSession } from './session-snapshot';

describe('session-snapshot', () => {
  it('returns null for non-object payloads', () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession('invalid')).toBeNull();
    expect(parseSession([1, 2, 3])).toBeNull();
  });

  it('keeps valid trials and drops malformed records while preserving storedTrialCount', () => {
    const restored = parseSession({
      sessionNumber: 4,
      readingStage: 3,
      goalMemoryMode: 'AUTO_PROG',
      semanticMorphEnabled: true,
      uiFontScale: Number.NaN,
      trials: [
        { id: 2.1, mt: 620, hw: 12, brain: 210, ballistic: 190, homing: 208 },
        { id: 'bad', mt: 500 },
      ],
      fpRecords: [
        {
          tw: 1100,
          rt: 265,
          dist: 'ISOCHRONOUS',
          hazard: 4.5,
          premature: false,
          phaseErrorMs: 0,
          t: 1200,
        },
        { tw: 1100, rt: 'bad' },
      ],
    });

    expect(restored).not.toBeNull();
    expect(restored?.sessionNumber).toBe(4);
    expect(restored?.readingStage).toBe(3);
    expect(restored?.goalMemoryMode).toBe('AUTO_PROG');
    expect(restored?.uiFontScale).toBeUndefined();
    expect(restored?.storedTrialCount).toBe(2);
    expect(restored?.trials).toHaveLength(1);
    expect(restored?.fpRecords).toHaveLength(1);
  });

  it('extracts checkpointTag only when gitMeta.tag is a non-empty string', () => {
    expect(checkpointTag({ gitMeta: { tag: 'v3.0.0' } })).toBe('v3.0.0');
    expect(checkpointTag({ gitMeta: { tag: '' } })).toBeUndefined();
    expect(checkpointTag({})).toBeUndefined();
  });
});
