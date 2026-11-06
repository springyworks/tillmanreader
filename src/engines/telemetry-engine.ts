import { PRESET_25_TRIALS, PRESET_66_BULLSEYE_LOG, PRESET_PUT_32_LOG } from '../data/presets';
import { ComplexFFT } from './complex-fft';
import { TimeStampUtil } from '../util/timestamp';
import type { GoalMemoryMode, Point } from '../types/arena';
import type { AimStrategy, TillmannTrialRecord, TrialInput, TrialRegime } from '../types/telemetry';
import type { AdaptiveReadingEngine } from './adaptive-reading-engine';
import type { ForeperiodHazardEngine } from './foreperiod-hazard-engine';

/** One pointer sample of the movement history with its finite-difference kinematics (px, ms, px/s). */
export interface PositionSample {
  readonly x: number;
  readonly y: number;
  /** Time the sample was taken, as passed to `recordPointerMove`. */
  readonly t: number;
  readonly vx: number;
  readonly vy: number;
  readonly speed: number;
  readonly accel: number;
  readonly jerk: number;
}

/** Least-squares Fitts line `time = a + b · ID` with its R² and throughput `tp = 1000 / b` (bits/s). */
export interface LinearFit {
  readonly a: number;
  readonly b: number;
  readonly r2: number;
  readonly tp: number;
}

/*************************************************************************
 * 7. TELEMETRY ENGINE (HARDWARE, KINEMATICS, FFT, MULTI-MANIFOLD FITTS)
 *************************************************************************/
export class TelemetryEngine {
  readonly dtHistory: number[];
  lastEventTime: number;
  coalescedRatio: number;
  estimatedHz: number;
  jitterMs: number;
  inputToPhotonMs: number;

  readonly posHistory: PositionSample[];
  readonly fftSize: number;
  readonly vxRing: Float64Array;
  readonly vyRing: Float64Array;
  ringIdx: number;
  readonly fftSpectrum: Float64Array;
  peakFreqHz: number;
  bandLow: number;
  bandTremor: number;
  bandNoise: number;
  posNegSpinRatio: number;

  lastDownTime: number;
  lastDownPos: Point;
  lastDwellMs: number;
  lastSlipPx: number;

  instSpeed: number;
  meanSpeed: number;
  peakSpeed: number;
  instVx: number;
  instVy: number;
  instAccel: number;
  instJerk: number;
  instSnap: number;
  curvature: number;
  readonly straightness: number;
  readonly orthoDevPx: number;
  readonly zeroCrossings: number;

  aimStrategy: AimStrategy;
  lastRadialErrPx: number;
  lastNormRadiusPct: number;
  meanNormRadiusPct: number;
  effectiveWidthRatio: number;
  selfImposedTaxBits: number;

  goalMemoryMode: GoalMemoryMode;
  goalPeekCount: number;
  totalGoalHoverMs: number;
  readonly lastTrialPeeks: number;
  readonly lastTrialGoalHoverMs: number;
  memoryDecayAlpha: number;

  rt0BaselineMs: number;
  trials: TillmannTrialRecord[];
  regTotal: LinearFit;
  regMotor: LinearFit;
  regEffective: LinearFit;

  /** Set by the layout controller on each layout pass; `declare` keeps it off the instance until then. */
  declare viewDiagPx?: number;

