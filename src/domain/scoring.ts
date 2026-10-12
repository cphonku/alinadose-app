import {
  QUESTIONNAIRE_ITEMS,
  SECTIONS,
  SIDE_EFFECT_OPTIONS,
  type QuestionnaireItem,
  type ScaleValue,
  type SectionId,
  type SideEffectId,
} from '../content/questionnaire';

export interface MultiChoiceAnswer {
  selected: SideEffectId[];
  /** Free text for options marked `freeText` (e.g. "other"). */
  otherText?: string;
}

export type Answer = ScaleValue | boolean | MultiChoiceAnswer;
export type Answers = Record<string, Answer>;

export interface SectionScore {
  section: SectionId;
  /** Sum of the symptom items answered in this section. */
  sum: number;
  /** Lowest/highest possible sum for this section. */
  min: number;
  max: number;
  itemCount: number;
}

export interface QuestionnaireScore {
  sections: SectionScore[];
  /** Total symptom score (sum over all symptom items). Higher = worse. */
  total: number;
  totalMin: number;
  totalMax: number;
  /** Total rescaled to 0–100 for charts and comparisons. */
  totalPercent: number;
  /** 1–5, where 5 = medication worked very well. Not part of the symptom score. */
  medicationEffect: ScaleValue | null;
  sideEffects: { present: boolean; selected: SideEffectId[]; otherText?: string };
}

export class IncompleteQuestionnaireError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing answers for: ${missing.join(', ')}`);
    this.name = 'IncompleteQuestionnaireError';
  }
}

export function isScaleValue(v: unknown): v is ScaleValue {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
}

/** Whether an item should be shown given the answers so far. */
export function isItemVisible(item: QuestionnaireItem, answers: Answers): boolean {
  if (!item.showIf) return true;
  return answers[item.showIf.itemId] === item.showIf.equals;
}

export function visibleItems(answers: Answers): QuestionnaireItem[] {
  return QUESTIONNAIRE_ITEMS.filter((item) => isItemVisible(item, answers));
}

function isValidAnswer(item: QuestionnaireItem, answer: Answer | undefined): boolean {
  switch (item.kind) {
    case 'scale':
      return isScaleValue(answer);
    case 'yesNo':
      return typeof answer === 'boolean';
    case 'multiChoice': {
      if (typeof answer !== 'object' || answer === null) return false;
      const valid = new Set(item.options.map((o) => o.id));
      return answer.selected.length > 0 && answer.selected.every((id) => valid.has(id));
    }
  }
}

/** IDs of visible items without a valid answer. */
export function missingAnswers(answers: Answers): string[] {
  return visibleItems(answers)
    .filter((item) => !isValidAnswer(item, answers[item.id]))
    .map((item) => item.id);
}

/**
 * Drop answers to items that are hidden (e.g. the side-effect list after the
 * patient changes "yes" to "no"), so stale answers are never stored.
 */
export function pruneHiddenAnswers(answers: Answers): Answers {
  const visible = new Set(visibleItems(answers).map((i) => i.id));
  return Object.fromEntries(Object.entries(answers).filter(([id]) => visible.has(id)));
}

export function scoreQuestionnaire(answers: Answers): QuestionnaireScore {
  const missing = missingAnswers(answers);
  if (missing.length > 0) throw new IncompleteQuestionnaireError(missing);

  const symptomItems = QUESTIONNAIRE_ITEMS.filter((i) => i.role === 'symptom');
  const sections: SectionScore[] = SECTIONS.map(({ id }) => {
    const items = symptomItems.filter((i) => i.section === id);
    const sum = items.reduce((acc, i) => acc + (answers[i.id] as ScaleValue), 0);
    return { section: id, sum, min: items.length, max: items.length * 5, itemCount: items.length };
  });

  const total = sections.reduce((a, s) => a + s.sum, 0);
  const totalMin = sections.reduce((a, s) => a + s.min, 0);
  const totalMax = sections.reduce((a, s) => a + s.max, 0);

  const effectItem = QUESTIONNAIRE_ITEMS.find((i) => i.role === 'medicationEffect');
  const presentItem = QUESTIONNAIRE_ITEMS.find((i) => i.role === 'sideEffectsPresent');
  const listItem = QUESTIONNAIRE_ITEMS.find((i) => i.role === 'sideEffectsList');

  const effect = effectItem ? answers[effectItem.id] : undefined;
  const present = presentItem ? answers[presentItem.id] === true : false;
  const list = present && listItem ? (answers[listItem.id] as MultiChoiceAnswer) : undefined;
  const otherAllowed = new Set<string>(
    SIDE_EFFECT_OPTIONS.filter((o) => 'freeText' in o && o.freeText).map((o) => o.id),
  );
  const otherText =
    list?.otherText?.trim() && list.selected.some((id) => otherAllowed.has(id))
      ? list.otherText.trim()
      : undefined;

  return {
    sections,
    total,
    totalMin,
    totalMax,
    totalPercent: Math.round(((total - totalMin) / (totalMax - totalMin)) * 100),
    medicationEffect: isScaleValue(effect) ? effect : null,
    sideEffects: { present, selected: list?.selected ?? [], otherText },
  };
}
