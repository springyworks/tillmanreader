import type { GoalMemoryMode } from './arena';
import type {
  AimStrategy,
  ForeperiodDistribution,
  ForeperiodShape,
  TrialRegime,
} from './telemetry';

/**
 * Builds a runtime check for a string union. Typing `keys` as `Record<T, true>` makes the compiler
 * reject a missing or misspelled member, so a guard can never drift from its union.
 */
export function oneOf<T extends string>(keys: Record<T, true>): (value: unknown) => value is T {
  return (value): value is T => typeof value === 'string' && Object.hasOwn(keys, value);
}

export const isGoalMemoryMode = oneOf<GoalMemoryMode>({
  ALWAYS: true,
  PEEK_1200: true,
  MEM_500: true,
  AUTO_PROG: true,
});

export const isAimStrategy = oneOf<AimStrategy>({
  NATURAL: true,
  BULLSEYE: true,
  RIM_GRAZE: true,
});

export const isTrialRegime = oneOf<TrialRegime>({
  MOTOR_LOCKED: true,
  COGNITIVE_SEARCH: true,
  TELEMETRY_INSPECTION: true,
  AFFECTIVE_GESTURE: true,
  AWAY_PAUSE: true,
});

export const isForeperiodDistribution = oneOf<ForeperiodDistribution>({
  AUTO_ADAPT: true,
  ISOCHRONOUS: true,
  EXPONENTIAL: true,
  UNIFORM: true,
  BIMODAL: true,
  WEIBULL: true,
});

export const isForeperiodShape = oneOf<ForeperiodShape>({
  ISOCHRONOUS: true,
  EXPONENTIAL: true,
  UNIFORM: true,
  BIMODAL: true,
  WEIBULL: true,
});
