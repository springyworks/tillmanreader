import type { LabApp } from '../app/lab-app';
import type { GestureType } from '../engines/gesture-decoder';
import type {
  GuiDoodleMeta,
  GuiDoodleType,
  GuiRegistryEntry,
} from '../engines/gui-affordance-doodle-engine';
import { byId, maybeById } from '../util/dom';

/** Toasts, HUD/telemetry text and the visual feedback for GUI-doodle and embodied-gesture events. */
export class Hud {
  private readonly app: LabApp;
  private toastTimer: number | undefined;

  constructor(app: LabApp) {
    this.app = app;
  }

  showToast(title: string, sub: string, borderClass: string): void {
    const toast = byId('gestureToast');
    toast.className = `bg-slate-900/95 border-2 ${borderClass} rounded-lg px-3 py-1.5 shadow-xl transition-all`;
    byId('gestureToastTitle').textContent = title;
    byId('gestureToastSub').textContent = sub;
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
  }

  updateHUDText(): void {
    const badge = maybeById('hudModeBadge');
    const title = maybeById('hudTitle');
    const l1Sub = maybeById('l1SubControls');
    const l1Fp = maybeById('l1ForeperiodControls');
    const l2Sub = maybeById('l2SubControls');
    const l7Sub = maybeById('l7SubControls');

    if (l1Sub)
      l1Sub.className =
        this.app.level === 1 ? 'flex flex-wrap items-center gap-1.5 ml-2' : 'hidden';
    if (l1Fp) {
      l1Fp.className =
        this.app.level === 1 && this.app.l1Mode === 'zero'
          ? 'flex flex-wrap items-center gap-1.5 ml-1'
          : 'hidden';
    }
    if (l2Sub) l2Sub.className = this.app.level === 2 ? 'flex items-center gap-1.5 ml-2' : 'hidden';
    if (l7Sub) l7Sub.className = this.app.level === 7 ? 'flex items-center gap-1.5 ml-2' : 'hidden';

    if (!badge || !title) return;
    if (this.app.level === 1) {
      badge.textContent =
        this.app.l1Mode === 'zero' ? 'OSI L1A • ZERO-MOVE TAP' : 'OSI L1B • SHRINKING CIRCLE';
      title.textContent =
        this.app.l1Mode === 'zero'
          ? 'Isochronous → Stochastic Foreperiod PUT Test'
          : 'Shrinking Circle Calibration (View-Normalized Safe Arena)';
    } else if (this.app.level === 2) {
      badge.textContent = 'OSI L2 • FITTS KINEMATICS';
      title.textContent = 'View-Normalized Pointing (Ballistic Surge vs. Meyer Corrective Homing)';
    } else if (this.app.level === 3) {
      badge.textContent = 'OSI L3 • SPIRAL STEERING';
      title.textContent = 'Continuous Accot-Zhai Spiral Tunnel (Scaled to Safe Action Field)';
    } else {
      const st = this.app.reading.getCurrentStageConfig();
      badge.textContent = `OSI L7 • ${st.name.toUpperCase()}`;
      title.textContent = st.desc;
    }
  }

  updateTextTelemetry(): void {
    const tel = this.app.telemetry;
    const fpStats = this.app.fpEngine.computeStats();
    const setTxt = (id: string, val: string): void => {
      const el = maybeById(id);
      if (el) el.textContent = val;
    };

    setTxt('sumRt0', `${Math.round(tel.rt0BaselineMs)}ms`);
    setTxt('sumMu', `${fpStats.mu}ms`);
    setTxt('sumTau', `${fpStats.tau}ms`);
    setTxt('sumGuiGaze', this.app.guiEngine.activeFocusId);

    setTxt('hdrCenterBias', `${Math.round(tel.meanNormRadiusPct * 100)}% R`);
    setTxt('hdrViewID', `+${tel.selfImposedTaxBits.toFixed(1)}b`);

    setTxt('scope1Stat', `${tel.estimatedHz} Hz (±${tel.jitterMs.toFixed(1)}ms)`);
    setTxt('s1Coalesced', `${tel.coalescedRatio.toFixed(1)}x`);
    setTxt('s1Dwell', `${Math.round(tel.lastDwellMs)}ms`);
    setTxt('s1Slip', `${tel.lastSlipPx.toFixed(1)}px`);

    setTxt('scope2Stat', `Peak: ${tel.peakFreqHz.toFixed(1)} Hz`);
    setTxt('fftBandLow', `${tel.bandLow.toFixed(1)}%`);
    setTxt('fftBandTremor', `${tel.bandTremor.toFixed(1)}%`);
    setTxt('fftBandNoise', `${tel.bandNoise.toFixed(1)}%`);

    setTxt('s3Mu', `${Math.round(tel.meanNormRadiusPct * 100)}% R`);
    setTxt('s3Tau', `${tel.effectiveWidthRatio.toFixed(2)}x`);
    setTxt('s3Slope', `+${tel.selfImposedTaxBits.toFixed(2)} bits`);
    setTxt('s3False', `${tel.trials.length} Kept`);
    setTxt('scope4Badge', `${tel.trials.length} Trials`);

    const last = tel.trials.at(-1);
    if (last) {
      const tot = Math.max(1, last.hw + last.brain + last.ballistic + last.homing);
      const barHw = maybeById('barHw');
      const barBrain = maybeById('barBrain');
      const barBal = maybeById('barBallistic');
      const barHom = maybeById('barHoming');
      if (barHw) barHw.style.width = `${(last.hw / tot) * 100}%`;
      if (barBrain) barBrain.style.width = `${(last.brain / tot) * 100}%`;
      if (barBal) barBal.style.width = `${(last.ballistic / tot) * 100}%`;
      if (barHom) barHom.style.width = `${(last.homing / tot) * 100}%`;
      setTxt('lblHw', `${last.hw}ms`);
      setTxt('lblBrain', `${last.brain}ms`);
      setTxt('lblBallistic', `${last.ballistic}ms`);
      setTxt('lblHoming', `${last.homing}ms`);
    }
  }

