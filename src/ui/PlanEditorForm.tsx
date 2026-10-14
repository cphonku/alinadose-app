import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AGE_GROUP_LABELS,
  findMedication,
  INGREDIENTS,
  labelLimitFor,
  matchMedication,
  medicationsFor,
  OTHER_MEDICATION_ID,
  type AgeGroup,
  type Ingredient,
} from '../content/medications';
import { phaseForDay } from '../domain/cycle';
import {
  adjustDose,
  daysAboveLabelMax,
  formatDayRanges,
  InvalidDosingPlanError,
  MIN_PLAN_LENGTH,
  titrationJumps,
  validateDosingPlan,
  type DoseAdjustment,
} from '../domain/dosing';
import type { DosingPlanDraft, PlanAdaptation } from '../domain/models';
import { Button, Caption, Card, Eyebrow, Segmented, Stepper } from './components';
import { Field } from './Field';
import { colors, fonts, phaseColors, radius, spacing } from './theme';

type RangeMode = DoseAdjustment['kind'];

interface Props {
  /** Plan to start from; otherwise an empty plan of `defaultLength` days. */
  initial: DosingPlanDraft | null;
  defaultMedication?: string;
  defaultLength?: number;
  submitLabel: string;
  onSubmit(draft: DosingPlanDraft): Promise<void>;
}

const signed = (v: number, unit: string) => `${v > 0 ? '+' : ''}${v} ${unit}`;

/**
 * The physician's plan editor, used by the physician portal and the on-device
 * demo editor. Every dose is entered by a person; nothing is suggested. Doses
 * above the medication's label maximum are flagged and need a written reason.
 */
