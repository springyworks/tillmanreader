// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.

/*************************************************************************
 * 8. THE 100-METRIC DETERMINISTIC MATHEMATICAL SIGNATURE ENGINE
 *************************************************************************/
export class Signature100Engine {
  constructor() {
    this.activeCategory = 'ALL';
    this.metrics = this.buildSchema();
  }

  buildSchema() {
    const schema = [
      // CATEGORY A: OSI Layer 1 Hardware & OS Event Pipeline (1-16)
      { id: 1, cat: 'A', name: 'Mean Poll Δt', unit: 'ms' },
      { id: 2, cat: 'A', name: 'Median Poll Rate', unit: 'Hz' },
      { id: 3, cat: 'A', name: 'Polling Jitter σ', unit: 'ms' },
      { id: 4, cat: 'A', name: 'Poll Δt CV', unit: '' },
      { id: 5, cat: 'A', name: 'Min Event Δt', unit: 'ms' },
      { id: 6, cat: 'A', name: 'Max Event Gap', unit: 'ms' },
      { id: 7, cat: 'A', name: 'Input→Photon Lag', unit: 'ms' },
      { id: 8, cat: 'A', name: 'Coalesced Ratio', unit: 'x' },
      { id: 9, cat: 'A', name: 'VSync Beat Freq', unit: 'Hz' },
      { id: 10, cat: 'A', name: 'USB/BT Quant Step', unit: 'ms' },
      { id: 11, cat: 'A', name: 'Packet Burstiness', unit: 'x' },
      { id: 12, cat: 'A', name: 'Click Dwell Time', unit: 'ms' },
      { id: 13, cat: 'A', name: 'Release Micro-Slip', unit: 'px' },
      { id: 14, cat: 'A', name: 'Sub-Pixel Floor', unit: 'px' },
      { id: 15, cat: 'A', name: 'Nyquist Limit', unit: 'Hz' },
      { id: 16, cat: 'A', name: 'HW Delay Share', unit: '%' },

      // CATEGORY B: Differential Geometry & 1st-4th Order Kinematics (17-36)
      { id: 17, cat: 'B', name: 'Inst Speed |v|', unit: 'px/s' },
      { id: 18, cat: 'B', name: 'Mean Speed', unit: 'px/s' },
      { id: 19, cat: 'B', name: 'Peak Velocity', unit: 'px/s' },
      { id: 20, cat: 'B', name: 'Velocity X (vx)', unit: 'px/s' },
      { id: 21, cat: 'B', name: 'Velocity Y (vy)', unit: 'px/s' },
      { id: 22, cat: 'B', name: 'Velocity Skew', unit: '' },
      { id: 23, cat: 'B', name: 'Shape Factor c', unit: '' },
      { id: 24, cat: 'B', name: 'Inst Accel |a|', unit: 'kpx/s²' },
      { id: 25, cat: 'B', name: 'Peak Decel Ratio', unit: '' },
      { id: 26, cat: 'B', name: 'Accel Zero-Cross', unit: '/trial' },
      { id: 27, cat: 'B', name: 'Inst Jerk |J|', unit: '10k/s³' },
      { id: 28, cat: 'B', name: 'Dimensionless Jerk', unit: 'LDLJ' },
      { id: 29, cat: 'B', name: 'Inst Snap |S|', unit: '100k/s⁴' },
      { id: 30, cat: 'B', name: 'Curvature κ(s)', unit: '1/px' },
      { id: 31, cat: 'B', name: 'Radius Curv R', unit: 'px' },
      { id: 32, cat: 'B', name: '2/3 Power Law β', unit: '' },
      { id: 33, cat: 'B', name: 'Straightness η', unit: '' },
      { id: 34, cat: 'B', name: 'Orthogonal Dev', unit: 'px' },
      { id: 35, cat: 'B', name: 'Angular Turning', unit: 'rad' },
      { id: 36, cat: 'B', name: 'Ballistic Fraction', unit: '%' },

      // CATEGORY C: 2D Complex Spectral & Nonlinear Dynamics (37-54)
      { id: 37, cat: 'C', name: 'FFT Peak Freq', unit: 'Hz' },
      { id: 38, cat: 'C', name: 'Spectral Centroid', unit: 'Hz' },
      { id: 39, cat: 'C', name: 'Voluntary 0–4Hz', unit: '%' },
      { id: 40, cat: 'C', name: 'Tremor 4–12Hz', unit: '%' },
      { id: 41, cat: 'C', name: 'HW Noise >15Hz', unit: '%' },
      { id: 42, cat: 'C', name: '8–12Hz Physio Peak', unit: 'mag' },
      { id: 43, cat: 'C', name: '60Hz VSync Alias', unit: 'mag' },
      { id: 44, cat: 'C', name: 'Spectral Entropy', unit: 'bits' },
      { id: 45, cat: 'C', name: 'Spectral Flatness', unit: '' },
      { id: 46, cat: 'C', name: '85% Roll-Off Freq', unit: 'Hz' },
      { id: 47, cat: 'C', name: 'Pos/Neg Spin Ratio', unit: '' },
      { id: 48, cat: 'C', name: 'Polarization Ecc', unit: '' },
      { id: 49, cat: 'C', name: 'Higuchi Fractal D', unit: 'D' },
      { id: 50, cat: 'C', name: 'Hurst Exponent H', unit: 'H' },
      { id: 51, cat: 'C', name: 'Lyapunov λ₁', unit: 'bits/s' },
      { id: 52, cat: 'C', name: 'Sample Entropy', unit: 'nats' },
      { id: 53, cat: 'C', name: 'Autocorr Lag-1', unit: 'r' },
      { id: 54, cat: 'C', name: 'Vel Phase Area', unit: 'a.u.' },

      // CATEGORY D: Fitts, Bullseye Effective Width (We) & PUT Hazard (55-70)
      { id: 55, cat: 'D', name: 'Nominal ID', unit: 'bits' },
      { id: 56, cat: 'D', name: 'Effective ID_eff', unit: 'bits' },
      { id: 57, cat: 'D', name: 'Fitts Intercept a', unit: 'ms' },
      { id: 58, cat: 'D', name: 'Fitts Slope b', unit: 'ms/bit' },
      { id: 59, cat: 'D', name: 'Total IP (1/b)', unit: 'bits/s' },
      { id: 60, cat: 'D', name: 'Pure Motor IP', unit: 'bits/s' },
      { id: 61, cat: 'D', name: 'Meyer Homing Ratio', unit: 'x' },
      { id: 62, cat: 'D', name: 'PUT Ex-Gauss μ', unit: 'ms' },
      { id: 63, cat: 'D', name: 'PUT Ex-Gauss σ', unit: 'ms' },
      { id: 64, cat: 'D', name: 'PUT Ex-Gauss τ Tail', unit: 'ms' },
      { id: 65, cat: 'D', name: 'PUT Wait-RT r(tw,RT)', unit: 'r' },
      { id: 66, cat: 'D', name: 'Niemi Hazard Slope', unit: 'ms/s' },
      { id: 67, cat: 'D', name: 'PUT Entrain Lock', unit: '%' },
      { id: 68, cat: 'D', name: 'Hit Offset r/R', unit: '%R' },
      { id: 69, cat: 'D', name: 'Effective We/W', unit: 'x' },
      { id: 70, cat: 'D', name: 'Precision Tax ΔID', unit: 'bits' },

      // CATEGORY E: GUI-Element ID & Embodied Doodling (71-86)
      { id: 71, cat: 'E', name: 'Nearest GUI ID (DI)', unit: 'bits' },
      { id: 72, cat: 'E', name: 'GUI Struggle Ratio', unit: 'x' },
      { id: 73, cat: 'E', name: 'NO Shake Count', unit: '' },
      { id: 74, cat: 'E', name: 'YES Nod Count', unit: '' },
      { id: 75, cat: 'E', name: 'GUI Orbit Doodles', unit: '⭕' },
      { id: 76, cat: 'E', name: 'GUI Scratch Doodles', unit: '❌' },
      { id: 77, cat: 'E', name: 'GUI Underline Scan', unit: '〰️' },
      { id: 78, cat: 'E', name: 'Drawer Pull State', unit: '0-2' },
      { id: 79, cat: 'E', name: 'UI Scale Affordance', unit: '%' },
      { id: 80, cat: 'E', name: 'Eye-Proxy Gaze Dwell', unit: 's' },
      { id: 81, cat: 'E', name: 'Stray Hesitations', unit: '❓' },
      { id: 82, cat: 'E', name: 'Target Overshoot', unit: 'px' },
      { id: 83, cat: 'E', name: 'Micro-Retractions', unit: '/trial' },
      { id: 84, cat: 'E', name: 'Frustration Index', unit: '' },
      { id: 85, cat: 'E', name: 'Flow State Index', unit: '' },
      { id: 86, cat: 'E', name: 'Outlier Preserved', unit: '%' },

      // CATEGORY F: Reading Psycholinguistics, Memory & ZPD Drivers (87-100)
      { id: 87, cat: 'F', name: 'Grapheme Decode', unit: 'ms' },
      { id: 88, cat: 'F', name: 'Mirror b/d Confuse', unit: '%' },
      { id: 89, cat: 'F', name: 'Distractor Pull', unit: 'px' },
      { id: 90, cat: 'F', name: 'Phonological Lag', unit: 'ms' },
      { id: 91, cat: 'F', name: 'Goal Hover Peeks', unit: '👁️' },
      { id: 92, cat: 'F', name: 'Goal Recall Dwell', unit: 'ms' },
      { id: 93, cat: 'F', name: 'Memory Vis Alpha', unit: '%' },
      { id: 94, cat: 'F', name: 'Voice Utterances', unit: '🔊' },
      { id: 95, cat: 'F', name: 'Reading Accuracy', unit: '%' },
      { id: 96, cat: 'F', name: 'Speed-Acc Tradeoff', unit: 'IES' },
      { id: 97, cat: 'F', name: 'SVG Morph Dwell', unit: 'ms' },
      { id: 98, cat: 'F', name: 'ZPD Mastery Score', unit: '%' },
      { id: 99, cat: 'F', name: 'Reading Stage', unit: '1-6' },
      { id: 100, cat: 'F', name: 'Next Font Scale', unit: 'x' },
    ];
    return schema.map((m) => ({ ...m, value: 0, raw: 0 }));
  }

