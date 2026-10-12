import { QUESTIONNAIRE_VERSION } from '../content/questionnaire';
import type { PatientData } from '../domain/dailyRecords';
import { isIsoDate, type IsoDate } from '../domain/dates';
import { validateDosingPlan } from '../domain/dosing';
import type {
  CycleAdjustment,
  DosingPlan,
  DosingPlanDraft,
  HormoneReading,
  MedicationLog,
  PatientProfile,
  PeriodStart,
  QuestionnaireEntry,
  RecordMeta,
} from '../domain/models';
import { pruneHiddenAnswers, scoreQuestionnaire, type Answers } from '../domain/scoring';
import type { BiosensorResult } from '../services/biosensor/BiosensorService';
import type { RemotePlan } from '../services/plans/RemotePlanService';
import type { DocumentStore } from './DocumentStore';
import { newMeta, touch } from './ids';

type Input<T extends RecordMeta> = Omit<T, keyof RecordMeta>;

function assertDate(date: IsoDate) {
  if (!isIsoDate(date)) throw new Error(`Invalid date: ${date}`);
}

function assertRange(value: number | undefined, min: number, max: number, label: string) {
  if (value !== undefined && !(Number.isInteger(value) && value >= min && value <= max)) {
    throw new Error(`${label} must be between ${min} and ${max} days`);
  }
}

/** Brings plans stored by older app versions (schema v1) up to the current shape. */
export function normalizePlan(raw: DosingPlan & { active?: boolean }): DosingPlan {
  if (raw.status) return raw;
  const { active, ...rest } = raw;
  return {
    ...rest,
    status: active ? 'active' : 'archived',
    source: rest.source ?? 'local',
    periodLength: rest.periodLength ?? 5,
    // v1 plans were applied day-by-day; keep that behaviour.
    adaptation: rest.adaptation ?? 'fixedDays',
  };
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
    assertRange(input.typicalPeriodLength, 1, 14, 'Period length');
    const existing = await this.getProfile();
    const profile: PatientProfile = existing
      ? { ...touch(existing, this.clock()), ...input }
      : { ...newMeta(this.clock()), ...input };
    await this.store.put('profile', profile);
    return profile;
  }

  /** Changes some profile fields; the profile must exist. */
  async updateProfile(changes: Partial<Input<PatientProfile>>): Promise<PatientProfile> {
    const existing = await this.getProfile();
    if (!existing) throw new Error('No profile');
    const { id, createdAt, updatedAt, schemaVersion, ...current } = existing;
    return this.saveProfile({ ...current, ...changes });
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

  async listCycleAdjustments(): Promise<CycleAdjustment[]> {
    return this.store.all<CycleAdjustment>('cycleAdjustments');
  }

  /** The patient's correction for one cycle: expected length and/or bleeding days. */
  async saveCycleAdjustment(
    cycleStart: IsoDate,
    changes: { expectedLength?: number; periodLength?: number },
  ): Promise<CycleAdjustment> {
    assertDate(cycleStart);
    assertRange(changes.expectedLength, 15, 60, 'Cycle length');
    assertRange(changes.periodLength, 1, 14, 'Period length');
    const existing = (await this.listCycleAdjustments()).find((a) => a.cycleStart === cycleStart);
    const adjustment: CycleAdjustment = existing
      ? { ...touch(existing, this.clock()), ...changes }
      : { ...newMeta(this.clock()), cycleStart, ...changes };
    await this.store.put('cycleAdjustments', adjustment);
    return adjustment;
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

  async listDosingPlans(): Promise<DosingPlan[]> {
    return (await this.store.all<DosingPlan>('dosingPlans')).map(normalizePlan);
  }

  async getActiveDosingPlan(): Promise<DosingPlan | null> {
    return (await this.listDosingPlans()).find((p) => p.status === 'active') ?? null;
  }

  /** A plan from the physician the patient has not confirmed yet. */
  async getPendingPlan(): Promise<DosingPlan | null> {
    return (await this.listDosingPlans()).find((p) => p.status === 'pending') ?? null;
  }

  private async archive(status: DosingPlan['status'], now: Date): Promise<void> {
    for (const p of (await this.listDosingPlans()).filter((p) => p.status === status)) {
      await this.store.put('dosingPlans', { ...touch(p, now), status: 'archived' });
    }
  }

  /** Stores a plan entered on this device and makes it the active one. Older plans are archived. */
  async saveDosingPlan(input: DosingPlanDraft & { validFrom: IsoDate; isDemo?: boolean }): Promise<DosingPlan> {
    assertDate(input.validFrom);
    validateDosingPlan(input);
    const now = this.clock();
    await this.archive('active', now);
    const plan: DosingPlan = {
      ...newMeta(now),
      ...input,
      days: [...input.days].sort((a, b) => a.cycleDay - b.cycleDay),
      status: 'active',
      source: 'local',
    };
    await this.store.put('dosingPlans', plan);
    return plan;
  }

  /**
   * Stores a plan published by the physician as *pending*. Returns null when
   * this plan (or a newer one) was already received. Plans are compared by
   * publish time, so a restarted server that counts versions from 1 again
   * still gets through.
   */
  async receiveRemotePlan(remote: RemotePlan): Promise<DosingPlan | null> {
    validateDosingPlan(remote);
    const latest = (await this.listDosingPlans())
      .map((p) => p.remotePublishedAt ?? '')
      .reduce((a, b) => (b > a ? b : a), '');
    if (remote.publishedAt <= latest) return null;
    const now = this.clock();
    await this.archive('pending', now); // superseded by the newer version
    const { patientCode, version, publishedAt, ...draft } = remote;
    const plan: DosingPlan = {
      ...newMeta(now),
      ...draft,
      days: [...draft.days].sort((a, b) => a.cycleDay - b.cycleDay),
      validFrom: publishedAt.slice(0, 10),
      status: 'pending',
      source: 'physician',
      remoteVersion: version,
      remotePublishedAt: publishedAt,
      receivedAt: now.toISOString(),
    };
    await this.store.put('dosingPlans', plan);
    return plan;
  }

  /** The patient confirms the pending plan: it becomes active from `today`. */
  async acceptPendingPlan(today: IsoDate): Promise<DosingPlan> {
    assertDate(today);
    const pending = await this.getPendingPlan();
    if (!pending) throw new Error('No pending plan');
    const now = this.clock();
    await this.archive('active', now);
    const plan: DosingPlan = { ...touch(pending, now), status: 'active', validFrom: today, acceptedAt: now.toISOString() };
    await this.store.put('dosingPlans', plan);
    return plan;
  }

  // --- Aggregate -------------------------------------------------------

  /** Everything needed to build daily records. Null until a profile exists. */
  async loadPatientData(): Promise<PatientData | null> {
    const profile = await this.getProfile();
    if (!profile) return null;
    const [periodStarts, readings, questionnaires, medicationLogs, plans, cycleAdjustments] = await Promise.all([
      this.listPeriodStarts(),
      this.listReadings(),
      this.store.all<QuestionnaireEntry>('questionnaires'),
      this.store.all<MedicationLog>('medicationLogs'),
      this.listDosingPlans(),
      this.listCycleAdjustments(),
    ]);
    return {
      profile,
      periodStarts,
      readings,
      questionnaires,
      medicationLogs,
      dosingPlan: plans.find((p) => p.status === 'active') ?? null,
      pendingPlan: plans.find((p) => p.status === 'pending') ?? null,
      cycleAdjustments,
    };
  }

  async clearAll(): Promise<void> {
    await this.store.clear();
  }
}
