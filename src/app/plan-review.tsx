import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getCycleDay } from '../domain/cycle';
import { cycleContextFrom } from '../domain/dailyRecords';
import { comparePlans, expandPlanForCycle } from '../domain/dosing';
import { useApp } from '../state/AppContext';
import { Body, Button, Caption, Card, Disclaimer, Eyebrow, Header, Screen } from '../ui/components';
import { DosingDial } from '../ui/DosingDial';
import { formatDose } from '../ui/format';
import { colors, fonts, spacing } from '../ui/theme';
import { useAppWidth } from '../ui/useAppWidth';

function dayRange(from: number, to: number) {
  return from === to ? `Day ${from}` : `Days ${from}–${to}`;
}

/** Shows a plan the physician sent and lets the patient confirm it. */
export default function PlanReview() {
  const { data, today, acceptPendingPlan } = useApp();
  const width = useAppWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const plan = data?.pendingPlan;

  if (!data || !plan) {
    return (
      <Screen>
        <Header title="New plan" />
        <Body>There is no new plan to review.</Body>
      </Screen>
    );
  }

  const cycle = getCycleDay(today, cycleContextFrom(data));
  const days = cycle?.cycleLength ?? plan.days.length;
  const periodLength = cycle?.periodLength ?? plan.periodLength;
  const changes = comparePlans(data.dosingPlan, plan, days, periodLength);
  const fmt = (v: number | null) => (v === null ? '—' : formatDose(v, plan.unit));

  const confirm = async () => {
    setSaving(true);
    try {
      await acceptPendingPlan();
      router.replace('/dosing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Header title="New dosing plan" subtitle={`From ${plan.prescribedBy ?? 'your physician'}`} />
      <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
        <DosingDial
          size={Math.min(width - 40, 320)}
          days={days}
          selectedDay={Math.min(selected ?? cycle?.cycleDay ?? 1, days)}
          onSelectDay={setSelected}
          todayDay={cycle?.cycleDay ?? null}
          plan={expandPlanForCycle(plan, days, periodLength)}
          periodLength={periodLength}
          unit={plan.unit}
        />
      </View>

      <Card style={styles.card}>
        <Eyebrow>{data.dosingPlan ? 'What changes in your current cycle' : 'Your plan for this cycle'}</Eyebrow>
        {changes.length === 0 ? (
          <Body>The doses are the same as in your current plan.</Body>
        ) : (
          changes.map((c) => (
            <View key={c.fromDay} style={styles.change}>
              <Text style={styles.changeDays}>{dayRange(c.fromDay, c.toDay)}</Text>
              <Text style={styles.changeDose}>
                {data.dosingPlan ? `${fmt(c.before)} → ` : ''}
                <Text style={{ color: colors.petalDim }}>{fmt(c.after)}</Text>
              </Text>
            </View>
          ))
        )}
        <Caption>
          {plan.medicationName} · {plan.days.length}-day plan,{' '}
          {plan.adaptation === 'phaseAnchored' ? 'adapts to your cycle length' : 'fixed days'}
        </Caption>
      </Card>

      <Button title="I have read my new plan" icon="checkmark" onPress={confirm} loading={saving} />
      <Caption style={{ textAlign: 'center', marginTop: spacing.sm }}>
        The new plan applies from today. Questions? Contact your physician before you change your medication.
      </Caption>
      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.lg },
  change: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  changeDays: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkMid },
  changeDose: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
