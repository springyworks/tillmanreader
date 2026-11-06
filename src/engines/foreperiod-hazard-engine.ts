import type {
  ForeperiodDistribution,
  ForeperiodRecord,
  ForeperiodShape,
  ForeperiodStats,
} from '../types/telemetry';
import { TimeStampUtil } from '../util/timestamp';

/** One randomly assigned waiting time: its length, the distribution it came from and its hazard rate. */
export interface ForeperiodDraw {
  readonly tw: number;
  readonly dist: ForeperiodShape;
  readonly hazard: number;
}

/*************************************************************************
 * 4. PUT FOREPERIOD ENTRAINMENT, STOCHASTIC WAITING & HAZARD ENGINE
 *************************************************************************/
export class ForeperiodHazardEngine {
  mode: ForeperiodDistribution;
  activeDist: ForeperiodShape;
  readonly beatPeriodMs: number;
  isoStreak: number;
  entrainmentLockScore: number;
  prematureCount: number;
  currentTwMs: number;
  currentHazard: number;
  records: ForeperiodRecord[];

  constructor() {
    this.mode = 'AUTO_ADAPT';
    this.activeDist = 'ISOCHRONOUS';
    this.beatPeriodMs = 1100;
    this.isoStreak = 0;
    this.entrainmentLockScore = 65;
    this.prematureCount = 0;
    this.currentTwMs = 1100;
    this.currentHazard = 1.0;
    this.records = [];
  }

  setMode(mode: ForeperiodDistribution): void {
    this.mode = mode;
    if (mode !== 'AUTO_ADAPT') {
      this.activeDist = mode;
    } else {
      this.isoStreak = 0;
      this.activeDist = 'ISOCHRONOUS';
    }
  }

  nextForeperiod(): ForeperiodDraw {
    if (this.mode === 'AUTO_ADAPT') {
      if (this.isoStreak < 4) {
        this.activeDist = 'ISOCHRONOUS';
      } else {
        const cycleIdx = Math.floor((this.isoStreak - 4) / 3) % 4;
        const rot: ForeperiodShape[] = ['EXPONENTIAL', 'UNIFORM', 'BIMODAL', 'WEIBULL'];
        this.activeDist = rot[cycleIdx];
      }
    } else {
      this.activeDist = this.mode;
    }

    let tw = 1100;
    const u = Math.max(0.002, Math.min(0.998, Math.random()));

    switch (this.activeDist) {
      case 'ISOCHRONOUS':
        tw = this.beatPeriodMs;
        break;
      case 'EXPONENTIAL':
        tw = Math.min(3400, 420 - 750 * Math.log(1 - u));
        break;
      case 'UNIFORM':
        tw = 450 + u * 2000;
        break;
      case 'BIMODAL':
        if (Math.random() < 0.5) {
          tw = 550 + (Math.random() + Math.random() - 1) * 160;
        } else {
          tw = 2150 + (Math.random() + Math.random() - 1) * 220;
        }
        break;
      case 'WEIBULL':
        tw = Math.min(3500, 450 + 1150 * Math.pow(-Math.log(1 - u), 1 / 1.5));
        break;
    }

    this.currentTwMs = Math.round(Math.max(380, tw));
    this.currentHazard = this.instantaneousHazard(this.currentTwMs, this.activeDist);
    return {
      tw: this.currentTwMs,
      dist: this.activeDist,
      hazard: this.currentHazard,
    };
  }

  instantaneousHazard(tMs: number, distName: ForeperiodDistribution = this.activeDist): number {
    const tSec = tMs / 1000;
    switch (distName) {
      case 'ISOCHRONOUS': {
        const diff = (tMs - this.beatPeriodMs) / 95;
        return Number((0.2 + 4.3 * Math.exp(-0.5 * diff * diff)).toFixed(2));
      }
      case 'EXPONENTIAL':
        return tMs < 420 ? 0.1 : 1.33;
      case 'UNIFORM': {
        if (tMs < 450) return 0.1;
        const remSec = Math.max(0.18, (2450 - tMs) / 1000);
        return Number(Math.min(5.0, 1 / remSec).toFixed(2));
      }
      case 'BIMODAL': {
        const g1 = 2.6 * Math.exp(-0.5 * Math.pow((tMs - 550) / 130, 2));
        const g2 = 3.8 * Math.exp(-0.5 * Math.pow((tMs - 2150) / 160, 2));
        return Number((0.25 + g1 + g2).toFixed(2));
      }
      case 'WEIBULL': {
        if (tMs <= 450) return 0.15;
        const x = (tSec - 0.45) / 1.15;
        return Number(Math.min(4.8, (1.5 / 1.15) * Math.pow(Math.max(0.05, x), 0.5)).toFixed(2));
      }
      default:
        return 1.0;
    }
  }

