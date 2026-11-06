/** Shared geometry and state types for the play arena and the level flow. */
import type { SemanticMorphKey } from '../engines/adaptive-reading-engine';
import type { ForeperiodShape } from './telemetry';

export interface Point {
  x: number;
  y: number;
}

/** One pointer-trail sample kept for the ribbon and the distractor-pull measure. */
export interface TrailSample extends Point {
  t: number;
  speed: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A circle that can be aimed at. */
export interface Target extends Point {
  r: number;
}

/** Aim target of pointing levels 1 and 2. */
export interface PointingTarget extends Target {
  color: string;
  label: string;
  subLabel?: string;
  /** Shannon index of difficulty of the trial this target represents. */
  id: number;
  /** Level 1 pulse-tap only: assigned foreperiod in ms and the distribution it was drawn from. */
  tw?: number;
  fpDist?: ForeperiodShape;
  /** Pointer position when the trial started (level 1 shrinking circle and level 2). */
  startX?: number;
  startY?: number;
}

/** The level 1 pulse-tap target, which always carries its assigned foreperiod. */
export interface PulseTarget extends PointingTarget {
  tw: number;
  fpDist: ForeperiodShape;
}

/** One letter or word bubble of the reading game; the correct one has `isTarget` set. */
export interface ReadingTarget extends Target {
  text: string;
  isTarget: boolean;
}

/** What `LabApp.target` can hold: a pointing target on levels 1 and 2, the right bubble on level 7. */
export type AimTarget = PointingTarget | ReadingTarget;

/** A celebratory circle-to-SVG morph; `gazeDwellMs` accumulates while the cursor stays near it. */
export interface ActiveMorph extends Target {
  startTime: number;
  durationMs: number;
  semanticKey: SemanticMorphKey;
  label: string;
  gazeDwellMs: number;
  /** Monotonic seed used to cycle all 16 thin black-on-white kinetic line-art morphs. */
  variantSeed?: number;
}

export interface SpiralPoint extends Point {
  /** Half-width of the steering tunnel at this point. */
  w: number;
}

/** Level 3 steering-law tunnel state. */
export interface SpiralState {
  active: boolean;
  progress: number;
  startTime: number;
  insideSamples: number;
  totalSamples: number;
  path: SpiralPoint[];
}

export type ScoopCandidate =
  | { type: 'MAIN_TARGET'; obj: Target; dist: number }
  | { type: 'READING_BUBBLE'; obj: ReadingTarget; dist: number };

export interface DropRipple extends Point {
  r: number;
  alpha: number;
}

/**
 * Anti-fat-finger Scoop-Visor rig: the finger drags the lower handle, the transparent visor floats
 * `offsetY` pixels above it, and lifting the finger drops the visor onto the target under it.
 */
export interface ScoopVisorState {
  enabled: boolean;
  isDragging: boolean;
  pointerId: number | null;
  /** Pointer-to-handle delta latched at grab start so dragging never snaps or jumps. */
  grabOffsetX: number;
  grabOffsetY: number;
  /** Decaying 0..1 highlight ring triggered when a stray tap lands away from the docked Scoop Pad. */
  nudgePulse: number;
  offsetY: number;
  handleX: number;
  handleY: number;
  visorX: number;
  visorY: number;
  handleR: number;
  visorR: number;
  dragStartTime: number;
  dragPathLen: number;
  /** Target currently inside the visor crosshairs. */
  hoveredCandidate: ScoopCandidate | null;
  dropRipples: DropRipple[];
}

export type GoalMemoryMode = 'ALWAYS' | 'PEEK_1200' | 'MEM_500' | 'AUTO_PROG';

/** Top-goal hover-to-reveal and working-memory fade parameters plus their running counters. */
export interface GoalMemoryState {
  mode: GoalMemoryMode;
  initialShowMs: number;
  fadeDurationMs: number;
  RequiredBaselineHits: number;
  cloakTargets: boolean;
  isHoveringTopGoal: boolean;
  hoverEnterTime: number;
  trialPeekCount: number;
  trialHoverMs: number;
  autoStreak: number;
  stageUnfadedStreak: number;
  calmFadeUnlocked: boolean;
  revealAlpha: number;
}

/** Playable levels: 1 pulse tap / shrinking circle, 2 Fitts pointing, 3 steering spiral, 7 reading. */
export type Level = 1 | 2 | 3 | 7;
export type L1Mode = 'zero' | 'shrink';
export type L2Shape = 'circle' | 'square';
export type L1WaitState = 'IDLE' | 'WAITING' | 'READY_GREEN';
export type Scope3Mode = 'BULLSEYE_MAP' | 'FITTS' | 'PUT_HAZARD';
/** Telemetry drawer position: hidden, scopes only, or scopes plus the 100-metric registry. */
export type DrawerState = 0 | 1 | 2;

/** One phase of the smart envelope-flying tutor. */
export interface LevelStep {
  step: number;
  level: Level;
  l1Mode: L1Mode;
  badge: string;
  /** Successful trials needed before the tutor advances. */
  quota: number;
}

/** The unobstructed action field inside #gameArena, in canvas pixels. */
export interface SafeArena {
  w: number;
  h: number;
  isMobile: boolean;
  topGoalBannerH: number;
  safeLeft: number;
  safeTop: number;
  safeRight: number;
  safeBottom: number;
  safeW: number;
  safeH: number;
  diag: number;
  cx: number;
  cy: number;
  topSafeY: number;
}
