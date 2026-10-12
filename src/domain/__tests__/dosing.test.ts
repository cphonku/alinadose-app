import { getDoseForDate, InvalidDosingPlanError, validateDosingPlan } from '../dosing';
import type { DosingPlan } from '../models';

const plan = (overrides: Partial<DosingPlan> = {}): DosingPlan => ({
  id: 'p1',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  schemaVersion: 1,
  medicationName: 'Test',
  unit: 'mg',
  days: Array.from({ length: 28 }, (_, i) => ({ cycleDay: i + 1, amount: i + 1 > 14 ? 30 : 20 })),
  doseBeyondPlan: 20,
  validFrom: '2026-10-01',
  active: true,
  ...overrides,
});

const starts = ['2026-09-03', '2026-10-01'];

describe('dose lookup', () => {
  it('returns noPlan without a plan', () => {
    expect(getDoseForDate('2026-10-05', null, starts).status).toBe('noPlan');
  });

  it('is not valid before validFrom', () => {
    expect(getDoseForDate('2026-09-20', plan(), starts)).toEqual({
      status: 'notYetValid',
      validFrom: '2026-10-01',
    });
  });

  it('needs cycle data', () => {
    expect(getDoseForDate('2026-10-05', plan(), []).status).toBe('noCycleData');
  });

  it('maps cycle day N to plan day N', () => {
    expect(getDoseForDate('2026-10-01', plan(), starts)).toMatchObject({ status: 'planned', amount: 20 });
    expect(getDoseForDate('2026-10-20', plan(), starts)).toMatchObject({
      status: 'planned',
      amount: 30,
      cycle: { cycleDay: 20 },
    });
  });

  it("uses the physician's fallback dose when the cycle runs past the plan", () => {
    expect(getDoseForDate('2026-10-31', plan(), starts)).toMatchObject({
      status: 'beyondPlan',
      amount: 20,
      cycle: { cycleDay: 31 },
    });
  });

  it('asks the patient to contact the physician when no fallback was given', () => {
    expect(getDoseForDate('2026-10-31', plan({ doseBeyondPlan: null }), starts).status).toBe(
      'contactPhysician',
    );
  });
});

describe('plan validation', () => {
  it('accepts a complete plan', () => {
    expect(() => validateDosingPlan(plan())).not.toThrow();
  });

  it('rejects gaps, negative doses and empty plans', () => {
    expect(() => validateDosingPlan(plan({ days: [{ cycleDay: 1, amount: 10 }, { cycleDay: 3, amount: 10 }] }))).toThrow(
      InvalidDosingPlanError,
    );
    expect(() => validateDosingPlan(plan({ days: [{ cycleDay: 1, amount: -5 }] }))).toThrow(InvalidDosingPlanError);
    expect(() => validateDosingPlan(plan({ days: [] }))).toThrow(InvalidDosingPlanError);
  });
});
