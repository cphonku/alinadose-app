import * as Haptics from 'expo-haptics';
import { useMemo, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { phaseForDay } from '../domain/cycle';
import type { ExpandedDay } from '../domain/dosing';
import { formatDose } from './format';
import { colors, fonts, phaseColors, phaseLabels } from './theme';

interface Props {
  size: number;
  /** Number of days shown around the dial. */
  days: number;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  todayDay: number | null;
  /** Physician's doses laid out over this cycle (see expandPlanForCycle); null during monitoring. */
  plan: ExpandedDay[] | null;
  /** Bleeding days in this cycle. */
  periodLength: number;
  unit: string;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/**
 * Circular cycle dial. Each day is a radial bar (length = dose, colour =
 * phase); dragging anywhere on the dial moves the arrow to that day.
 */
export function DosingDial({ size, days, selectedDay, onSelectDay, todayDay, plan, periodLength, unit }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const inner = size * 0.3;
  const maxBar = size * 0.17;
  const pointerR = size / 2 - 8;
  const step = (2 * Math.PI) / days;
  const angleOf = (day: number) => -Math.PI / 2 + (day - 0.5) * step;

  const doseByDay = useMemo(
    () => new Map((plan ?? []).flatMap((d) => (d.amount === null ? [] : [[d.cycleDay, d.amount] as const]))),
    [plan],
  );
  const maxDose = Math.max(1, ...doseByDay.values());

  // Track the dial's position on screen so touches can be turned into angles.
  const viewRef = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const selected = useRef(selectedDay);
  selected.current = selectedDay;

  const measure = () =>
    viewRef.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
    });

  const dayFromEvent = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.pageX - origin.current.x - cx;
    const y = e.nativeEvent.pageY - origin.current.y - cy;
    let a = Math.atan2(y, x) + Math.PI / 2; // 0 at the top, clockwise
    if (a < 0) a += 2 * Math.PI;
    return (Math.floor(a / step) % days) + 1;
  };

  const update = (e: GestureResponderEvent) => {
    const day = dayFromEvent(e);
    if (day !== selected.current) {
      selected.current = day;
      onSelectDay(day);
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    }
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          measure();
          update(e);
        },
        onPanResponderMove: update,
      }),
    // Handlers only depend on the geometry; onSelectDay is a state setter.
    [days, size],
  );

  const pointerAngle = angleOf(selectedDay);
  const tip = polar(cx, cy, pointerR - 16, pointerAngle);
  const baseL = polar(cx, cy, pointerR, pointerAngle - 0.09);
  const baseR = polar(cx, cy, pointerR, pointerAngle + 0.09);

  const todayPos = todayDay !== null && todayDay <= days ? polar(cx, cy, inner - 20, angleOf(todayDay)) : null;

  const selectedDose = doseByDay.get(selectedDay);
  const phase = phaseForDay(selectedDay, days);

  return (
    <View
      ref={viewRef}
      onLayout={measure}
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Cycle day selector"
      accessibilityValue={{ text: `Day ${selectedDay}${selectedDose !== undefined ? `, ${selectedDose} ${unit}` : ''}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        onSelectDay(
          e.nativeEvent.actionName === 'increment' ? (selectedDay % days) + 1 : ((selectedDay + days - 2) % days) + 1,
        )
      }
      {...pan.panHandlers}
    >
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={pointerR - 22} fill={colors.surface} />
        <Circle cx={cx} cy={cy} r={inner - 10} fill={colors.wheatSoft} />
        <G>
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const a = angleOf(day);
            const dose = doseByDay.get(day);
            const len = plan ? maxBar * (0.2 + 0.8 * ((dose ?? 0) / maxDose)) : maxBar * 0.45;
            const p1 = polar(cx, cy, inner, a);
            const p2 = polar(cx, cy, inner + len, a);
            const color = day <= periodLength ? phaseColors.menstruation : phaseColors[phaseForDay(day, days)];
            const isSelected = day === selectedDay;
            return (
              <Line
                key={day}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={color}
                strokeOpacity={isSelected ? 1 : 0.55}
                strokeWidth={Math.min(12, ((2 * Math.PI * inner) / days) * (isSelected ? 0.85 : 0.6))}
                strokeLinecap="round"
              />
            );
          })}
        </G>
        {todayPos && (
          <>
            <Circle cx={todayPos.x} cy={todayPos.y} r={7} fill={colors.surface} stroke={colors.ink} strokeWidth={2} />
            <Circle cx={todayPos.x} cy={todayPos.y} r={3} fill={colors.ink} />
          </>
        )}
        <Path d={`M ${tip.x} ${tip.y} L ${baseL.x} ${baseL.y} L ${baseR.x} ${baseR.y} Z`} fill={colors.coral} stroke={colors.coralDim} strokeWidth={1.5} strokeLinejoin="round" />
      </Svg>

      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={styles.dayLabel}>Day {selectedDay}</Text>
        {selectedDose !== undefined ? (
          <Text style={styles.dose} adjustsFontSizeToFit numberOfLines={1}>
            {formatDose(selectedDose, unit)}
          </Text>
        ) : (
          <Text style={[styles.dose, styles.noDose]}>{plan ? 'Ask your physician' : '—'}</Text>
        )}
        <Text style={[styles.phase, { color: selectedDay <= periodLength ? colors.coralDim : phase === 'luteal' ? colors.petalDim : colors.tealDim }]}>
          {selectedDay <= periodLength ? 'Period' : phaseLabels[phase]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  dayLabel: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.inkSoft },
  dose: { fontFamily: fonts.display, fontSize: 40, color: colors.ink, maxWidth: '50%' },
  noDose: { fontSize: 22 },
  phase: { fontFamily: fonts.displayItalic, fontSize: 15 },
});
