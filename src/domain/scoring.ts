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
  /** Mean of this section's symptom answers, 1–5 (2 decimals). Higher = worse. */
  average: number;
  itemCount: number;
}

export interface QuestionnaireScore {
  sections: SectionScore[];
  /**
   * Overall symptom score, 1–5: the mean of the section averages, so every
   * section weighs the same however many questions it has. Higher = worse.
   */
  overall: number;
  /** `overall` rescaled to 0–100 (1 → 0 %, 5 → 100 %) for charts. */
  overallPercent: number;
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

  // Only symptom items count; the medication questions are stored separately.
  const symptomItems = QUESTIONNAIRE_ITEMS.filter((i) => i.role === 'symptom');
  const sections: SectionScore[] = SECTIONS.map(({ id }) => {
    const items = symptomItems.filter((i) => i.section === id);
    const sum = items.reduce((acc, i) => acc + (answers[i.id] as ScaleValue), 0);
    return { section: id, average: round2(sum / items.length), itemCount: items.length };
  });
  const overall = round2(mean(sections.map((s) => s.average)));

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
    overall,
    overallPercent: toPercent(overall),
    medicationEffect: isScaleValue(effect) ? effect : null,
    sideEffects: { present, selected: list?.selected ?? [], otherText },
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const toPercent = (overall: number) => Math.round(((overall - 1) / 4) * 100);

export interface SymptomSummary {
  overall: number;
  overallPercent: number;
  sections: SectionScore[];
}

/** Score shape stored by questionnaire version 2 (sums over 23 questions). */
interface LegacyScore {
  sections: { section: SectionId; sum: number; itemCount: number }[];
}

/**
 * The symptom part of a stored score, for any questionnaire version. Scores
 * saved before version 3 held section sums; they are turned into averages here.
 */
export function symptomSummary(score: QuestionnaireScore | LegacyScore): SymptomSummary {
  if ('overall' in score) {
    return { overall: score.overall, overallPercent: score.overallPercent, sections: score.sections };
  }
  const sections = score.sections.map((s) => ({
    section: s.section,
    average: round2(s.sum / s.itemCount),
    itemCount: s.itemCount,
  }));
  const overall = round2(mean(sections.map((s) => s.average)));
  return { overall, overallPercent: toPercent(overall), sections };
}
