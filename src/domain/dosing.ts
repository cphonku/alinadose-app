import { getCycleDay, LUTEAL_PHASE_DAYS, type CycleContext, type CycleDayInfo } from './cycle';
import type { IsoDate } from './dates';
import type { DosingPlan, DosingPlanDraft } from './models';

export type DoseForDay =
  | { status: 'noPlan' }
  | { status: 'notYetValid'; validFrom: IsoDate }
  | { status: 'noCycleData' }
  /** `planDay` is the physician's plan day that today's cycle day maps to. */
  | { status: 'planned'; amount: number; unit: string; cycle: CycleDayInfo; planDay: number }
  /** Past the expected end of the cycle (period late); the physician's fallback dose applies. */
  | { status: 'beyondPlan'; amount: number; unit: string; cycle: CycleDayInfo }
  /** Past the expected end of the cycle and no fallback was given: contact the physician. */
  | { status: 'contactPhysician'; cycle: CycleDayInfo };

export class InvalidDosingPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDosingPlanError';
  }
}

/** Shortest plan that still has at least one bleeding and one follicular day before the luteal phase. */
export const MIN_PLAN_LENGTH = LUTEAL_PHASE_DAYS + 2;

/** Throws when a plan is malformed (gaps, duplicates, negative doses, impossible lengths). */
export function validateDosingPlan(
  plan: Pick<
    DosingPlanDraft,
    'days' | 'doseBeyondPlan' | 'periodLength' | 'adaptation' | 'labelMaxDailyDose' | 'notLicensedForAgeGroup' | 'overLimitReason'
  >,
): void {
  if (plan.days.length === 0) throw new InvalidDosingPlanError('Plan has no days');
  const sorted = [...plan.days].sort((a, b) => a.cycleDay - b.cycleDay);
  sorted.forEach((d, i) => {
    if (d.cycleDay !== i + 1) {
      throw new InvalidDosingPlanError(`Plan must cover consecutive days from 1; problem at day ${d.cycleDay}`);
    }
    if (!Number.isFinite(d.amount) || d.amount < 0) {
      throw new InvalidDosingPlanError(`Invalid dose on day ${d.cycleDay}`);
    }
  });
  if (plan.doseBeyondPlan !== null && (!Number.isFinite(plan.doseBeyondPlan) || plan.doseBeyondPlan < 0)) {
    throw new InvalidDosingPlanError('Invalid dose beyond plan');
  }
  if (plan.adaptation === 'phaseAnchored' && plan.days.length < MIN_PLAN_LENGTH) {
    throw new InvalidDosingPlanError(`A phase-anchored plan needs at least ${MIN_PLAN_LENGTH} days`);
  }
  if (!Number.isInteger(plan.periodLength) || plan.periodLength < 1 || plan.periodLength > 14) {
    throw new InvalidDosingPlanError('Period length must be between 1 and 14 days');
  }
  const max = plan.labelMaxDailyDose;
  if (max !== undefined && !(Number.isFinite(max) && max > 0)) {
    throw new InvalidDosingPlanError('Invalid label maximum');
  }
  const hasReason = !!plan.overLimitReason?.trim();
  if (plan.notLicensedForAgeGroup && !hasReason && plan.days.some((d) => d.amount > 0)) {
    throw new InvalidDosingPlanError(
      "This medication is not licensed for the patient's age group; give a reason to save.",
    );
  }
  const over = max === undefined ? [] : daysAboveLabelMax(plan, max);
  if (over.length > 0 && !hasReason) {
    throw new InvalidDosingPlanError(
      `${formatDayRanges(over)} exceed the label maximum of ${max} mg; give a reason to save.`,
    );
  }
}

// --- Dose limits and adjustments ----------------------------------------

export type DoseAdjustment =
  | { kind: 'set'; mg: number }
  | { kind: 'absolute'; mg: number }
  | { kind: 'percent'; pct: number };

export interface DoseLimits {
  /** Smallest dose step; results are rounded to a multiple of it. */
  stepMg: number;
  /** Label maximum per day; null when unknown. */
  maxDailyDoseMg: number | null;
}

