import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { phaseForDay } from '../domain/cycle';
import { InvalidDosingPlanError, MIN_PLAN_LENGTH, validateDosingPlan } from '../domain/dosing';
import type { DosingPlanDraft, PlanAdaptation } from '../domain/models';
import { Button, Caption, Card, Eyebrow, Segmented, Stepper } from './components';
import { Field } from './Field';
import { colors, fonts, phaseColors, spacing } from './theme';

const DOSE_STEP = 5;

interface Props {
  /** Plan to start from; otherwise an empty plan of `defaultLength` days. */
  initial: DosingPlanDraft | null;
  defaultMedication?: string;
  defaultLength?: number;
  submitLabel: string;
  onSubmit(draft: DosingPlanDraft): Promise<void>;
}

/**
 * The physician's plan editor, used by the physician portal and the on-device
 * demo editor. Every dose is entered by a person; nothing is suggested.
 */
export function PlanEditorForm({ initial, defaultMedication = '', defaultLength = 28, submitLabel, onSubmit }: Props) {
  const [medication, setMedication] = useState(initial?.medicationName ?? defaultMedication);
  const [prescribedBy, setPrescribedBy] = useState(initial?.prescribedBy ?? '');
  const [doses, setDoses] = useState<number[]>(initial?.days.map((d) => d.amount) ?? Array(defaultLength).fill(0));
  const [periodLength, setPeriodLength] = useState(initial?.periodLength ?? 5);
  const [adaptation, setAdaptation] = useState<PlanAdaptation>(initial?.adaptation ?? 'phaseAnchored');
  const [beyond, setBeyond] = useState<number>(initial?.doseBeyondPlan ?? 0);
  const [range, setRange] = useState({ from: 1, to: Math.min(14, doses.length), dose: 20 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setLength = (n: number) => {
    setDoses((d) => (n > d.length ? [...d, ...Array(n - d.length).fill(d[d.length - 1] ?? 0)] : d.slice(0, n)));
    setRange((r) => ({ ...r, from: Math.min(r.from, n), to: Math.min(r.to, n) }));
  };
  const setDose = (index: number, value: number) => setDoses((d) => d.map((v, i) => (i === index ? value : v)));
  const applyRange = () => setDoses((d) => d.map((v, i) => (i + 1 >= range.from && i + 1 <= range.to ? range.dose : v)));

  const submit = async () => {
    setError(null);
    if (!medication.trim()) return setError('Please enter the medication name.');
    const draft: DosingPlanDraft = {
      medicationName: medication.trim(),
      unit: 'mg',
      days: doses.map((amount, i) => ({ cycleDay: i + 1, amount })),
      periodLength,
      adaptation,
      doseBeyondPlan: beyond > 0 ? beyond : null,
      prescribedBy: prescribedBy.trim() || undefined,
    };
    try {
      validateDosingPlan(draft);
    } catch (e) {
      return setError(e instanceof InvalidDosingPlanError ? e.message : 'The plan is not valid.');
    }
    setSaving(true);
    try {
      await onSubmit(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saving failed.');
    } finally {
      setSaving(false);
    }
  };

  const lutealFrom = doses.length - 13;

  return (
    <View>
      <Field label="Medication" value={medication} onChangeText={setMedication} placeholder="e.g. Methylphenidate" />
      <Field label="Prescribed by" value={prescribedBy} onChangeText={setPrescribedBy} placeholder="Physician's name" />

      <Card style={styles.card}>
        <Eyebrow>Plan written for</Eyebrow>
        <View style={styles.rangeRow}>
          <Caption style={styles.rangeLabel}>Cycle</Caption>
          <Stepper label="Plan length" value={doses.length} onChange={setLength} min={MIN_PLAN_LENGTH} max={45} format={(v) => `${v} days`} />
        </View>
        <View style={styles.rangeRow}>
          <Caption style={styles.rangeLabel}>Period</Caption>
          <Stepper label="Plan period length" value={periodLength} onChange={setPeriodLength} min={1} max={10} format={(v) => `${v} days`} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Eyebrow>When the patient's cycle is longer or shorter</Eyebrow>
        <Segmented
          options={[
            { value: 'phaseAnchored', label: 'Follow the phases' },
            { value: 'fixedDays', label: 'Fixed days' },
          ]}
          value={adaptation}
          onChange={setAdaptation}
        />
        <Caption>
          {adaptation === 'phaseAnchored'
            ? `Days ${lutealFrom}–${doses.length} (luteal phase) stay lined up with the patient's next period; period and follicular days stretch or shrink to fit.`
            : 'Cycle day N always uses plan day N.'}
        </Caption>
      </Card>

      <Card style={styles.card}>
        <Eyebrow>Set several days at once</Eyebrow>
        <View style={styles.rangeRow}>
          <Caption style={styles.rangeLabel}>From day</Caption>
          <Stepper label="From day" value={range.from} onChange={(from) => setRange((r) => ({ ...r, from, to: Math.max(r.to, from) }))} min={1} max={doses.length} />
        </View>
        <View style={styles.rangeRow}>
          <Caption style={styles.rangeLabel}>To day</Caption>
          <Stepper label="To day" value={range.to} onChange={(to) => setRange((r) => ({ ...r, to, from: Math.min(r.from, to) }))} min={1} max={doses.length} />
        </View>
        <View style={styles.rangeRow}>
          <Caption style={styles.rangeLabel}>Dose</Caption>
          <Stepper label="Range dose" value={range.dose} onChange={(dose) => setRange((r) => ({ ...r, dose }))} step={DOSE_STEP} format={(v) => `${v} mg`} />
        </View>
        <Button title={`Apply to days ${range.from}–${range.to}`} variant="secondary" onPress={applyRange} />
      </Card>

      <Card style={styles.card}>
        <Eyebrow>Dose per plan day</Eyebrow>
        {doses.map((dose, i) => {
          const day = i + 1;
          const color = day <= periodLength ? phaseColors.menstruation : phaseColors[phaseForDay(day, doses.length)];
          return (
            <View key={i} style={styles.dayRow}>
              <View style={[styles.phaseBar, { backgroundColor: color }]} />
              <Text style={styles.dayText}>Day {day}</Text>
              <Pressable accessibilityLabel={`Decrease day ${day}`} onPress={() => setDose(i, Math.max(0, dose - DOSE_STEP))} hitSlop={6} style={styles.smallBtn}>
                <Ionicons name="remove" size={18} color={colors.coralDim} />
              </Pressable>
              <Text style={styles.doseText}>{dose} mg</Text>
              <Pressable accessibilityLabel={`Increase day ${day}`} onPress={() => setDose(i, dose + DOSE_STEP)} hitSlop={6} style={styles.smallBtn}>
                <Ionicons name="add" size={18} color={colors.coralDim} />
              </Pressable>
            </View>
          );
        })}
      </Card>

      <Card style={styles.card}>
        <Eyebrow>If the period is late</Eyebrow>
        <Stepper label="Dose for extra days" value={beyond} onChange={setBeyond} step={DOSE_STEP} format={(v) => (v === 0 ? 'Ask me' : `${v} mg`)} />
        <Caption>"Ask me" tells the patient to contact you on those days.</Caption>
      </Card>

      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={submitLabel} onPress={submit} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.sm },
  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rangeLabel: { width: 70 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  phaseBar: { width: 4, height: 26, borderRadius: 2 },
  dayText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkMid, flex: 1 },
  smallBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.wheatSoft, alignItems: 'center', justifyContent: 'center' },
  doseText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, width: 60, textAlign: 'center' },
  error: { fontFamily: fonts.bodyMedium, color: colors.danger, marginBottom: spacing.sm },
});
