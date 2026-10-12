import { addDays, daysBetween, type IsoDate } from './dates';

export type CyclePhase = 'follicular' | 'ovulatory' | 'luteal';

export interface CycleDayInfo {
  /** 1-based index of the cycle since the first logged period. */
  cycleNumber: number;
  /** 1-based day within the cycle (day 1 = first day of the period). */
  cycleDay: number;
  /** First day of this cycle. */
  cycleStart: IsoDate;
  /** Length of this cycle: actual when the next period is logged, otherwise estimated. */
  cycleLength: number;
  /** True when `cycleLength` is an estimate (the next period has not been logged yet). */
  lengthIsEstimate: boolean;
  /** Estimated day of ovulation within this cycle. */
  ovulationDay: number;
  phase: CyclePhase;
  /** True when the date is past the estimated cycle length (period is late). */
  overdue: boolean;
}

/** The luteal phase is fairly constant (~14 days); the follicular phase varies. */
export const LUTEAL_PHASE_DAYS = 14;
export const DEFAULT_CYCLE_LENGTH = 28;
const MIN_CYCLE_LENGTH = 15;
const MAX_CYCLE_LENGTH = 60;

/** Sorted, de-duplicated period start dates. */
export function normalizePeriodStarts(starts: readonly IsoDate[]): IsoDate[] {
  return [...new Set(starts)].sort();
}

/**
 * Average length of the completed cycles between logged period starts.
 * Implausible gaps (e.g. a missed log) are ignored. Falls back to
 * `fallback` when no usable cycles exist.
 */
export function averageCycleLength(
  starts: readonly IsoDate[],
  fallback = DEFAULT_CYCLE_LENGTH,
): number {
  const sorted = normalizePeriodStarts(starts);
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const len = daysBetween(sorted[i - 1], sorted[i]);
    if (len >= MIN_CYCLE_LENGTH && len <= MAX_CYCLE_LENGTH) lengths.push(len);
  }
  if (lengths.length === 0) return fallback;
  return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
}

export function estimateOvulationDay(cycleLength: number): number {
  return Math.max(1, cycleLength - LUTEAL_PHASE_DAYS);
}

/**
 * Phase for a cycle day. The ovulatory window is the estimated ovulation
 * day ±1; everything before is follicular (including menstruation),
 * everything after is luteal.
 */
export function phaseForDay(cycleDay: number, cycleLength: number): CyclePhase {
  const ovulation = estimateOvulationDay(cycleLength);
  if (cycleDay < ovulation - 1) return 'follicular';
  if (cycleDay <= ovulation + 1) return 'ovulatory';
  return 'luteal';
}

/**
 * Where `date` falls in the patient's cycles. Returns null when the date is
 * before the first logged period (nothing to anchor to).
 *
 * @param typicalCycleLength patient-reported length, used until enough cycles are logged.
 */
export function getCycleDay(
  date: IsoDate,
  periodStarts: readonly IsoDate[],
  typicalCycleLength: number = DEFAULT_CYCLE_LENGTH,
): CycleDayInfo | null {
  const starts = normalizePeriodStarts(periodStarts);
  let index = -1;
  for (let i = 0; i < starts.length && starts[i] <= date; i++) index = i;
  if (index < 0) return null;

  const cycleStart = starts[index];
  const cycleDay = daysBetween(cycleStart, date) + 1;
  const next = starts[index + 1];
  const lengthIsEstimate = next === undefined;
  const cycleLength = lengthIsEstimate
    ? averageCycleLength(starts, typicalCycleLength)
    : daysBetween(cycleStart, next);

  return {
    cycleNumber: index + 1,
    cycleDay,
    cycleStart,
    cycleLength,
    lengthIsEstimate,
    ovulationDay: estimateOvulationDay(cycleLength),
    phase: phaseForDay(Math.min(cycleDay, cycleLength), cycleLength),
    overdue: lengthIsEstimate && cycleDay > cycleLength,
  };
}

/** Predicted start of the next period, based on the latest logged start. */
export function predictNextPeriod(
  periodStarts: readonly IsoDate[],
  typicalCycleLength: number = DEFAULT_CYCLE_LENGTH,
): IsoDate | null {
  const starts = normalizePeriodStarts(periodStarts);
  if (starts.length === 0) return null;
  return addDays(starts[starts.length - 1], averageCycleLength(starts, typicalCycleLength));
}