/**
 * Applies a physician's change to a dose: set to a value, change by mg, or
 * change by a percentage. The result is rounded to the medication's step and
 * never negative. It is NOT capped: `aboveLabelMax` tells the editor to warn.
 *
 * Percent changes round toward the change (up for an increase, down for a
 * decrease), so a small percentage still moves the dose at least one step
 * (20 mg + 10 % = 22 → 30 mg on a 10 mg step). Set and mg changes round to the
 * nearest step. `exact` is the value before rounding.
 */
export function adjustDose(
  current: number,
  change: DoseAdjustment,
  limits: DoseLimits,
): { amount: number; exact: number; aboveLabelMax: boolean } {
  const exact =
    change.kind === 'set' ? change.mg : change.kind === 'absolute' ? current + change.mg : current * (1 + change.pct / 100);
  const step = limits.stepMg > 0 ? limits.stepMg : 1;
  // Tolerance so 22.000000001 / 10 isn't pushed up a whole step by float noise.
  const steps = exact / step;
  const rounded =
    change.kind !== 'percent' || change.pct === 0
      ? Math.round(steps)
      : change.pct > 0
        ? Math.ceil(steps - 1e-9)
        : Math.floor(steps + 1e-9);
  const amount = Math.max(0, rounded * step);
  // Avoid float noise like 35.00000001 for fractional steps.
  const clean = Math.round(amount * 1000) / 1000;
  return {
    amount: clean,
    exact: Math.round(exact * 10) / 10,
    aboveLabelMax: limits.maxDailyDoseMg !== null && clean > limits.maxDailyDoseMg,
  };
}

/** Plan days whose dose is above the label maximum (plus the late-period dose as day 0). */
export function daysAboveLabelMax(plan: Pick<DosingPlanDraft, 'days' | 'doseBeyondPlan'>, maxMg: number): number[] {
  const days = plan.days.filter((d) => d.amount > maxMg).map((d) => d.cycleDay);
  return plan.doseBeyondPlan !== null && plan.doseBeyondPlan > maxMg ? [...days, 0] : days;
}

/**
 * Plan days whose dose goes up by more than the label's usual titration step
 * compared with the previous plan (same plan day). Information for the
 * physician only; it does not block saving.
 */
export function titrationJumps(
  previous: readonly { cycleDay: number; amount: number }[] | null,
  days: readonly { cycleDay: number; amount: number }[],
  maxStepMg: number,
): number[] {
  if (!previous) return [];
  const before = new Map(previous.map((d) => [d.cycleDay, d.amount]));
  return days
    .filter((d) => before.has(d.cycleDay) && d.amount - before.get(d.cycleDay)! > maxStepMg)
    .map((d) => d.cycleDay);
}

/** "Days 17–26 and the late-period dose" style label for a list of plan days (0 = late-period dose). */
export function formatDayRanges(days: number[]): string {
  const sorted = [...new Set(days)].filter((d) => d > 0).sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j;
  }
  const late = days.includes(0) ? 'the late-period dose' : '';
  if (parts.length === 0) return late ? 'The late-period dose' : '';
  const label = `${sorted.length === 1 ? 'Day' : 'Days'} ${parts.join(', ')}`;
  return late ? `${label} and ${late}` : label;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Linear map of x from [a0, a1] onto [b0, b1], rounded to a whole day. */
function scaleDay(x: number, a0: number, a1: number, b0: number, b1: number): number {
  if (a1 === a0) return b0;
  return Math.round(b0 + ((x - a0) * (b1 - b0)) / (a1 - a0));
}

type PlanShape = Pick<DosingPlan, 'days' | 'periodLength' | 'adaptation'>;

/**
 * Which plan day applies on a given day of the patient's actual cycle.
 * Returns null when the day lies beyond the plan (period is late).
 *
 * phaseAnchored splits both the plan and the cycle into three segments:
 *   bleeding  (days 1..M)          → plan days 1..Mp, stretched/shrunk
 *   follicular (M+1 .. C−14)       → plan days Mp+1 .. L−14, stretched/shrunk
 *   luteal    (last 14 days)       → plan's last 14 days, counted back from the next period
 * so the high-progesterone days always get the physician's luteal doses.
 */
