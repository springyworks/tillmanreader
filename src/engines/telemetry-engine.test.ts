import { describe, expect, it } from 'vitest';
import { PRESET_66_BULLSEYE_LOG } from '../data/presets';
import { AdaptiveReadingEngine } from './adaptive-reading-engine';
import { ForeperiodHazardEngine } from './foreperiod-hazard-engine';
import { TelemetryEngine } from './telemetry-engine';

describe('TelemetryEngine', () => {
  it('classifies trials into psychomotor and cognitive regimes', () => {
    const engine = new TelemetryEngine();

    expect(
      engine.classifyTrial({
        id: 2.5,
        mt: 680,
        hw: 12,
        brain: 240,
        ballistic: 210,
        homing: 218,
      }),
    ).toBe('MOTOR_LOCKED');

    expect(
      engine.classifyTrial({
        id: 2.5,
        mt: 1900,
        hw: 12,
        brain: 1500,
        ballistic: 200,
        homing: 188,
      }),
    ).toBe('COGNITIVE_SEARCH');

    expect(
      engine.classifyTrial({
        id: 2.5,
        mt: 900,
        hw: 12,
        brain: 280,
        ballistic: 300,
        homing: 308,
        dockInspectionMs: 1600,
      }),
    ).toBe('TELEMETRY_INSPECTION');

    expect(
      engine.classifyTrial({
        id: 2.5,
        mt: 35000,
        hw: 12,
        brain: 300,
        ballistic: 200,
        homing: 200,
      }),
    ).toBe('AWAY_PAUSE');

    expect(
      engine.classifyTrial({
        id: 2.5,
        mt: 800,
        hw: 12,
        brain: 250,
        ballistic: 250,
        homing: 288,
        gestureTagged: 'NO_SHAKE',
      }),
    ).toBe('AFFECTIVE_GESTURE');
  });

  it('computes Crossman-Welford effective width tax higher for bullseye hits than rim grazing', () => {
    const bullseye = new TelemetryEngine();
    for (let i = 0; i < 6; i++) {
      bullseye.addTrial({
        id: 1.5 + i * 0.5,
        mt: 420 + i * 90,
        hw: 12,
        brain: 190,
        ballistic: 110 + i * 45,
        homing: 108 + i * 45,
        normRadiusPct: 0.12,
      });
    }

    const rimGraze = new TelemetryEngine();
    for (let i = 0; i < 6; i++) {
      rimGraze.addTrial({
        id: 1.5 + i * 0.5,
        mt: 360 + i * 75,
        hw: 12,
        brain: 180,
        ballistic: 95 + i * 38,
        homing: 85 + i * 37,
        normRadiusPct: 0.85,
      });
    }

    expect(bullseye.effectiveWidthRatio).toBeLessThan(rimGraze.effectiveWidthRatio);
    expect(bullseye.selfImposedTaxBits).toBeGreaterThan(rimGraze.selfImposedTaxBits);
    expect(bullseye.regMotor.r2).toBeCloseTo(1, 5);
  });

  it('loads the 66-trial bullseye preset and populates Fitts regressions', () => {
    const engine = new TelemetryEngine();
    const fp = new ForeperiodHazardEngine();
    const reading = new AdaptiveReadingEngine();

    engine.loadPreset66(fp, reading);

    expect(engine.trials.length).toBe(PRESET_66_BULLSEYE_LOG.trials.length);
    expect(fp.records.length).toBeGreaterThan(0);
    expect(reading.stage).toBe(3);
    expect(engine.selfImposedTaxBits).toBeGreaterThan(1.0);
    expect(engine.regTotal.tp).toBeGreaterThan(0);
  });
});
