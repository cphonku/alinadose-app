import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { newShareCode } from '../data/ids';
import { addDays } from '../domain/dates';
import { dailyRecordsToCsv } from '../domain/export';
import { useApp, useServices } from '../state/AppContext';
import { Avatar, Button, Caption, Card, Disclaimer, Eyebrow, Header, Screen, Segmented, Stepper } from '../ui/components';
import { confirm } from '../ui/confirm';
import { formatDate } from '../ui/format';
import { colors, fonts, spacing } from '../ui/theme';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function Profile() {
  const { repository } = useServices();
  const { data, user, status, records, today, refresh, signOut, startDemo, resetEverything } = useApp();
  const [daysAgo, setDaysAgo] = useState(0);
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const { profile } = data;

  const updateProfile = async (changes: Parameters<typeof repository.updateProfile>[0]) => {
    await repository.updateProfile(changes);
    await refresh();
  };

  const logPeriod = async () => {
    await repository.logPeriodStart(addDays(today, -daysAgo));
    setDaysAgo(0);
    await refresh();
  };

  const removePeriod = async (date: string) => {
    if (await confirm('Remove period start?', formatDate(date), 'Remove')) {
      await repository.removePeriodStart(date);
      await refresh();
    }
  };

  const exportCsv = () => Share.share({ title: 'Lutealine data', message: dailyRecordsToCsv(records) });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Profile" />
      <View style={styles.identity}>
        <Avatar name={profile.displayName} size={72} />
        <View>
          <Text style={styles.name}>{profile.displayName}</Text>
          <Caption>{user?.email}</Caption>
        </View>
      </View>

      <Card style={styles.card}>
        <Eyebrow>About you</Eyebrow>
        {profile.birthYear ? <Row label="Birth year" value={String(profile.birthYear)} /> : null}
        <Row label="Medication" value={profile.medicationName ?? '—'} />
        <Row label="Tracking since" value={formatDate(profile.monitoringStartDate)} />
        <Row
          label="Phase"
          value={
            status?.phase === 'treatment'
              ? 'Treatment plan active'
              : `Monitoring${status?.phase === 'monitoring' && status.monitoringCycle ? `, cycle ${status.monitoringCycle}` : ''}`
          }
        />
        <Text style={styles.subLabel}>Typical cycle length</Text>
        <Stepper
          label="Typical cycle length"
          value={profile.typicalCycleLength}
          onChange={(v) => updateProfile({ typicalCycleLength: v })}
          min={18}
          max={45}
          format={(v) => `${v} days`}
        />
        <Text style={styles.subLabel}>Test sample</Text>
        <Segmented
          options={[
            { value: 'saliva', label: 'Saliva' },
            { value: 'urine', label: 'Urine' },
          ]}
          value={profile.preferredSampleType}
          onChange={(v) => updateProfile({ preferredSampleType: v })}
        />
      </Card>

      <Card style={styles.card}>
        <Eyebrow>Period starts</Eyebrow>
        {[...data.periodStarts].reverse().slice(0, 6).map((d) => (
          <View key={d} style={styles.periodRow}>
            <Ionicons name="water" size={14} color={colors.coral} />
            <Text style={[styles.rowValue, { flex: 1 }]}>{formatDate(d)}</Text>
            <Pressable accessibilityLabel={`Remove ${formatDate(d)}`} onPress={() => removePeriod(d)} hitSlop={8}>
              <Ionicons name="close-circle-outline" size={20} color={colors.inkSoft} />
            </Pressable>
          </View>
        ))}
        <Text style={styles.subLabel}>Add a period start</Text>
        <Stepper label="Days ago" value={daysAgo} onChange={setDaysAgo} min={0} max={60} format={(v) => (v === 0 ? 'Today' : `${v} d ago`)} />
        <Button title={`Add ${formatDate(addDays(today, -daysAgo))}`} variant="secondary" icon="add" onPress={logPeriod} />
      </Card>

      <Card style={styles.card}>
        <Eyebrow>Your data</Eyebrow>
        <Caption>Everything is stored on this phone. Export it to share with your physician.</Caption>
        <Button title="Export as CSV" variant="secondary" icon="share-outline" onPress={exportCsv} />
      </Card>

      <Card style={styles.card}>
        <Eyebrow>Your physician code</Eyebrow>
        {profile.shareCode ? (
          <Text style={styles.code} selectable accessibilityLabel={`Physician code ${profile.shareCode.split('').join(' ')}`}>
            {profile.shareCode}
          </Text>
        ) : (
          <Button title="Create a code" variant="secondary" onPress={() => repository.updateProfile({ shareCode: newShareCode() }).then(refresh)} />
        )}
        <Caption>
          Give this code to your physician so they can send your dosing plan to this app. New plans always wait for your
          confirmation.
        </Caption>
      </Card>

      <Card style={styles.card}>
        <Eyebrow>Demo</Eyebrow>
        <Caption>Replaces your data with two simulated monitoring cycles and an example plan.</Caption>
        <Button
          title="Load demo data"
          variant="secondary"
          icon="sparkles-outline"
          loading={busy}
          onPress={() => run(async () => {
            if (await confirm('Load demo data?', 'This replaces all data and the account on this device.', 'Load')) await startDemo();
          })}
        />
        <Button title="Enter plan on this device" variant="secondary" icon="create-outline" onPress={() => router.push('/plan-editor')} />
        <Button
          title="Delete all data"
          variant="ghost"
          onPress={() => run(async () => {
            if (await confirm('Delete everything?', 'All data and the account on this device will be deleted.', 'Delete')) await resetEverything();
          })}
        />
      </Card>

      <Button title="Sign out" variant="ghost" icon="log-out-outline" onPress={signOut} />
      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  name: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  card: { marginBottom: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
  rowValue: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  subLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkMid, marginTop: spacing.sm },
  code: { fontFamily: fonts.display, fontSize: 30, letterSpacing: 2, color: colors.petalDim },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
});
