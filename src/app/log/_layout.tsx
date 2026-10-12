import { Stack } from 'expo-router';
import { LogDraftProvider } from '../../state/LogDraft';
import { colors } from '../../ui/theme';

export default function LogLayout() {
  return (
    <LogDraftProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </LogDraftProvider>
  );
}