export function mapToPlanDay(
  cycleDay: number,
  cycleLength: number,
  periodLength: number,
  plan: PlanShape,
): number | null {
  const L = plan.days.length;
  if (plan.adaptation === 'fixedDays') return cycleDay <= L ? cycleDay : null;
  if (cycleDay > cycleLength) return null;

  const C = cycleLength;
  const lutealStartActual = C - LUTEAL_PHASE_DAYS + 1;
  const lutealStartPlan = L - LUTEAL_PHASE_DAYS + 1;
  if (cycleDay >= lutealStartActual || lutealStartActual <= 2) {
    return clamp(L - (C - cycleDay), 1, L);
  }

  // At least one follicular day must remain on both sides.
  const M = clamp(periodLength, 1, lutealStartActual - 2);
  const Mp = clamp(plan.periodLength, 1, lutealStartPlan - 2);
  if (cycleDay <= M) return scaleDay(cycleDay, 1, M, 1, Mp);
  return scaleDay(cycleDay, M + 1, lutealStartActual - 1, Mp + 1, lutealStartPlan - 1);
}

export interface ExpandedDay {
  cycleDay: number;
  planDay: number | null;
  amount: number | null;
}

/** The physician's doses laid out over an actual cycle (for the dial and plan review). */
export function expandPlanForCycle(plan: PlanShape, cycleLength: number, periodLength: number): ExpandedDay[] {
  const byDay = new Map(plan.days.map((d) => [d.cycleDay, d.amount]));
  return Array.from({ length: cycleLength }, (_, i) => {
    const planDay = mapToPlanDay(i + 1, cycleLength, periodLength, plan);
    return { cycleDay: i + 1, planDay, amount: planDay === null ? null : (byDay.get(planDay) ?? null) };
  });
}

/**
 * Looks up — never calculates — the physician-prescribed dose for a date,
 * using the plan's adaptation rule to match plan days to the actual cycle.
 */
export function getDoseForDate(date: IsoDate, plan: DosingPlan | null, ctx: CycleContext): DoseForDay {
  if (!plan) return { status: 'noPlan' };
  if (date < plan.validFrom) return { status: 'notYetValid', validFrom: plan.validFrom };

  const cycle = getCycleDay(date, ctx);
  if (!cycle) return { status: 'noCycleData' };

  const planDay = mapToPlanDay(cycle.cycleDay, cycle.cycleLength, cycle.periodLength, plan);
  const day = planDay === null ? undefined : plan.days.find((d) => d.cycleDay === planDay);
  if (day) return { status: 'planned', amount: day.amount, unit: plan.unit, cycle, planDay: day.cycleDay };
  if (plan.doseBeyondPlan !== null) {
    return { status: 'beyondPlan', amount: plan.doseBeyondPlan, unit: plan.unit, cycle };
  }
  return { status: 'contactPhysician', cycle };
}

export interface DoseChange {
  fromDay: number;
  toDay: number;
  before: number | null;
  after: number | null;
}

/**
 * Days of the patient's current cycle whose dose differs between two plans,
 * grouped into ranges, e.g. days 17–26: 30 → 40 mg.
 */
export function comparePlans(
  previous: PlanShape | null,
  next: PlanShape,
  cycleLength: number,
  periodLength: number,
): DoseChange[] {
  const after = expandPlanForCycle(next, cycleLength, periodLength);
  const before = previous ? expandPlanForCycle(previous, cycleLength, periodLength) : null;
  const changes: DoseChange[] = [];
  after.forEach((day, i) => {
    const b = before ? before[i]!.amount : null;
    if (b === day.amount) return;
    const last = changes[changes.length - 1];
    if (last && last.toDay === day.cycleDay - 1 && last.before === b && last.after === day.amount) {
      last.toDay = day.cycleDay;
    } else {
      changes.push({ fromDay: day.cycleDay, toDay: day.cycleDay, before: b, after: day.amount });
    }
  });
  return changes;
}
