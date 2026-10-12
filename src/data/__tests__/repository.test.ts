import { QUESTIONNAIRE_ITEMS } from '../../content/questionnaire';
import {
  buildDailyRecords,
  getProgramStatus,
  progesteroneSymptomCorrelation,
  summarizeByPhase,
} from '../../domain/dailyRecords';
import { dailyRecordsToCsv } from '../../domain/export';
import type { Answers } from '../../domain/scoring';
import { generateDemoData, seedDemoData } from '../demoSeed';
import { MemoryRemotePlanService } from '../../services/plans/MemoryRemotePlanService';
import { syncPlan } from '../../services/plans/syncPlan';
import { MemoryDocumentStore } from '../DocumentStore';
import { LutealineRepository, normalizePlan } from '../LutealineRepository';

const answers = (value: 1 | 2 | 3 | 4 | 5, extra: Answers = {}): Answers => {
  const a: Answers = { e6: 3, e7: false, ...extra };
  QUESTIONNAIRE_ITEMS.filter((i) => i.role === 'symptom').forEach((i) => (a[i.id] = value));
  return a;
};

const reading = {
  measuredAt: '2026-10-12T08:00:00.000Z',
  sampleType: 'saliva' as const,
  reporterSignal: 400,
  progesterone: 120,
  unit: 'pg/mL',
  source: 'mock' as const,
  calibrationId: 'test',
};

function setup() {
  const store = new MemoryDocumentStore();
  const repo = new LutealineRepository(store, () => new Date('2026-10-12T09:00:00Z'));
  return { store, repo };
}

const profileInput = {
  displayName: 'Test',
  typicalCycleLength: 28,
  doseUnit: 'mg',
  preferredSampleType: 'saliva' as const,
  monitoringStartDate: '2026-09-01',
};

