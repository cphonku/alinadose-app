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
import { MemoryDocumentStore } from '../DocumentStore';
import { LutealineRepository } from '../LutealineRepository';

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

  it('keeps only one active dosing plan', async () => {
    const { repo } = setup();
    const planInput = {
      medicationName: 'Test',
      unit: 'mg',
      days: [{ cycleDay: 1, amount: 10 }],
      doseBeyondPlan: 10,
      validFrom: '2026-10-01',
    };
    const first = await repo.saveDosingPlan(planInput);
    const second = await repo.saveDosingPlan({ ...planInput, days: [{ cycleDay: 1, amount: 20 }] });
    expect((await repo.getActiveDosingPlan())!.id).toBe(second.id);
    const all = await repo.listDosingPlans();
    expect(all).toHaveLength(2);
    expect(all.find((p) => p.id === first.id)!.active).toBe(false);
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
