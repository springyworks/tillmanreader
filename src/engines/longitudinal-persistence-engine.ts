import { BUILD_INFO } from '../app/build-info';
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

export interface LearnerProfileMeta {
  readonly slug: string;
  readonly nickname: string;
}

const PROFILES_KEY = 'TILLMANN_LEARNER_PROFILES_V3';
const ACTIVE_SLUG_KEY = 'TILLMANN_ACTIVE_LEARNER_SLUG_V3';

function slugifyNickname(name: string): string {
  const clean = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'beste_leerling';
}

const DEFAULT_PROFILES: readonly LearnerProfileMeta[] = [
  { slug: 'beste_leerling', nickname: 'Beste leerling' },
  { slug: 'opa_test', nickname: 'Opa (Test)' },
];

function isProfileList(val: unknown): val is LearnerProfileMeta[] {
  return (
    Array.isArray(val) &&
    val.length > 0 &&
    val.every(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Record<string, unknown>).slug === 'string' &&
        typeof (p as Record<string, unknown>).nickname === 'string',
    )
  );
}

/*************************************************************************
 * 8.5. LONGITUDINAL BROWSER PERSISTENCE & LEARNER NICKNAME PROFILES
 *************************************************************************/
export class LongitudinalPersistenceEngine {
  activeSlug: string;
  activeNickname: string;
  profiles: LearnerProfileMeta[];
  sessionNumber: number;
  previousSessionSummary: PreviousSessionSummary | null;
  returnGapMinutes: number;
  progressionDeltaReport: string;
  morphRewardDwellMs: number;
  /** Keeps saves working when localStorage is blocked, e.g. in private browsing. */
  private readonly memoryFallbackStore: Map<string, string>;

  constructor() {
    this.memoryFallbackStore = new Map();
    this.profiles = [...DEFAULT_PROFILES];
    this.activeSlug = 'beste_leerling';
    this.activeNickname = 'Beste leerling';
    this.sessionNumber = 1;
    this.previousSessionSummary = null;
    this.returnGapMinutes = 0;
    this.progressionDeltaReport = 'Sessie #1 Start';
    this.morphRewardDwellMs = 0;
    this.loadProfileRegistry();
  }

  get storageKey(): string {
    return `TILLMANN_LEARNER_SAVE_V3_${this.activeSlug}`;
  }

  get checkpointKey(): string {
    return `TILLMANN_LEARNER_CHECKPOINT_V3_${this.activeSlug}`;
  }

  private loadProfileRegistry(): void {
    try {
      const rawProfiles = this.safeGetItem(PROFILES_KEY);
      if (rawProfiles) {
        const parsed: unknown = JSON.parse(rawProfiles);
        if (isProfileList(parsed)) {
          this.profiles = parsed;
        }
      }
      const savedSlug = this.safeGetItem(ACTIVE_SLUG_KEY);
      const found = this.profiles.find((p) => p.slug === savedSlug) ?? this.profiles[0];
      this.activeSlug = found.slug;
      this.activeNickname = found.nickname;
    } catch {
      this.profiles = [...DEFAULT_PROFILES];
      this.activeSlug = 'beste_leerling';
      this.activeNickname = 'Beste leerling';
    }
  }

  private saveProfileRegistry(): void {
    this.safeSetItem(PROFILES_KEY, JSON.stringify(this.profiles));
    this.safeSetItem(ACTIVE_SLUG_KEY, this.activeSlug);
  }