describe('LutealineRepository', () => {
  it('creates and updates the single patient profile', async () => {
    const { repo } = setup();
    const created = await repo.saveProfile(profileInput);
    const updated = await repo.saveProfile({ ...profileInput, displayName: 'Renamed' });
    expect(updated.id).toBe(created.id);
    expect((await repo.getProfile())!.displayName).toBe('Renamed');
  });

  it('rejects an implausible cycle length', async () => {
    const { repo } = setup();
    await expect(repo.saveProfile({ ...profileInput, typicalCycleLength: 5 })).rejects.toThrow();
  });

  it('logs period starts idempotently', async () => {
    const { repo } = setup();
    await repo.logPeriodStart('2026-10-01');
    await repo.logPeriodStart('2026-09-03');
    await repo.logPeriodStart('2026-10-01');
    expect(await repo.listPeriodStarts()).toEqual(['2026-09-03', '2026-10-01']);
    await repo.removePeriodStart('2026-10-01');
    expect(await repo.listPeriodStarts()).toEqual(['2026-09-03']);
  });

  it('keeps one questionnaire per day, replacing on resubmit', async () => {
    const { repo } = setup();
    const first = await repo.saveQuestionnaire('2026-10-12', answers(2));
    const second = await repo.saveQuestionnaire('2026-10-12', answers(4));
    expect(second.id).toBe(first.id);
    expect((await repo.getQuestionnaire('2026-10-12'))!.score.total).toBe(92);
  });

  it('refuses to save an incomplete questionnaire', async () => {
    const { repo } = setup();
    await expect(repo.saveQuestionnaire('2026-10-12', { o1: 3 })).rejects.toThrow('Missing answers');
  });

  const draft = (lutealDose = 30) => ({
    medicationName: 'Test',
    unit: 'mg',
    days: Array.from({ length: 28 }, (_, i) => ({ cycleDay: i + 1, amount: i >= 14 ? lutealDose : 20 })),
    periodLength: 5,
    adaptation: 'phaseAnchored' as const,
    doseBeyondPlan: 20,
  });

  it('keeps only one active dosing plan', async () => {
    const { repo } = setup();
    const first = await repo.saveDosingPlan({ ...draft(), validFrom: '2026-10-01' });
    const second = await repo.saveDosingPlan({ ...draft(40), validFrom: '2026-10-01' });
    expect((await repo.getActiveDosingPlan())!.id).toBe(second.id);
    const all = await repo.listDosingPlans();
    expect(all).toHaveLength(2);
    expect(all.find((p) => p.id === first.id)!.status).toBe('archived');
  });

  it('stores a physician plan as pending until the patient confirms it', async () => {
    const { repo } = setup();
    await repo.saveDosingPlan({ ...draft(), validFrom: '2026-10-01' });
    const remote = { ...draft(40), patientCode: 'LUT-AAAAA', version: 1, publishedAt: '2026-10-12T08:00:00.000Z' };

    const pending = (await repo.receiveRemotePlan(remote))!;
    expect(pending).toMatchObject({ status: 'pending', source: 'physician', remoteVersion: 1 });
    expect((await repo.getActiveDosingPlan())!.days[20]!.amount).toBe(30); // old plan still in use

    // Receiving the same publication again does nothing.
    expect(await repo.receiveRemotePlan(remote)).toBeNull();

    const active = await repo.acceptPendingPlan('2026-10-12');
    expect(active).toMatchObject({ id: pending.id, status: 'active', validFrom: '2026-10-12' });
    const statuses = (await repo.listDosingPlans()).map((p) => p.status).sort();
    expect(statuses).toEqual(['active', 'archived']);
    expect(await repo.getPendingPlan()).toBeNull();
  });

  it('replaces an unconfirmed plan with a newer one', async () => {
    const { repo } = setup();
    await repo.receiveRemotePlan({ ...draft(35), patientCode: 'X', version: 1, publishedAt: '2026-10-12T08:00:00.000Z' });
    await repo.receiveRemotePlan({ ...draft(40), patientCode: 'X', version: 2, publishedAt: '2026-10-12T09:00:00.000Z' });
    const pending = (await repo.listDosingPlans()).filter((p) => p.status === 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0]!.remoteVersion).toBe(2);
  });

  it('accepts a plan from a restarted server that counts versions from 1 again', async () => {
    const { repo } = setup();
    await repo.receiveRemotePlan({ ...draft(35), patientCode: 'X', version: 3, publishedAt: '2026-10-12T08:00:00.000Z' });
    const again = await repo.receiveRemotePlan({ ...draft(40), patientCode: 'X', version: 1, publishedAt: '2026-10-13T08:00:00.000Z' });
    expect(again).not.toBeNull();
  });

  it('normalizes plans stored by the first app version', () => {
    const { adaptation, periodLength, ...v1Fields } = draft(); // v1 plans had neither field
    const v1 = { ...v1Fields, id: 'old', createdAt: '', updatedAt: '', schemaVersion: 1, validFrom: '2026-10-01', active: true } as never;
    const plan = normalizePlan(v1);
    expect(plan).toMatchObject({ status: 'active', adaptation: 'fixedDays', periodLength: 5, source: 'local' });
    expect('active' in plan).toBe(false);
  });

  it('saves cycle adjustments per cycle', async () => {
    const { repo } = setup();
    await repo.saveCycleAdjustment('2026-10-01', { expectedLength: 33 });
    await repo.saveCycleAdjustment('2026-10-01', { periodLength: 7 });
    expect(await repo.listCycleAdjustments()).toMatchObject([{ cycleStart: '2026-10-01', expectedLength: 33, periodLength: 7 }]);
    await expect(repo.saveCycleAdjustment('2026-10-01', { periodLength: 30 })).rejects.toThrow('Period length');
  });

  it('combines everything into daily records', async () => {
    const { repo } = setup();
    await repo.saveProfile(profileInput);
    await repo.logPeriodStart('2026-10-01');
    await repo.addReading('2026-10-12', reading);
    await repo.saveQuestionnaire('2026-10-12', answers(3, { e7: true, e8: { selected: ['sleep'] } }));
    await repo.logMedication('2026-10-12', 20, 'mg');

    const data = (await repo.loadPatientData())!;
    const [day11, day12] = buildDailyRecords(data, '2026-10-11', '2026-10-12');

    expect(day11).toMatchObject({ progesterone: null, symptoms: null, medicationTaken: null });
    expect(day12).toMatchObject({
      programPhase: 'monitoring',
      cycle: { cycleDay: 12, phase: 'follicular' },
      progesterone: { value: 120, readingCount: 1 },
      symptoms: { total: 69 },
      medicationTaken: { amount: 20, unit: 'mg' },
      sideEffects: { present: true, selected: ['sleep'] },
      prescribed: { status: 'noPlan' },
    });
  });

  it('logging data works without a dosing plan', async () => {
    const { repo } = setup();
    await repo.saveProfile(profileInput);
    const status = getProgramStatus((await repo.loadPatientData())!, '2026-10-12');
    expect(status.phase).toBe('monitoring');
  });
});