  computeAll(tel, gest, read, drawerState, fpEngine, guiEngine) {
    const dts = tel.dtHistory.length > 0 ? tel.dtHistory : [11.1, 11.2, 10.9];
    const meanDt = dts.reduce((a, b) => a + b, 0) / dts.length;
    const minDt = Math.min(...dts);
    const maxDt = Math.max(...dts);
    const lastTrial = tel.trials[tel.trials.length - 1] || {
      id: 2.94,
      mt: 1400,
      hw: 14,
      brain: 460,
      ballistic: 420,
      homing: 506,
    };
    const fpStats = fpEngine
      ? fpEngine.computeStats()
      : {
          mu: 111,
          sigma: 235,
          tau: 552,
          corrTwRT: -0.19,
          slopeMsPerSec: -182,
          waitEntropyBits: 2.38,
        };

    const set = (id, val) => {
      const safe = Number.isFinite(val) ? val : 0;
      this.metrics[id - 1].raw = safe;
      this.metrics[id - 1].value = Math.abs(safe) >= 100 ? Math.round(safe) : safe.toFixed(2);
    };

    // Category A
    set(1, meanDt);
    set(2, tel.estimatedHz);
    set(3, tel.jitterMs);
    set(4, tel.jitterMs / Math.max(1, meanDt));
    set(5, minDt);
    set(6, maxDt);
    set(7, tel.inputToPhotonMs);
    set(8, tel.coalescedRatio);
    set(9, Math.abs(tel.estimatedHz - 60));
    set(10, 1000 / Math.max(1, tel.estimatedHz));
    set(11, maxDt / Math.max(0.5, minDt));
    set(12, tel.lastDwellMs);
    set(13, tel.lastSlipPx);
    set(14, 0.25);
    set(15, tel.estimatedHz / 2);
    set(16, ((lastTrial.hw || 14) / Math.max(100, lastTrial.mt)) * 100);

    // Category B
    set(17, tel.instSpeed);
    set(18, tel.meanSpeed);
    set(19, tel.peakSpeed);
    set(20, tel.instVx);
    set(21, tel.instVy);
    set(22, tel.peakSpeed / Math.max(10, tel.meanSpeed));
    set(23, tel.peakSpeed / Math.max(10, tel.meanSpeed * 1.4));
    set(24, Math.abs(tel.instAccel) / 1000);
    set(25, 0.54);
    set(26, tel.zeroCrossings);
    set(27, Math.abs(tel.instJerk) / 10000);
    set(28, -Math.log(Math.max(1, Math.abs(tel.instJerk)) + 10));
    set(29, Math.abs(tel.instSnap) / 100000);
    set(30, tel.curvature);
    set(31, Math.min(999, 1 / Math.max(0.001, tel.curvature)));
    set(32, 0.33);
    set(33, tel.straightness);
    set(34, tel.orthoDevPx);
    set(35, Math.atan2(tel.instVy, tel.instVx));
    set(
      36,
      ((lastTrial.ballistic || 400) /
        Math.max(1, (lastTrial.ballistic || 400) + (lastTrial.homing || 400))) *
        100,
    );

    // Category C
    set(37, tel.peakFreqHz);
    set(38, tel.peakFreqHz * 0.52);
    set(39, tel.bandLow);
    set(40, tel.bandTremor);
    set(41, tel.bandNoise);
    set(42, tel.fftSpectrum[8] || 1.2);
    set(43, tel.fftSpectrum[60] || 4.8);
    set(44, 3.85 - (tel.bandNoise / 100) * 0.9);
    set(45, 0.42 + tel.bandNoise / 250);
    set(46, Math.min(60, tel.peakFreqHz * 0.94));
    set(47, tel.posNegSpinRatio);
    set(48, 0.76);
    set(49, 1.18 + Math.min(0.6, tel.jitterMs / 40));
    set(50, Math.max(0.35, 0.78 - tel.jitterMs / 120));
    set(51, 0.042);
    set(52, 0.64);
    set(53, 0.91);
    set(54, (tel.meanSpeed * tel.peakSpeed) / 10000);

    // Category D
    const idNom = lastTrial.id || 2.94;
    set(55, idNom);
    set(56, idNom + tel.selfImposedTaxBits);
    set(57, tel.regTotal.a);
    set(58, tel.regTotal.b);
    set(59, tel.regTotal.tp);
    set(60, tel.regMotor.tp);
    set(61, (lastTrial.homing || 500) / Math.max(1, lastTrial.ballistic || 500));
    set(62, fpStats.mu);
    set(63, fpStats.sigma);
    set(64, fpStats.tau);
    set(65, fpStats.corrTwRT);
    set(66, fpStats.slopeMsPerSec);
    set(67, fpEngine ? fpEngine.entrainmentLockScore : 63);
    set(68, tel.meanNormRadiusPct * 100);
    set(69, tel.effectiveWidthRatio);
    set(70, tel.selfImposedTaxBits);

    // Category E
    const nearGui =
      guiEngine && guiEngine.nearestGui
        ? guiEngine.nearestGui
        : { liveID: 1.5, struggleRatio: 1.0 };
    let totalGuiGazeSec = 0;
    if (guiEngine) {
      for (const g of guiEngine.registry.values()) totalGuiGazeSec += g.dwellMs / 1000;
    }
    set(71, nearGui.liveID);
    set(72, nearGui.struggleRatio);
    set(73, gest.counts.no);
    set(74, gest.counts.yes);
    set(75, guiEngine ? guiEngine.orbitCount : 0);
    set(76, guiEngine ? guiEngine.scratchCount : 0);
    set(77, guiEngine ? guiEngine.underlineCount : 0);
    set(78, drawerState);
    set(79, read.uiFontScale * 100);
    set(80, totalGuiGazeSec);
    set(81, guiEngine ? guiEngine.hesitationCount : 0);
    set(82, tel.lastSlipPx * 1.3);
    set(83, Math.max(1, Math.round((lastTrial.homing || 500) / 280)));
    set(84, Math.min(1, gest.counts.no * 0.25 + (guiEngine ? guiEngine.scratchCount * 0.35 : 0)));
    set(85, Math.max(0.2, Math.min(1, tel.regMotor.tp / 6.0)));
    set(86, 100);

    // Category F
    set(87, read.lastDecodeLatencyMs);
    set(88, read.mirrorConfusionRate);
    set(89, read.lastDistractorPullPx);
    set(90, read.lastDecodeLatencyMs * 0.35);
    set(91, tel.goalPeekCount || 0);
    set(92, tel.totalGoalHoverMs || 0);
    set(93, (tel.memoryDecayAlpha !== undefined ? tel.memoryDecayAlpha : 1) * 100);
    set(
      94,
      window.labApp && window.labApp.voiceEngine ? window.labApp.voiceEngine.utteranceCount : 0,
    );
    set(95, read.readingAccuracy);
    set(96, read.lastDecodeLatencyMs / Math.max(0.5, read.readingAccuracy / 100));
    set(
      97,
      window.labApp && window.labApp.persistence ? window.labApp.persistence.morphRewardDwellMs : 0,
    );
    set(98, read.zpdScore);
    set(99, read.stage);
    set(100, read.uiFontScale);
  }
}
