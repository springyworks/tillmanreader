import type { LabApp } from '../app/lab-app';
import { PRESET_25_TRIALS } from '../data/presets';
import { ComplexFFT } from '../engines/complex-fft';
import { SemanticMorphEngine } from '../engines/semantic-morph-engine';
import { maybeById } from '../util/dom';
import { TimeStampUtil } from '../util/timestamp';

/** One-line description of whatever a promise was rejected with. */
function describeRejection(reason: unknown): string {
  if (reason instanceof Error) return String(reason);
  return typeof reason === 'string' && reason !== '' ? reason : 'Unhandled Promise';
}

/**
 * Collects uncaught errors and runs the in-browser smoke tests whose verdict
 * is shown in the status badge ("0 ERR • 14/14 PASS").
 */
class Watchdog {
  readonly errors: string[] = [];
  testsPassed = 0;
  readonly totalTests = 14;

  init(): void {
    window.addEventListener('error', (e) => {
      this.recordError(e.message || 'Runtime Error', e.lineno);
    });
    window.addEventListener('unhandledrejection', (e) => {
      this.recordError(describeRejection(e.reason));
    });
  }

  recordError(msg: string, line: number | string = ''): void {
    this.errors.push(`${msg}${line ? ' @L' + line : ''}`);
    this.updateBadge();
  }

  /** Returns true when every self-test passed and no error has been recorded so far. */
  runSelfTests(app: LabApp): boolean {
    let passed = 0;
    try {
      // 1. Main arena & overlay canvas
      if (app.canvas && app.ctx && app.overlayCanvas && app.overlayCtx) passed++;
      // 2. Scope canvases
      if (app.s1Ctx && app.s2Ctx && app.s3Ctx) passed++;
      // 3. Radix-2 128-pt Complex FFT DC check
      const re = new Float64Array(128).fill(1);
      const im = new Float64Array(128).fill(0);
      ComplexFFT.transform(re, im);
      if (Math.abs(re[0] - 128) < 1e-6) passed++;
      // 4. 100-Metric engine count
      if (app.sig100.metrics.length === 100) passed++;
      // 5. All 100 metrics finite
      app.computeSignature();
      if (app.sig100.metrics.every((m) => Number.isFinite(m.raw))) passed++;
      // 6. Gesture decoder
      if (typeof app.gesture.pushSample === 'function') passed++;
      // 7. Adaptive reading 6 stages
      if (app.reading.stages.length === 6) passed++;
      // 8. Preset datasets present
      if (Array.isArray(PRESET_25_TRIALS) && PRESET_25_TRIALS.length === 25) passed++;
      // 9. PUT Foreperiod engine
      if (typeof app.fpEngine.nextForeperiod === 'function') passed++;
      // 10. PUT Ex-Gaussian stats finite
      const st = app.fpEngine.computeStats();
      if (Number.isFinite(st.mu) && Number.isFinite(st.tau)) passed++;
      // 11. GUI-Element ID & Doodling Engine registered elements
      if (app.guiEngine.registry.size >= 15) passed++;
      // 12. L1 Safe Center Target is strictly inside visible viewport bounds
      const safe = app.getSafeArenaCenter();
      if (safe.cx > 60 && safe.cy > 80 && app.target && app.target.r >= 14) passed++;
      // 13. Dual Unix + ISO Timestamp packet verification
      const ts = TimeStampUtil.nowPacket();
      if (ts.unixMs > 1700000000000 && ts.perfNowUs >= 0 && ts.iso.includes('T')) passed++;
      // 14. Semantic Circle->SVG Morphing Engine & LocalStorage Persistence Manager
      if (typeof SemanticMorphEngine.renderMorph === 'function' && app.persistence) passed++;
    } catch (err) {
      this.recordError('SelfTest: ' + (err instanceof Error ? err.message : String(err)));
    }
    this.testsPassed = passed;
    this.updateBadge();
    return passed === this.totalTests && this.errors.length === 0;
  }

  updateBadge(): void {
    const dot = maybeById('watchdogDot');
    const txt = maybeById('watchdogText');
    const btn = maybeById('btnWatchdog');
    if (!dot || !txt || !btn) return;
    if (this.errors.length === 0) {
      dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
      txt.textContent = `0 ERR • ${this.testsPassed}/${this.totalTests} PASS`;
    } else {
      dot.className = 'w-1.5 h-1.5 rounded-full bg-rose-400';
      txt.textContent = `${this.errors.length} ERR: ${this.errors[0].slice(0, 22)}`;
    }
  }
}

export const RuntimeWatchdog = new Watchdog();
