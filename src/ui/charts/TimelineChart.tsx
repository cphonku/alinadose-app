import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import type { DailyRecord } from '../../domain/dailyRecords';
import { formatShortDate } from '../format';
import { colors, fonts, phaseColors, series, spacing } from '../theme';
import { linePath } from './svgHelpers';

interface Props {
  records: DailyRecord[];
  width: number;
  height?: number;
}

const PAD = { top: 18, bottom: 26, left: 6, right: 6 };

/**
 * Progesterone (teal area) and symptom score (coral line) over time, on top
 * of the cycle phases. Tap anywhere to inspect a day.
 */
export function TimelineChart({ records, width, height = 230 }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const n = records.length;
  if (n === 0) return null;

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const dx = n > 1 ? plotW / (n - 1) : 0;
  const x = (i: number) => PAD.left + i * dx;
  const maxProg = Math.max(1, ...records.map((r) => r.progesterone?.value ?? 0));
  const yProg = (v: number) => PAD.top + plotH * (1 - v / (maxProg * 1.1));
  const ySym = (pct: number) => PAD.top + plotH * (1 - pct / 100);

  const progPoints = records.map((r, i) => (r.progesterone ? { x: x(i), y: yProg(r.progesterone.value) } : null));
  const symPoints = records.map((r, i) => (r.symptoms ? { x: x(i), y: ySym(r.symptoms.overallPercent) } : null));
  const progLine = linePath(progPoints);
  const valid = progPoints.filter((p): p is { x: number; y: number } => p !== null);
  const progArea =
    valid.length > 1
      ? `${linePath(valid)} L ${valid[valid.length - 1]!.x} ${PAD.top + plotH} L ${valid[0]!.x} ${PAD.top + plotH} Z`
      : '';

  const treatmentStart = records.findIndex((r) => r.programPhase === 'treatment');
  const cycleStarts = records.map((r, i) => (r.cycle?.cycleDay === 1 ? i : -1)).filter((i) => i >= 0);
  const sel = selected !== null ? records[selected] : null;

  const onTouch = (locationX: number) => {
    const i = Math.round((locationX - PAD.left) / (dx || 1));
    setSelected(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <View>
      <Pressable
        onPressIn={(e) => onTouch(e.nativeEvent.locationX)}
        accessibilityLabel="Timeline of progesterone and symptoms. Tap to inspect a day."
      >
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="progFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={series.progesterone} stopOpacity={0.35} />
              <Stop offset="1" stopColor={series.progesterone} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

          {/* Phase bands */}
          {records.map((r, i) => {
            if (!r.cycle) return null;
            const color = r.cycle.cycleDay <= 5 ? phaseColors.menstruation : r.cycle.phase === 'luteal' ? phaseColors.luteal : null;
            if (!color) return null;
            return <Rect key={r.date} x={x(i) - dx / 2} y={PAD.top} width={Math.max(dx, 1)} height={plotH} fill={color} opacity={0.09} />;
          })}

          {[0, 50, 100].map((p) => (
            <Line key={p} x1={PAD.left} x2={width - PAD.right} y1={ySym(p)} y2={ySym(p)} stroke={colors.border} strokeDasharray="3 5" />
          ))}

          {cycleStarts.map((i, k) => (
            <G key={i}>
              <Line x1={x(i)} x2={x(i)} y1={PAD.top} y2={PAD.top + plotH} stroke={colors.coral} strokeOpacity={0.5} />
              <SvgText x={x(i) + 3} y={height - 8} fontSize={10} fill={colors.inkSoft} fontFamily={fonts.bodyMedium}>
                {`C${(records[i]!.cycle?.cycleNumber ?? k + 1)} · ${formatShortDate(records[i]!.date)}`}
              </SvgText>
            </G>
          ))}

          {treatmentStart > 0 && (
            <G>
              <Line x1={x(treatmentStart)} x2={x(treatmentStart)} y1={PAD.top - 8} y2={PAD.top + plotH} stroke={series.medication} strokeWidth={2} strokeDasharray="5 4" />
              <SvgText x={x(treatmentStart) + 4} y={PAD.top - 6} fontSize={10} fill={series.medication} fontFamily={fonts.bodyBold}>
                Plan started
              </SvgText>
            </G>
          )}

          {progArea ? <Path d={progArea} fill="url(#progFill)" /> : null}
          <Path d={progLine} stroke={series.progesterone} strokeWidth={2} fill="none" strokeLinejoin="round" />
          <Path d={linePath(symPoints)} stroke={series.symptoms} strokeWidth={2.5} fill="none" strokeLinejoin="round" />

          {selected !== null && (
            <G>
              <Line x1={x(selected)} x2={x(selected)} y1={PAD.top} y2={PAD.top + plotH} stroke={colors.ink} strokeOpacity={0.4} />
              {progPoints[selected] && <Circle cx={progPoints[selected]!.x} cy={progPoints[selected]!.y} r={5} fill={series.progesterone} stroke={colors.surface} strokeWidth={2} />}
              {symPoints[selected] && <Circle cx={symPoints[selected]!.x} cy={symPoints[selected]!.y} r={5} fill={series.symptoms} stroke={colors.surface} strokeWidth={2} />}
            </G>
          )}
        </Svg>
      </Pressable>

      <View style={styles.legend}>
        <LegendDot color={series.progesterone} label={`Progesterone${records.find((r) => r.progesterone)?.progesterone ? ` (${records.find((r) => r.progesterone)!.progesterone!.unit})` : ''}`} />
        <LegendDot color={series.symptoms} label="Symptom score (%)" />
        <LegendDot color={phaseColors.luteal} label="Luteal phase" square />
      </View>

      {sel && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>
            {formatShortDate(sel.date)}
            {sel.cycle ? ` · cycle day ${sel.cycle.cycleDay}` : ''}
          </Text>
          <Text style={styles.tooltipText}>
            Progesterone: {sel.progesterone ? `${sel.progesterone.value.toFixed(0)} ${sel.progesterone.unit}` : '—'}   ·   Symptoms:{' '}
            {sel.symptoms ? `${sel.symptoms.overallPercent}%` : '—'}   ·   Medication: {sel.medicationTaken ? `${sel.medicationTaken.amount} ${sel.medicationTaken.unit}` : '—'}
          </Text>
        </View>
      )}
    </View>
  );
}

export function LegendDot({ color, label, square }: { color: string; label: string; square?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color, borderRadius: square ? 2 : 5, opacity: square ? 0.45 : 1 }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10 },
  legendText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMid },
  tooltip: { marginTop: spacing.sm, backgroundColor: colors.wheatSoft, borderRadius: 12, padding: spacing.sm + 2 },
  tooltipTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  tooltipText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMid, marginTop: 2 },
});
