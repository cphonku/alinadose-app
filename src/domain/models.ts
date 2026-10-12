import type { IsoDate } from './dates';
import type { Answers, QuestionnaireScore } from './scoring';

/**
 * Persisted records. Every record has a stable `id`, timestamps and a
 * `schemaVersion` so data can later be exported to the physician or to
 * researchers without guessing its shape.
 */
export interface RecordMeta {
  id: string;
  /** ISO timestamp. */
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export type SampleType = 'saliva' | 'urine';

export interface PatientProfile extends RecordMeta {
  /** Name or pseudonym. */
  displayName: string;
  birthYear?: number;
  /** Patient-reported typical cycle length, used until real cycles are logged. */
  typicalCycleLength: number;
  medicationName?: string;
  /** Unit used for all doses, e.g. "mg". */
  doseUnit: string;
  preferredSampleType: SampleType;
  /** First day of the monitoring phase. */
  monitoringStartDate: IsoDate;
}

export interface PeriodStart extends RecordMeta {
  date: IsoDate;
}

export interface HormoneReading extends RecordMeta {
  date: IsoDate;
  /** ISO timestamp of the measurement. */
  measuredAt: string;
  sampleType: SampleType;
  /** Raw reporter signal (arbitrary units) read from the test. */
  reporterSignal: number;
  /** Progesterone concentration derived from the calibration curve. */
  progesterone: number;
  unit: string;
  /** Where the value came from. 'mock' = synthetic, never real patient data. */
  source: 'mock' | 'camera';
  calibrationId: string;
}

export interface QuestionnaireEntry extends RecordMeta {
  date: IsoDate;
  questionnaireVersion: number;
  answers: Answers;
  score: QuestionnaireScore;
}

export interface MedicationLog extends RecordMeta {
  date: IsoDate;
  /** Total amount taken that day, in the profile's dose unit. */
  amount: number;
  unit: string;
  note?: string;
}

export interface DosingPlanDay {
  cycleDay: number;
  amount: number;
}

/**
 * A dosing plan written by the physician after the monitoring phase.
 * The app only *displays* these doses — it never calculates or adjusts them.
 */
export interface DosingPlan extends RecordMeta {
  medicationName: string;
  unit: string;
  /** One entry per cycle day, starting at day 1. */
  days: DosingPlanDay[];
  /**
   * Dose the physician specifies for cycle days not covered by `days`
   * (cycles longer than the plan). Null = the app tells the patient to
   * contact the physician instead of showing a dose.
   */
  doseBeyondPlan: number | null;
  prescribedBy?: string;
  validFrom: IsoDate;
  /** Only one plan is active at a time; older plans are kept for history. */
  active: boolean;
  /** True for synthetic demo plans. */
  isDemo?: boolean;
}