  handleGuiDoodle(type: GuiDoodleType, targetGui: GuiRegistryEntry, meta: GuiDoodleMeta): void {
    byId('pillDoodleCount').textContent = String(this.app.guiEngine.totalDoodleEvents);
    const coach = maybeById('insightText');
    if (type === 'ORBIT_ENCIRCLE') {
      const msg = `⭕ Orbit Doodle around [${targetGui.id}] (${targetGui.label})! Shannon DI=${targetGui.liveID.toFixed(2)} bits, Gaze Dwell=${Math.round(targetGui.dwellMs)}ms.`;
      if (coach) coach.textContent = msg;
      this.showToast(`⭕ GUI ORBIT DOODLE: ${targetGui.id}`, msg, 'border-cyan-400');
    } else if (type === 'SCRATCH_FRICTION') {
      const msg = `❌ Scratch-Out Friction on [${targetGui.id}]! Logged usability struggle (${targetGui.struggleRatio}x) & auto-enlarged button to ${Math.round(targetGui.scale * 100)}%.`;
      if (coach) coach.textContent = msg;
      this.showToast(`❌ GUI FRICTION ADAPTED: ${targetGui.id}`, msg, 'border-rose-500');
    } else if (type === 'UNDERLINE_READ') {
      const msg = `〰️ Eye-Proxy Reading Underline on [${targetGui.id}] (${targetGui.label}) — user is actively decoding this control.`;
      if (coach) coach.textContent = msg;
      this.showToast(`〰️ EYE-PROXY READING: ${targetGui.id}`, msg, 'border-amber-400');
    } else {
      const msg = `❓ Stray Hesitation near [${targetGui.id}] (tortuosity ${meta.tortuosity}x) — illuminating nearby affordances.`;
      if (coach) coach.textContent = msg;
      this.showToast(`❓ AFFORDANCE SEARCH: ${targetGui.id}`, msg, 'border-purple-500/40');
    }
  }

  handleEmbodiedGesture(type: GestureType): void {
    this.app.currentTrialGesture = type;
    byId('gCountNo').textContent = String(this.app.gesture.counts.no);
    byId('gCountYes').textContent = String(this.app.gesture.counts.yes);

    if (type === 'NO_SHAKE') {
      this.app.voiceEngine.playPreset('GRRRR');
      this.app.reading.uiFontScale = Math.min(1.6, this.app.reading.uiFontScale + 0.16);
      if (this.app.target) this.app.target.r = Math.min(98, this.app.target.r * 1.25);
      for (const rt of this.app.readingTargets) rt.r = Math.min(68, rt.r * 1.2);
      this.showToast(
        '↔ NO SHAKE GESTURE',
        `Enlarged targets & font scale to ${Math.round(this.app.reading.uiFontScale * 100)}%.`,
        'border-rose-500',
      );
    } else if (type === 'YES_NOD') {
      this.app.voiceEngine.playPreset('HIHI');
      this.app.reading.uiFontScale = Math.max(0.85, this.app.reading.uiFontScale - 0.06);
      if (this.app.target) this.app.target.r = Math.max(12, this.app.target.r * 0.9);
      this.showToast(
        '↕ YES NOD GESTURE',
        'Flow state confirmed — tightening target precision.',
        'border-emerald-500',
      );
    } else {
      this.app.voiceEngine.playPreset('TSSJJ');
      this.app.reading.uiFontScale = 1.35;
      if (this.app.reading.stage > 1) this.app.reading.stage--;
      if (!this.app.scoopVisor.isDragging) {
        this.app.spawner.spawnForCurrentLevel();
      }
      this.showToast(
        '⚡ RAGE SCRIBBLE DETECTED',
        'Scaffolding down one reading stage & enlarging targets.',
        'border-amber-500',
      );
    }
  }
}
