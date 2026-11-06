import { describe, expect, it } from 'vitest';
import { ForeperiodHazardEngine } from './foreperiod-hazard-engine';

describe('ForeperiodHazardEngine', () => {
  it('starts in isochronous beat grounding before rotating stochastic shapes in AUTO_ADAPT', () => {
    const engine = new ForeperiodHazardEngine();

    const first = engine.nextForeperiod();
    expect(first.dist).toBe('ISOCHRONOUS');
    expect(first.tw).toBe(engine.beatPeriodMs);

    for (let i = 0; i < 4; i++) {
      engine.recordValidHit(1100, 240 + i * 10, 'ISOCHRONOUS');
    }

    const fifth = engine.nextForeperiod();
    expect(fifth.dist).toBe('EXPONENTIAL');
    expect(fifth.tw).toBeGreaterThanOrEqual(380);
  });

  it('exhibits aging hazard for uniform foreperiods and flat hazard for exponential', () => {
    const engine = new ForeperiodHazardEngine();

    const hEarlyUni = engine.instantaneousHazard(600, 'UNIFORM');
    const hLateUni = engine.instantaneousHazard(2100, 'UNIFORM');
    expect(hLateUni).toBeGreaterThan(hEarlyUni);

    const hMidExp = engine.instantaneousHazard(800, 'EXPONENTIAL');
    const hLateExp = engine.instantaneousHazard(2200, 'EXPONENTIAL');
    expect(hLateExp).toBe(hMidExp);
  });

  it('tracks premature impulses separately from valid Ex-Gaussian reaction stats', () => {
    const engine = new ForeperiodHazardEngine();

    engine.recordPrematureClick(320, 1100, 'ISOCHRONOUS');
    expect(engine.prematureCount).toBe(1);

    engine.recordValidHit(600, 310, 'UNIFORM');
    engine.recordValidHit(1400, 260, 'UNIFORM');
    engine.recordValidHit(2100, 215, 'UNIFORM');

    const stats = engine.computeStats();
    expect(stats.mu).toBeGreaterThanOrEqual(110);
    expect(stats.sigma).toBeGreaterThan(0);
    expect(stats.tau).toBeGreaterThan(0);
    expect(stats.slopeMsPerSec).toBeLessThan(0);
  });
});