  constructor() {
    this.dtHistory = [];
    this.lastEventTime = 0;
    this.coalescedRatio = 1.0;
    this.estimatedHz = 90;
    this.jitterMs = 12.18;
    this.inputToPhotonMs = 6.21;

    this.posHistory = [];
    this.fftSize = 128;
    this.vxRing = new Float64Array(128);
    this.vyRing = new Float64Array(128);
    this.ringIdx = 0;
    this.fftSpectrum = new Float64Array(64);
    this.peakFreqHz = 59.06;
    this.bandLow = 12.8;
    this.bandTremor = 15.6;
    this.bandNoise = 71.6;
    this.posNegSpinRatio = 1.04;

    this.lastDownTime = 0;
    this.lastDownPos = { x: 0, y: 0 };
    this.lastDwellMs = 68;
    this.lastSlipPx = 1.4;

    this.instSpeed = 0;
    this.meanSpeed = 380;
    this.peakSpeed = 1120;
    this.instVx = 0;
    this.instVy = 0;
    this.instAccel = 0;
    this.instJerk = 0;
    this.instSnap = 0;
    this.curvature = 0.004;
    this.straightness = 0.88;
    this.orthoDevPx = 11.4;
    this.zeroCrossings = 2.4;

    // Center-Shooting vs. Edge-Grazing (Crossman-Welford-MacKenzie Effective Width We)
    this.aimStrategy = 'NATURAL'; // 'NATURAL' | 'BULLSEYE' | 'RIM_GRAZE'
    this.lastRadialErrPx = 12.4;
    this.lastNormRadiusPct = 0.21; // 0 = dead center, 1.0 = outer edge
    this.meanNormRadiusPct = 0.21;
    this.effectiveWidthRatio = 0.31; // We / W_nominal
    this.selfImposedTaxBits = 1.85; // ID_eff - ID_nominal

    // Hover-to-Reveal Top Goal & Spatial Working-Memory Telemetry
    this.goalMemoryMode = 'AUTO_PROG'; // Default AUTO_PROG so when the PUT does well, it automatically fades to test working memory!
    this.goalPeekCount = 0;
    this.totalGoalHoverMs = 0;
    this.lastTrialPeeks = 0;
    this.lastTrialGoalHoverMs = 0;
    this.memoryDecayAlpha = 1.0;

    this.rt0BaselineMs = 443;
    this.trials = [];
    this.regTotal = { a: 1390, b: 128, r2: 0.84, tp: 7.79 };
    this.regMotor = { a: 450, b: 141, r2: 0.88, tp: 7.1 };
    this.regEffective = { a: 520, b: 132, r2: 0.91, tp: 7.58 };
  }

  recordPointerMove(e: PointerEvent, now: number): void {
    const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    this.coalescedRatio = 0.9 * this.coalescedRatio + 0.1 * coalesced.length;

    const pts = coalesced.length > 0 ? coalesced : [e];
    for (const pt of pts) {
      const t = pt.timeStamp || now;
      if (this.lastEventTime > 0) {
        const dt = t - this.lastEventTime;
        if (dt > 0.15 && dt < 200) {
          this.dtHistory.push(dt);
          if (this.dtHistory.length > 120) this.dtHistory.shift();
          this.updateHardwareStats();
        }
      }
      this.lastEventTime = t;
    }

    const prev: PositionSample | undefined = this.posHistory[this.posHistory.length - 1];
    const x = e.offsetX,
      y = e.offsetY;
    if (prev) {
      const rawDtMs = now - prev.t;
      const dtSec = Math.max(0.004, rawDtMs / 1000);
      const vx = (x - prev.x) / dtSec;
      const vy = (y - prev.y) / dtSec;
      const speed = Math.hypot(vx, vy);
      const accel = (speed - (prev.speed || 0)) / dtSec;
      const jerk = (accel - (prev.accel || 0)) / dtSec;
      const snap = (jerk - (prev.jerk || 0)) / dtSec;

      this.instVx = vx;
      this.instVy = vy;
      this.instSpeed = speed;
      this.meanSpeed = 0.96 * this.meanSpeed + 0.04 * speed;
      if (speed < 18000 && speed > this.peakSpeed) this.peakSpeed = speed;
      this.instAccel = accel;
      this.instJerk = jerk;
      this.instSnap = snap;

      const cross = Math.abs(vx * (vy - (prev.vy || 0)) - vy * (vx - (prev.vx || 0)));
      const denom = Math.pow(vx * vx + vy * vy, 1.5);
      if (denom > 100) {
        this.curvature = Math.min(0.25, cross / denom);
      }

      this.vxRing[this.ringIdx] = vx;
      this.vyRing[this.ringIdx] = vy;
      this.ringIdx = (this.ringIdx + 1) & 127;

      this.posHistory.push({ x, y, t: now, vx, vy, speed, accel, jerk });
      if (this.posHistory.length > 140) this.posHistory.shift();
    } else {
      this.posHistory.push({ x, y, t: now, vx: 0, vy: 0, speed: 0, accel: 0, jerk: 0 });
    }
  }

  updateHardwareStats(): void {
    if (this.dtHistory.length < 6) return;
    const sorted = [...this.dtHistory].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = this.dtHistory.reduce((a, b) => a + b, 0) / this.dtHistory.length;
    const variance =
      this.dtHistory.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / this.dtHistory.length;
    this.jitterMs = Math.sqrt(variance);
    this.estimatedHz = Math.min(1000, Math.max(15, Math.round(1000 / Math.max(1, median))));
    this.inputToPhotonMs = 0.5 * median + 8.3;
  }

  recordDown(x: number, y: number, now: number): void {
    this.lastDownTime = now;
    this.lastDownPos = { x, y };
  }

