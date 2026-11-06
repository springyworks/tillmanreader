/**
 * @file src/types/telemetry.ts
 * Strongly-typed TypeScript interfaces for The Tillmann Games & Ground-Truth HCI Telemetry Lab.
 */

export type MetricCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface SignatureMetric {
  id: number;
  cat: MetricCategory;
  name: string;
  unit: string;
  value: string | number;
  raw: number;
}

export type ForeperiodDistribution =
  'AUTO_ADAPT' | 'ISOCHRONOUS' | 'EXPONENTIAL' | 'UNIFORM' | 'BIMODAL' | 'WEIBULL';

/** A waiting-time distribution a foreperiod is actually drawn from; 'AUTO_ADAPT' only rotates through these. */
export type ForeperiodShape = Exclude<ForeperiodDistribution, 'AUTO_ADAPT'>;

export type AimStrategy = 'NATURAL' | 'BULLSEYE' | 'RIM_GRAZE';

export type TrialRegime =
  'MOTOR_LOCKED' | 'COGNITIVE_SEARCH' | 'TELEMETRY_INSPECTION' | 'AFFECTIVE_GESTURE' | 'AWAY_PAUSE';

export interface ForeperiodRecord {
  tw: number;
  rt: number;
  dist: ForeperiodDistribution;
  hazard: number;
  premature: boolean;
  phaseErrorMs: number;
  t: number;
  unixMs?: number;
  perfNowUs?: number;
  isoTime?: string;
}

/** Ex-Gaussian reaction-time fit plus the wait/RT relation of the valid foreperiod records. */
export interface ForeperiodStats {
  readonly mu: number;
  readonly sigma: number;
  readonly tau: number;
  readonly skewness: number;
  readonly corrTwRT: number;
  readonly slopeMsPerSec: number;
  readonly cvRT: number;
  readonly meanWaitMs: number;
  readonly waitEntropyBits: number;
}

/** What callers hand to `TelemetryEngine.addTrial`; the engine fills in the derived fields in place. */
export interface TrialInput {
  id: number;
  mt: number;
  hw: number;
  brain: number;
  ballistic: number;
  homing: number;
  motorMt?: number;
  regime?: TrialRegime;
  dockInspectionMs?: number;
  gestureTagged?: string | null;
  tw?: number;
  fpDist?: ForeperiodDistribution;
  radialErrPx?: number;
  normRadiusPct?: number;
  hitAngleRad?: number;
  goalPeeks?: number;
  goalHoverMs?: number;
  goalMemoryMode?: string;
  semanticMorphActive?: boolean;
  unixMs?: number;
  perfNowUs?: number;
  isoTime?: string;
}

/** A stored and exported trial: `addTrial` has stamped the clock fields, regime, motor time and hit radius. */
export interface TillmannTrialRecord extends TrialInput {
  motorMt: number;
  regime: TrialRegime;
  normRadiusPct: number;
  unixMs: number;
  perfNowUs: number;
  isoTime: string;
}

export interface GuiAffordanceElement {
  id: string;
  label: string;
  liveShannonID: number;
  dwellMs: number;
  eyeProxyReadingScanMs: number;
  visits: number;
  clicks: number;
  doodles: number;
  struggleRatio: number;
  adaptedScale: number;
}
