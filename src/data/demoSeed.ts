import { QUESTIONNAIRE_ITEMS, QUESTIONNAIRE_VERSION, type ScaleValue } from '../content/questionnaire';
import { getCycleDay } from '../domain/cycle';
import { addDays, dateRange, type IsoDate } from '../domain/dates';
import type {
  DosingPlan,
  HormoneReading,
  MedicationLog,
  PatientProfile,
  PeriodStart,
  QuestionnaireEntry,
  SampleType,
} from '../domain/models';
import { clamp, createRng, gaussian } from '../domain/random';
import { scoreQuestionnaire, type Answers } from '../domain/scoring';
import { interpretSignal } from '../services/biosensor/BiosensorService';
import {
  relativeProgesterone,
  syntheticReporterSignal,
} from '../services/biosensor/MockBiosensorService';
import type { DocumentStore } from './DocumentStore';
import { newMeta } from './ids';

export interface DemoOptions {
  /** The demo "today". Left unlogged so the presenter can log it live. */
  today: IsoDate;
  seed?: number;
  sampleType?: SampleType;
  /** Lengths of the monitoring cycles. */
  monitoringCycleLengths?: number[];
  /** Cycle day "today" falls on in the current (treatment) cycle. 20 = mid-luteal. */
  todayCycleDay?: number;
  /** Fraction of days the synthetic patient forgets to log. */
  missedDayRate?: number;
}

export interface DemoData {
  profile: PatientProfile;
  periodStarts: PeriodStart[];
  readings: HormoneReading[];
  questionnaires: QuestionnaireEntry[];
  medicationLogs: MedicationLog[];
  dosingPlan: DosingPlan;
}

const MONITORING_DOSE = 20;

/** Fixed share code of the demo patient, so the physician portal demo can find it. */
export const DEMO_SHARE_CODE = 'DEMO-01';

/**
 * SYNTHETIC demo data: two monitoring cycles, then a physician's plan that
 * started at the beginning of the current cycle. Symptoms are generated to
 * worsen with progesterone during monitoring and to improve once the luteal
 * dose is raised. This is a story for the demo, not a model of real patients.
 */
export function generateDemoData(options: DemoOptions): DemoData {
  const {
    today,
    seed = 42,
    sampleType = 'saliva',
    monitoringCycleLengths = [28, 30],
    todayCycleDay = 20,
    missedDayRate = 0.08,
  } = options;
  const rng = createRng(seed);
  const at = (date: IsoDate, hour = 8) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00Z`);
  const meta = (date: IsoDate) => newMeta(at(date), rng);

  // Period starts, counted backwards from today.
  const currentStart = addDays(today, -(todayCycleDay - 1));
  const starts: IsoDate[] = [currentStart];
  for (const len of [...monitoringCycleLengths].reverse()) starts.unshift(addDays(starts[0], -len));
  const monitoringStart = starts[0];
  const typicalCycleLength = Math.round(
    monitoringCycleLengths.reduce((a, b) => a + b, 0) / monitoringCycleLengths.length,
  );

  const profile: PatientProfile = {
    ...meta(monitoringStart),
    displayName: 'Demo patient',
    birthYear: 1997,
    typicalCycleLength,
    medicationName: 'Methylphenidate (demo)',
    doseUnit: 'mg',
    preferredSampleType: sampleType,
    monitoringStartDate: monitoringStart,
    typicalPeriodLength: 5,
    shareCode: DEMO_SHARE_CODE,
  };

  // Plan: baseline dose, raised through the luteal phase.
  const planDays = Array.from({ length: typicalCycleLength }, (_, i) => {
    const day = i + 1;
    const luteal = day > typicalCycleLength - 14;
    const peak = relativeProgesterone(day, typicalCycleLength) > 0.4;
    return { cycleDay: day, amount: peak ? 40 : luteal ? 30 : MONITORING_DOSE };
  });
  const dosingPlan: DosingPlan = {
    ...meta(addDays(currentStart, -2)),
    medicationName: profile.medicationName!,
    unit: 'mg',
    days: planDays,
    periodLength: 5,
    adaptation: 'phaseAnchored',
    doseBeyondPlan: MONITORING_DOSE,
    prescribedBy: 'Demo physician',
    validFrom: currentStart,
    status: 'active',
    source: 'physician',
    isDemo: true,
  };

  const readings: HormoneReading[] = [];
  const questionnaires: QuestionnaireEntry[] = [];
  const medicationLogs: MedicationLog[] = [];

  for (const date of dateRange(monitoringStart, addDays(today, -1))) {
    const cycle = getCycleDay(date, { periodStarts: starts, typicalCycleLength })!;
    const treatment = date >= dosingPlan.validFrom;
    const prescribed = planDays.find((d) => d.cycleDay === cycle.cycleDay)?.amount ?? MONITORING_DOSE;
    const missed = rng() < missedDayRate;
    if (missed) continue;

    // Biosensor reading.
    const signal = syntheticReporterSignal(cycle.cycleDay, cycle.cycleLength, sampleType, rng);
    readings.push({
      ...meta(date),
      date,
      ...interpretSignal(signal, sampleType, at(date, 7), 'mock'),
    });

    // Medication: occasionally forgets to log.
    const taken = treatment ? prescribed : MONITORING_DOSE;
    if (rng() > 0.05) {
      medicationLogs.push({ ...meta(date), date, amount: taken, unit: 'mg' });
    }

    // Symptoms: worse with progesterone; extra luteal dose relieves part of it.
    const prog = relativeProgesterone(cycle.cycleDay, cycle.cycleLength);
    const relief = treatment ? ((taken - MONITORING_DOSE) / 20) * 0.35 : 0;
    const severity = clamp(0.2 + 0.55 * prog - relief + 0.08 * gaussian(rng), 0, 1);

    const answers: Answers = {};
    for (const item of QUESTIONNAIRE_ITEMS) {
      if (item.role === 'symptom') {
        answers[item.id] = clamp(Math.round(1 + 4 * severity + 0.7 * gaussian(rng)), 1, 5) as ScaleValue;
      }
    }
    const effect = treatment ? 4 - severity * 1.5 : 3.5 - prog * 2;
    answers.e6 = clamp(Math.round(effect + 0.5 * gaussian(rng)), 1, 5) as ScaleValue;
    const sideEffects = rng() < (taken >= 40 ? 0.25 : 0.07);
    answers.e7 = sideEffects;
    if (sideEffects) {
      answers.e8 = { selected: [rng() < 0.6 ? 'sleep' : 'appetite'] };
    }

    questionnaires.push({
      ...meta(date),
      date,
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      answers,
      score: scoreQuestionnaire(answers),
    });
  }

  return {
    profile,
    periodStarts: starts.map((date) => ({ ...meta(date), date })),
    readings,
    questionnaires,
    medicationLogs,
    dosingPlan,
  };
}

/** Replaces all stored data with the demo data set. */
export async function seedDemoData(store: DocumentStore, options: DemoOptions): Promise<DemoData> {
  const data = generateDemoData(options);
  await store.clear();
  await store.put('profile', data.profile);
  await store.putMany('periodStarts', data.periodStarts);
  await store.putMany('hormoneReadings', data.readings);
  await store.putMany('questionnaires', data.questionnaires);
  await store.putMany('medicationLogs', data.medicationLogs);
  await store.put('dosingPlans', data.dosingPlan);
  return data;
}
