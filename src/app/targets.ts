import type { AimTarget, PointingTarget, PulseTarget } from '../types/arena';

/** True for the levels 1 and 2 targets (level 7 targets are reading bubbles). */
export function isPointingTarget(target: AimTarget | null): target is PointingTarget {
  return target !== null && 'color' in target;
}

/** True for the level 1 pulse-tap target, which is the only one with an assigned foreperiod. */
export function isPulseTarget(target: AimTarget | null): target is PulseTarget {
  return isPointingTarget(target) && target.tw !== undefined && target.fpDist !== undefined;
}