  recordUp(x: number, y: number, now: number): void {
    if (this.lastDownTime > 0) {
      const dwell = now - this.lastDownTime;
      if (dwell > 5 && dwell < 1500) {
        this.lastDwellMs = dwell;
        this.lastSlipPx = Math.min(120, Math.hypot(x - this.lastDownPos.x, y - this.lastDownPos.y));
      }
      this.lastDownTime = 0;
    }
  }

  computeFFT(): void {
    const re = new Float64Array(128);
    const im = new Float64Array(128);
    for (let i = 0; i < 128; i++) {
      const idx = (this.ringIdx + i) & 127;
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / 127));
      re[i] = this.vxRing[idx] * w;
      im[i] = this.vyRing[idx] * w;
    }
    ComplexFFT.transform(re, im);

    const fs = Math.max(60, this.estimatedHz);
    let maxMag = 0,
      maxBin = 1;
    let eLow = 0,
      eTremor = 0,
      eNoise = 0;
    let posSpin = 0,
      negSpin = 0;

    for (let k = 1; k < 64; k++) {
      const magPos = Math.hypot(re[k], im[k]) / 128;
      const magNeg = Math.hypot(re[128 - k], im[128 - k]) / 128;
      posSpin += magPos;
      negSpin += magNeg;
      const mag = magPos + magNeg;
      this.fftSpectrum[k] = 0.8 * this.fftSpectrum[k] + 0.2 * mag;

      const freq = (k * fs) / 128;
      if (this.fftSpectrum[k] > maxMag) {
        maxMag = this.fftSpectrum[k];
        maxBin = k;
      }
      const e = this.fftSpectrum[k] * this.fftSpectrum[k];
      if (freq <= 4.5) eLow += e;
      else if (freq <= 12.5) eTremor += e;
      else eNoise += e;
    }

    const totalE = eLow + eTremor + eNoise;
    if (totalE > 1e-3) {
      this.peakFreqHz = (maxBin * fs) / 128;
      this.bandLow = (eLow / totalE) * 100;
      this.bandTremor = (eTremor / totalE) * 100;
      this.bandNoise = (eNoise / totalE) * 100;
      this.posNegSpinRatio = posSpin / Math.max(1e-3, negSpin);
    }
  }

  classifyTrial(t: TrialInput): TrialRegime {
    if (t.gestureTagged) return 'AFFECTIVE_GESTURE';
    if (t.mt > 30000) return 'AWAY_PAUSE';
    if ((t.dockInspectionMs && t.dockInspectionMs > 1200) || t.mt > 5500)
      return 'TELEMETRY_INSPECTION';
    if (t.brain > 1350) return 'COGNITIVE_SEARCH';
    return 'MOTOR_LOCKED';
  }

  addTrial(trial: TrialInput): void {
    const ts = TimeStampUtil.nowPacket();
    if (!trial.unixMs) trial.unixMs = ts.unixMs;
    if (!trial.perfNowUs) trial.perfNowUs = ts.perfNowUs;
    if (!trial.isoTime) trial.isoTime = ts.iso;
    trial.regime = this.classifyTrial(trial);
    trial.motorMt = Math.max(20, (trial.ballistic || 0) + (trial.homing || 0));
    if (trial.normRadiusPct === undefined) {
      trial.normRadiusPct = 0.22;
      trial.hitAngleRad = (this.trials.length * 1.1) % (Math.PI * 2);
    }
    this.lastNormRadiusPct = trial.normRadiusPct;
    // The in-place stamping above completes the object; the compiler cannot follow that.
    this.trials.push(trial as TillmannTrialRecord);
    if (this.trials.length > 90) this.trials.shift();
    this.recomputeRegressions();
  }

  recomputeRegressions(): void {
    // Compute Mean Normalized Hit Radius (r_err / R) & Effective Width Ratio (We / W_nominal)
    const hitTrials = this.trials.filter((t) => Number.isFinite(t.normRadiusPct));
    if (hitTrials.length >= 2) {
      const sumR = hitTrials.reduce((s, t) => s + t.normRadiusPct, 0);
      this.meanNormRadiusPct = sumR / hitTrials.length;
      const varR =
        hitTrials.reduce((s, t) => s + Math.pow(t.normRadiusPct - this.meanNormRadiusPct, 2), 0) /
        hitTrials.length;
      const sdNorm = Math.sqrt(Math.max(0.002, varR));
      // Crossman-Welford Effective Width ratio We / W_nominal:
      // Combines radial mean offset and bivariate SD so bullseye shooters show We/W ~ 0.22-0.38
      this.effectiveWidthRatio = Math.max(
        0.14,
        Math.min(1.25, 0.85 * this.meanNormRadiusPct + 1.45 * sdNorm),
      );
      this.selfImposedTaxBits = Math.max(
        0,
        Math.log2(1 / Math.max(0.14, this.effectiveWidthRatio)),
      );
    }

    const motorLocked = this.trials.filter((t) => t.regime === 'MOTOR_LOCKED' && t.id > 0.35);
    if (motorLocked.length >= 2) {
      this.regTotal = this.fitLinear(motorLocked.map((t) => ({ x: t.id, y: t.mt })));
      // Effective ID regression (shifting each trial's nominal ID by its self-imposed precision tax)
      this.regEffective = this.fitLinear(
        motorLocked.map((t) => ({
          x: t.id + Math.max(0, Math.log2(1 / Math.max(0.15, (t.normRadiusPct || 0.22) * 1.6))),
          y: t.mt,
        })),
      );
    }
    const spatial = this.trials.filter(
      (t) => t.regime === 'MOTOR_LOCKED' && t.id > 0.35 && t.motorMt > 30 && t.motorMt < 5000,
    );
    if (spatial.length >= 2) {
      this.regMotor = this.fitLinear(spatial.map((t) => ({ x: t.id, y: t.motorMt })));
    }
  }

  fitLinear(pts: readonly Point[]): LinearFit {
    const n = pts.length;
    let sx = 0,
      sy = 0,
      sxy = 0,
      sxx = 0,
      syy = 0;
    for (const p of pts) {
      sx += p.x;
      sy += p.y;
      sxy += p.x * p.y;
      sxx += p.x * p.x;
      syy += p.y * p.y;
    }
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-5) return { a: 220, b: 195, r2: 0, tp: 5.13 };
    const b = Math.max(40, (n * sxy - sx * sy) / denom);
    const a = (sy - b * sx) / n;
    const numR = n * sxy - sx * sy;
    const denR = Math.sqrt(Math.max(1e-5, (n * sxx - sx * sx) * (n * syy - sy * sy)));
    const r2 = Math.max(0, Math.min(1, Math.pow(numR / denR, 2)));
    return { a, b, r2, tp: 1000 / b };
  }

  loadPreset66(fpEngine?: ForeperiodHazardEngine, readingEngine?: AdaptiveReadingEngine): void {
    this.trials = [];
    this.rt0BaselineMs = 443;
    for (const raw of PRESET_66_BULLSEYE_LOG.trials) {
      this.addTrial({ ...raw });
    }
    if (fpEngine) {
      fpEngine.records = PRESET_66_BULLSEYE_LOG.records.map((r, idx) => ({
        ...r,
        t: performance.now() - (PRESET_66_BULLSEYE_LOG.records.length - idx) * 1400,
      }));
      fpEngine.isoStreak = 44;
      fpEngine.entrainmentLockScore = 61;
      fpEngine.prematureCount = 5;
      fpEngine.activeDist = 'UNIFORM';
    }
    if (readingEngine) {
      readingEngine.stage = 3;
      readingEngine.readingAccuracy = 93.94;
      readingEngine.mirrorConfusionRate = 14.7;
      readingEngine.lastDecodeLatencyMs = 796;
      readingEngine.lastDistractorPullPx = 28.5;
    }
  }

  loadPresetPut32(fpEngine?: ForeperiodHazardEngine): void {
    this.trials = [];
    this.rt0BaselineMs = 445;
    for (const raw of PRESET_PUT_32_LOG.trials) {
      this.addTrial({ ...raw });
    }
    if (fpEngine) {
      fpEngine.records = PRESET_PUT_32_LOG.records.map((r, idx) => ({
        ...r,
        t: performance.now() - (PRESET_PUT_32_LOG.records.length - idx) * 1400,
      }));
      fpEngine.isoStreak = 36;
      fpEngine.entrainmentLockScore = 63;
      fpEngine.prematureCount = 4;
      fpEngine.activeDist = 'WEIBULL';
    }
  }

  loadPreset25(fpEngine?: ForeperiodHazardEngine): void {
    this.trials = [];
    for (const raw of PRESET_25_TRIALS) {
      this.addTrial({ ...raw });
    }
    if (fpEngine) {
      fpEngine.records = [];
      for (const raw of PRESET_25_TRIALS.slice(0, 6)) {
        fpEngine.recordValidHit(raw.tw || 1100, raw.mt, raw.fpDist || 'ISOCHRONOUS');
      }
    }
  }
}
