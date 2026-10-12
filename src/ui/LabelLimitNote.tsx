import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { daysAboveLabelMax } from '../domain/dosing';
import type { DosingPlan } from '../domain/models';
import { Body, Card } from './components';
import { colors, fonts, spacing } from './theme';

/**
 * Tells the patient when the physician prescribed outside the product label
 * (above its maximum, or for an age group it is not licensed for), with the
 * physician's reason.
 */
export function LabelLimitNote({ plan }: { plan: DosingPlan }) {
  const max = plan.labelMaxDailyDose;
  const above = max !== undefined && daysAboveLabelMax(plan, max).length > 0;
  const offLabel = !!plan.notLicensedForAgeGroup;
  if (!above && !offLabel) return null;

  const what = offLabel
    ? "This medication's product label does not cover your age group, so your physician prescribes it off-label."
    : `Some doses in this plan are above the product label's usual maximum of ${max} ${plan.unit} per day.`;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="information-circle-outline" size={18} color={colors.petalDim} />
        <Text style={styles.title}>{offLabel ? 'Prescribed outside the label' : 'Above the usual label maximum'}</Text>
      </View>
      <Body>
        {what}
        {plan.overLimitReason ? ` Your physician's note: "${plan.overLimitReason}"` : ''}
      </Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs, marginBottom: spacing.md, borderColor: colors.petal + '55' },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.petalDim },
});
