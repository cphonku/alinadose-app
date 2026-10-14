import { QUESTIONNAIRE_ITEMS, type ScaleValue } from '../../content/questionnaire';
import {
  IncompleteQuestionnaireError,
  missingAnswers,
  pruneHiddenAnswers,
  scoreQuestionnaire,
  symptomSummary,
  visibleItems,
  type Answers,
} from '../scoring';

const symptomIds = (section?: string) =>
  QUESTIONNAIRE_ITEMS.filter((i) => i.role === 'symptom' && (!section || i.section === section)).map((i) => i.id);

function allSymptoms(value: ScaleValue): Answers {
  return Object.fromEntries(symptomIds().map((id) => [id, value]));
}

const noMeds: Answers = { medEffect: 3, sideEffects: false };

describe('questionnaire content', () => {
  it('matches docs/diva_questionnaire_short.md: 5 + 4 + 2 symptom questions, then 3 medication questions', () => {
    expect(symptomIds('attention')).toHaveLength(5);
    expect(symptomIds('hyperactivity')).toHaveLength(4);
    expect(symptomIds('emotional')).toHaveLength(2);
    expect(QUESTIONNAIRE_ITEMS).toHaveLength(14);
    expect(QUESTIONNAIRE_ITEMS.slice(-3).map((i) => i.role)).toEqual(['medicationEffect', 'sideEffectsPresent', 'sideEffectsList']);
  });

  it('has unique ids', () => {
    const ids = QUESTIONNAIRE_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('scoring', () => {
  it('scores the lowest and highest overall averages', () => {
    const low = scoreQuestionnaire({ ...allSymptoms(1), ...noMeds });
    expect(low).toMatchObject({ overall: 1, overallPercent: 0 });
    const high = scoreQuestionnaire({ ...allSymptoms(5), ...noMeds });
    expect(high).toMatchObject({ overall: 5, overallPercent: 100 });
  });

  it('averages each section, then averages the three sections equally', () => {
    const answers: Answers = { ...allSymptoms(1), ...noMeds };
    symptomIds('attention').forEach((id) => (answers[id] = 5));
    const score = scoreQuestionnaire(answers);
    expect(score.sections).toEqual([
      { section: 'attention', average: 5, itemCount: 5 },
      { section: 'hyperactivity', average: 1, itemCount: 4 },
      { section: 'emotional', average: 1, itemCount: 2 },
    ]);
    // (5 + 1 + 1) / 3, not the per-question mean (25 + 4 + 2) / 11 = 2.82
    expect(score.overall).toBe(2.33);
    expect(score.overallPercent).toBe(33);
  });

  it('rounds section averages to two decimals', () => {
    const answers: Answers = { ...allSymptoms(2), ...noMeds, a1: 3 };
    expect(scoreQuestionnaire(answers).sections[0]!.average).toBe(2.2);
    const h: Answers = { ...allSymptoms(2), ...noMeds, h1: 3, h2: 3, h3: 4 };
    expect(scoreQuestionnaire(h).sections[1]!.average).toBe(3);
  });

  it('keeps the medication questions out of the symptom score', () => {
    const a = scoreQuestionnaire({ ...allSymptoms(3), medEffect: 1, sideEffects: false });
    const b = scoreQuestionnaire({
      ...allSymptoms(3),
      medEffect: 5,
      sideEffects: true,
      sideEffectList: { selected: ['sleep', 'nausea'] },
    });
    expect(a.overall).toBe(3);
    expect(b.overall).toBe(3);
    expect(b.medicationEffect).toBe(5);
    expect(b.sideEffects).toMatchObject({ present: true, selected: ['sleep', 'nausea'] });
  });

  it('only shows the side-effect list after "yes"', () => {
    expect(visibleItems({ sideEffects: false }).some((i) => i.id === 'sideEffectList')).toBe(false);
    expect(visibleItems({ sideEffects: true }).some((i) => i.id === 'sideEffectList')).toBe(true);
  });

  it('requires the side-effect list when side effects = yes', () => {
    const answers: Answers = { ...allSymptoms(2), medEffect: 3, sideEffects: true };
    expect(missingAnswers(answers)).toEqual(['sideEffectList']);
    expect(() => scoreQuestionnaire(answers)).toThrow(IncompleteQuestionnaireError);
  });

  it('records side effects including free text for "other"', () => {
    const score = scoreQuestionnaire({
      ...allSymptoms(2),
      medEffect: 3,
      sideEffects: true,
      sideEffectList: { selected: ['sleep', 'other'], otherText: '  dry mouth ' },
    });
    expect(score.sideEffects).toEqual({ present: true, selected: ['sleep', 'other'], otherText: 'dry mouth' });
  });

  it('drops a stale side-effect list after changing the answer to no', () => {
    const pruned = pruneHiddenAnswers({ ...allSymptoms(2), ...noMeds, sideEffectList: { selected: ['sleep'] } });
    expect(pruned.sideEffectList).toBeUndefined();
  });

  it('reports missing and invalid answers', () => {
    const answers: Answers = { ...allSymptoms(2), ...noMeds };
    delete answers.a3;
    (answers as Record<string, unknown>).h1 = 7;
    expect(missingAnswers(answers)).toEqual(['a3', 'h1']);
  });
});

describe('scores saved by older versions', () => {
  it('turns version 2 section sums into averages', () => {
    const v2 = {
      sections: [
        { section: 'attention' as const, sum: 27, min: 9, max: 45, itemCount: 9 },
        { section: 'hyperactivity' as const, sum: 18, min: 9, max: 45, itemCount: 9 },
        { section: 'emotional' as const, sum: 5, min: 5, max: 25, itemCount: 5 },
      ],
    };
    expect(symptomSummary(v2)).toEqual({
      overall: 2,
      overallPercent: 25,
      sections: [
        { section: 'attention', average: 3, itemCount: 9 },
        { section: 'hyperactivity', average: 2, itemCount: 9 },
        { section: 'emotional', average: 1, itemCount: 5 },
      ],
    });
  });

  it('passes current scores through unchanged', () => {
    const score = scoreQuestionnaire({ ...allSymptoms(4), ...noMeds });
    expect(symptomSummary(score)).toEqual({ overall: 4, overallPercent: 75, sections: score.sections });
  });
});
