/**
 * Daily Functioning Questionnaire (based on DIVA).
 * Source of truth: docs/diva_questionnaire_short.md — keep this file in sync with it
 * and ask the team before changing any wording.
 */

export const QUESTIONNAIRE_VERSION = 3;

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
  symptom('a1', 'attention', 'I made careless mistakes or had to go back over things because I lost focus partway through.', 'O1, O2'),
  symptom('a2', 'attention', 'My attention drifted: in conversations, or when noise, notifications or things around me pulled me away.', 'O3, O8'),
  symptom('a3', 'attention', "I avoided, put off, or didn't finish tasks that required sustained concentration.", 'O4, O6'),
  symptom('a4', 'attention', 'I struggled to plan or structure my time: I was late, double-booked, or did not know where to begin.', 'O5'),
  symptom('a5', 'attention', 'I forgot or misplaced things: tasks, appointments, messages, keys, phone.', 'O7, O9'),

  // Part 2 – Inner restlessness and impulsivity
  symptom('h1', 'hyperactivity', 'I felt physically restless: fidgeting, or finding it hard to stay seated or still.', 'H/I 1, H/I 2'),
  symptom('h2', 'hyperactivity', 'I felt restless inside: hard to relax or settle into something quiet, or my thoughts kept racing.', 'H/I 3, H/I 4, H/I 5'),
  symptom('h3', 'hyperactivity', 'I talked more than I meant to, or said things before thinking them through.', 'H/I 6, H/I 7'),
  symptom('h4', 'hyperactivity', 'I was impatient when waiting, or interrupted others.', 'H/I 8, H/I 9'),

  // Part 3 – Emotional regulation and daily functioning
  symptom('e1', 'emotional', 'My mood shifted quickly, or I felt unusually sensitive to criticism or rejection.'),
  symptom('e2', 'emotional', 'Ordinary tasks, including keeping up appearances, took more effort than usual or felt overwhelming.'),

  // Medication questions: stored separately, never part of the symptom score.
  {
    id: 'medEffect',
    section: 'emotional',
    kind: 'scale',
    role: 'medicationEffect',
    reversed: true,
    text: 'My medication felt effective.',
  },
  {
    id: 'sideEffects',
    section: 'emotional',
    kind: 'yesNo',
    role: 'sideEffectsPresent',
    text: 'I experienced adverse side effects (e.g. trouble sleeping, heart racing, headaches, loss of appetite, nausea, anxiety).',
  },
  {
    id: 'sideEffectList',
    section: 'emotional',
    kind: 'multiChoice',
    role: 'sideEffectsList',
    text: 'I experienced the following side effects.',
    options: SIDE_EFFECT_OPTIONS,
    showIf: { itemId: 'sideEffects', equals: true },
  },
];
