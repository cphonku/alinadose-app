import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { addDays } from '../domain/dates';
import type { SampleType } from '../domain/models';
import { useApp, useServices } from '../state/AppContext';
import { Body, Button, Caption, Card, Eyebrow, Screen, Segmented, Stepper, Title } from '../ui/components';
import { Field } from '../ui/Field';
import { formatDate } from '../ui/format';
import { spacing } from '../ui/theme';

export default function Onboarding() {
  const { repository } = useServices();
  const { user, today, refresh } = useApp();
  const [name, setName] = useState(user?.displayName ?? '');
  const [birthYear, setBirthYear] = useState('');
  const [cycleLength, setCycleLength] = useState(28);
  const [daysSincePeriod, setDaysSincePeriod] = useState(0);
  const [medication, setMedication] = useState('');
  const [sampleType, setSampleType] = useState<SampleType>('saliva');
  const [saving, setSaving] = useState(false);

  const lastPeriod = addDays(today, -daysSincePeriod);

  const save = async () => {
    setSaving(true);
    try {
      const year = Number.parseInt(birthYear, 10);
      await repository.logPeriodStart(lastPeriod);
      await repository.saveProfile({
        displayName: name.trim() || 'Patient',
        birthYear: Number.isFinite(year) ? year : undefined,
        typicalCycleLength: cycleLength,
        medicationName: medication.trim() || undefined,
        doseUnit: 'mg',
        preferredSampleType: sampleType,
        monitoringStartDate: today,
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Eyebrow>Getting started</Eyebrow>
      <Title style={{ marginTop: spacing.xs }}>A few things about you</Title>
      <Body style={styles.intro}>
        For the first one to two cycles you will log a test and a short questionnaire every day. Your physician then uses
        the data to make your personal dosing plan.
      </Body>

      <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" />
      <Field label="Birth year (optional)" value={birthYear} onChangeText={setBirthYear} keyboardType="number-pad" placeholder="e.g. 1998" maxLength={4} />
      <Field label="ADHD medication (optional)" value={medication} onChangeText={setMedication} placeholder="e.g. Methylphenidate" />

      <Card style={styles.card}>
        <Eyebrow>Typical cycle length</Eyebrow>
        <Stepper label="Cycle length" value={cycleLength} onChange={setCycleLength} min={18} max={45} format={(v) => `${v} days`} />
      </Card>

      <Card style={styles.card}>
        <Eyebrow>Your last period started</Eyebrow>
        <Stepper
          label="Days since last period"
          value={daysSincePeriod}
          onChange={setDaysSincePeriod}
          min={0}
          max={45}
          format={(v) => (v === 0 ? 'Today' : `${v} d ago`)}
        />
        <Caption>{formatDate(lastPeriod)}</Caption>
      </Card>

      <Card style={styles.card}>
        <Eyebrow>Test sample</Eyebrow>
        <Segmented
          options={[
            { value: 'saliva', label: 'Saliva' },
            { value: 'urine', label: 'Urine' },
          ]}
          value={sampleType}
          onChange={setSampleType}
        />
      </Card>

      <View style={{ marginTop: spacing.md }}>
        <Button title="Start tracking" onPress={save} loading={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: spacing.sm, marginBottom: spacing.lg },
  card: { marginBottom: spacing.md, gap: spacing.sm, alignItems: 'flex-start' },
});
