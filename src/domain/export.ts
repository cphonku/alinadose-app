import type { DailyRecord } from './dailyRecords';

const COLUMNS = [
  'date',
  'program_phase',
  'cycle_number',
  'cycle_day',
  'cycle_phase',
  'progesterone',
  'progesterone_unit',
  'sample_type',
  'reporter_signal',
  'symptom_total',
  'symptom_percent',
  'attention',
  'hyperactivity',
  'emotional',
  'medication_effect',
  'side_effects',
  'medication_taken',
  'medication_prescribed',
  'dose_unit',
] as const;

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per day; suitable for the physician or for research analysis. */
export function dailyRecordsToCsv(records: DailyRecord[]): string {
  const rows = records.map((r) => {
    const section = (id: string) => r.symptoms?.sections.find((s) => s.section === id)?.sum;
    const prescribed =
      r.prescribed.status === 'planned' || r.prescribed.status === 'beyondPlan' ? r.prescribed : null;
    const sideEffects = r.sideEffects?.present
      ? [...r.sideEffects.selected, r.sideEffects.otherText].filter(Boolean).join(';')
      : r.sideEffects
        ? 'none'
        : '';
    return [
      r.date,
      r.programPhase,
      r.cycle?.cycleNumber,
      r.cycle?.cycleDay,
      r.cycle?.phase,
      r.progesterone?.value,
      r.progesterone?.unit,
      r.progesterone?.sampleType,
      r.progesterone?.reporterSignal,
      r.symptoms?.total,
      r.symptoms?.totalPercent,
      section('attention'),
      section('hyperactivity'),
      section('emotional'),
      r.medicationEffect,
      sideEffects,
      r.medicationTaken?.amount,
      prescribed?.amount,
      r.medicationTaken?.unit ?? prescribed?.unit,
    ]
      .map(cell)
      .join(',');
  });
  return [COLUMNS.join(','), ...rows].join('\n');
}