describe('plan sync', () => {
  it('fetches a newly published plan as pending, once', async () => {
    const { repo } = setup();
    await repo.saveProfile({ ...profileInput, shareCode: 'LUT-AAAAA' });
    const server = new MemoryRemotePlanService(() => new Date('2026-10-12T10:00:00Z'));

    expect(await syncPlan(repo, server)).toEqual({ status: 'upToDate' });
    await server.publish('lut-aaaaa', {
      medicationName: 'Test',
      unit: 'mg',
      days: Array.from({ length: 28 }, (_, i) => ({ cycleDay: i + 1, amount: 25 })),
      periodLength: 5,
      adaptation: 'phaseAnchored',
      doseBeyondPlan: null,
      prescribedBy: 'Dr Test',
    });
    const first = await syncPlan(repo, server);
    expect(first.status).toBe('newPlan');
    expect((await repo.loadPatientData())!.pendingPlan).toMatchObject({ prescribedBy: 'Dr Test', status: 'pending' });
    expect(await syncPlan(repo, server)).toEqual({ status: 'upToDate' });
  });

  it('does nothing without a configured server or share code', async () => {
    const { repo } = setup();
    await repo.saveProfile(profileInput);
    expect(await syncPlan(repo, new MemoryRemotePlanService())).toEqual({ status: 'noShareCode' });
    expect(await syncPlan(repo, { configured: false } as never)).toEqual({ status: 'notConfigured' });
  });
});

describe('demo data', () => {
  const today = '2026-10-12';

  it('covers two monitoring cycles plus an active plan, leaving today unlogged', () => {
    const demo = generateDemoData({ today });
    expect(demo.periodStarts).toHaveLength(3);
    expect(demo.dosingPlan.isDemo).toBe(true);
    expect(demo.questionnaires.some((q) => q.date === today)).toBe(false);
    expect(demo.readings.every((r) => r.source === 'mock')).toBe(true);
  });

  it('is in treatment on demo day 20 with the luteal dose', async () => {
    const store = new MemoryDocumentStore();
    await seedDemoData(store, { today });
    const repo = new LutealineRepository(store);
    const data = (await repo.loadPatientData())!;

    const status = getProgramStatus(data, today);
    expect(status.phase).toBe('treatment');

    const [todayRecord] = buildDailyRecords(data, today, today);
    expect(todayRecord.cycle).toMatchObject({ cycleNumber: 3, cycleDay: 20, phase: 'luteal' });
    expect(todayRecord.prescribed).toMatchObject({ status: 'planned', amount: 40 });
  });

  it('shows worse symptoms in the luteal phase during monitoring and a positive correlation', async () => {
    const demo = generateDemoData({ today });
    const store = new MemoryDocumentStore();
    await seedDemoData(store, { today });
    const data = (await new LutealineRepository(store).loadPatientData())!;
    const monitoring = buildDailyRecords(
      data,
      demo.profile.monitoringStartDate,
      '2026-10-12',
    ).filter((r) => r.programPhase === 'monitoring');

    const phases = summarizeByPhase(monitoring);
    const luteal = phases.find((p) => p.phase === 'luteal')!;
    const follicular = phases.find((p) => p.phase === 'follicular')!;
    expect(luteal.meanProgesterone!).toBeGreaterThan(follicular.meanProgesterone!);
    expect(luteal.meanSymptomPercent!).toBeGreaterThan(follicular.meanSymptomPercent!);
    expect(progesteroneSymptomCorrelation(monitoring)!.r).toBeGreaterThan(0.4);
  });

  it('exports daily records as CSV', async () => {
    const store = new MemoryDocumentStore();
    await seedDemoData(store, { today });
    const data = (await new LutealineRepository(store).loadPatientData())!;
    const csv = dailyRecordsToCsv(buildDailyRecords(data, '2026-10-10', '2026-10-12'));
    const lines = csv.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0].startsWith('date,program_phase,cycle_number,cycle_day')).toBe(true);
    expect(lines[3]).toContain('2026-10-12,treatment,3,20,luteal');
  });
});
