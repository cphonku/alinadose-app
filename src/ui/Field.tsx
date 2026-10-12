import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, spacing } from './theme';

export function Field({ label, ...props }: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.inkSoft} style={styles.input} accessibilityLabel={label} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkMid, marginBottom: 6 },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
});
