import { BUILD_INFO } from '../app/build-info';
import DEFAULT_SESSION from '../data/default-session.json';
import type { GoalMemoryState, L1Mode, Level, LevelStep } from '../types/arena';
import { maybeById } from '../util/dom';
import { TimeStampUtil } from '../util/timestamp';
import type { AdaptiveReadingEngine } from './adaptive-reading-engine';
import type { ForeperiodHazardEngine } from './foreperiod-hazard-engine';
import {
  checkpointTag,
  parseSession,
  type CommittedCheckpoint,
  type PreviousSessionSummary,
  type ProgressSnapshot,
  type SavedSession,
} from './session-snapshot';
import type { TelemetryEngine } from './telemetry-engine';

/** The slice of the running lab that a session snapshot is read from and restored into. */
export interface SessionHost {
  currentStepIdx: number;
  phaseProgress: number;
  groundingComplete: boolean;
  semanticMorphEnabled: boolean;
  level: Level;
  l1Mode: L1Mode;
  readonly levelSteps: readonly LevelStep[];
  readonly goalMemory: Pick<GoalMemoryState, 'mode' | 'stageUnfadedStreak' | 'calmFadeUnlocked'>;
  readonly reading: Pick<AdaptiveReadingEngine, 'stage' | 'uiFontScale' | 'zpdScore'>;
  readonly telemetry: Pick<
    TelemetryEngine,
    'rt0BaselineMs' | 'effectiveWidthRatio' | 'trials' | 'addTrial'
  >;
  readonly fpEngine: Pick<ForeperiodHazardEngine, 'records'>;
  syncStageUI(): void;
  spawnForCurrentLevel(): void;
}

/*************************************************************************
 * 8.5. LONGITUDINAL BROWSER PERSISTENCE & RETURN-PROGRESSION ANALYZER
 *************************************************************************/
export class LongitudinalPersistenceEngine {
  readonly storageKey: string;
  readonly checkpointKey: string;
  sessionNumber: number;
  previousSessionSummary: PreviousSessionSummary | null;
  returnGapMinutes: number;
  progressionDeltaReport: string;
  morphRewardDwellMs: number;
  /** Keeps saves working when localStorage is blocked, e.g. in private browsing. */
  private readonly memoryFallbackStore: Map<string, string>;

  constructor() {
    this.storageKey = 'TILLMANN_GAMES_LONGITUDINAL_V1';
    this.checkpointKey = 'TILLMANN_GAMES_GIT_CHECKPOINT_V1_8';
    this.sessionNumber = 1;
    this.previousSessionSummary = null;
    this.returnGapMinutes = 0;
    this.progressionDeltaReport = 'Session #1 Baseline';
    this.morphRewardDwellMs = 0;
    this.memoryFallbackStore = new Map();
  }

  safeGetItem(key: string): string | null {
    try {
      return localStorage.getItem(key) || this.memoryFallbackStore.get(key) || null;
    } catch {
      return this.memoryFallbackStore.get(key) || null;
    }
  }

  safeSetItem(key: string, val: string): void {
    this.memoryFallbackStore.set(key, val);
    try {
      localStorage.setItem(key, val);
    } catch {
      // The in-memory copy above still serves reads.
    }
  }

