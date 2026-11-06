import type { BuildInfo } from '../app/build-info';
import type { GoalMemoryMode } from '../types/arena';
import { isForeperiodDistribution, isGoalMemoryMode, isTrialRegime } from '../types/guards';
import type { ForeperiodRecord, TillmannTrialRecord, TrialInput } from '../types/telemetry';

/** Learner progress shared by every saved session and committed checkpoint. */
export interface ProgressSnapshot {
  currentStepIdx: number;
  phaseProgress: number;
  groundingComplete: boolean;
  readingStage: number;
  uiFontScale: number;
  zpdScore: number;
  rt0BaselineMs: number;
  effectiveWidthRatio: number;
  stageUnfadedStreak: number;
  calmFadeUnlocked: boolean;
  goalMemoryMode: GoalMemoryMode;
  semanticMorphEnabled: boolean;
  trials: TillmannTrialRecord[];
  fpRecords: ForeperiodRecord[];
}

/** What the auto-save writes under the storage key. */
export interface SavedSession extends ProgressSnapshot {
  sessionNumber: number;
  lastSavedUnixMs: number;
  lastSavedIso: string;
}

/** A named restore point: the progress plus the build that wrote it. */
export interface CommittedCheckpoint extends ProgressSnapshot {
  gitMeta: BuildInfo;
  committedUnixMs: number;
  committedIso: string;
}

/** What a returning learner's previous session looked like; exported in the telemetry payload. */
export interface PreviousSessionSummary {
  lastSavedIso: string;
  readingStage: number;
  rt0BaselineMs: number;
  effectiveWidthRatio: number;
  zpdScore: number;
  trialCount: number;
}

/**
 * A stored session after validation. Scalars are optional because snapshots
 * written by an older build, or by `commitCheckpoint`, lack some of them;
 * malformed values are treated as absent.
 */
export interface RestoredSession {
  sessionNumber?: number;
  lastSavedUnixMs?: number;
  lastSavedIso?: string;
  currentStepIdx?: number;
  phaseProgress?: number;
  groundingComplete?: boolean;
  readingStage?: number;
  uiFontScale?: number;
  zpdScore?: number;
  rt0BaselineMs?: number;
  effectiveWidthRatio?: number;
  stageUnfadedStreak?: number;
  calmFadeUnlocked?: boolean;
  goalMemoryMode?: GoalMemoryMode;
  semanticMorphEnabled?: boolean;
  /** Length of the stored trial list, counted before malformed entries are dropped. */
  storedTrialCount: number;
  trials: TrialInput[];
  fpRecords: ForeperiodRecord[];
}

type Check = (value: unknown) => boolean;

const isNumber: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const isString: Check = (v) => typeof v === 'string';
const isBoolean: Check = (v) => typeof v === 'boolean';
const isStringOrNull: Check = (v) => v === null || typeof v === 'string';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every required key must pass its check; optional keys only when present. */
function matches(
  record: Record<string, unknown>,
  required: Record<string, Check>,
  optional: Record<string, Check>,
): boolean {
  return (
    Object.entries(required).every(([key, check]) => check(record[key])) &&
    Object.entries(optional).every(
      ([key, check]) => record[key] === undefined || check(record[key]),
    )
  );
}

const TRIAL_REQUIRED: Record<string, Check> = {
  id: isNumber,
  mt: isNumber,
  hw: isNumber,
  brain: isNumber,
  ballistic: isNumber,
  homing: isNumber,
};

const TRIAL_OPTIONAL: Record<string, Check> = {
  motorMt: isNumber,
  regime: isTrialRegime,
  dockInspectionMs: isNumber,
  gestureTagged: isStringOrNull,
  tw: isNumber,
  fpDist: isForeperiodDistribution,
  radialErrPx: isNumber,
  normRadiusPct: isNumber,
  hitAngleRad: isNumber,
  goalPeeks: isNumber,
  goalHoverMs: isNumber,
  goalMemoryMode: isString,
  semanticMorphActive: isBoolean,
  unixMs: isNumber,
  perfNowUs: isNumber,
  isoTime: isString,
};

const FOREPERIOD_REQUIRED: Record<string, Check> = {
  tw: isNumber,
  rt: isNumber,
  dist: isForeperiodDistribution,
  hazard: isNumber,
  premature: isBoolean,
  phaseErrorMs: isNumber,
  t: isNumber,
};

const FOREPERIOD_OPTIONAL: Record<string, Check> = {
  unixMs: isNumber,
  perfNowUs: isNumber,
  isoTime: isString,
};

function isTrialInput(value: unknown): value is TrialInput {
  return isRecord(value) && matches(value, TRIAL_REQUIRED, TRIAL_OPTIONAL);
}

function isForeperiodRecord(value: unknown): value is ForeperiodRecord {
  return isRecord(value) && matches(value, FOREPERIOD_REQUIRED, FOREPERIOD_OPTIONAL);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function flag(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function listOf<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  return Array.isArray(value) ? value.filter(guard) : [];
}

/** Validates untrusted stored JSON; returns null unless it is a JSON object. */
export function parseSession(value: unknown): RestoredSession | null {
  if (!isRecord(value)) return null;
  const mode = value.goalMemoryMode;
  return {
    sessionNumber: finiteNumber(value.sessionNumber),
    lastSavedUnixMs: finiteNumber(value.lastSavedUnixMs),
    lastSavedIso: text(value.lastSavedIso),
    currentStepIdx: finiteNumber(value.currentStepIdx),
    phaseProgress: finiteNumber(value.phaseProgress),
    groundingComplete: flag(value.groundingComplete),
    readingStage: finiteNumber(value.readingStage),
    uiFontScale: finiteNumber(value.uiFontScale),
    zpdScore: finiteNumber(value.zpdScore),
    rt0BaselineMs: finiteNumber(value.rt0BaselineMs),
    effectiveWidthRatio: finiteNumber(value.effectiveWidthRatio),
    stageUnfadedStreak: finiteNumber(value.stageUnfadedStreak),
    calmFadeUnlocked: flag(value.calmFadeUnlocked),
    goalMemoryMode: isGoalMemoryMode(mode) ? mode : undefined,
    semanticMorphEnabled: flag(value.semanticMorphEnabled),
    storedTrialCount: Array.isArray(value.trials) ? value.trials.length : 0,
    trials: listOf(value.trials, isTrialInput),
    fpRecords: listOf(value.fpRecords, isForeperiodRecord),
  };
}

/** The release tag stored in a committed checkpoint, if it has one. */
export function checkpointTag(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.gitMeta)) return undefined;
  const tag = value.gitMeta.tag;
  return typeof tag === 'string' && tag ? tag : undefined;
}