  recordValidHit(tw: number, rt: number, dist: ForeperiodDistribution): void {
    const hazard = this.instantaneousHazard(tw, dist);
    const phaseErr = tw - this.beatPeriodMs;
    const ts = TimeStampUtil.nowPacket();
    this.records.push({
      tw,
      rt: Math.round(rt),
      dist,
      hazard,
      premature: false,
      phaseErrorMs: Math.round(phaseErr),
      t: performance.now(),
      unixMs: ts.unixMs,
      perfNowUs: ts.perfNowUs,
      isoTime: ts.iso,
    });
    if (this.records.length > 80) this.records.shift();

    this.isoStreak++;
    const isoRecs = this.records.filter((r) => !r.premature && r.rt < 2500).slice(-6);
    if (isoRecs.length >= 2) {
      const mean = isoRecs.reduce((s, r) => s + r.rt, 0) / isoRecs.length;
      const sd = Math.sqrt(
        isoRecs.reduce((s, r) => s + Math.pow(r.rt - mean, 2), 0) / isoRecs.length,
      );
      const cv = sd / Math.max(1, mean);
      this.entrainmentLockScore = Math.round(Math.max(15, Math.min(99, (1 - cv * 1.15) * 100)));
    }
  }

  recordPrematureClick(
    elapsedWaitMs: number,
    assignedTw: number,
    dist: ForeperiodDistribution,
  ): void {
    this.prematureCount++;
    const ts = TimeStampUtil.nowPacket();
    this.records.push({
      tw: assignedTw,
      rt: Math.round(elapsedWaitMs),
      dist,
      hazard: this.instantaneousHazard(elapsedWaitMs, dist),
      premature: true,
      phaseErrorMs: Math.round(elapsedWaitMs - this.beatPeriodMs),
      t: performance.now(),
      unixMs: ts.unixMs,
      perfNowUs: ts.perfNowUs,
      isoTime: ts.iso,
    });
    if (this.records.length > 80) this.records.shift();
  }

  computeStats(): ForeperiodStats {
    const valid = this.records.filter((r) => !r.premature && r.rt > 90 && r.rt < 4500);
    if (valid.length < 2) {
      return {
        mu: 209,
        sigma: 50,
        tau: 389,
        skewness: 1.8,
        corrTwRT: -0.15,
        slopeMsPerSec: -92,
        cvRT: 0.25,
        meanWaitMs: this.currentTwMs,
        waitEntropyBits: 2.65,
      };
    }

    const n = valid.length;
    const rts = valid.map((r) => r.rt);
    const tws = valid.map((r) => r.tw);
    const meanRT = rts.reduce((a, b) => a + b, 0) / n;
    const varRT = rts.reduce((s, x) => s + Math.pow(x - meanRT, 2), 0) / n;
    const sdRT = Math.sqrt(Math.max(1, varRT));

    const m3 = rts.reduce((s, x) => s + Math.pow(x - meanRT, 3), 0) / n;
    const rawSkew = m3 / Math.pow(sdRT, 3);
    const clampedSkew = Math.max(0.15, Math.min(2.5, Math.abs(rawSkew) || 0.8));

    const tau = Math.min(sdRT * 0.92, sdRT * Math.pow(clampedSkew / 2, 1 / 3));
    const mu = Math.max(110, meanRT - tau);
    const sigma = Math.sqrt(Math.max(64, varRT - tau * tau));

    const meanTw = tws.reduce((a, b) => a + b, 0) / n;
    let num = 0,
      denTw = 0,
      denRt = 0;
    for (let i = 0; i < n; i++) {
      const dx = (tws[i] - meanTw) / 1000;
      const dy = rts[i] - meanRT;
      num += dx * dy;
      denTw += dx * dx;
      denRt += dy * dy;
    }
    const slopeMsPerSec = denTw > 1e-4 ? num / denTw : 0;
    const corrTwRT = denTw > 1e-4 && denRt > 1e-4 ? num / Math.sqrt(denTw * denRt) : 0;

    const bins = new Array<number>(8).fill(0);
    for (let i = 0; i < n; i++) {
      const b = Math.min(7, Math.floor((tws[i] - 350) / 400));
      if (b >= 0) bins[b]++;
    }
    let entropy = 0;
    for (let b = 0; b < 8; b++) {
      if (bins[b] > 0) {
        const p = bins[b] / n;
        entropy -= p * Math.log2(p);
      }
    }

    return {
      mu: Math.round(mu),
      sigma: Math.round(sigma),
      tau: Math.round(tau),
      skewness: Number(clampedSkew.toFixed(2)),
      corrTwRT: Number(corrTwRT.toFixed(2)),
      slopeMsPerSec: Math.round(slopeMsPerSec),
      cvRT: Number((sdRT / Math.max(1, meanRT)).toFixed(3)),
      meanWaitMs: Math.round(meanTw),
      waitEntropyBits: Number(entropy.toFixed(2)),
    };
  }
}
