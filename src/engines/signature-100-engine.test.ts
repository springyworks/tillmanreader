import { describe, expect, it } from 'vitest';
import { AdaptiveReadingEngine } from './adaptive-reading-engine';
import { ForeperiodHazardEngine } from './foreperiod-hazard-engine';
import { GestureDecoder } from './gesture-decoder';
import { GuiAffordanceDoodleEngine } from './gui-affordance-doodle-engine';
import { Signature100Engine, isMetricFilter } from './signature-100-engine';
import { TelemetryEngine } from './telemetry-engine';

describe('Signature100Engine', () => {
  it('computes 100 finite deterministic metrics across categories A through F', () => {
    const telemetry = new TelemetryEngine();
    const fpEngine = new ForeperiodHazardEngine();
    const reading = new AdaptiveReadingEngine();
    const gesture = new GestureDecoder(() => undefined);
    const guiEngine = new GuiAffordanceDoodleEngine();
    const sig100 = new Signature100Engine();

    telemetry.loadPreset66(fpEngine, reading);
    sig100.computeAll({
      telemetry,
      gesture,
      reading,
      fpEngine,
      guiEngine,
      drawerState: 0,
      voiceUtterances: 7,
      morphRewardDwellMs: 420,
    });

    expect(sig100.metrics).toHaveLength(100);
    expect(sig100.metrics.map((m) => m.id)).toEqual(
      Array.from({ length: 100 }, (_, idx) => idx + 1),
    );
    expect(sig100.metrics.every((m) => Number.isFinite(m.raw) && String(m.value).length > 0)).toBe(
      true,
    );

    expect(sig100.metrics.filter((m) => m.cat === 'A')).toHaveLength(16);
    expect(sig100.metrics.filter((m) => m.cat === 'B')).toHaveLength(20);
    expect(sig100.metrics.filter((m) => m.cat === 'C')).toHaveLength(18);
    expect(sig100.metrics.filter((m) => m.cat === 'D')).toHaveLength(16);
    expect(sig100.metrics.filter((m) => m.cat === 'E')).toHaveLength(16);
    expect(sig100.metrics.filter((m) => m.cat === 'F')).toHaveLength(14);
  });

  it('validates metric category filter tokens', () => {
    expect(isMetricFilter('ALL')).toBe(true);
    expect(isMetricFilter('A')).toBe(true);
    expect(isMetricFilter('F')).toBe(true);
    expect(isMetricFilter('Z')).toBe(false);
    expect(isMetricFilter(undefined)).toBe(false);
  });
});
