import { addDays, daysBetween, type IsoDate } from './dates';

export type CyclePhase = 'follicular' | 'ovulatory' | 'luteal';

export interface CycleDayInfo {
  /** 1-based index of the cycle since the first logged period. */
  cycleNumber: number;
  /** 1-based day within the cycle (day 1 = first day of the period). */
  cycleDay: number;
  /** First day of this cycle. */
  cycleStart: IsoDate;
  /** Length of this cycle: actual when the next period is logged, otherwise adjusted or estimated. */
  cycleLength: number;
  /** True when `cycleLength` is not known yet (the next period has not been logged). */
  lengthIsEstimate: boolean;
  /** Where `cycleLength` comes from. */
  lengthSource: 'logged' | 'adjusted' | 'estimated';
  /** Number of bleeding days in this cycle (patient-adjustable). */
  periodLength: number;
  /** Estimated day of ovulation within this cycle. */
  ovulationDay: number;
  phase: CyclePhase;
  /** True when the date is past the estimated cycle length (period is late). */
  overdue: boolean;
}

/** The luteal phase is fairly constant (~14 days); the follicular phase varies. */
export const LUTEAL_PHASE_DAYS = 14;
export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;
const MIN_CYCLE_LENGTH = 15;
const MAX_CYCLE_LENGTH = 60;

/** Patient's own corrections for one cycle, e.g. "this cycle will be 32 days". */
export interface CycleAdjustmentInput {
  cycleStart: IsoDate;
  /** Expected length of a cycle that is still running. Ignored once the next period is logged. */
  expectedLength?: number;
  /** Bleeding days in this cycle. */
  periodLength?: number;
}

/** Everything needed to place a date in the patient's cycles. */
export interface CycleContext {
  periodStarts: readonly IsoDate[];
  /** Patient-reported cycle length, used until enough cycles are logged. */
  typicalCycleLength?: number;
  /** Patient-reported bleeding length. */
  typicalPeriodLength?: number;
  adjustments?: readonly CycleAdjustmentInput[];
}

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
 * Cycle length: the actual length once the next period is logged; for the
 * running cycle, the patient's adjustment if set, otherwise the average of
 * past cycles (falling back to the typical length).
 */
export function getCycleDay(date: IsoDate, ctx: CycleContext): CycleDayInfo | null {
  const starts = normalizePeriodStarts(ctx.periodStarts);
  let index = -1;
  for (let i = 0; i < starts.length && starts[i] <= date; i++) index = i;
  if (index < 0) return null;

  const cycleStart = starts[index];
  const cycleDay = daysBetween(cycleStart, date) + 1;
  const next = starts[index + 1];
  const adjustment = ctx.adjustments?.find((a) => a.cycleStart === cycleStart);

  let cycleLength: number;
  let lengthSource: CycleDayInfo['lengthSource'];
  if (next !== undefined) {
    cycleLength = daysBetween(cycleStart, next);
    lengthSource = 'logged';
  } else if (adjustment?.expectedLength) {
    cycleLength = adjustment.expectedLength;
    lengthSource = 'adjusted';
  } else {
    cycleLength = averageCycleLength(starts, ctx.typicalCycleLength ?? DEFAULT_CYCLE_LENGTH);
    lengthSource = 'estimated';
  }
  const lengthIsEstimate = lengthSource !== 'logged';

  return {
    cycleNumber: index + 1,
    cycleDay,
    cycleStart,
    cycleLength,
    lengthIsEstimate,
    lengthSource,
    periodLength: adjustment?.periodLength ?? ctx.typicalPeriodLength ?? DEFAULT_PERIOD_LENGTH,
    ovulationDay: estimateOvulationDay(cycleLength),
    phase: phaseForDay(Math.min(cycleDay, cycleLength), cycleLength),
    overdue: lengthIsEstimate && cycleDay > cycleLength,
  };
}

/** Predicted start of the next period, based on the latest logged start. */
export function predictNextPeriod(ctx: CycleContext): IsoDate | null {
  const starts = normalizePeriodStarts(ctx.periodStarts);
  if (starts.length === 0) return null;
  const last = starts[starts.length - 1]!;
  return addDays(last, getCycleDay(last, ctx)!.cycleLength);
}
