// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import { PRESET_25_TRIALS } from '../data/presets';
import { ComplexFFT } from '../engines/complex-fft';
import { SemanticMorphEngine } from '../engines/semantic-morph-engine';
import { TimeStampUtil } from '../util/timestamp';

export const RuntimeWatchdog = {
  errors: [],
  testsPassed: 0,
  totalTests: 14,
  init() {
    window.addEventListener('error', (e) => {
      this.recordError(e.message || 'Runtime Error', e.lineno);
    });
    window.addEventListener('unhandledrejection', (e) => {
      this.recordError(e.reason ? String(e.reason) : 'Unhandled Promise');
    });
  },
  recordError(msg, line = '') {
    this.errors.push(`${msg}${line ? ' @L' + line : ''}`);
    this.updateBadge();
  },
  runSelfTests(app) {
    let passed = 0;
    try {
      // 1. Main arena & overlay canvas
      if (app && app.canvas && app.ctx && app.overlayCanvas && app.overlayCtx) passed++;
      // 2. Scope canvases
      if (app.s1Ctx && app.s2Ctx && app.s3Ctx) passed++;
      // 3. Radix-2 128-pt Complex FFT DC check
      const re = new Float64Array(128).fill(1);
      const im = new Float64Array(128).fill(0);
      ComplexFFT.transform(re, im);
      if (Math.abs(re[0] - 128) < 1e-6) passed++;
      // 4. 100-Metric engine count
      if (app.sig100 && app.sig100.metrics.length === 100) passed++;
      // 5. All 100 metrics finite
      app.sig100.computeAll(
        app.telemetry,
        app.gesture,
        app.reading,
        app.drawerState,
        app.fpEngine,
        app.guiEngine,
      );
      if (app.sig100.metrics.every((m) => Number.isFinite(m.raw))) passed++;
      // 6. Gesture decoder
      if (app.gesture && typeof app.gesture.pushSample === 'function') passed++;
      // 7. Adaptive reading 6 stages
      if (app.reading && app.reading.stages.length === 6) passed++;
      // 8. Preset datasets present
      if (Array.isArray(PRESET_25_TRIALS) && PRESET_25_TRIALS.length === 25) passed++;
      // 9. PUT Foreperiod engine
      if (app.fpEngine && typeof app.fpEngine.nextForeperiod === 'function') passed++;
      // 10. PUT Ex-Gaussian stats finite
      const st = app.fpEngine.computeStats();
      if (Number.isFinite(st.mu) && Number.isFinite(st.tau)) passed++;
      // 11. GUI-Element ID & Doodling Engine registered elements
      if (app.guiEngine && app.guiEngine.registry.size >= 15) passed++;
      // 12. L1 Safe Center Target is strictly inside visible viewport bounds
      const safe = app.getSafeArenaCenter();
      if (safe.cx > 60 && safe.cy > 80 && app.target && app.target.r >= 14) passed++;
      // 13. Dual Unix + ISO Timestamp packet verification
      const ts = TimeStampUtil.nowPacket();
      if (ts.unixMs > 1700000000000 && ts.perfNowUs >= 0 && ts.iso.includes('T')) passed++;
      // 14. Semantic Circle->SVG Morphing Engine & LocalStorage Persistence Manager
      if (
        SemanticMorphEngine &&
        typeof SemanticMorphEngine.renderMorph === 'function' &&
        app.persistence
      )
        passed++;
    } catch (err) {
      this.recordError('SelfTest: ' + err.message);
    }
    this.testsPassed = passed;
    this.updateBadge();
    return passed === this.totalTests && this.errors.length === 0;
  },
  updateBadge() {
    const dot = document.getElementById('watchdogDot');
    const txt = document.getElementById('watchdogText');
    const btn = document.getElementById('btnWatchdog');
    if (!dot || !txt || !btn) return;
    if (this.errors.length === 0) {
      dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400';
      txt.textContent = `0 ERR • ${this.testsPassed}/${this.totalTests} PASS`;
    } else {
      dot.className = 'w-1.5 h-1.5 rounded-full bg-rose-400';
      txt.textContent = `${this.errors.length} ERR: ${this.errors[0].slice(0, 22)}`;
    }
  },
};
