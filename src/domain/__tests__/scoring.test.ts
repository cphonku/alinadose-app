import { QUESTIONNAIRE_ITEMS } from '../../content/questionnaire';
import {
  IncompleteQuestionnaireError,
  missingAnswers,
  pruneHiddenAnswers,
  scoreQuestionnaire,
  visibleItems,
  type Answers,
} from '../scoring';

function allSymptoms(value: 1 | 2 | 3 | 4 | 5): Answers {
  const answers: Answers = {};
  QUESTIONNAIRE_ITEMS.filter((i) => i.role === 'symptom').forEach((i) => (answers[i.id] = value));
  return answers;
}

describe('questionnaire content', () => {
  it('matches docs/diva_questionnaire.md: 9 + 9 + 8 items', () => {
    const count = (s: string) => QUESTIONNAIRE_ITEMS.filter((i) => i.section === s).length;
    expect(count('attention')).toBe(9);
    expect(count('hyperactivity')).toBe(9);
    expect(count('emotional')).toBe(8);
  });

  it('has unique ids', () => {
    const ids = QUESTIONNAIRE_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('scoring', () => {
  it('scores the minimum and maximum symptom totals', () => {
    const low = scoreQuestionnaire({ ...allSymptoms(1), e6: 5, e7: false });
    expect(low.total).toBe(23);
    expect(low.totalPercent).toBe(0);

    const high = scoreQuestionnaire({ ...allSymptoms(5), e6: 1, e7: false });
    expect(high.total).toBe(115);
    expect(high.totalPercent).toBe(100);
  });

  it('computes section subscores', () => {
    const answers: Answers = { ...allSymptoms(2), e6: 3, e7: false };
    answers.o1 = 5;
    const score = scoreQuestionnaire(answers);
    expect(score.sections.find((s) => s.section === 'attention')).toMatchObject({ sum: 21, min: 9, max: 45 });
    expect(score.sections.find((s) => s.section === 'emotional')).toMatchObject({ sum: 10, itemCount: 5 });
  });

  it('keeps medication effect out of the symptom score', () => {
    const a = scoreQuestionnaire({ ...allSymptoms(3), e6: 1, e7: false });
    const b = scoreQuestionnaire({ ...allSymptoms(3), e6: 5, e7: false });
    expect(a.total).toBe(b.total);
    expect(b.medicationEffect).toBe(5);
  });

  it('only shows the side-effect list when side effects were reported', () => {
    expect(visibleItems({ e7: false }).some((i) => i.id === 'e8')).toBe(false);
    expect(visibleItems({ e7: true }).some((i) => i.id === 'e8')).toBe(true);
  });

  it('requires the side-effect list when side effects = yes', () => {
    const answers: Answers = { ...allSymptoms(2), e6: 3, e7: true };
    expect(missingAnswers(answers)).toEqual(['e8']);
    expect(() => scoreQuestionnaire(answers)).toThrow(IncompleteQuestionnaireError);
  });

  it('records side effects including free text for "other"', () => {
    const score = scoreQuestionnaire({
      ...allSymptoms(2),
      e6: 3,
      e7: true,
      e8: { selected: ['sleep', 'other'], otherText: '  dry mouth ' },
    });
    expect(score.sideEffects).toEqual({ present: true, selected: ['sleep', 'other'], otherText: 'dry mouth' });
  });

  it('drops a stale side-effect list after changing the answer to no', () => {
    const pruned = pruneHiddenAnswers({ ...allSymptoms(2), e6: 3, e7: false, e8: { selected: ['sleep'] } });
    expect(pruned.e8).toBeUndefined();
  });

  it('reports missing and invalid answers', () => {
    const answers: Answers = { ...allSymptoms(2), e6: 3, e7: false };
    delete answers.o3;
    (answers as Record<string, unknown>).hi1 = 7;
    expect(missingAnswers(answers)).toEqual(['o3', 'hi1']);
  });
});
