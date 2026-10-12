import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  SCALE_LABELS,
  SECTIONS,
  type MultiChoiceItem,
  type ScaleValue,
  type SideEffectId,
} from '../../content/questionnaire';
import { visibleItems, type MultiChoiceAnswer } from '../../domain/scoring';
import { useApp } from '../../state/AppContext';
import { useLogDraft } from '../../state/LogDraft';
import { Button, Caption, Eyebrow, ProgressBar, Screen } from '../../ui/components';
import { colors, fonts, radius, spacing } from '../../ui/theme';

const ADVANCE_DELAY_MS = 220;

export default function Questionnaire() {
  const { answers, setAnswers } = useLogDraft();
  const { data, today } = useApp();
  const [index, setIndex] = useState(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start from today's earlier answers when editing.
  useEffect(() => {
    const existing = data?.questionnaires.find((q) => q.date === today);
    if (existing && Object.keys(answers).length === 0) setAnswers(() => existing.answers);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
    // Runs once on mount only.
  }, []);

  const items = visibleItems(answers);
  const item = items[Math.min(index, items.length - 1)]!;
  const section = SECTIONS.find((s) => s.id === item.section)!;
  const sectionNumber = SECTIONS.indexOf(section) + 1;

  const next = () => {
    if (index + 1 >= items.length) router.push('/log/finish');
    else setIndex(index + 1);
  };
  const back = () => (index === 0 ? router.back() : setIndex(index - 1));

  const answerAndAdvance = (value: ScaleValue | boolean) => {
    setAnswers((a) => ({ ...a, [item.id]: value }));
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      // A "yes" to side effects reveals the follow-up item, so recompute visibility.
      const nextItems = visibleItems({ ...answers, [item.id]: value });
      if (index + 1 >= nextItems.length) router.push('/log/finish');
      else setIndex(index + 1);
    }, ADVANCE_DELAY_MS);
  };

  const current = answers[item.id];

  return (
    <Screen scroll={item.kind === 'multiChoice'}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.inkMid} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ProgressBar value={(index + 1) / items.length} />
        </View>
        <Caption>
          {index + 1}/{items.length}
        </Caption>
      </View>

      <Eyebrow style={styles.eyebrow}>
        Part {sectionNumber} · {section.title}
      </Eyebrow>
      <Caption>Today…</Caption>
      <Text style={styles.question}>{item.text}</Text>

      {item.kind === 'scale' && (
        <View style={styles.options}>
          {([1, 2, 3, 4, 5] as const).map((v) => {
            const label = SCALE_LABELS[v];
            const active = current === v;
            return (
              <Pressable
                key={v}
                accessibilityRole="radio"
                aria-selected={active}
                accessibilityLabel={`${v}, ${label}`}
                onPress={() => answerAndAdvance(v)}
                style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && { opacity: 0.8 }]}
              >
                <View style={[styles.optionNumber, active && styles.optionNumberActive]}>
                  <Text style={[styles.optionNumberText, active && { color: colors.surface }]}>{v}</Text>
                </View>
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {item.kind === 'yesNo' && (
        <View style={styles.yesNo}>
          {[
            { v: false, label: 'No' },
            { v: true, label: 'Yes' },
          ].map(({ v, label }) => (
            <Pressable
              key={label}
              accessibilityRole="radio"
              aria-selected={current === v}
              onPress={() => answerAndAdvance(v)}
              style={[styles.option, styles.yesNoOption, current === v && styles.optionActive]}
            >
              <Text style={[styles.optionLabel, current === v && styles.optionLabelActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {item.kind === 'multiChoice' && (
        <MultiChoice
          item={item}
          value={(current as MultiChoiceAnswer | undefined) ?? { selected: [] }}
          onChange={(v) => setAnswers((a) => ({ ...a, [item.id]: v }))}
          onContinue={next}
        />
      )}
    </Screen>
  );
}

function MultiChoice({
  item,
  value,
  onChange,
  onContinue,
}: {
  item: MultiChoiceItem;
  value: MultiChoiceAnswer;
  onChange: (v: MultiChoiceAnswer) => void;
  onContinue: () => void;
}) {
  const isSelected = (id: string) => (value.selected as string[]).includes(id);
  const toggle = (id: SideEffectId) => {
    const selected = isSelected(id) ? value.selected.filter((s) => s !== id) : [...value.selected, id];
    onChange({ ...value, selected });
  };
  const showOther = item.options.some((o) => o.freeText && isSelected(o.id));

  return (
    <View>
      <View style={styles.chips}>
        {item.options.map((o) => {
          const active = isSelected(o.id);
          return (
            <Pressable
              key={o.id}
              accessibilityRole="checkbox"
              aria-checked={active}
              onPress={() => toggle(o.id as SideEffectId)}
              style={[styles.chip, active && styles.chipActive]}
            >
              {active && <Ionicons name="checkmark" size={16} color={colors.surface} />}
              <Text style={[styles.chipText, active && { color: colors.surface }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {showOther && (
        <TextInput
          value={value.otherText ?? ''}
          onChangeText={(otherText) => onChange({ ...value, otherText })}
          placeholder="Describe other side effects"
          placeholderTextColor={colors.inkSoft}
          style={styles.otherInput}
          accessibilityLabel="Other side effects"
        />
      )}
      <Button title="Continue" onPress={onContinue} disabled={value.selected.length === 0} style={{ marginTop: spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.coralDim, marginBottom: spacing.sm },
  question: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32, color: colors.ink, marginTop: spacing.xs, marginBottom: spacing.xl },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  optionActive: { borderColor: colors.coral, backgroundColor: colors.wheatSoft },
  optionNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.wheatSoft, alignItems: 'center', justifyContent: 'center' },
  optionNumberActive: { backgroundColor: colors.coral },
  optionNumberText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.inkMid },
  optionLabel: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.inkMid },
  optionLabelActive: { color: colors.ink, fontFamily: fonts.bodyBold },
  yesNo: { flexDirection: 'row', gap: spacing.md },
  yesNoOption: { flex: 1, justifyContent: 'center', paddingVertical: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.petal, borderColor: colors.petal },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkMid },
  otherInput: {
    marginTop: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
