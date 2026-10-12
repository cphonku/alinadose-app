import { getCycleDay, type CycleDayInfo } from './cycle';
import type { IsoDate } from './dates';
import type { DosingPlan } from './models';

export type DoseForDay =
  | { status: 'noPlan' }
  | { status: 'notYetValid'; validFrom: IsoDate }
  | { status: 'noCycleData' }
  | { status: 'planned'; amount: number; unit: string; cycle: CycleDayInfo }
  /** Cycle is longer than the plan; the physician's specified fallback dose applies. */
  | { status: 'beyondPlan'; amount: number; unit: string; cycle: CycleDayInfo }
  /** Cycle is longer than the plan and no fallback was given: contact the physician. */
  | { status: 'contactPhysician'; cycle: CycleDayInfo };

export class InvalidDosingPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDosingPlanError';
  }
}

/** Throws when a plan is malformed (gaps, duplicates, negative doses). */
export function validateDosingPlan(plan: Pick<DosingPlan, 'days' | 'doseBeyondPlan'>): void {
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
}

/**
 * Looks up — never calculates — the physician-prescribed dose for a date.
 * Cycle day N maps to plan day N. Shorter cycles simply end early;
 * longer cycles use the physician's `doseBeyondPlan`.
 */
export function getDoseForDate(
  date: IsoDate,
  plan: DosingPlan | null,
  periodStarts: readonly IsoDate[],
  typicalCycleLength?: number,
): DoseForDay {
  if (!plan) return { status: 'noPlan' };
  if (date < plan.validFrom) return { status: 'notYetValid', validFrom: plan.validFrom };

  const cycle = getCycleDay(date, periodStarts, typicalCycleLength);
  if (!cycle) return { status: 'noCycleData' };

  const day = plan.days.find((d) => d.cycleDay === cycle.cycleDay);
  if (day) return { status: 'planned', amount: day.amount, unit: plan.unit, cycle };
  if (plan.doseBeyondPlan !== null) {
    return { status: 'beyondPlan', amount: plan.doseBeyondPlan, unit: plan.unit, cycle };
  }
  return { status: 'contactPhysician', cycle };
}
