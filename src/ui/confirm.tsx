import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { Body, Button } from './components';
import { colors, fonts, radius, shadow, spacing } from './theme';

interface Request {
  title: string;
  message: string;
  confirmLabel: string;
  resolve(ok: boolean): void;
}

let show: ((r: Request) => void) | null = null;

/**
 * Cross-platform yes/no confirmation. Native uses the system alert; web uses
 * an in-app dialog (rendered by <ConfirmHost/>), because `window.confirm` is
 * blocked in sandboxed frames such as the hosted preview.
 */
export function confirm(title: string, message: string, confirmLabel = 'OK'): Promise<boolean> {
  if (Platform.OS !== 'web') {
    return new Promise((resolve) =>
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ]),
    );
  }
  return new Promise((resolve) => {
    if (show) show({ title, message, confirmLabel, resolve });
    else resolve(false);
  });
}

/** Mount once near the root of the app (web only renders anything). */
export function ConfirmHost() {
  const [request, setRequest] = useState<Request | null>(null);

  useEffect(() => {
    show = setRequest;
    return () => {
      show = null;
    };
  }, []);

  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={() => close(false)}>
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityRole="alert">
          <Text style={styles.title}>{request?.title}</Text>
          <Body>{request?.message}</Body>
          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={() => close(false)} style={{ flex: 1 }} />
            <Button title={request?.confirmLabel ?? 'OK'} onPress={() => close(true)} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(33, 16, 10, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});
