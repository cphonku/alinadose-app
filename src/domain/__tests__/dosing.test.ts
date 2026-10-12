import {
  comparePlans,
  expandPlanForCycle,
  getDoseForDate,
  InvalidDosingPlanError,
  mapToPlanDay,
  validateDosingPlan,
} from '../dosing';
import type { DosingPlan } from '../models';

/** A plan whose dose on plan day N is N mg, so mappings are easy to read. */
const plan = (overrides: Partial<DosingPlan> = {}): DosingPlan => ({
  id: 'p1',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  schemaVersion: 2,
  medicationName: 'Test',
  unit: 'mg',
  days: Array.from({ length: 28 }, (_, i) => ({ cycleDay: i + 1, amount: i + 1 })),
  periodLength: 5,
  adaptation: 'phaseAnchored',
  doseBeyondPlan: 20,
  validFrom: '2026-10-01',
  status: 'active',
  source: 'physician',
  ...overrides,
});

const map = (day: number, cycleLength: number, periodLength = 5, p = plan()) =>
  mapToPlanDay(day, cycleLength, periodLength, p);

describe('phase-anchored mapping', () => {
  it('is the identity when the cycle matches the plan', () => {
    for (let d = 1; d <= 28; d++) expect(map(d, 28)).toBe(d);
  });

  it('keeps the luteal phase anchored to the next period in a long cycle', () => {
    // 35-day cycle: the last 14 days (22–35) use the plan's last 14 days (15–28).
    expect(map(22, 35)).toBe(15);
    expect(map(35, 35)).toBe(28);
    expect(map(30, 35)).toBe(23);
    // Follicular days stretch: 6–21 cover plan days 6–14.
    expect(map(6, 35)).toBe(6);
    expect(map(21, 35)).toBe(14);
  });

  it('shrinks the follicular phase in a short cycle', () => {
    // 24-day cycle: luteal starts on day 11.
    expect(map(11, 24)).toBe(15);
    expect(map(24, 24)).toBe(28);
    const follicular = [6, 7, 8, 9, 10].map((d) => map(d, 24)!);
    expect(follicular[0]).toBe(6);
    expect(follicular[4]).toBe(14);
    expect([...follicular].sort((a, b) => a - b)).toEqual(follicular); // monotonic
  });

  it('stretches the plan period over a longer bleed', () => {
    // 7 bleeding days map onto the plan's 5 period days.
    expect(map(1, 28, 7)).toBe(1);
    expect(map(7, 28, 7)).toBe(5);
    expect(map(8, 28, 7)).toBe(6);
    expect(map(15, 28, 7)).toBe(15); // luteal unchanged
  });

  it('still anchors the luteal phase in a very short cycle', () => {
    expect(map(16, 16, 7)).toBe(28);
    expect(map(3, 16, 7)).toBe(15);
    expect(map(1, 16, 7)).toBe(1);
  });

  it('returns null after the expected end of the cycle (period late)', () => {
    expect(map(36, 35)).toBeNull();
  });

  it('maps day N to plan day N for fixed-day plans', () => {
    const fixed = plan({ adaptation: 'fixedDays' });
    expect(map(22, 35, 5, fixed)).toBe(22);
    expect(map(29, 35, 5, fixed)).toBeNull();
  });

  it('lays the plan out over the actual cycle', () => {
    const days = expandPlanForCycle(plan(), 31, 5);
    expect(days).toHaveLength(31);
    expect(days[30]).toEqual({ cycleDay: 31, planDay: 28, amount: 28 });
  });
});

describe('dose lookup', () => {
  const ctx = { periodStarts: ['2026-09-03', '2026-10-01'] };

  it('returns noPlan without a plan', () => {
    expect(getDoseForDate('2026-10-05', null, ctx).status).toBe('noPlan');
  });

  it('is not valid before validFrom', () => {
    expect(getDoseForDate('2026-09-20', plan(), ctx)).toEqual({ status: 'notYetValid', validFrom: '2026-10-01' });
  });

  it('needs cycle data', () => {
    expect(getDoseForDate('2026-10-05', plan(), { periodStarts: [] }).status).toBe('noCycleData');
  });

  it('looks up the mapped plan day', () => {
    expect(getDoseForDate('2026-10-20', plan(), ctx)).toMatchObject({
      status: 'planned',
      amount: 20,
      planDay: 20,
      cycle: { cycleDay: 20 },
    });
  });

  it("follows the patient's adjusted cycle length", () => {
    const adjusted = { ...ctx, adjustments: [{ cycleStart: '2026-10-01', expectedLength: 34 }] };
    // Day 21 of a 34-day cycle is the first luteal day → plan day 15.
    expect(getDoseForDate('2026-10-21', plan(), adjusted)).toMatchObject({ status: 'planned', planDay: 15, amount: 15 });
  });

  it("uses the physician's fallback dose when the period is late", () => {
    expect(getDoseForDate('2026-10-31', plan(), ctx)).toMatchObject({ status: 'beyondPlan', amount: 20, cycle: { cycleDay: 31 } });
  });

  it('asks the patient to contact the physician when no fallback was given', () => {
    expect(getDoseForDate('2026-10-31', plan({ doseBeyondPlan: null }), ctx).status).toBe('contactPhysician');
  });
});

describe('plan comparison', () => {
  it('groups changed days into ranges', () => {
    const flat = (lutealDose: number) =>
      plan({ days: Array.from({ length: 28 }, (_, i) => ({ cycleDay: i + 1, amount: i >= 14 ? lutealDose : 20 })) });
    expect(comparePlans(flat(30), flat(40), 28, 5)).toEqual([{ fromDay: 15, toDay: 28, before: 30, after: 40 }]);
    expect(comparePlans(flat(30), flat(30), 28, 5)).toEqual([]);
  });

  it('lists everything as new when there was no plan before', () => {
    const changes = comparePlans(null, plan(), 28, 5);
    expect(changes[0]).toMatchObject({ fromDay: 1, before: null, after: 1 });
  });
});

describe('plan validation', () => {
  it('accepts a complete plan', () => {
    expect(() => validateDosingPlan(plan())).not.toThrow();
  });

  it('rejects gaps, negative doses, empty plans and impossible lengths', () => {
    const bad = (o: Partial<DosingPlan>) => () => validateDosingPlan(plan(o));
    expect(bad({ days: [{ cycleDay: 1, amount: 10 }, { cycleDay: 3, amount: 10 }] })).toThrow(InvalidDosingPlanError);
    expect(bad({ days: [{ cycleDay: 1, amount: -5 }] })).toThrow(InvalidDosingPlanError);
    expect(bad({ days: [] })).toThrow(InvalidDosingPlanError);
    expect(bad({ days: Array.from({ length: 10 }, (_, i) => ({ cycleDay: i + 1, amount: 1 })) })).toThrow('at least 16 days');
    expect(bad({ periodLength: 0 })).toThrow('Period length');
  });
});
