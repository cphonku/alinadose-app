import { StyleSheet, Text, View } from 'react-native';
import type { PhaseSummary } from '../../domain/dailyRecords';
import { colors, fonts, phaseColors, phaseLabels, series, spacing } from '../theme';

/** Average progesterone and symptom score per cycle phase, as paired bars. */
export function PhaseBars({ summary, unit }: { summary: PhaseSummary[]; unit: string }) {
  const maxProg = Math.max(1, ...summary.map((s) => s.meanProgesterone ?? 0));
  return (
    <View style={{ gap: spacing.md }}>
      {summary.map((s) => (
        <View key={s.phase}>
          <View style={styles.labelRow}>
            <View style={[styles.swatch, { backgroundColor: phaseColors[s.phase] }]} />
            <Text style={styles.phase}>{phaseLabels[s.phase]}</Text>
            <Text style={styles.days}>{s.days} days</Text>
          </View>
          <Bar
            value={(s.meanProgesterone ?? 0) / maxProg}
            color={series.progesterone}
            label={s.meanProgesterone !== null ? `${s.meanProgesterone.toFixed(0)} ${unit}` : '—'}
          />
          <Bar
            value={(s.meanSymptomPercent ?? 0) / 100}
            color={series.symptoms}
            label={s.meanSymptomPercent !== null ? `${s.meanSymptomPercent.toFixed(0)}%` : '—'}
          />
        </View>
      ))}
    </View>
  );
}

function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <View style={styles.barRow}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(2, value * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.value}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  phase: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, flex: 1 },
  days: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.wheatSoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  value: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkMid, width: 78, textAlign: 'right' },
});
