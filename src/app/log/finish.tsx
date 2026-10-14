import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cycleContextFrom } from '../../domain/dailyRecords';
import { getDoseForDate } from '../../domain/dosing';
import { IncompleteQuestionnaireError, scoreQuestionnaire } from '../../domain/scoring';
import { useApp, useServices } from '../../state/AppContext';
import { useLogDraft } from '../../state/LogDraft';
import { Body, Button, Caption, Card, Eyebrow, Header, Screen, Segmented, Stepper } from '../../ui/components';
import { formatDose } from '../../ui/format';
import { colors, fonts, series, spacing } from '../../ui/theme';

export default function Finish() {
  const { repository } = useServices();
  const { data, today, refresh } = useApp();
  const { answers, reading } = useLogDraft();
  const unit = data?.profile.doseUnit ?? 'mg';

  const dose = data ? getDoseForDate(today, data.dosingPlan, cycleContextFrom(data)) : null;
  const prescribed = dose && (dose.status === 'planned' || dose.status === 'beyondPlan') ? dose.amount : null;
  const loggedToday = data?.medicationLogs.find((m) => m.date === today)?.amount;
  const lastLogged = [...(data?.medicationLogs ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0]?.amount;
  const periodLoggedToday = data?.periodStarts.includes(today) ?? false;

  const [amount, setAmount] = useState(loggedToday ?? prescribed ?? lastLogged ?? 0);
  const [periodToday, setPeriodToday] = useState<'yes' | 'no'>(periodLoggedToday ? 'yes' : 'no');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await repository.saveQuestionnaire(today, answers);
      await repository.logMedication(today, amount, unit);
      if (periodToday === 'yes') await repository.logPeriodStart(today);
      else if (periodLoggedToday) await repository.removePeriodStart(today);
      await refresh();
      setDone(true);
    } catch (e) {
      setError(
        e instanceof IncompleteQuestionnaireError
          ? 'Some questions are not answered yet. Please go back and complete them.'
          : 'Saving failed. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    const score = scoreQuestionnaire(answers);
    return (
      <Screen>
        <View style={styles.doneHero}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={44} color={colors.surface} />
          </View>
          <Text style={styles.doneTitle}>All logged for today</Text>
          <Body style={{ textAlign: 'center' }}>Thank you. Every day you log makes your plan more personal.</Body>
        </View>
        <View style={styles.stats}>
          {reading && (
            <Card style={styles.stat}>
              <Eyebrow>Progesterone</Eyebrow>
              <Text style={[styles.statValue, { color: series.progesterone }]}>{reading.progesterone.toFixed(0)}</Text>
              <Caption>{reading.unit}</Caption>
            </Card>
          )}
          <Card style={styles.stat}>
            <Eyebrow>Symptoms</Eyebrow>
            <Text style={[styles.statValue, { color: series.symptoms }]}>{score.overall.toFixed(1)}</Text>
            <Caption>of 5</Caption>
          </Card>
          <Card style={styles.stat}>
            <Eyebrow>Medication</Eyebrow>
            <Text style={[styles.statValue, { color: series.medication }]}>{amount}</Text>
            <Caption>{unit}</Caption>
          </Card>
        </View>
        <Button title="See your history" icon="analytics-outline" onPress={() => router.navigate('/history')} />
        <Button title="Back to home" variant="ghost" onPress={() => router.navigate('/')} style={{ marginTop: spacing.xs }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Almost done" subtitle="Two quick things about today" />
      <Card style={styles.card}>
        <Eyebrow>ADHD medication taken today</Eyebrow>
        <Stepper label="Medication taken" value={amount} onChange={setAmount} step={5} format={(v) => `${v} ${unit}`} />
        {prescribed !== null && <Caption>Your plan for today: {formatDose(prescribed, unit)}</Caption>}
      </Card>
      <Card style={styles.card}>
        <Eyebrow>Did your period start today?</Eyebrow>
        <Segmented
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes, it started' },
          ]}
          value={periodToday}
          onChange={setPeriodToday}
        />
      </Card>
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Save today's log" icon="checkmark" onPress={save} loading={saving} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.sm },
  error: { fontFamily: fonts.bodyMedium, color: colors.danger, marginBottom: spacing.sm },
  doneHero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xl },
  check: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  doneTitle: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xs, gap: 2 },
  statValue: { fontFamily: fonts.display, fontSize: 28 },
});
