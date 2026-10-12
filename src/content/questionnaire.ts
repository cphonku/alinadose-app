/**
 * Daily Functioning Questionnaire (based on DIVA).
 * Source of truth: docs/diva_questionnaire.md — keep this file in sync with it
 * and ask the team before changing any wording.
 */

export const QUESTIONNAIRE_VERSION = 2;

export const SCALE_LABELS = {
  1: 'Not at all',
  2: 'A little',
  3: 'Somewhat',
  4: 'Quite a lot',
  5: 'Very much / all day',
} as const;

export type ScaleValue = 1 | 2 | 3 | 4 | 5;

export type SectionId = 'attention' | 'hyperactivity' | 'emotional';

/** What an item contributes to: the symptom score, or a separate field. */
export type ItemRole = 'symptom' | 'medicationEffect' | 'sideEffectsPresent' | 'sideEffectsList';

interface BaseItem {
  id: string;
  section: SectionId;
  text: string;
  /** DIVA criterion code, where the item maps to one. */
  divaCode?: string;
  role: ItemRole;
  /** Only show this item when another item has a given answer. */
  showIf?: { itemId: string; equals: boolean };
}

export interface ScaleItem extends BaseItem {
  kind: 'scale';
  /** True when 5 is the *good* end of the scale. */
  reversed?: boolean;
}

export interface YesNoItem extends BaseItem {
  kind: 'yesNo';
}

export interface MultiChoiceItem extends BaseItem {
  kind: 'multiChoice';
  options: readonly { id: string; label: string; freeText?: boolean }[];
}

export type QuestionnaireItem = ScaleItem | YesNoItem | MultiChoiceItem;

export const SECTIONS: readonly { id: SectionId; title: string }[] = [
  { id: 'attention', title: 'Attention and organisation' },
  { id: 'hyperactivity', title: 'Inner restlessness and impulsivity' },
  { id: 'emotional', title: 'Emotional regulation and daily functioning' },
];

const symptom = (
  id: string,
  section: SectionId,
  text: string,
  divaCode?: string,
): ScaleItem => ({ id, section, text, divaCode, kind: 'scale', role: 'symptom' });

export const SIDE_EFFECT_OPTIONS = [
  { id: 'sleep', label: 'Trouble sleeping' },
  { id: 'heartRacing', label: 'Heart racing' },
  { id: 'headache', label: 'Headaches' },
  { id: 'appetite', label: 'Loss of appetite' },
  { id: 'nausea', label: 'Nausea' },
  { id: 'anxiety', label: 'Anxiety' },
  { id: 'other', label: 'Other', freeText: true },
] as const;

export type SideEffectId = (typeof SIDE_EFFECT_OPTIONS)[number]['id'];

export const QUESTIONNAIRE_ITEMS: readonly QuestionnaireItem[] = [
  // Part 1 – Attention and organisation
  symptom('o1', 'attention', 'I made mistakes because I rushed or did not read something properly: emails, forms, instructions, work tasks.', 'O1'),
  symptom('o2', 'attention', 'I had to re-read, restart, or go back over something because I lost focus partway through.', 'O2'),
  symptom('o3', 'attention', 'I lost track of what someone was saying while they were talking directly to me.', 'O3'),
  symptom('o4', 'attention', 'I started tasks but moved on before finishing them.', 'O4'),
  symptom('o5', 'attention', 'I struggled to plan or structure my time: I was late, double-booked, or did not know where to begin.', 'O5'),
  symptom('o6', 'attention', 'I put off or avoided a task because it required sustained concentration.', 'O6'),
  symptom('o7', 'attention', 'I spent time looking for something I had misplaced: keys, phone, wallet, papers.', 'O7'),
  symptom('o8', 'attention', 'I was pulled away from what I was doing by noise, notifications, or things happening around me.', 'O8'),
  symptom('o9', 'attention', 'I forgot something I was supposed to do, bring, or respond to.', 'O9'),

  // Part 2 – Inner restlessness and impulsivity
  symptom('hi1', 'hyperactivity', 'I felt physically restless: fidgeting, bouncing my leg, picking at my nails or hair.', 'H/I 1'),
  symptom('hi2', 'hyperactivity', 'I found it hard to stay seated or still when I was expected to.', 'H/I 2'),
  symptom('hi3', 'hyperactivity', 'I felt an inner restlessness, or found it hard to relax and do nothing.', 'H/I 3'),
  symptom('hi4', 'hyperactivity', 'I found it difficult to settle into something quiet: reading, watching something, sitting still.', 'H/I 4'),
  symptom('hi5', 'hyperactivity', 'My thoughts felt like they were running without stopping.', 'H/I 5'),
  symptom('hi6', 'hyperactivity', 'I talked more than I intended, or found it hard to stop once I had started.', 'H/I 6'),
  symptom('hi7', 'hyperactivity', 'I said something before thinking it through.', 'H/I 7'),
  symptom('hi8', 'hyperactivity', 'I felt impatient when I had to wait: in a queue, in traffic, for my turn to speak.', 'H/I 8'),
  symptom('hi9', 'hyperactivity', 'I interrupted someone or cut into a conversation or activity.', 'H/I 9'),

  // Part 3 – Emotional regulation and daily functioning
  symptom('e1', 'emotional', 'My mood shifted quickly or felt harder to control than usual.'),
  symptom('e2', 'emotional', 'I felt sensitive to criticism or rejection, or spent time wondering whether I had upset someone.'),
  symptom('e3', 'emotional', 'I worked hard to appear more organised or more focused than I actually felt.'),
  symptom('e4', 'emotional', 'Ordinary tasks took more effort than they usually do.'),
  symptom('e5', 'emotional', 'I felt overwhelmed by things that would not normally overwhelm me.'),
  {
    id: 'e6',
    section: 'emotional',
    kind: 'scale',
    role: 'medicationEffect',
    reversed: true,
    text: 'My medication felt effective.',
  },
  {
    id: 'e7',
    section: 'emotional',
    kind: 'yesNo',
    role: 'sideEffectsPresent',
    text: 'I experienced adverse side effects (e.g. trouble sleeping, heart racing, headaches, loss of appetite, nausea, anxiety).',
  },
  {
    id: 'e8',
    section: 'emotional',
    kind: 'multiChoice',
    role: 'sideEffectsList',
    text: 'I experienced the following side effects.',
    options: SIDE_EFFECT_OPTIONS,
    showIf: { itemId: 'e7', equals: true },
  },
];
