import {
  averageCycleLength,
  getCycleDay,
  phaseForDay,
  predictNextPeriod,
} from '../cycle';
import { addDays, daysBetween, isIsoDate } from '../dates';

describe('dates', () => {
  it('validates ISO dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-2-3')).toBe(false);
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30'); // EU DST change
    expect(daysBetween('2026-10-01', '2026-10-29')).toBe(28);
  });
});

describe('cycle tracking', () => {
  const starts = ['2026-08-01', '2026-08-29', '2026-09-28'];

  it('returns null before the first logged period', () => {
    expect(getCycleDay('2026-07-31', { periodStarts: starts })).toBeNull();
  });

  it('day 1 is the first day of the period', () => {
    expect(getCycleDay('2026-08-01', { periodStarts: starts })).toMatchObject({ cycleNumber: 1, cycleDay: 1 });
  });

  it('uses the actual length for completed cycles', () => {
    const info = getCycleDay('2026-09-10', { periodStarts: starts })!;
    expect(info).toMatchObject({ cycleNumber: 2, cycleDay: 13, cycleLength: 30, lengthIsEstimate: false });
  });

  it('estimates the current cycle length from the average of past cycles', () => {
    const info = getCycleDay('2026-10-12', { periodStarts: starts })!;
    expect(info.cycleDay).toBe(15);
    expect(info.cycleLength).toBe(29); // (28 + 30) / 2
    expect(info.lengthIsEstimate).toBe(true);
  });

  it('falls back to the typical cycle length with only one period logged', () => {
    expect(getCycleDay('2026-08-10', { periodStarts: ['2026-08-01'], typicalCycleLength: 32 })!.cycleLength).toBe(32);
  });

  it('ignores unsorted and duplicate input', () => {
    const info = getCycleDay('2026-09-10', { periodStarts: ['2026-09-28', '2026-08-01', '2026-08-29', '2026-08-29'] })!;
    expect(info.cycleNumber).toBe(2);
  });

  it('marks a late period as overdue', () => {
    const info = getCycleDay('2026-10-30', { periodStarts: starts })!;
    expect(info.cycleDay).toBe(33);
    expect(info.overdue).toBe(true);
    expect(info.phase).toBe('luteal');
  });

  it('ignores implausible gaps (missed logs) in the average', () => {
    expect(averageCycleLength(['2026-01-01', '2026-01-29', '2026-05-01'])).toBe(28);
  });

  it('assigns phases around the estimated ovulation day', () => {
    // 28-day cycle: ovulation ≈ day 14
    expect(phaseForDay(5, 28)).toBe('follicular');
    expect(phaseForDay(12, 28)).toBe('follicular');
    expect(phaseForDay(13, 28)).toBe('ovulatory');
    expect(phaseForDay(15, 28)).toBe('ovulatory');
    expect(phaseForDay(16, 28)).toBe('luteal');
    // Longer cycles have a longer follicular phase; the luteal phase stays ~14 days.
    expect(phaseForDay(16, 35)).toBe('follicular');
  });

  it('predicts the next period', () => {
    expect(predictNextPeriod({ periodStarts: starts })).toBe('2026-10-27');
    expect(predictNextPeriod({ periodStarts: [] })).toBeNull();
  });

  it("uses the patient's expected length for the running cycle only", () => {
    const adjustments = [
      { cycleStart: '2026-09-28', expectedLength: 33, periodLength: 7 },
      { cycleStart: '2026-08-29', expectedLength: 40 }, // ignored: that cycle is logged
    ];
    const running = getCycleDay('2026-10-12', { periodStarts: starts, adjustments })!;
    expect(running).toMatchObject({ cycleLength: 33, lengthSource: 'adjusted', periodLength: 7 });
    const logged = getCycleDay('2026-09-10', { periodStarts: starts, adjustments })!;
    expect(logged).toMatchObject({ cycleLength: 30, lengthSource: 'logged', periodLength: 5 });
  });

  it('uses the typical period length when no adjustment exists', () => {
    expect(getCycleDay('2026-10-12', { periodStarts: starts, typicalPeriodLength: 4 })!.periodLength).toBe(4);
  });

  it('predicts the next period from an adjusted length', () => {
    const adjustments = [{ cycleStart: '2026-09-28', expectedLength: 33 }];
    expect(predictNextPeriod({ periodStarts: starts, adjustments })).toBe('2026-10-31');
  });
});
