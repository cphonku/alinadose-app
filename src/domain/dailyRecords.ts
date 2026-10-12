import { getCycleDay, type CycleDayInfo, type CyclePhase } from './cycle';
import { dateRange, type IsoDate } from './dates';
import { getDoseForDate, type DoseForDay } from './dosing';
import type {
  DosingPlan,
  HormoneReading,
  MedicationLog,
  PatientProfile,
  QuestionnaireEntry,
  SampleType,
} from './models';
import type { QuestionnaireScore } from './scoring';

/** Everything the app knows about one day, combined for the physician. */
export interface DailyRecord {
  date: IsoDate;
  cycle: CycleDayInfo | null;
  programPhase: 'monitoring' | 'treatment';
  progesterone: {
    value: number;
    unit: string;
    sampleType: SampleType;
    reporterSignal: number;
    /** Number of readings that day; `value` is the latest one. */
    readingCount: number;
  } | null;
  symptoms: Pick<QuestionnaireScore, 'total' | 'totalPercent' | 'sections'> | null;
  medicationEffect: number | null;
  sideEffects: QuestionnaireScore['sideEffects'] | null;
  medicationTaken: { amount: number; unit: string } | null;
  /** Dose from the physician's plan (treatment phase only). */
  prescribed: DoseForDay;
}

export interface PatientData {
  profile: PatientProfile;
  periodStarts: IsoDate[];
  readings: HormoneReading[];
  questionnaires: QuestionnaireEntry[];
  medicationLogs: MedicationLog[];
  /** The active plan, if any. */
  dosingPlan: DosingPlan | null;
}

function latestBy<T extends { date: IsoDate; updatedAt: string }>(items: T[]): Map<IsoDate, T> {
  const map = new Map<IsoDate, T>();
  for (const item of items) {
    const current = map.get(item.date);
    if (!current || item.updatedAt > current.updatedAt) map.set(item.date, item);
  }
  return map;
}

export function buildDailyRecords(data: PatientData, from: IsoDate, to: IsoDate): DailyRecord[] {
  const { profile, periodStarts, dosingPlan } = data;

  const readingsByDate = new Map<IsoDate, HormoneReading[]>();
  for (const r of data.readings) {
    readingsByDate.set(r.date, [...(readingsByDate.get(r.date) ?? []), r]);
  }
  const questionnaireByDate = latestBy(data.questionnaires);
  const medicationByDate = new Map<IsoDate, MedicationLog[]>();
  for (const m of data.medicationLogs) {
    medicationByDate.set(m.date, [...(medicationByDate.get(m.date) ?? []), m]);
  }

  return dateRange(from, to).map((date) => {
    const readings = (readingsByDate.get(date) ?? []).sort((a, b) =>
      a.measuredAt.localeCompare(b.measuredAt),
    );
    const latest = readings[readings.length - 1];
    const q = questionnaireByDate.get(date);
    const meds = medicationByDate.get(date);
    const inTreatment = dosingPlan !== null && date >= dosingPlan.validFrom;

    return {
      date,
      cycle: getCycleDay(date, periodStarts, profile.typicalCycleLength),
      programPhase: inTreatment ? 'treatment' : 'monitoring',
      progesterone: latest
        ? {
            value: latest.progesterone,
            unit: latest.unit,
            sampleType: latest.sampleType,
            reporterSignal: latest.reporterSignal,
            readingCount: readings.length,
          }
        : null,
      symptoms: q
        ? { total: q.score.total, totalPercent: q.score.totalPercent, sections: q.score.sections }
        : null,
      medicationEffect: q?.score.medicationEffect ?? null,
      sideEffects: q?.score.sideEffects ?? null,
      medicationTaken: meds
        ? { amount: meds.reduce((a, m) => a + m.amount, 0), unit: meds[0].unit }
        : null,
      prescribed: inTreatment
        ? getDoseForDate(date, dosingPlan, periodStarts, profile.typicalCycleLength)
        : { status: 'noPlan' },
    };
  });
}

export type ProgramStatus =
  | { phase: 'monitoring'; monitoringCycle: number | null; daysInMonitoring: number; targetCycles: number }
  | { phase: 'treatment'; plan: DosingPlan };

export const MONITORING_TARGET_CYCLES = 2;

/**
 * Monitoring = collecting data before the physician makes a plan.
 * Treatment = an active dosing plan is valid for this date.
 */
export function getProgramStatus(data: PatientData, today: IsoDate): ProgramStatus {
  const { dosingPlan, profile, periodStarts } = data;
  if (dosingPlan && today >= dosingPlan.validFrom) return { phase: 'treatment', plan: dosingPlan };

  const now = getCycleDay(today, periodStarts, profile.typicalCycleLength);
  const atStart = getCycleDay(profile.monitoringStartDate, periodStarts, profile.typicalCycleLength);
  const firstCycle = atStart?.cycleNumber ?? 1;
  return {
    phase: 'monitoring',
    monitoringCycle: now ? now.cycleNumber - firstCycle + 1 : null,
    daysInMonitoring: Math.max(0, dateRange(profile.monitoringStartDate, today).length),
    targetCycles: MONITORING_TARGET_CYCLES,
  };
}

export interface PhaseSummary {
  phase: CyclePhase;
  days: number;
  meanProgesterone: number | null;
  meanSymptomPercent: number | null;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Average progesterone and symptom severity per cycle phase. */
export function summarizeByPhase(records: DailyRecord[]): PhaseSummary[] {
  const phases: CyclePhase[] = ['follicular', 'ovulatory', 'luteal'];
  return phases.map((phase) => {
    const inPhase = records.filter((r) => r.cycle?.phase === phase);
    const prog = inPhase.flatMap((r) => (r.progesterone ? [r.progesterone.value] : []));
    const sym = inPhase.flatMap((r) => (r.symptoms ? [r.symptoms.totalPercent] : []));
    return {
      phase,
      days: inPhase.length,
      meanProgesterone: mean(prog),
      meanSymptomPercent: mean(sym),
    };
  });
}

/**
 * Pearson correlation between progesterone and symptom score on days with
 * both. Only readings of the same sample type are comparable, so the most
 * common sample type is used. Returns null with fewer than 3 paired days.
 */
export function progesteroneSymptomCorrelation(
  records: DailyRecord[],
): { r: number; n: number; sampleType: SampleType } | null {
  const paired = records.filter((r) => r.progesterone && r.symptoms);
  if (paired.length < 3) return null;
  const counts = new Map<SampleType, number>();
  paired.forEach((r) => counts.set(r.progesterone!.sampleType, (counts.get(r.progesterone!.sampleType) ?? 0) + 1));
  const sampleType = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const rows = paired.filter((r) => r.progesterone!.sampleType === sampleType);
  if (rows.length < 3) return null;

  const xs = rows.map((r) => r.progesterone!.value);
  const ys = rows.map((r) => r.symptoms!.total);
  const mx = mean(xs)!;
  const my = mean(ys)!;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return { r: sxy / Math.sqrt(sxx * syy), n: rows.length, sampleType };
}
