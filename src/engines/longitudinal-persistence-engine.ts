// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.
import { BUILD_INFO } from '../app/build-info';
import { TimeStampUtil } from '../util/timestamp';
import DEFAULT_SESSION from '../data/default-session.json';

/*************************************************************************
 * 8.5. LONGITUDINAL BROWSER PERSISTENCE & RETURN-PROGRESSION ANALYZER
 *************************************************************************/
export class LongitudinalPersistenceEngine {
  constructor() {
    this.storageKey = 'TILLMANN_GAMES_LONGITUDINAL_V1';
    this.checkpointKey = 'TILLMANN_GAMES_GIT_CHECKPOINT_V1_8';
    this.sessionNumber = 1;
    this.previousSessionSummary = null;
    this.returnGapMinutes = 0;
    this.progressionDeltaReport = 'Session #1 Baseline';
    this.morphRewardDwellMs = 0;
    this.morphDistractionDeltaMs = 0;
    this.memoryFallbackStore = {};
  }

  safeGetItem(key) {
    try {
      return localStorage.getItem(key) || this.memoryFallbackStore[key] || null;
    } catch (_) {
      return this.memoryFallbackStore[key] || null;
    }
  }

  safeSetItem(key, val) {
    this.memoryFallbackStore[key] = val;
    try {
      localStorage.setItem(key, val);
    } catch (_) {}
  }

