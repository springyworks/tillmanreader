import { describe, expect, it } from 'vitest';
import { GestureDecoder } from './gesture-decoder';
import type { GestureType } from './gesture-decoder';

describe('GestureDecoder', () => {
  it('recognises a horizontal NO_SHAKE sweep', () => {
    const detected: GestureType[] = [];
    const decoder = new GestureDecoder((type) => detected.push(type));

    const xs = [100, 230, 90, 240, 85, 235, 95, 225, 100, 220, 105];
    let t = 1000;
    for (const x of xs) {
      decoder.pushSample(x, 200, t);
      t += 28;
    }

    expect(detected).toEqual(['NO_SHAKE']);
    expect(decoder.counts.no).toBe(1);
  });

  it('recognises a vertical YES_NOD sweep', () => {
    const detected: GestureType[] = [];
    const decoder = new GestureDecoder((type) => detected.push(type));

    const ys = [100, 240, 95, 245, 90, 240, 100, 235, 105, 230, 100];
    let t = 2000;
    for (const y of ys) {
      decoder.pushSample(200, y, t);
      t += 28;
    }

    expect(detected).toEqual(['YES_NOD']);
    expect(decoder.counts.yes).toBe(1);
  });

  it('recognises a two-axis RAGE_SCRIBBLE', () => {
    const detected: GestureType[] = [];
    const decoder = new GestureDecoder((type) => detected.push(type));

    const pts: readonly [number, number][] = [
      [100, 100],
      [220, 210],
      [95, 105],
      [225, 215],
      [90, 95],
      [230, 220],
      [100, 100],
      [220, 210],
      [105, 105],
      [215, 205],
    ];
    let t = 3000;
    for (const [x, y] of pts) {
      decoder.pushSample(x, y, t);
      t += 28;
    }

    expect(detected).toEqual(['RAGE_SCRIBBLE']);
    expect(decoder.counts.rage).toBe(1);
  });
});
