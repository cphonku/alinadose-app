import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { phaseForDay } from '../../domain/cycle';
import type { DailyRecord } from '../../domain/dailyRecords';
import { colors, fonts, phaseColors, series, spacing } from '../theme';
import { interpolateColor, polar, ringSegment } from './svgHelpers';

const HEAT = [colors.wheatSoft, colors.sand, colors.coral, colors.coralDim] as const;

interface Props {
  records: DailyRecord[];
  size: number;
  /** Which value colours the segments. */
  metric: 'symptoms' | 'progesterone';
}

/**
 * Every cycle is one ring (oldest inside), every day one segment at the same
 * angle. Patterns that repeat on the same cycle days line up as "spokes".
 */
export function CycleRings({ records, size, metric }: Props) {
  const cycles = new Map<number, DailyRecord[]>();
  for (const r of records) {
    if (!r.cycle) continue;
    cycles.set(r.cycle.cycleNumber, [...(cycles.get(r.cycle.cycleNumber) ?? []), r]);
  }
  const numbers = [...cycles.keys()].sort((a, b) => a - b);
  if (numbers.length === 0) return null;

  const maxDay = Math.max(28, ...records.map((r) => r.cycle?.cycleLength ?? 0), ...records.map((r) => r.cycle?.cycleDay ?? 0));
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 22;
  const inner = size * 0.17;
  const phaseRing = 8;
  const ringW = (outer - inner - phaseRing - 6) / numbers.length;
  const step = (2 * Math.PI) / maxDay;
  const a = (day: number) => -Math.PI / 2 + (day - 1) * step;
  const maxProg = Math.max(1, ...records.map((r) => r.progesterone?.value ?? 0));

  const valueOf = (r: DailyRecord): number | null =>
    metric === 'symptoms'
      ? r.symptoms
        ? r.symptoms.overallPercent / 100
        : null
      : r.progesterone
        ? r.progesterone.value / maxProg
        : null;
  const stops = metric === 'symptoms' ? HEAT : ([colors.wheatSoft, '#8FD0C9', series.progesterone, colors.tealDim] as const);

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* Reference ring: phases of a typical cycle */}
        {Array.from({ length: maxDay }, (_, i) => {
          const day = i + 1;
          const color = day <= 5 ? phaseColors.menstruation : phaseColors[phaseForDay(day, maxDay)];
          return <Path key={`p${day}`} d={ringSegment(cx, cy, outer - phaseRing, outer, a(day) + 0.01, a(day + 1) - 0.01)} fill={color} opacity={0.8} />;
        })}

        {numbers.map((num, ringIndex) => {
          const r0 = inner + ringIndex * ringW;
          const r1 = r0 + ringW - 2;
          const days = new Map(cycles.get(num)!.map((r) => [r.cycle!.cycleDay, r]));
          return (
            <G key={num}>
              {Array.from({ length: maxDay }, (_, i) => {
                const day = i + 1;
                const rec = days.get(day);
                const v = rec ? valueOf(rec) : null;
                return (
                  <Path
                    key={day}
                    d={ringSegment(cx, cy, r0, r1, a(day) + 0.012, a(day + 1) - 0.012)}
                    fill={v === null ? colors.wheat : interpolateColor(stops, v)}
                    opacity={v === null ? 0.35 : 1}
                  />
                );
              })}
            </G>
          );
        })}

        {[1, 7, 14, 21, 28].filter((d) => d <= maxDay).map((d) => {
          const p = polar(cx, cy, outer + 12, a(d) + step / 2);
          return (
            <SvgText key={d} x={p.x} y={p.y + 4} fontSize={10} textAnchor="middle" fill={colors.inkSoft} fontFamily={fonts.bodyMedium}>
              {d}
            </SvgText>
          );
        })}
        <SvgText x={cx} y={cy - 2} fontSize={11} textAnchor="middle" fill={colors.inkSoft} fontFamily={fonts.bodyBold}>
          CYCLE
        </SvgText>
        <SvgText x={cx} y={cy + 13} fontSize={11} textAnchor="middle" fill={colors.inkSoft} fontFamily={fonts.bodyBold}>
          DAY
        </SvgText>
      </Svg>
      <View style={styles.scale}>
        <Text style={styles.scaleText}>{metric === 'symptoms' ? 'Mild' : 'Low'}</Text>
        <View style={styles.scaleBar}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: interpolateColor(stops, i / 11) }} />
          ))}
        </View>
        <Text style={styles.scaleText}>{metric === 'symptoms' ? 'Severe' : 'High'}</Text>
      </View>
      <Text style={styles.caption}>
        Inner ring = cycle {numbers[0]}, outer ring = cycle {numbers[numbers.length - 1]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scale: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  scaleBar: { flexDirection: 'row', width: 140, height: 8, borderRadius: 4, overflow: 'hidden' },
  scaleText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMid },
  caption: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: spacing.xs },
});
