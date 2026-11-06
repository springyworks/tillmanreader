import { BUILD_INFO } from '../app/build-info';
import type { LabApp } from '../app/lab-app';
import type { GuiAffordanceElement } from '../types/telemetry';
import { maybeById } from '../util/dom';
import { TimeStampUtil } from '../util/timestamp';

/** The ground-truth telemetry export: what the JSON inspector, clipboard and download all share. */
export type GroundTruthPayload = ReturnType<PayloadExporter['buildPayloadObject']>;

/** Builds the ground-truth telemetry payload and exposes it via the JSON inspector, clipboard and file download. */
export class PayloadExporter {
  private readonly app: LabApp;

  constructor(app: LabApp) {
    this.app = app;
  }

  buildPayloadObject() {
    const ts = TimeStampUtil.nowPacket();
    const guiElements: GuiAffordanceElement[] = [];
    for (const g of this.app.guiEngine.registry.values()) {
      guiElements.push({
        id: g.id,
        label: g.label,
        liveShannonID: Number(g.liveID.toFixed(2)),
        dwellMs: Math.round(g.dwellMs),
        eyeProxyReadingScanMs: Math.round(g.gazeScanMs),
        visits: g.visits,
        clicks: g.clicks,
        doodles: g.doodles,
        struggleRatio: g.struggleRatio,
        adaptedScale: Number(g.scale.toFixed(2)),
      });
    }
    return {
      gitCheckpointMeta: BUILD_INFO,
      unixTimestampMs: ts.unixMs,
      perfNowMicroseconds: ts.perfNowUs,
      timestampISO: ts.iso,
      longitudinalPersistence: {
        sessionNumber: this.app.persistence.sessionNumber,
        returnGapMinutes: Number(this.app.persistence.returnGapMinutes.toFixed(2)),
        progressionDeltaReport: this.app.persistence.progressionDeltaReport,
        previousSessionSummary: this.app.persistence.previousSessionSummary,
        semanticMorphEnabled: this.app.semanticMorphEnabled,
        semanticMorphRewardGazeDwellMs: Math.round(this.app.persistence.morphRewardDwellMs),
      },
      deviceClassification:
        this.app.telemetry.estimatedHz >= 115
          ? 'High-Rate USB Gaming Mouse'
          : 'Mouse / Trackpad • ~90Hz VSync/Touch',
      estimatedPollingHz: this.app.telemetry.estimatedHz,
      pollingJitterMs: Number(this.app.telemetry.jitterMs.toFixed(2)),
      inputToPhotonLagMs: Number(this.app.telemetry.inputToPhotonMs.toFixed(2)),
      calibratedGroundTruthRT0Ms: Math.round(this.app.telemetry.rt0BaselineMs),
      multiManifoldRegression: {
        a: Math.round(this.app.telemetry.regTotal.a),
        b: Math.round(this.app.telemetry.regTotal.b),
        tpTotal: this.app.telemetry.regTotal.tp.toFixed(2),
        tpMotor: this.app.telemetry.regMotor.tp.toFixed(2),
      },
      putForeperiodAnalysis: {
        mode: this.app.fpEngine.mode,
        activeDistribution: this.app.fpEngine.activeDist,
        entrainmentLockScore: this.app.fpEngine.entrainmentLockScore,
        prematureImpulseCount: this.app.fpEngine.prematureCount,
        exGaussianStats: this.app.fpEngine.computeStats(),
        records: this.app.fpEngine.records,
      },
      guiElementAffordanceAndDoodles: {
        totalDoodles: this.app.guiEngine.totalDoodleEvents,
        orbitCount: this.app.guiEngine.orbitCount,
        underlineCount: this.app.guiEngine.underlineCount,
        scratchCount: this.app.guiEngine.scratchCount,
        hesitationCount: this.app.guiEngine.hesitationCount,
        elements: guiElements,
      },
      goalWorkingMemoryAnalysis: {
        mode: this.app.goalMemory.mode,
        initialShowMs: this.app.goalMemory.initialShowMs,
        cloakTargets: this.app.goalMemory.cloakTargets,
        totalGoalRePeeks: this.app.telemetry.goalPeekCount,
        totalGoalHoverRecallMs: Math.round(this.app.telemetry.totalGoalHoverMs),
        autoProgressionStreak: this.app.goalMemory.autoStreak,
      },
      embodiedGestures: this.app.gesture.counts,
      adaptiveReadingStage: this.app.reading.stage,
      signature100Metrics: this.app.sig100.metrics,
      trials: this.app.telemetry.trials,
    };
  }

