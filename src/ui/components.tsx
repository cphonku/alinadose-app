import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow, spacing } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const content = padded ? [styles.padded, style] : style;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[content, styles.scrollContent]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/** Back button + title row used at the top of every inner screen. */
export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={12}
        style={styles.backButton}
      >
        <Ionicons name="chevron-back" size={22} color={colors.inkMid} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Title>{title}</Title>
        {subtitle ? <Caption>{subtitle}</Caption> : null}
      </View>
      {right}
    </View>
  );
}

export function Title({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.title, style]} />;
}

export function Heading({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.heading, style]} />;
}

export function Body({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.body, style]} />;
}

export function Caption({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.caption, style]} />;
}

/** Small uppercase label, echoing the wiki's mono eyebrow text. */
export function Eyebrow({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.eyebrow, style]} />;
}

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = variant === 'primary' ? colors.surface : colors.coralDim;
  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={disabled || loading}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function ProgressBar({ value, color = colors.coral }: { value: number; color?: string }) {
  return (
    <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/** − value + control for numbers like doses and cycle length. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  format = (v: number) => String(v),
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  label: string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        onPress={() => onChange(Math.max(min, value - step))}
        style={styles.stepperButton}
        hitSlop={8}
      >
        <Ionicons name="remove" size={22} color={colors.coralDim} />
      </Pressable>
      <Text style={styles.stepperValue} accessibilityLabel={`${label}: ${format(value)}`}>
        {format(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        onPress={() => onChange(Math.min(max, value + step))}
        style={styles.stepperButton}
        hitSlop={8}
      >
        <Ionicons name="add" size={22} color={colors.coralDim} />
      </Pressable>
    </View>
  );
}

/** Pill-shaped option group (single select). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            aria-selected={active}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Avatar({ name, size = 44, onPress }: { name: string; size?: number; onPress?: () => void }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      onPress={onPress}
      disabled={!onPress}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials || '?'}</Text>
    </Pressable>
  );
}

export function Disclaimer() {
  return (
    <Caption style={styles.disclaimer}>
      Lutealine shows the dosing plan your physician prescribed. It does not give medical advice. Never change your
      medication without talking to your physician.
    </Caption>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  padded: { paddingHorizontal: spacing.lg - 4, paddingTop: spacing.md },
  scrollContent: { paddingBottom: spacing.xl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.inkMid },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.inkSoft,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primary: { backgroundColor: colors.coral },
  secondary: { backgroundColor: colors.wheatSoft, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.wheat, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.wheatSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, minWidth: 90, textAlign: 'center' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.wheatSoft,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface, ...shadow },
  segmentText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSoft },
  segmentTextActive: { color: colors.ink },
  avatar: {
    backgroundColor: colors.petal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    ...shadow,
  },
  avatarText: { fontFamily: fonts.bodyBold, color: colors.surface },
  disclaimer: { textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.md },
});
