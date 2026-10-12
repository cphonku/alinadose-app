import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { phaseForDay } from '../domain/cycle';
import { useApp, useServices } from '../state/AppContext';
import { Body, Button, Caption, Card, Eyebrow, Header, Screen, Stepper } from '../ui/components';
import { Field } from '../ui/Field';
import { colors, fonts, phaseColors, spacing } from '../ui/theme';

const DOSE_STEP = 5;

/**
 * Where the physician's plan is entered. Every dose is typed in by a person;
 * the app does not suggest or calculate doses.
 */
export default function PlanEditor() {
  const { repository } = useServices();
  const { data, today, refresh } = useApp();
  const existing = data?.dosingPlan;
  const typical = data?.profile.typicalCycleLength ?? 28;

  const [medication, setMedication] = useState(existing?.medicationName ?? data?.profile.medicationName ?? '');
  const [prescribedBy, setPrescribedBy] = useState(existing?.prescribedBy ?? '');
  const [doses, setDoses] = useState<number[]>(existing?.days.map((d) => d.amount) ?? Array(typical).fill(0));
  const [beyond, setBeyond] = useState<number>(existing?.doseBeyondPlan ?? 0);
  const [range, setRange] = useState({ from: 1, to: Math.min(14, doses.length), dose: 20 });
  const [saving, setSaving] = useState(false);

  const setLength = (n: number) => {
    setDoses((d) => (n > d.length ? [...d, ...Array(n - d.length).fill(d[d.length - 1] ?? 0)] : d.slice(0, n)));
    setRange((r) => ({ ...r, from: Math.min(r.from, n), to: Math.min(r.to, n) }));
  };
  const setDose = (index: number, value: number) => setDoses((d) => d.map((v, i) => (i === index ? value : v)));
  const applyRange = () =>
    setDoses((d) => d.map((v, i) => (i + 1 >= range.from && i + 1 <= range.to ? range.dose : v)));

  const save = async () => {
    if (!medication.trim()) {
      const msg = 'Please enter the medication name.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Missing information', msg);
      return;
    }
    setSaving(true);
    try {
      await repository.saveDosingPlan({
        medicationName: medication.trim(),
        unit: 'mg',
        days: doses.map((amount, i) => ({ cycleDay: i + 1, amount })),
        doseBeyondPlan: beyond > 0 ? beyond : null,
        prescribedBy: prescribedBy.trim() || undefined,
        validFrom: today,
      });
      await refresh();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header title="Physician's plan" subtitle="To be filled in together with your physician" />
      <Field label="Medication" value={medication} onChangeText={setMedication} placeholder="e.g. Methylphenidate" />
      <Field label="Prescribed by" value={prescribedBy} onChangeText={setPrescribedBy} placeholder="Physician's name" />

      <Card style={styles.card}>
        <Eyebrow>Plan length</Eyebrow>
        <Stepper label="Plan length" value={doses.length} onChange={setLength} min={18} max={45} format={(v) => `${v} days`} />
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
        <Eyebrow>Dose per cycle day</Eyebrow>
        {doses.map((dose, i) => {
          const phase = phaseForDay(i + 1, doses.length);
          return (
            <View key={i} style={styles.dayRow}>
              <View style={[styles.phaseBar, { backgroundColor: i < 5 ? phaseColors.menstruation : phaseColors[phase] }]} />
              <Text style={styles.dayText}>Day {i + 1}</Text>
              <Pressable accessibilityLabel={`Decrease day ${i + 1}`} onPress={() => setDose(i, Math.max(0, dose - DOSE_STEP))} hitSlop={6} style={styles.smallBtn}>
                <Ionicons name="remove" size={18} color={colors.coralDim} />
              </Pressable>
              <Text style={styles.doseText}>{dose} mg</Text>
              <Pressable accessibilityLabel={`Increase day ${i + 1}`} onPress={() => setDose(i, dose + DOSE_STEP)} hitSlop={6} style={styles.smallBtn}>
                <Ionicons name="add" size={18} color={colors.coralDim} />
              </Pressable>
            </View>
          );
        })}
      </Card>

      <Card style={styles.card}>
        <Eyebrow>If the cycle is longer than the plan</Eyebrow>
        <Stepper label="Dose for extra days" value={beyond} onChange={setBeyond} step={DOSE_STEP} format={(v) => (v === 0 ? 'Ask me' : `${v} mg`)} />
        <Caption>"Ask me" tells the patient to contact you on those days.</Caption>
      </Card>

      <Body style={{ marginBottom: spacing.md }}>
        The plan applies from today, by cycle day. Saving replaces the previous plan, which is kept in the history.
      </Body>
      <Button title="Save plan" onPress={save} loading={saving} />
    </Screen>
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
});
