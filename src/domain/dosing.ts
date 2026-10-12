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
  plan: Pick<DosingPlanDraft, 'days' | 'doseBeyondPlan' | 'periodLength' | 'adaptation'>,
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
