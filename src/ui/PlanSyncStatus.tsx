import { StyleSheet, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Button, Caption } from './components';
import { spacing } from './theme';

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Check for plan updates" button with the result of the last check. */
export function PlanSyncStatus() {
  const { planSync, checkForPlan, services } = useApp();
  const result = planSync.lastResult;

  let message: string;
  if (!services?.remotePlans.configured || result?.status === 'notConfigured') {
    message = 'Physician connection is not set up on this device.';
  } else if (result?.status === 'error') {
    message = `Could not reach your physician's plan service${planSync.lastChecked ? ` (tried ${timeOf(planSync.lastChecked)})` : ''}.`;
  } else if (result?.status === 'noShareCode') {
    message = 'No physician code yet. Find it in your profile.';
  } else if (planSync.lastChecked) {
    message = `${result?.status === 'newPlan' ? 'New plan received' : 'Up to date'} · checked ${timeOf(planSync.lastChecked)}`;
  } else {
    message = 'Your physician can send you an updated plan at any time.';
  }

  return (
    <View style={styles.wrap}>
      <Button
        title="Check for plan updates"
        variant="secondary"
        icon="refresh-outline"
        loading={planSync.checking}
        disabled={!services?.remotePlans.configured}
        onPress={() => {
          checkForPlan();
        }}
      />
      <Caption style={styles.caption}>{message}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, gap: spacing.xs },
  caption: { textAlign: 'center' },
});
