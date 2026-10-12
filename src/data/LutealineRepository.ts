import { QUESTIONNAIRE_VERSION } from '../content/questionnaire';
import type { PatientData } from '../domain/dailyRecords';
import { isIsoDate, type IsoDate } from '../domain/dates';
import { validateDosingPlan } from '../domain/dosing';
import type {
  DosingPlan,
  HormoneReading,
  MedicationLog,
  PatientProfile,
  PeriodStart,
  QuestionnaireEntry,
  RecordMeta,
} from '../domain/models';
import { pruneHiddenAnswers, scoreQuestionnaire, type Answers } from '../domain/scoring';
import type { BiosensorResult } from '../services/biosensor/BiosensorService';
import type { DocumentStore } from './DocumentStore';
import { newMeta, touch } from './ids';

type Input<T extends RecordMeta> = Omit<T, keyof RecordMeta>;

function assertDate(date: IsoDate) {
  if (!isIsoDate(date)) throw new Error(`Invalid date: ${date}`);
}

/**
 * The app's single entry point for reading and writing patient data.
 * Screens never talk to the DocumentStore directly.
 */
export class LutealineRepository {
  constructor(
    private readonly store: DocumentStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // --- Profile ---------------------------------------------------------

  async getProfile(): Promise<PatientProfile | null> {
    const [profile] = await this.store.all<PatientProfile>('profile');
    return profile ?? null;
  }

  async saveProfile(input: Input<PatientProfile>): Promise<PatientProfile> {
    assertDate(input.monitoringStartDate);
    if (!(input.typicalCycleLength >= 15 && input.typicalCycleLength <= 60)) {
      throw new Error('Typical cycle length must be between 15 and 60 days');
    }
    const existing = await this.getProfile();
    const profile: PatientProfile = existing
      ? { ...touch(existing, this.clock()), ...input }
      : { ...newMeta(this.clock()), ...input };
    await this.store.put('profile', profile);
    return profile;
  }

  // --- Cycle -----------------------------------------------------------

  async listPeriodStarts(): Promise<IsoDate[]> {
    const rows = await this.store.all<PeriodStart>('periodStarts');
    return rows.map((r) => r.date).sort();
  }

  /** Idempotent: logging the same date twice keeps one entry. */
  async logPeriodStart(date: IsoDate): Promise<void> {
    assertDate(date);
    const rows = await this.store.all<PeriodStart>('periodStarts');
    if (rows.some((r) => r.date === date)) return;
    await this.store.put<PeriodStart>('periodStarts', { ...newMeta(this.clock()), date });
  }

  async removePeriodStart(date: IsoDate): Promise<void> {
    const rows = await this.store.all<PeriodStart>('periodStarts');
    for (const r of rows.filter((r) => r.date === date)) await this.store.delete('periodStarts', r.id);
  }

  // --- Biosensor readings ---------------------------------------------

  async addReading(date: IsoDate, result: BiosensorResult, photoUri?: string): Promise<HormoneReading> {
    assertDate(date);
    const reading: HormoneReading = { ...newMeta(this.clock()), date, ...result, photoUri };
    await this.store.put('hormoneReadings', reading);
    return reading;
  }

  async listReadings(): Promise<HormoneReading[]> {
    return this.store.all<HormoneReading>('hormoneReadings');
  }

  // --- Questionnaire ---------------------------------------------------

  /** One entry per day; saving again for the same date replaces it. Throws if incomplete. */
  async saveQuestionnaire(date: IsoDate, rawAnswers: Answers): Promise<QuestionnaireEntry> {
    assertDate(date);
    const answers = pruneHiddenAnswers(rawAnswers);
    const score = scoreQuestionnaire(answers);
    const existing = (await this.store.all<QuestionnaireEntry>('questionnaires')).find(
      (q) => q.date === date,
    );
    const meta = existing ? touch(existing, this.clock()) : newMeta(this.clock());
    const entry: QuestionnaireEntry = {
      id: meta.id,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      schemaVersion: meta.schemaVersion,
      date,
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      answers,
      score,
    };
    await this.store.put('questionnaires', entry);
    return entry;
  }

  async getQuestionnaire(date: IsoDate): Promise<QuestionnaireEntry | null> {
    const all = await this.store.all<QuestionnaireEntry>('questionnaires');
    return all.find((q) => q.date === date) ?? null;
  }

  // --- Medication ------------------------------------------------------

  /** Total medication taken on a day; logging again for the same date replaces it. */
  async logMedication(date: IsoDate, amount: number, unit: string, note?: string): Promise<MedicationLog> {
    assertDate(date);
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid medication amount');
    const existing = (await this.store.all<MedicationLog>('medicationLogs')).find((m) => m.date === date);
    const log: MedicationLog = existing
      ? { ...touch(existing, this.clock()), amount, unit, note }
      : { ...newMeta(this.clock()), date, amount, unit, note };
    await this.store.put('medicationLogs', log);
    return log;
  }

  // --- Dosing plan -----------------------------------------------------

  async getActiveDosingPlan(): Promise<DosingPlan | null> {
    const plans = await this.store.all<DosingPlan>('dosingPlans');
    return plans.find((p) => p.active) ?? null;
  }

  async listDosingPlans(): Promise<DosingPlan[]> {
    return this.store.all<DosingPlan>('dosingPlans');
  }

  /** Stores a physician's plan and makes it the active one. Older plans are kept, inactive. */
  async saveDosingPlan(input: Omit<Input<DosingPlan>, 'active'>): Promise<DosingPlan> {
    assertDate(input.validFrom);
    validateDosingPlan(input);
    const now = this.clock();
    const previous = await this.store.all<DosingPlan>('dosingPlans');
    for (const p of previous.filter((p) => p.active)) {
      await this.store.put('dosingPlans', { ...touch(p, now), active: false });
    }
    const plan: DosingPlan = {
      ...newMeta(now),
      ...input,
      days: [...input.days].sort((a, b) => a.cycleDay - b.cycleDay),
      active: true,
    };
    await this.store.put('dosingPlans', plan);
    return plan;
  }

  // --- Aggregate -------------------------------------------------------

  /** Everything needed to build daily records. Null until a profile exists. */
  async loadPatientData(): Promise<PatientData | null> {
    const profile = await this.getProfile();
    if (!profile) return null;
    const [periodStarts, readings, questionnaires, medicationLogs, dosingPlan] = await Promise.all([
      this.listPeriodStarts(),
      this.listReadings(),
      this.store.all<QuestionnaireEntry>('questionnaires'),
      this.store.all<MedicationLog>('medicationLogs'),
      this.getActiveDosingPlan(),
    ]);
    return { profile, periodStarts, readings, questionnaires, medicationLogs, dosingPlan };
  }

  async clearAll(): Promise<void> {
    await this.store.clear();
  }
}
