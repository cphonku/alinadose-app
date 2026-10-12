import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getCycleDay } from '../domain/cycle';
import { cycleContextFrom } from '../domain/dailyRecords';
import { addDays } from '../domain/dates';
import { expandPlanForCycle, getDoseForDate } from '../domain/dosing';
import { useApp, useServices } from '../state/AppContext';
import { Body, Button, Caption, Card, Disclaimer, Eyebrow, Header, ProgressBar, Screen, Stepper } from '../ui/components';
import { DosingDial } from '../ui/DosingDial';
import { LabelLimitNote } from '../ui/LabelLimitNote';
import { formatDate, formatDose } from '../ui/format';
import { PlanSyncStatus } from '../ui/PlanSyncStatus';
import { colors, fonts, radius, spacing } from '../ui/theme';
import { useAppWidth } from '../ui/useAppWidth';

export default function Dosing() {
  const { repository } = useServices();
  const { data, status, today, refresh } = useApp();
  const width = useAppWidth();
  const [selected, setSelected] = useState<number | null>(null);
  if (!data || !status) return null;

  const ctx = cycleContextFrom(data);
  const cycle = getCycleDay(today, ctx);
  const plan = status.phase === 'treatment' ? status.plan : null;
  const days = cycle?.cycleLength ?? data.profile.typicalCycleLength;
  const periodLength = cycle?.periodLength ?? data.profile.typicalPeriodLength ?? 5;
  const todayDay = cycle?.cycleDay ?? null;
  const selectedDay = Math.min(selected ?? todayDay ?? 1, days);
  const expanded = plan ? expandPlanForCycle(plan, days, periodLength) : null;
  const dose = getDoseForDate(today, data.dosingPlan, ctx);
  const unit = plan?.unit ?? data.profile.doseUnit;
  const dialSize = Math.min(width - 40, 360);

  const step = (delta: number) => setSelected(((selectedDay - 1 + delta + days) % days) + 1);

  const setCycleLength = async (expectedLength: number) => {
    if (!cycle) return;
    await repository.saveCycleAdjustment(cycle.cycleStart, { expectedLength });
    await refresh();
  };
  const setPeriodLength = async (length: number) => {
    if (!cycle) return;
    await repository.saveCycleAdjustment(cycle.cycleStart, { periodLength: length });
    await repository.updateProfile({ typicalPeriodLength: length });
    await refresh();
  };

  const adapted =
    plan && plan.adaptation === 'phaseAnchored' && (plan.days.length !== days || plan.periodLength !== periodLength);

  return (
    <Screen>
      <Header
        title="Dosing plan"
        subtitle={plan ? `${plan.medicationName}${plan.prescribedBy ? ` · by ${plan.prescribedBy}` : ''}` : 'Monitoring phase'}
      />

      {data.pendingPlan && (
        <Card onPress={() => router.push('/plan-review')} style={styles.pending} accessibilityLabel="Review your new plan">
          <Ionicons name="mail-unread-outline" size={22} color={colors.surface} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingTitle}>New plan from {data.pendingPlan.prescribedBy ?? 'your physician'}</Text>
            <Caption style={{ color: colors.surface }}>Tap to review and confirm</Caption>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.surface} />
        </Card>
      )}

      <View style={styles.dialWrap}>
        <DosingDial
          size={dialSize}
          days={days}
          selectedDay={selectedDay}
          onSelectDay={setSelected}
          todayDay={todayDay}
          plan={expanded}
          periodLength={periodLength}
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
        {adapted && (
          <Caption style={styles.adapted}>
            Your physician's {plan.days.length}-day plan is adapted to your {days}-day cycle ({periodLength}-day period). The
            luteal-phase doses stay lined up with your next period.
          </Caption>
        )}
      </View>

      {dose.status === 'planned' || dose.status === 'beyondPlan' ? (
        <Card style={styles.todayCard}>
          <Eyebrow style={{ color: colors.surface, opacity: 0.85 }}>Today · {formatDate(today)}</Eyebrow>
          <Text style={styles.todayText}>
            Day {dose.cycle.cycleDay}: {formatDose(dose.amount, dose.unit)}
          </Text>
          {dose.status === 'beyondPlan' && (
            <Caption style={{ color: colors.surface }}>
              Your period is later than expected. This is the dose your physician set for extra days. If your cycle is
              longer this time, update its length below.
            </Caption>
          )}
          {todayDay !== selectedDay && todayDay !== null && todayDay <= days && (
            <Pressable onPress={() => setSelected(todayDay)}>
              <Text style={styles.jump}>Show today on the dial</Text>
            </Pressable>
          )}
        </Card>
      ) : dose.status === 'contactPhysician' ? (
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Your period is later than expected</Text>
          <Body>
            Your plan does not cover day {dose.cycle.cycleDay}. If your cycle is longer this time, update its length below;
            otherwise contact your physician about today's dose.
          </Body>
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

      {cycle && (
        <Card style={styles.cycleCard}>
          <Eyebrow>Your cycle</Eyebrow>
          <Caption>If this cycle is longer or shorter than usual, adjust it here and your plan follows.</Caption>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>This cycle</Text>
              <Caption>
                {cycle.lengthSource === 'adjusted' ? 'Set by you' : 'Estimated from past cycles'} · next period{' '}
                {formatDate(addDays(cycle.cycleStart, cycle.cycleLength))}
              </Caption>
            </View>
            <Stepper label="Cycle length" value={cycle.cycleLength} onChange={setCycleLength} min={18} max={45} format={(v) => `${v} d`} />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Period</Text>
              <Caption>Bleeding days</Caption>
            </View>
            <Stepper label="Period length" value={periodLength} onChange={setPeriodLength} min={1} max={10} format={(v) => `${v} d`} />
          </View>
        </Card>
      )}

      {plan && <LabelLimitNote plan={plan} />}
      <PlanSyncStatus />
      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pending: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.coral, borderColor: colors.coral, marginBottom: spacing.md },
  pendingTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.surface },
  dialWrap: { alignItems: 'center', marginBottom: spacing.lg },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.wheatSoft },
  adapted: {
    textAlign: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.petal + '14',
    color: colors.petalDim,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  todayCard: { backgroundColor: colors.petal, borderColor: colors.petal, gap: spacing.xs },
  todayText: { fontFamily: fonts.display, fontSize: 30, color: colors.surface },
  jump: { fontFamily: fonts.bodyBold, color: colors.surface, textDecorationLine: 'underline', marginTop: spacing.xs },
  infoCard: { gap: spacing.sm },
  infoTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  cycleCard: { marginTop: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  rowLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