  loadFromBrowser(host: SessionHost): boolean {
    try {
      // 1. Check if this file was exported as a Standalone Portable HTML App with baked-in state
      let raw = this.safeGetItem(this.storageKey);
      const bakedState: unknown = window.__BAKED_TILLMANN_STATE__ || DEFAULT_SESSION;
      if (!raw && bakedState) {
        raw = JSON.stringify(bakedState);
        this.safeSetItem(this.storageKey, raw);
      }
      if (!raw) return false;
      const saved = parseSession(JSON.parse(raw));
      if (!saved) return false;

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
        trialCount: saved.storedTrialCount,
      };

      if (saved.currentStepIdx !== undefined) host.currentStepIdx = saved.currentStepIdx;
      if (saved.phaseProgress !== undefined) host.phaseProgress = saved.phaseProgress;
      if (saved.groundingComplete !== undefined) host.groundingComplete = saved.groundingComplete;
      if (saved.readingStage !== undefined) {
        host.reading.stage = Math.max(1, Math.min(6, saved.readingStage));
      }
      if (saved.uiFontScale !== undefined) host.reading.uiFontScale = saved.uiFontScale;
      if (saved.zpdScore !== undefined) host.reading.zpdScore = saved.zpdScore;
      if (saved.rt0BaselineMs !== undefined) host.telemetry.rt0BaselineMs = saved.rt0BaselineMs;
      if (saved.effectiveWidthRatio !== undefined) {
        host.telemetry.effectiveWidthRatio = saved.effectiveWidthRatio;
      }
      if (saved.stageUnfadedStreak !== undefined) {
        host.goalMemory.stageUnfadedStreak = saved.stageUnfadedStreak;
      }
      if (saved.calmFadeUnlocked !== undefined) {
        host.goalMemory.calmFadeUnlocked = saved.calmFadeUnlocked;
      }
      if (saved.goalMemoryMode !== undefined) host.goalMemory.mode = saved.goalMemoryMode;
      if (saved.semanticMorphEnabled !== undefined) {
        host.semanticMorphEnabled = saved.semanticMorphEnabled;
      }

      if (saved.trials.length > 0) {
        host.telemetry.trials = [];
        for (const trial of saved.trials) host.telemetry.addTrial({ ...trial });
      }
      if (saved.fpRecords.length > 0) {
        host.fpEngine.records = saved.fpRecords;
      }

      const trialCount = host.telemetry.trials.length;
      this.progressionDeltaReport = `Session #${this.sessionNumber} (+${this.returnGapMinutes.toFixed(1)}m gap) • Stage ${host.reading.stage}/6`;
      this.showStatus(`💾 Restored S#${this.sessionNumber} (${trialCount}tr)`, trialCount);
      return true;
    } catch {
      return false;
    }
  }

  saveToBrowser(host: SessionHost): SavedSession | null {
    try {
      const ts = TimeStampUtil.nowPacket();
      const payload: SavedSession = {
        sessionNumber: this.sessionNumber,
        lastSavedUnixMs: ts.unixMs,
        lastSavedIso: ts.iso,
        ...this.snapshotProgress(host),
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
      const trialCount = host.telemetry.trials.length;
      this.showStatus(`💾 Saved (S#${this.sessionNumber} • ${trialCount}tr)`, trialCount);
      return payload;
    } catch {
      return null;
    }
  }

  commitCheckpoint(host: SessionHost): CommittedCheckpoint | null {
    try {
      const ts = TimeStampUtil.nowPacket();
      const snap: CommittedCheckpoint = {
        gitMeta: BUILD_INFO,
        committedUnixMs: ts.unixMs,
        committedIso: ts.iso,
        ...this.snapshotProgress(host),
      };
      this.safeSetItem(this.checkpointKey, JSON.stringify(snap));
      this.safeSetItem(this.storageKey, JSON.stringify(snap));
      this.showStatus(`📌 Committed ${BUILD_INFO.commitHash}`);
      return snap;
    } catch {
      return null;
    }
  }

  /** Restores the last committed checkpoint; returns its release tag, or null when there is none. */
  revertToCheckpoint(host: SessionHost): string | null {
    try {
      const raw = this.safeGetItem(this.checkpointKey);
      if (!raw) return null;
      const snap: unknown = JSON.parse(raw);
      this.safeSetItem(this.storageKey, JSON.stringify(snap));
      this.loadFromBrowser(host);
      const cfg = host.levelSteps[host.currentStepIdx] || host.levelSteps[0];
      host.level = cfg.level;
      host.l1Mode = cfg.l1Mode;
      host.syncStageUI();
      host.spawnForCurrentLevel();
      return checkpointTag(snap) ?? BUILD_INFO.tag;
    } catch {
      return null;
    }
  }

  clearBrowserSave(): void {
    this.memoryFallbackStore.clear();
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Nothing was persisted, so there is nothing to clear.
    }
    this.sessionNumber = 1;
    this.previousSessionSummary = null;
    this.progressionDeltaReport = 'Fresh Profile (Cleared)';
  }

  private snapshotProgress(host: SessionHost): ProgressSnapshot {
    return {
      currentStepIdx: host.currentStepIdx,
      phaseProgress: host.phaseProgress,
      groundingComplete: host.groundingComplete,
      readingStage: host.reading.stage,
      uiFontScale: host.reading.uiFontScale,
      zpdScore: host.reading.zpdScore,
      rt0BaselineMs: Math.round(host.telemetry.rt0BaselineMs),
      effectiveWidthRatio: Number(host.telemetry.effectiveWidthRatio.toFixed(3)),
      stageUnfadedStreak: host.goalMemory.stageUnfadedStreak,
      calmFadeUnlocked: host.goalMemory.calmFadeUnlocked,
      goalMemoryMode: host.goalMemory.mode,
      semanticMorphEnabled: host.semanticMorphEnabled,
      trials: host.telemetry.trials.slice(-65),
      fpRecords: host.fpEngine.records.slice(-50),
    };
  }

  /** Mirrors the save state into the status pill and, when `trialCount` is given, the top "saved JSON" button. */
  private showStatus(pillText: string, trialCount?: number): void {
    const pill = maybeById('pillSaveStatus');
    if (pill) pill.textContent = pillText;
    if (trialCount === undefined) return;
    const topBtn = maybeById('btnTopSavedJson');
    if (topBtn) {
      topBtn.textContent = `💾 SAVED S#${this.sessionNumber} (${trialCount}tr) • 📋 COPY JSON`;
    }
  }
}
