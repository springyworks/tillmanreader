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
  | 'AUTO_ADAPT'
  | 'ISOCHRONOUS'
  | 'EXPONENTIAL'
  | 'UNIFORM'
  | 'BIMODAL'
  | 'WEIBULL';

export type AimStrategy = 'NATURAL' | 'BULLSEYE' | 'RIM_GRAZE';

export type TrialRegime =
  | 'MOTOR_LOCKED'
  | 'COGNITIVE_SEARCH'
  | 'TELEMETRY_INSPECTION'
  | 'AFFECTIVE_GESTURE'
  | 'AWAY_PAUSE';

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

export interface TillmannTrialRecord {
  id: number;
  mt: number;
  hw: number;
  brain: number;
  ballistic: number;
  homing: number;
  motorMt: number;
  regime: TrialRegime;
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

export interface GroundTruthTelemetryPayload {
  gitCheckpointMeta: {
    tag: string;
    commitHash: string;
    committedAtISO: string;
    description: string;
  };
  unixTimestampMs: number;
  perfNowMicroseconds: number;
  timestampISO: string;
  deviceClassification: string;
  estimatedPollingHz: number;
  pollingJitterMs: number;
  inputToPhotonLagMs: number;
  calibratedGroundTruthRT0Ms: number;
  multiManifoldRegression: {
    a: number;
    b: number;
    tpTotal: string;
    tpMotor: string;
  };
  adaptiveReadingStage: number;
  signature100Metrics: SignatureMetric[];
  trials: TillmannTrialRecord[];
}