  /** Switches to an existing or newly entered learner nickname, isolating their calibration & reading stage. */
  selectOrCreateLearner(nickname: string): LearnerProfileMeta {
    const cleanName = nickname.trim().slice(0, 24) || 'Beste leerling';
    const slug = slugifyNickname(cleanName);
    let existing = this.profiles.find((p) => p.slug === slug);
    if (!existing) {
      existing = { slug, nickname: cleanName };
      this.profiles.push(existing);
    }
    this.activeSlug = existing.slug;
    this.activeNickname = existing.nickname;
    this.saveProfileRegistry();
    return existing;
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
      // Only restore an explicitly baked standalone export (`window.__BAKED_TILLMANN_STATE__`) or a real
      // saved profile for THIS learner — never pollute a new learner with a pre-baked adult preset!
      let raw = this.safeGetItem(this.storageKey);
      const bakedState: unknown = window.__BAKED_TILLMANN_STATE__;
      if (!raw && bakedState) {
        raw = JSON.stringify(bakedState);
        this.safeSetItem(this.storageKey, raw);
      }
      if (!raw) return false;
      const saved = parseSession(JSON.parse(raw));
      if (!saved) return false;

      if (saved.learnerNickname) {
        this.activeNickname = saved.learnerNickname;
      }

      const nowUnix = TimeStampUtil.nowPacket().unixMs;
      const lastUnix = saved.lastSavedUnixMs || nowUnix;
      this.returnGapMinutes = Math.max(0, (nowUnix - lastUnix) / 60000);
      this.sessionNumber = (saved.sessionNumber || 1) + (this.returnGapMinutes > 2 ? 1 : 0);

      this.previousSessionSummary = {
        lastSavedIso: saved.lastSavedIso || new Date(lastUnix).toISOString(),
        readingStage: saved.readingStage || 1,
        rt0BaselineMs: saved.rt0BaselineMs || 780,
        effectiveWidthRatio: saved.effectiveWidthRatio || 0.48,
        zpdScore: saved.zpdScore || 75,
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

      host.telemetry.trials = [];
      for (const trial of saved.trials) host.telemetry.addTrial({ ...trial });
      host.fpEngine.records = saved.fpRecords;

      const trialCount = host.telemetry.trials.length;
      this.progressionDeltaReport = `${this.activeNickname} • Sessie #${this.sessionNumber} (+${this.returnGapMinutes.toFixed(1)}m) • Stap ${host.reading.stage}/6`;
      this.showStatus(
        `💾 ${this.activeNickname} (S#${this.sessionNumber} • ${trialCount}tr)`,
        trialCount,
      );
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
      this.showStatus(
        `💾 ${this.activeNickname} (S#${this.sessionNumber} • ${trialCount}tr)`,
        trialCount,
      );
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
    this.memoryFallbackStore.delete(this.storageKey);
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Nothing was persisted, so there is nothing to clear.
    }
    this.sessionNumber = 1;
    this.previousSessionSummary = null;
    this.progressionDeltaReport = `${this.activeNickname} • Vers profiel (live ms-kalibratie)`;
  }

  /**
   * Full Webpage Data-Memory Service Wipe:
   * Removes all saved `TILLMANN_*` keys, checkpoints, longitudinal comparisons and baked state in the browser.
   * Long-term session-to-session comparison is intentionally reset so the Embedded Tutor re-calibrates
   * strictly from the pupil's live millisecond movement & reading dynamics.
   */
  eraseAllWebpageDataMemory(): number {
    let removedKeys = 0;
    this.memoryFallbackStore.clear();
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('TILLMANN_')) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
        removedKeys++;
      }
    } catch {
      // Ignore storage access errors in restricted sandboxes.
    }
    try {
      delete window.__BAKED_TILLMANN_STATE__;
    } catch {
      // Ignore if non-configurable.
    }
    this.profiles = [...DEFAULT_PROFILES];
    this.activeSlug = 'beste_leerling';
    this.activeNickname = 'Beste leerling';
    this.sessionNumber = 1;
    this.previousSessionSummary = null;
    this.returnGapMinutes = 0;
    this.morphRewardDwellMs = 0;
    this.progressionDeltaReport =
      'Geheugen gewist (geen langetermijn-historie) • Live ms-kalibratie actief';
    this.showStatus('🧹 Geheugen gewist (0tr • ms-probe)', 0);
    return removedKeys;
  }

  private snapshotProgress(host: SessionHost): ProgressSnapshot {
    return {
      learnerNickname: this.activeNickname,
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

  /** Mirrors the save state into the status pill, learner badge and top "saved JSON" button. */
  private showStatus(pillText: string, trialCount?: number): void {
    const pill = maybeById('pillSaveStatus');
    if (pill) pill.textContent = pillText;
    const learnerLbl = maybeById('learnerNameLabel');
    if (learnerLbl) learnerLbl.textContent = this.activeNickname;
    if (trialCount === undefined) return;
    const topBtn = maybeById('btnTopSavedJson');
    if (topBtn) {
      topBtn.textContent = `💾 ${this.activeNickname} (${trialCount}tr) • 📋 JSON`;
    }
  }
}
