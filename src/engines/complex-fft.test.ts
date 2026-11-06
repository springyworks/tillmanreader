import { describe, expect, it } from 'vitest';
import { ComplexFFT } from './complex-fft';

describe('ComplexFFT', () => {
  it('concentrates a constant DC signal into bin 0', () => {
    const n = 128;
    const re = new Float64Array(n).fill(1);
    const im = new Float64Array(n).fill(0);

    ComplexFFT.transform(re, im);

    expect(re[0]).toBeCloseTo(n, 9);
    expect(im[0]).toBeCloseTo(0, 9);
    for (let k = 1; k < n; k++) {
      expect(Math.hypot(re[k], im[k])).toBeLessThan(1e-9);
    }
  });

  it('separates positive-spin and negative-spin complex exponentials', () => {
    const n = 128;
    const targetBin = 5;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let t = 0; t < n; t++) {
      const phase = (2 * Math.PI * targetBin * t) / n;
      re[t] = Math.cos(phase);
      im[t] = Math.sin(phase);
    }

    ComplexFFT.transform(re, im);

    expect(Math.hypot(re[targetBin], im[targetBin])).toBeCloseTo(n, 8);
    expect(Math.hypot(re[n - targetBin], im[n - targetBin])).toBeLessThan(1e-8);
  });

  it('conserves signal energy under Parseval identity', () => {
    const n = 128;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    let timeEnergy = 0;
    for (let t = 0; t < n; t++) {
      re[t] = Math.sin(0.21 * t) + 0.5 * Math.cos(0.73 * t);
      im[t] = Math.cos(0.37 * t);
      timeEnergy += re[t] * re[t] + im[t] * im[t];
    }

    ComplexFFT.transform(re, im);

    let freqEnergy = 0;
    for (let k = 0; k < n; k++) {
      freqEnergy += (re[k] * re[k] + im[k] * im[k]) / n;
    }
    expect(freqEnergy).toBeCloseTo(timeEnergy, 8);
  });
});
