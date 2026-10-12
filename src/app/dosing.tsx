import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getCycleDay } from '../domain/cycle';
import { getDoseForDate } from '../domain/dosing';
import { useApp } from '../state/AppContext';
import { useAppWidth } from '../ui/useAppWidth';
import { Body, Button, Caption, Card, Disclaimer, Eyebrow, Header, ProgressBar, Screen } from '../ui/components';
import { DosingDial } from '../ui/DosingDial';
import { formatDate, formatDose } from '../ui/format';
import { colors, fonts, spacing } from '../ui/theme';

export default function Dosing() {
  const { data, status, today } = useApp();
  const width = useAppWidth();
  const cycle = data ? getCycleDay(today, data.periodStarts, data.profile.typicalCycleLength) : null;
  const plan = status?.phase === 'treatment' ? status.plan : null;
  const days = plan ? plan.days.length : (cycle?.cycleLength ?? data?.profile.typicalCycleLength ?? 28);
  const todayDay = cycle?.cycleDay ?? null;
  const [selected, setSelected] = useState(Math.min(todayDay ?? 1, days));

  if (!data || !status) return null;
  const dose = getDoseForDate(today, data.dosingPlan, data.periodStarts, data.profile.typicalCycleLength);
  const unit = plan?.unit ?? data.profile.doseUnit;
  const dialSize = Math.min(width - 40, 360);

  const step = (delta: number) => setSelected((d) => ((d - 1 + delta + days) % days) + 1);

  return (
    <Screen>
      <Header
        title="Dosing plan"
        subtitle={plan ? `${plan.medicationName}${plan.prescribedBy ? ` · by ${plan.prescribedBy}` : ''}` : 'Monitoring phase'}
      />

      <View style={styles.dialWrap}>
        <DosingDial
          size={dialSize}
          days={days}
          selectedDay={selected}
          onSelectDay={setSelected}
          todayDay={todayDay}
          plan={plan?.days ?? null}
          unit={unit}
        />
        <View style={styles.stepRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => step(-1)} style={styles.stepBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.inkMid} />
          </Pressable>
          <Caption style={{ textAlign: 'center' }}>
            Turn the arrow to see any day{'\n'}● marks today
          </Caption>
          <Pressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => step(1)} style={styles.stepBtn} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={colors.inkMid} />
          </Pressable>
        </View>
      </View>

      {dose.status === 'planned' || dose.status === 'beyondPlan' ? (
        <Card style={styles.todayCard}>
          <Eyebrow style={{ color: colors.surface, opacity: 0.85 }}>Today · {formatDate(today)}</Eyebrow>
          <Text style={styles.todayText}>
            Day {dose.cycle.cycleDay}: {formatDose(dose.amount, dose.unit)}
          </Text>
          {dose.status === 'beyondPlan' && (
            <Caption style={{ color: colors.surface }}>
              Your cycle is longer than the plan. This is the dose your physician set for extra days.
            </Caption>
          )}
          {todayDay !== selected && (
            <Pressable onPress={() => todayDay && setSelected(Math.min(todayDay, days))}>
              <Text style={styles.jump}>Show today on the dial</Text>
            </Pressable>
          )}
        </Card>
      ) : dose.status === 'contactPhysician' ? (
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Day {dose.cycle.cycleDay} is not in your plan</Text>
          <Body>Your cycle is longer than your plan covers. Please contact your physician about today's dose.</Body>
        </Card>
      ) : (
        <Card style={styles.infoCard}>
          <Eyebrow>Monitoring</Eyebrow>
          <Text style={styles.infoTitle}>
            {status.phase === 'monitoring' && status.monitoringCycle
              ? `Cycle ${Math.min(status.monitoringCycle, status.targetCycles)} of ${status.targetCycles}`
              : 'Waiting for your first period'}
          </Text>
          {status.phase === 'monitoring' && status.monitoringCycle !== null && (
            <ProgressBar value={((status.monitoringCycle - 1) * days + (todayDay ?? 0)) / (status.targetCycles * days)} color={colors.petal} />
          )}
          <Body>
            Keep logging your test and questionnaire every day. After one to two cycles your physician will use your data to
            write a personal plan, and it will appear here.
          </Body>
        </Card>
      )}

      <Button
        title={plan ? 'Update plan (physician)' : 'Enter plan (physician)'}
        variant="secondary"
        icon="create-outline"
        onPress={() => router.push('/plan-editor')}
        style={{ marginTop: spacing.md }}
      />
      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  dialWrap: { alignItems: 'center', marginBottom: spacing.lg },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.wheatSoft },
  todayCard: { backgroundColor: colors.petal, borderColor: colors.petal, gap: spacing.xs },
  todayText: { fontFamily: fonts.display, fontSize: 30, color: colors.surface },
  jump: { fontFamily: fonts.bodyBold, color: colors.surface, textDecorationLine: 'underline', marginTop: spacing.xs },
  infoCard: { gap: spacing.sm },
  infoTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
});