  openJsonInspectorModal(autoCopy = true): void {
    this.app.persistence.saveToBrowser(this.app);
    const payload = this.buildPayloadObject();
    const jsonStr = JSON.stringify(payload, null, 2);

    const modal = maybeById('jsonInspectorModal');
    const ta = maybeById('jsonModalTextarea', HTMLTextAreaElement);
    const sum = maybeById('jsonModalSummary');
    const cards = maybeById('jsonModalCards');

    if (sum) {
      sum.textContent = `Session #${this.app.persistence.sessionNumber} • ${payload.trials.length} Trials • Reading Stage ${this.app.reading.stage}/6 • Hit Offset ${(this.app.telemetry.meanNormRadiusPct * 100).toFixed(1)}% R • We/W=${this.app.telemetry.effectiveWidthRatio.toFixed(2)}x`;
    }
    if (cards) {
      cards.innerHTML = `
            <div class="bg-slate-950 border border-slate-800 rounded p-2 text-xs mono">
              <div class="text-slate-400">UNIX TIMESTAMP</div>
              <div class="text-emerald-300 font-bold">${payload.unixTimestampMs}</div>
            </div>
            <div class="bg-slate-950 border border-slate-800 rounded p-2 text-xs mono">
              <div class="text-slate-400">TRIALS &amp; STAGE</div>
              <div class="text-cyan-300 font-bold">${payload.trials.length} Trials • Stage ${this.app.reading.stage}/6</div>
            </div>
            <div class="bg-slate-950 border border-slate-800 rounded p-2 text-xs mono">
              <div class="text-slate-400">CENTER BIAS (We/W)</div>
              <div class="text-amber-300 font-bold">${(this.app.telemetry.meanNormRadiusPct * 100).toFixed(1)}% R (${this.app.telemetry.effectiveWidthRatio.toFixed(2)}x)</div>
            </div>
            <div class="bg-slate-950 border border-slate-800 rounded p-2 text-xs mono">
              <div class="text-slate-400">VOICE &amp; MORPH DWELL</div>
              <div class="text-purple-300 font-bold">${this.app.voiceEngine.utteranceCount} Utter • ${Math.round(this.app.persistence.morphRewardDwellMs)}ms</div>
            </div>
          `;
    }
    if (ta) {
      ta.value = jsonStr;
    }
    if (modal) {
      modal.classList.remove('hidden');
    }
    if (ta) {
      ta.focus();
      ta.select();
    }
    if (autoCopy) {
      this.copyJSONToClipboard(false);
    }
  }

  copyJSONToClipboard(showToastMsg = true): void {
    const payload = this.buildPayloadObject();
    const jsonStr = JSON.stringify(payload, null, 2);
    const modal = maybeById('jsonInspectorModal');
    const ta = maybeById('jsonModalTextarea', HTMLTextAreaElement);
    if (ta && modal && !modal.classList.contains('hidden')) {
      ta.value = jsonStr;
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        // Falls through to the async clipboard API below.
      }
    } else {
      const tempTa = document.createElement('textarea');
      tempTa.value = jsonStr;
      tempTa.style.position = 'fixed';
      tempTa.style.left = '-9999px';
      document.body.appendChild(tempTa);
      tempTa.select();
      try {
        document.execCommand('copy');
      } catch {
        // Falls through to the async clipboard API below.
      }
      document.body.removeChild(tempTa);
    }
    // `navigator.clipboard` only exists in secure contexts.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).catch(() => {});
    }
    if (showToastMsg) {
      this.app.hud.showToast(
        '📋 JSON COPIED TO CLIPBOARD!',
        `Copied ${payload.trials.length} trials & 100 metrics (${Math.round(jsonStr.length / 1024)} KB). Paste directly into chat!`,
        'border-emerald-400',
      );
    }
  }

  exportJSON(): void {
    const payload = this.buildPayloadObject();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hci-ground-truth-${payload.unixTimestampMs}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 3000);
  }
}
