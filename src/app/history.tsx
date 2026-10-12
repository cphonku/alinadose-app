import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { progesteroneSymptomCorrelation, summarizeByPhase, type DailyRecord } from '../domain/dailyRecords';
import { useApp } from '../state/AppContext';
import { useAppWidth } from '../ui/useAppWidth';
import { CycleRings } from '../ui/charts/CycleRings';
import { PhaseBars } from '../ui/charts/PhaseBars';
import { TimelineChart } from '../ui/charts/TimelineChart';
import { Body, Caption, Card, Eyebrow, Header, Screen, Segmented } from '../ui/components';
import { colors, fonts, series, spacing } from '../ui/theme';

type Range = 'cycle' | 'two' | 'all';

function strength(r: number): string {
  const a = Math.abs(r);
  if (a < 0.2) return 'no clear';
  if (a < 0.4) return 'a weak';
  if (a < 0.6) return 'a moderate';
  return 'a strong';
}

export default function History() {
  const { records } = useApp();
  const width = useAppWidth();
  const [range, setRange] = useState<Range>('all');
  const [ringMetric, setRingMetric] = useState<'symptoms' | 'progesterone'>('symptoms');
  const chartWidth = width - 40 - 38;

  const shown = useMemo(() => {
    const last = records[records.length - 1]?.cycle?.cycleNumber ?? 1;
    const minCycle = range === 'cycle' ? last : range === 'two' ? last - 1 : -Infinity;
    return records.filter((r) => (r.cycle?.cycleNumber ?? 0) >= minCycle);
  }, [records, range]);

  // Patterns are judged on monitoring days, before medication was adjusted.
  const monitoring = records.filter((r) => r.programPhase === 'monitoring');
  const treatment = records.filter((r) => r.programPhase === 'treatment');
  const basis: DailyRecord[] = monitoring.length >= 10 ? monitoring : records;
  const correlation = progesteroneSymptomCorrelation(basis);
  const phases = summarizeByPhase(basis);
  const unit = records.find((r) => r.progesterone)?.progesterone?.unit ?? '';
  const logged = records.filter((r) => r.symptoms || r.progesterone).length;

  const lutealBefore = summarizeByPhase(monitoring).find((p) => p.phase === 'luteal')?.meanSymptomPercent ?? null;
  const lutealAfter = summarizeByPhase(treatment).find((p) => p.phase === 'luteal')?.meanSymptomPercent ?? null;

  if (logged === 0) {
    return (
      <Screen>
        <Header title="Data history" />
        <Card>
          <Body>No data yet. Log your first test and questionnaire, and your charts will start to grow here.</Body>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Data history" subtitle={`${logged} days logged`} />

      {correlation && (
        <Card style={[styles.card, styles.insight]}>
          <Eyebrow style={{ color: colors.surface, opacity: 0.85 }}>Your pattern</Eyebrow>
          <Text style={styles.insightTitle}>
            {correlation.r > 0.2
              ? 'Your symptoms rise with progesterone'
              : correlation.r < -0.2
                ? 'Your symptoms fall as progesterone rises'
                : 'No clear link with progesterone yet'}
          </Text>
          <Text style={styles.insightBody}>
            Across {correlation.n} days{basis === monitoring ? ' of monitoring' : ''} there is {strength(correlation.r)} link
            (r = {correlation.r.toFixed(2)}). Your physician uses this to tailor your plan.
          </Text>
        </Card>
      )}

      {lutealBefore !== null && lutealAfter !== null && (
        <Card style={styles.card}>
          <Eyebrow>Luteal phase, before and after your plan</Eyebrow>
          <View style={styles.compare}>
            <View style={styles.compareCol}>
              <Text style={[styles.compareValue, { color: colors.inkSoft }]}>{lutealBefore.toFixed(0)}%</Text>
              <Caption>Monitoring</Caption>
            </View>
            <Ionicons name="arrow-forward" size={26} color={colors.inkSoft} />
            <View style={styles.compareCol}>
              <Text style={[styles.compareValue, { color: series.symptoms }]}>{lutealAfter.toFixed(0)}%</Text>
              <Caption>With plan</Caption>
            </View>
          </View>
          <Caption>Average symptom score on luteal days.</Caption>
        </Card>
      )}

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Hormones & symptoms</Text>
        </View>
        <Segmented
          options={[
            { value: 'cycle', label: 'This cycle' },
            { value: 'two', label: '2 cycles' },
            { value: 'all', label: 'All' },
          ]}
          value={range}
          onChange={setRange}
        />
        <View style={{ marginTop: spacing.md }}>
          <TimelineChart records={shown} width={chartWidth} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Cycle rings</Text>
        <Caption style={{ marginBottom: spacing.sm }}>
          Each ring is one cycle. Days line up, so repeating patterns form spokes.
        </Caption>
        <Segmented
          options={[
            { value: 'symptoms', label: 'Symptoms' },
            { value: 'progesterone', label: 'Progesterone' },
          ]}
          value={ringMetric}
          onChange={setRingMetric}
        />
        <View style={{ marginTop: spacing.md }}>
          <CycleRings records={records} size={Math.min(chartWidth, 340)} metric={ringMetric} />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>By cycle phase</Text>
        <Caption style={{ marginBottom: spacing.md }}>
          Averages{basis === monitoring ? ' during monitoring' : ''}: progesterone (teal) and symptoms (coral).
        </Caption>
        <PhaseBars summary={phases} unit={unit} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginBottom: spacing.xs },
  insight: { backgroundColor: colors.teal, borderColor: colors.teal, gap: spacing.xs },
  insightTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.surface },
  insightBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.surface, opacity: 0.92 },
  compare: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginVertical: spacing.md },
  compareCol: { alignItems: 'center' },
  compareValue: { fontFamily: fonts.display, fontSize: 36 },
});