  loadFromBrowser(app) {
    try {
      // 1. Check if this file was exported as a Standalone Portable HTML App with baked-in state
      let raw = this.safeGetItem(this.storageKey);
      const bakedState = window.__BAKED_TILLMANN_STATE__ || DEFAULT_SESSION;
      if (!raw && bakedState) {
        raw = JSON.stringify(bakedState);
        this.safeSetItem(this.storageKey, raw);
      }
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return false;

      const nowUnix = TimeStampUtil.nowPacket().unixMs;
      const lastUnix = saved.lastSavedUnixMs || nowUnix;
      this.returnGapMinutes = Math.max(0, (nowUnix - lastUnix) / 60000);
      this.sessionNumber = (saved.sessionNumber || 1) + (this.returnGapMinutes > 2 ? 1 : 0);

      this.previousSessionSummary = {
        lastSavedIso: saved.lastSavedIso || new Date(lastUnix).toISOString(),
        readingStage: saved.readingStage || 1,
        rt0BaselineMs: saved.rt0BaselineMs || 443,
        effectiveWidthRatio: saved.effectiveWidthRatio || 0.31,
        zpdScore: saved.zpdScore || 72,
        trialCount: Array.isArray(saved.trials) ? saved.trials.length : 0,
      };

      if (Number.isFinite(saved.currentStepIdx)) app.currentStepIdx = saved.currentStepIdx;
      if (Number.isFinite(saved.phaseProgress)) app.phaseProgress = saved.phaseProgress;
      if (typeof saved.groundingComplete === 'boolean')
        app.groundingComplete = saved.groundingComplete;
      if (Number.isFinite(saved.readingStage))
        app.reading.stage = Math.max(1, Math.min(6, saved.readingStage));
      if (Number.isFinite(saved.uiFontScale)) app.reading.uiFontScale = saved.uiFontScale;
      if (Number.isFinite(saved.zpdScore)) app.reading.zpdScore = saved.zpdScore;
      if (Number.isFinite(saved.rt0BaselineMs)) app.telemetry.rt0BaselineMs = saved.rt0BaselineMs;
      if (Number.isFinite(saved.effectiveWidthRatio))
        app.telemetry.effectiveWidthRatio = saved.effectiveWidthRatio;
      if (Number.isFinite(saved.stageUnfadedStreak))
        app.goalMemory.stageUnfadedStreak = saved.stageUnfadedStreak;
      if (typeof saved.calmFadeUnlocked === 'boolean')
        app.goalMemory.calmFadeUnlocked = saved.calmFadeUnlocked;
      if (saved.goalMemoryMode) app.goalMemory.mode = saved.goalMemoryMode;
      if (typeof saved.semanticMorphEnabled === 'boolean')
        app.semanticMorphEnabled = saved.semanticMorphEnabled;

      if (Array.isArray(saved.trials) && saved.trials.length > 0) {
        app.telemetry.trials = [];
        for (const t of saved.trials) app.telemetry.addTrial({ ...t });
      }
      if (Array.isArray(saved.fpRecords) && saved.fpRecords.length > 0) {
        app.fpEngine.records = saved.fpRecords;
      }

      this.progressionDeltaReport = `Session #${this.sessionNumber} (+${this.returnGapMinutes.toFixed(1)}m gap) • Stage ${app.reading.stage}/6`;
      const pill = document.getElementById('pillSaveStatus');
      if (pill) {
        pill.textContent = `💾 Restored S#${this.sessionNumber} (${app.telemetry.trials.length}tr)`;
      }
      const topBtn = document.getElementById('btnTopSavedJson');
      if (topBtn) {
        topBtn.textContent = `💾 SAVED S#${this.sessionNumber} (${app.telemetry.trials.length}tr) • 📋 COPY JSON`;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  saveToBrowser(app) {
    try {
      const ts = TimeStampUtil.nowPacket();
      const payload = {
        sessionNumber: this.sessionNumber,
        lastSavedUnixMs: ts.unixMs,
        lastSavedIso: ts.iso,
        currentStepIdx: app.currentStepIdx,
        phaseProgress: app.phaseProgress,
        groundingComplete: app.groundingComplete,
        readingStage: app.reading.stage,
        uiFontScale: app.reading.uiFontScale,
        zpdScore: app.reading.zpdScore,
        rt0BaselineMs: Math.round(app.telemetry.rt0BaselineMs),
        effectiveWidthRatio: Number(app.telemetry.effectiveWidthRatio.toFixed(3)),
        stageUnfadedStreak: app.goalMemory.stageUnfadedStreak,
        calmFadeUnlocked: app.goalMemory.calmFadeUnlocked,
        goalMemoryMode: app.goalMemory.mode,
        semanticMorphEnabled: app.semanticMorphEnabled,
        trials: app.telemetry.trials.slice(-65),
        fpRecords: app.fpEngine.records.slice(-50),
      };
      this.safeSetItem(this.storageKey, JSON.stringify(payload));
      if (!this.safeGetItem(this.checkpointKey)) {
        this.safeSetItem(
          this.checkpointKey,
          JSON.stringify({
            gitMeta: BUILD_INFO,
            committedUnixMs: ts.unixMs,
            committedIso: ts.iso,
            ...payload,
          }),
        );
      }
      const pill = document.getElementById('pillSaveStatus');
      if (pill) {
        pill.textContent = `💾 Saved (S#${this.sessionNumber} • ${app.telemetry.trials.length}tr)`;
      }
      const topBtn = document.getElementById('btnTopSavedJson');
      if (topBtn) {
        topBtn.textContent = `💾 SAVED S#${this.sessionNumber} (${app.telemetry.trials.length}tr) • 📋 COPY JSON`;
      }
      return payload;
    } catch (e) {
      return null;
    }
  }

  commitCheckpoint(app) {
    try {
      const ts = TimeStampUtil.nowPacket();
      const snap = {
        gitMeta: BUILD_INFO,
        committedUnixMs: ts.unixMs,
        committedIso: ts.iso,
        currentStepIdx: app.currentStepIdx,
        phaseProgress: app.phaseProgress,
        groundingComplete: app.groundingComplete,
        readingStage: app.reading.stage,
        uiFontScale: app.reading.uiFontScale,
        zpdScore: app.reading.zpdScore,
        rt0BaselineMs: Math.round(app.telemetry.rt0BaselineMs),
        effectiveWidthRatio: Number(app.telemetry.effectiveWidthRatio.toFixed(3)),
        stageUnfadedStreak: app.goalMemory.stageUnfadedStreak,
        calmFadeUnlocked: app.goalMemory.calmFadeUnlocked,
        goalMemoryMode: app.goalMemory.mode,
        semanticMorphEnabled: app.semanticMorphEnabled,
        trials: app.telemetry.trials.slice(-65),
        fpRecords: app.fpEngine.records.slice(-50),
      };
      this.safeSetItem(this.checkpointKey, JSON.stringify(snap));
      this.safeSetItem(this.storageKey, JSON.stringify(snap));
      const pill = document.getElementById('pillSaveStatus');
      if (pill) {
        pill.textContent = `📌 Committed ${BUILD_INFO.commitHash}`;
      }
      return snap;
    } catch (e) {
      return null;
    }
  }

  revertToCheckpoint(app) {
    try {
      const raw = this.safeGetItem(this.checkpointKey);
      if (!raw) return null;
      const snap = JSON.parse(raw);
      this.safeSetItem(this.storageKey, JSON.stringify(snap));
      this.loadFromBrowser(app);
      const cfg = app.levelSteps[app.currentStepIdx] || app.levelSteps[0];
      app.level = cfg.level;
      app.l1Mode = cfg.l1Mode;
      app.syncStageUI();
      app.spawnForCurrentLevel();
      return (snap.gitMeta && snap.gitMeta.tag) || BUILD_INFO.tag;
    } catch (e) {
      return null;
    }
  }

  clearBrowserSave() {
    this.memoryFallbackStore = {};
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {}
    this.sessionNumber = 1;
    this.previousSessionSummary = null;
    this.progressionDeltaReport = 'Fresh Profile (Cleared)';
  }
}
