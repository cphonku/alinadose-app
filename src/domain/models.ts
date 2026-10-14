import type { CycleAdjustmentInput } from './cycle';
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
  /** Usual number of bleeding days (default 5). */
  typicalPeriodLength?: number;
  medicationName?: string;
  /** Unit used for all doses, e.g. "mg". */
  doseUnit: string;
  preferredSampleType: SampleType;
  /** First day of the monitoring phase. */
  monitoringStartDate: IsoDate;
  /** Code the patient gives their physician so the physician can send a plan (e.g. "LUT-4F7K2"). */
  shareCode?: string;
}

export interface PeriodStart extends RecordMeta {
  date: IsoDate;
}

/** The patient's corrections for one cycle (expected length, bleeding days). */
export interface CycleAdjustment extends RecordMeta, CycleAdjustmentInput {}

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
  /** Local file URI of the photo of the test, when one was taken. */
  photoUri?: string;
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
 * How a plan written for one cycle length is applied to a cycle of another length.
 * - phaseAnchored: bleeding days and follicular days stretch/shrink; the
 *   luteal days (~14) stay anchored to the expected next period.
 * - fixedDays: cycle day N always uses plan day N.
 */
export type PlanAdaptation = 'phaseAnchored' | 'fixedDays';

export type PlanStatus = 'pending' | 'active' | 'archived';

/**
 * A dosing plan written by the physician after the monitoring phase.
 * The app only *displays* these doses — it never calculates or changes them;
 * it only maps the physician's plan days onto the patient's actual cycle days
 * using the rule the physician chose (`adaptation`).
 */
export interface DosingPlan extends RecordMeta {
  medicationName: string;
  unit: string;
  /** One entry per plan day, starting at day 1. The plan length is `days.length`. */
  days: DosingPlanDay[];
  /** Bleeding days the plan was written for. */
  periodLength: number;
  adaptation: PlanAdaptation;
  /**
   * Dose for days after the expected end of the cycle (late period).
   * Null = the app tells the patient to contact the physician instead.
   */
  doseBeyondPlan: number | null;
  prescribedBy?: string;
  /** Catalog id from src/content/medications.ts ('other' or absent for free text). */
  medicationId?: string;
  /** Age group whose label rules apply: adults, or 6–17 years. */
  ageGroup?: 'adult' | 'youth';
  /** Label maximum per day when the plan was written (snapshot), in `unit`. */
  labelMaxDailyDose?: number;
  /** The product's label does not cover this age group (snapshot): any dose is off-label. */
  notLicensedForAgeGroup?: boolean;
  /** The physician's reason for prescribing outside the label (above the maximum or off-label). */
  overLimitReason?: string;
  validFrom: IsoDate;
  /**
   * pending: received from the physician, not yet confirmed by the patient.
   * active: the plan in use (at most one). archived: kept for history.
   */
  status: PlanStatus;
  /** 'physician' = received remotely; 'local' = entered on this device. */
  source: 'local' | 'physician';
  /** Version number and publish time on the plan server, for remote plans. */
  remoteVersion?: number;
  remotePublishedAt?: string;
  /** ISO timestamps. */
  receivedAt?: string;
  acceptedAt?: string;
  /** True for synthetic demo plans. */
  isDemo?: boolean;
}

/** The part of a plan a physician writes (no storage or lifecycle fields). */
export type DosingPlanDraft = Pick<
  DosingPlan,
  | 'medicationName'
  | 'unit'
  | 'days'
  | 'periodLength'
  | 'adaptation'
  | 'doseBeyondPlan'
  | 'prescribedBy'
  | 'medicationId'
  | 'ageGroup'
  | 'labelMaxDailyDose'
  | 'notLicensedForAgeGroup'
  | 'overLimitReason'
>;