export function PlanEditorForm({ initial, defaultMedication = '', defaultLength = 28, submitLabel, onSubmit }: Props) {
  const startMed = findMedication(initial?.medicationId) ?? matchMedication(initial?.medicationName ?? defaultMedication);
  const [medicationId, setMedicationIdState] = useState(startMed.id);
  const [ageGroup, setAgeGroupState] = useState<AgeGroup>(initial?.ageGroup ?? 'adult');
  const [weightText, setWeightText] = useState('');
  const [otherName, setOtherName] = useState(
    startMed.id === OTHER_MEDICATION_ID ? (initial?.medicationName ?? defaultMedication) : '',
  );
  const [prescribedBy, setPrescribedBy] = useState(initial?.prescribedBy ?? '');
  const [doses, setDoses] = useState<number[]>(initial?.days.map((d) => d.amount) ?? Array(defaultLength).fill(0));
  const [periodLength, setPeriodLength] = useState(initial?.periodLength ?? 5);
  const [adaptation, setAdaptation] = useState<PlanAdaptation>(initial?.adaptation ?? 'phaseAnchored');
  const [beyond, setBeyond] = useState<number>(initial?.doseBeyondPlan ?? 0);
  const [reason, setReason] = useState(initial?.overLimitReason ?? '');
  const [range, setRange] = useState({ from: 1, to: Math.min(14, doses.length) });
  const [mode, setMode] = useState<RangeMode>('set');
  const [setMg, setSetMg] = useState(20);
  const [deltaMg, setDeltaMg] = useState(startMed.titration[initial?.ageGroup ?? 'adult'].maxStepMg ?? startMed.stepMg);
  const [pct, setPct] = useState(10);
  // Per-day + / − buttons: one dose step, or a percentage of that day's dose.
  const [dayMode, setDayMode] = useState<'step' | 'percent'>('step');
  const [dayPct, setDayPct] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const med = findMedication(medicationId)!;
  const weightKg = Number.parseFloat(weightText.replace(',', '.'));
  const limit = labelLimitFor(med, ageGroup, Number.isFinite(weightKg) && weightKg > 0 ? weightKg : null);
  const titration = med.titration[ageGroup];
  const limits = { stepMg: med.stepMg, maxDailyDoseMg: limit.maxMg };
  const max = limit.maxMg;
  const planDays = doses.map((amount, i) => ({ cycleDay: i + 1, amount }));
  const over = max === null ? [] : daysAboveLabelMax({ days: planDays, doseBeyondPlan: beyond > 0 ? beyond : null }, max);
  const offLabel = limit.notLicensed && doses.some((d) => d > 0);
  const needsReason = over.length > 0 || offLabel;
  const jumps = titration.maxStepMg === null ? [] : titrationJumps(initial?.days ?? null, planDays, titration.maxStepMg);

  // Changing the product or age group also resets the default "change by mg" to its titration step.
  const selectMedication = (id: string, age: AgeGroup = ageGroup) => {
    const m = findMedication(id)!;
    setMedicationIdState(m.id);
    setDeltaMg(m.titration[age].maxStepMg ?? m.stepMg);
  };
  const setAgeGroup = (age: AgeGroup) => {
    setAgeGroupState(age);
    selectMedication(medicationId, age);
  };
  const selectIngredient = (ingredient: Ingredient) => selectMedication(medicationsFor(ingredient)[0]!.id);
  const change: DoseAdjustment =
    mode === 'set' ? { kind: 'set', mg: setMg } : mode === 'absolute' ? { kind: 'absolute', mg: deltaMg } : { kind: 'percent', pct };

  const setLength = (n: number) => {
    setDoses((d) => (n > d.length ? [...d, ...Array(n - d.length).fill(d[d.length - 1] ?? 0)] : d.slice(0, n)));
    setRange((r) => ({ from: Math.min(r.from, n), to: Math.min(r.to, n) }));
  };
  const setDose = (index: number, value: number) => setDoses((d) => d.map((v, i) => (i === index ? value : v)));
  const inRange = (i: number) => i + 1 >= range.from && i + 1 <= range.to;
  const applyRange = () => setDoses((d) => d.map((v, i) => (inRange(i) ? adjustDose(v, change, limits).amount : v)));

  // Live preview of the range change: one line per distinct "before → after".
  const previewGroups = new Map<string, { before: number; exact: number; after: number; days: number; above: boolean }>();
  doses.forEach((v, i) => {
    if (!inRange(i)) return;
    const { amount, exact, aboveLabelMax } = adjustDose(v, change, limits);
    const key = `${v}->${amount}`;
    const g = previewGroups.get(key);
    if (g) g.days += 1;
    else previewGroups.set(key, { before: v, exact, after: amount, days: 1, above: aboveLabelMax });
  });
  const zeroDaysInRange = doses.some((v, i) => inRange(i) && v === 0);
  const pctChange = (before: number, after: number) =>
    before > 0 && after !== before ? `, ${after > before ? '+' : ''}${Math.round(((after - before) / before) * 100)} %` : '';

  const stepDay = (i: number, dose: number, direction: 1 | -1) =>
    setDose(
      i,
      adjustDose(
        dose,
        dayMode === 'percent' ? { kind: 'percent', pct: direction * dayPct } : { kind: 'absolute', mg: direction * med.stepMg },
        limits,
      ).amount,
    );
  const dayStepLabel = dayMode === 'percent' ? `${dayPct} %` : `${med.stepMg} mg`;

  const submit = async () => {
    setError(null);
    const medicationName = medicationId === OTHER_MEDICATION_ID ? otherName.trim() : med.name;
    if (!medicationName) return setError('Please enter the medication name.');
    const draft: DosingPlanDraft = {
      medicationName,
      medicationId,
      ageGroup,
      labelMaxDailyDose: max ?? undefined,
      notLicensedForAgeGroup: limit.notLicensed || undefined,
      unit: 'mg',
      days: doses.map((amount, i) => ({ cycleDay: i + 1, amount })),
      periodLength,
      adaptation,
      doseBeyondPlan: beyond > 0 ? beyond : null,
      prescribedBy: prescribedBy.trim() || undefined,
      overLimitReason: needsReason ? reason.trim() || undefined : undefined,
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
      <Card style={styles.card}>
        <Eyebrow>Patient age group</Eyebrow>
        <Segmented
          options={[
            { value: 'adult', label: 'Adult' },
            { value: 'youth', label: '6–17 years' },
          ]}
          value={ageGroup}
          onChange={setAgeGroup}
        />
      </Card>

      <Card style={styles.card}>
        <Eyebrow>Medication</Eyebrow>
        <View style={styles.chips}>
          {INGREDIENTS.map((ing) => {
            const active = ing.id === med.ingredient;
            return (
              <Pressable
                key={ing.id}
                accessibilityRole="radio"
                aria-selected={active}
                onPress={() => selectIngredient(ing.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{ing.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.medList} accessibilityRole="radiogroup">
          {medicationsFor(med.ingredient).map((m) => {
            const active = m.id === medicationId;
            const l = labelLimitFor(m, ageGroup);
            const badge = l.notLicensed
              ? 'not licensed'
              : l.maxMg !== null
                ? `max ${l.maxMg} mg`
                : m.max[ageGroup].kind === 'notChecked'
                  ? 'not checked'
                  : '';
            return (
              <Pressable
                key={m.id}
                accessibilityRole="radio"
                aria-selected={active}
                onPress={() => selectMedication(m.id)}
                style={[styles.medRow, active && styles.medRowActive]}
              >
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? colors.coral : colors.inkSoft} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{m.name}</Text>
                  {m.strengths ? <Caption>{m.strengths}</Caption> : null}
                </View>
                <Caption style={l.notLicensed ? { color: colors.danger } : undefined}>{badge}</Caption>
              </Pressable>
            );
          })}
        </View>
        {medicationId === OTHER_MEDICATION_ID && (
          <Field label="Medication name" value={otherName} onChangeText={setOtherName} placeholder="e.g. Bupropion" />
        )}
        <View style={styles.labelInfo}>
          <Text style={[styles.labelMax, limit.notLicensed && { color: colors.danger }]}>{limit.summary}</Text>
          {limit.note ? <Caption>{limit.note}</Caption> : null}
          {med.max[ageGroup].kind === 'perKg' && (
            <Field
              label="Patient weight in kg (optional, only used for this limit)"
              value={weightText}
              onChangeText={setWeightText}
              keyboardType="decimal-pad"
              placeholder="e.g. 64"
            />
          )}
          {med.id !== OTHER_MEDICATION_ID && (
            <View style={styles.facts}>
              <Fact label={`Start (${AGE_GROUP_LABELS[ageGroup]})`} value={med.start[ageGroup]} />
              <Fact label="Titration" value={titration.text} />
            </View>
          )}
          {med.notes ? <Caption>{med.notes}</Caption> : null}
          <View style={styles.labelMeta}>
            {!med.verified && med.id !== OTHER_MEDICATION_ID && <Text style={styles.unverified}>Not yet verified by the team</Text>}
            {med.source && (
              <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(med.source!.url)}>
                <Text style={styles.link}>{med.source.label}</Text>
              </Pressable>
            )}
            <Caption>Dose step {med.stepMg} mg</Caption>
          </View>
        </View>
      </Card>

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
        <Eyebrow>Change several days at once</Eyebrow>
        <View style={styles.rangeRow}>
          <Caption style={styles.rangeLabel}>From day</Caption>
          <Stepper label="From day" value={range.from} onChange={(from) => setRange((r) => ({ from, to: Math.max(r.to, from) }))} min={1} max={doses.length} />
        </View>
        <View style={styles.rangeRow}>
          <Caption style={styles.rangeLabel}>To day</Caption>
          <Stepper label="To day" value={range.to} onChange={(to) => setRange((r) => ({ to, from: Math.min(r.from, to) }))} min={1} max={doses.length} />
        </View>
        <Segmented
          options={[
            { value: 'set', label: 'Set to' },
            { value: 'absolute', label: 'Change mg' },
            { value: 'percent', label: 'Change %' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <View style={styles.rangeRow}>
          <Caption style={styles.rangeLabel}>{mode === 'set' ? 'Dose' : 'Change'}</Caption>
          {mode === 'set' && (
            <Stepper label="Range dose" value={setMg} onChange={setSetMg} step={med.stepMg} format={(v) => `${v} mg`} />
          )}
          {mode === 'absolute' && (
            <Stepper label="Change in mg" value={deltaMg} onChange={setDeltaMg} step={med.stepMg} min={-200} max={200} format={(v) => signed(v, 'mg')} />
          )}
          {mode === 'percent' && (
            <Stepper label="Change in percent" value={pct} onChange={setPct} step={5} min={-90} max={200} format={(v) => signed(v, '%')} />
          )}
        </View>
        <View style={styles.preview} accessibilityLiveRegion="polite">
          {[...previewGroups.values()].slice(0, 4).map((g) => (
            <Text key={`${g.before}-${g.after}`} style={[styles.previewText, g.above && styles.previewAbove]}>
              {g.days} {g.days === 1 ? 'day' : 'days'}: {g.before} → {g.exact !== g.after ? `${g.exact} (exact) → ` : ''}
              {g.after} mg{pctChange(g.before, g.after)}{g.above ? '  (above label max)' : ''}
            </Text>
          ))}
          {mode === 'percent' && (
            <Caption>
              Rounded {pct >= 0 ? 'up' : 'down'} to the {med.stepMg} mg dose step, so the dose always changes.
              {zeroDaysInRange ? " Days at 0 mg are not changed by a percentage; use 'Set to' first." : ''}
            </Caption>
          )}
        </View>
        <Button title={`Apply to days ${range.from}–${range.to}`} variant="secondary" onPress={applyRange} />
      </Card>

      <Card style={styles.card}>
        <Eyebrow>Dose per plan day</Eyebrow>
        <Caption>Buttons change each day by</Caption>
        <Segmented
          options={[
            { value: 'step', label: `One step (${med.stepMg} mg)` },
            { value: 'percent', label: 'Percent' },
          ]}
          value={dayMode}
          onChange={setDayMode}
        />
        {dayMode === 'percent' && (
          <View style={styles.rangeRow}>
            <Caption style={styles.rangeLabel}>Percent</Caption>
            <Stepper label="Per-day percent" value={dayPct} onChange={setDayPct} step={5} min={5} max={100} format={(v) => `${v} %`} />
          </View>
        )}
        {doses.map((dose, i) => {
          const day = i + 1;
          const color = day <= periodLength ? phaseColors.menstruation : phaseColors[phaseForDay(day, doses.length)];
          const above = max !== null && dose > max;
          return (
            <View key={i} style={styles.dayRow}>
              <View style={[styles.phaseBar, { backgroundColor: color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dayText}>Day {day}</Text>
                {above && (
                  <View style={styles.aboveTag}>
                    <Ionicons name="warning-outline" size={12} color={colors.danger} />
                    <Text style={styles.aboveText}>above label max</Text>
                  </View>
                )}
              </View>
              <Pressable accessibilityLabel={`Decrease day ${day} by ${dayStepLabel}`} onPress={() => stepDay(i, dose, -1)} hitSlop={6} style={styles.smallBtn}>
                <Ionicons name="remove" size={18} color={colors.coralDim} />
              </Pressable>
              <Text style={[styles.doseText, above && { color: colors.danger }]}>{dose} mg</Text>
              <Pressable accessibilityLabel={`Increase day ${day} by ${dayStepLabel}`} onPress={() => stepDay(i, dose, 1)} hitSlop={6} style={styles.smallBtn}>
                <Ionicons name="add" size={18} color={colors.coralDim} />
              </Pressable>
            </View>
          );
        })}
      </Card>

      <Card style={styles.card}>
        <Eyebrow>If the period is late</Eyebrow>
        <Stepper label="Dose for extra days" value={beyond} onChange={setBeyond} step={med.stepMg} format={(v) => (v === 0 ? 'Ask me' : `${v} mg`)} />
        <Caption>"Ask me" tells the patient to contact you on those days.</Caption>
      </Card>

      {jumps.length > 0 && (
        <Card style={[styles.card, styles.infoCard]}>
          <View style={styles.aboveTag}>
            <Ionicons name="trending-up-outline" size={16} color={colors.petalDim} />
            <Text style={[styles.aboveText, { fontSize: 14, color: colors.petalDim }]}>Bigger step than the usual titration</Text>
          </View>
          <Caption>
            {formatDayRanges(jumps)}: up by more than {titration.maxStepMg} mg compared with the current plan (label:{' '}
            {titration.text}). For information; saving is not blocked.
          </Caption>
        </Card>
      )}

      {needsReason && (
        <Card style={[styles.card, styles.warnCard]}>
          <View style={styles.aboveTag}>
            <Ionicons name="warning-outline" size={16} color={colors.danger} />
            <Text style={[styles.aboveText, { fontSize: 14 }]}>
              {offLabel ? `Not licensed for ${AGE_GROUP_LABELS[ageGroup]} (off-label)` : `Above the label maximum of ${max} mg`}
            </Text>
          </View>
          <Caption>
            {offLabel ? 'This product is outside its label for this age group.' : `${formatDayRanges(over)}.`} To save, give your
            reason (it is shown to the patient with the plan).
          </Caption>
          <Field
            label="Reason for prescribing outside the label"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Partial response at 60 mg, tolerated well; agreed with patient"
            multiline
          />
        </Card>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={submitLabel} onPress={submit} loading={saving} />
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkMid },
  chipTextActive: { color: colors.surface },
  facts: { gap: 4 },
  fact: { flexDirection: 'row', gap: spacing.sm },
  factLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft, width: 110 },
  factValue: { fontFamily: fonts.body, fontSize: 13, color: colors.ink, flex: 1 },
  infoCard: { borderColor: colors.petal + '66' },
  medList: { gap: 4 },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  medRowActive: { backgroundColor: colors.wheatSoft, borderColor: colors.border },
  medName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  labelInfo: { gap: 4, paddingTop: spacing.xs },
  labelMax: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  labelMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  unverified: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.coralDim },
  link: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.tealDim, textDecorationLine: 'underline' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rangeLabel: { width: 70 },
  preview: { backgroundColor: colors.wheatSoft, borderRadius: radius.sm, padding: spacing.sm, gap: 2, minHeight: 36 },
  previewText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkMid, fontVariant: ['tabular-nums'] },
  previewAbove: { color: colors.danger },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  phaseBar: { width: 4, height: 26, borderRadius: 2 },
  dayText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkMid },
  aboveTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  aboveText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.danger },
  smallBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.wheatSoft, alignItems: 'center', justifyContent: 'center' },
  doseText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, width: 60, textAlign: 'center' },
  warnCard: { borderColor: colors.danger },
  error: { fontFamily: fonts.bodyMedium, color: colors.danger, marginBottom: spacing.sm },
});
