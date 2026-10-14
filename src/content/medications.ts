/**
 * ADHD medications the physician can pick in the plan editor, with the label
 * (SmPC) dosing rules per age group.
 *
 * Source of truth for the stimulants: EU_ADHD_stimulant_dosing.xlsx (team
 * overview of EU product labels, gathered 12 Oct 2026). Atomoxetine and
 * guanfacine are not in that sheet; their values were collected separately
 * from UK emc labels.
 *
 * NOT YET VERIFIED against the labels approved in Denmark (pro.medicin.dk).
 * Not a substitute for the current national SmPC, and not clinical advice.
 * The app uses these rules only to WARN the physician; a physician can save a
 * plan outside them by giving a reason (off-label use).
 */

export type Ingredient = 'lisdexamfetamine' | 'dexamfetamine' | 'methylphenidate' | 'atomoxetine' | 'guanfacine' | 'other';

/** 'youth' = ages 6–17 (the labels dose children and adolescents as one group). */
export type AgeGroup = 'adult' | 'youth';

export type LabelMax =
  | { kind: 'mg'; mg: number; note?: string }
  /** e.g. Medikinet adult: 1 mg/kg body weight, never above 80 mg. */
  | { kind: 'perKg'; mgPerKg: number; capMg: number }
  /** Not licensed for this age group (sheet: n/l). */
  | { kind: 'notLicensed'; note?: string }
  /** SmPC not checked (sheet: n/c). */
  | { kind: 'notChecked'; note?: string }
  /** Not stated in the SmPC that was read (sheet: –). */
  | { kind: 'notStated' };

export interface Titration {
  /** As written in the label overview, e.g. "≤ +20 mg weekly". */
  text: string;
  /** Largest usual increase per step, in mg; null when not stated. */
  maxStepMg: number | null;
}

export interface Medication {
  id: string;
  ingredient: Ingredient;
  /** Product name(s) as shown in the editor. */
  name: string;
  strengths: string;
  /** Smallest dose change the strengths allow; plan doses are rounded to it. */
  stepMg: number;
  start: Record<AgeGroup, string>;
  titration: Record<AgeGroup, Titration>;
  max: Record<AgeGroup, LabelMax>;
  source: { label: string; url: string } | null;
  notes?: string;
  /** Set to true once the team has checked the entry against the Danish label. */
  verified: boolean;
}

export const INGREDIENTS: readonly { id: Ingredient; label: string }[] = [
  { id: 'methylphenidate', label: 'Methylphenidate' },
  { id: 'lisdexamfetamine', label: 'Lisdexamfetamine' },
  { id: 'dexamfetamine', label: 'Dexamfetamine' },
  { id: 'atomoxetine', label: 'Atomoxetine' },
  { id: 'guanfacine', label: 'Guanfacine' },
  { id: 'other', label: 'Other' },
];

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = { adult: 'adults', youth: 'ages 6–17' };

// Shorthands for the sheet's codes.
const NL: LabelMax = { kind: 'notLicensed' };
const NC: LabelMax = { kind: 'notChecked' };
const NS: LabelMax = { kind: 'notStated' };
const t = (text: string, maxStepMg: number | null): Titration => ({ text, maxStepMg });
const T_NL = t('not licensed', null);
const T_NC = t('not checked', null);
const T_NS = t('not stated', null);
const DEX_MAX: LabelMax = { kind: 'mg', mg: 20, note: 'usually 20 mg (rarely 40 mg)' };
const DEX_NOTE = 'Licensed for ages 6–17 only; not licensed for adults.';
const FOOTNOTE_3 =
  "Generics of Elvanse whose own SmPCs were not opened. German Elvanse generics seen (STADA, ratiopharm) copy Elvanse dosing, but generics don't always carry the adult indication.";
const FOOTNOTE_4 = 'Ritalin Uno (DK) and the Belgian Rilatine products are assumed to match the Ritalin SmPCs read, but were not verified.';
const FOOTNOTE_5 =
  'Concerta copies differ: some keep 54 mg (children) / 72 mg (adults), but Methylphenidate STADA (SE) caps all patients at 54 mg, so these were not filled from Concerta.';
const notChecked = (note?: string): Pick<Medication, 'start' | 'titration' | 'max'> => ({
  start: { adult: 'not checked', youth: 'not checked' },
  titration: { adult: T_NC, youth: T_NC },
  max: { adult: note ? { kind: 'notChecked', note } : NC, youth: note ? { kind: 'notChecked', note } : NC },
});

export const MEDICATIONS: readonly Medication[] = [
  // --- Lisdexamfetamine ---------------------------------------------------
  {
    id: 'elvanse',
    ingredient: 'lisdexamfetamine',
    name: 'Elvanse / Tyvense',
    strengths: '20–70 mg capsules (10 mg steps)',
    stepMg: 10,
    start: { youth: '30 mg (20 mg possible)', adult: '30 mg in Tyvense (IE); elsewhere see Elvanse Adult' },
    titration: { youth: t('+10 or 20 mg ~weekly', 20), adult: t('+10 or 20 mg ~weekly', 20) },
    max: { youth: { kind: 'mg', mg: 70 }, adult: { kind: 'mg', mg: 70 } },
    source: { label: 'Tyvense SmPC (HPRA, Ireland)', url: 'https://medicines.ie/medicines/tyvense-20-mg-capsules-hard~A0003211/document/spc/027359/file' },
    notes: "Elvanse is child-only in most countries; adults use Elvanse Adult/Aduvanz. Ireland's Tyvense covers children and adults.",
    verified: false,
  },
  {
    id: 'elvanse-adult',
    ingredient: 'lisdexamfetamine',
    name: 'Elvanse Adult / Aduvanz',
    strengths: '20–70 mg capsules',
    stepMg: 10,
    start: { youth: 'not licensed', adult: '30 mg (20 mg possible)' },
    titration: { youth: T_NL, adult: t('+10 or 20 mg ~weekly', 20) },
    max: { youth: NL, adult: { kind: 'mg', mg: 70 } },
    source: { label: 'Elvanse Vuxen SmPC (Läkemedelsverket, Sweden)', url: 'https://docetp.mpa.se/LMF/Elvanse%20Vuxen%20capsule,%20hard%20ENG%20SmPC_09001bee83054119.pdf' },
    notes: 'Separate adult product (incl. Adultos, Erwachsene, Vuxen), used where Elvanse is child-only.',
    verified: false,
  },
  {
    id: 'lisdexamfetamine-solution',
    ingredient: 'lisdexamfetamine',
    name: 'Lisdexamfetamine Aristo (oral solution)',
    strengths: '10 mg/mL',
    stepMg: 1,
    ...notChecked(),
    source: null,
    verified: false,
  },
  {
    id: 'lisdexamfetamine-generics',
    ingredient: 'lisdexamfetamine',
    name: 'Lisfaveen, Lisdexamfetamin MEDICE/Hexal, Minalix, Amdex, Lysmi',
    strengths: '20–70 mg capsules',
    stepMg: 10,
    ...notChecked(FOOTNOTE_3),
    source: { label: 'Lisdexamfetamin-ratiopharm Fachinformation (footnote ³)', url: 'https://fachinfo.de/pdf/024432' },
    verified: false,
  },

  // --- Dexamfetamine ------------------------------------------------------
  {
    id: 'attentin',
    ingredient: 'dexamfetamine',
    name: 'Attentin / Tentin / Philla',
    strengths: '5, 10, 20 mg tablets',
    stepMg: 5,
    start: { youth: '5 mg once or twice daily', adult: 'not licensed' },
    titration: { youth: t('+5 mg weekly', 5), adult: T_NL },
    max: { youth: DEX_MAX, adult: NL },
    source: { label: 'Attentin SmPC (Läkemedelsverket, Sweden)', url: 'https://docetp.mpa.se/LMF/Attentin%20tablet%20ENG%20SmPC_09001bee846ce9e5.pdf' },
    notes: DEX_NOTE,
    verified: false,
  },
  {
    id: 'dexatin',
    ingredient: 'dexamfetamine',
    name: 'Dexatin / Attadex',
    strengths: '5, 10, 20 mg tablets',
    stepMg: 5,
    start: { youth: 'not stated', adult: 'not licensed' },
    titration: { youth: T_NS, adult: T_NL },
    max: { youth: DEX_MAX, adult: NL },
    source: { label: 'Dexatin SmPC (Läkemedelsverket, Sweden)', url: 'https://docetp.mpa.se/LMF/Dexatin%20tablet%20ENG%20SmPC_09001bee83c2aac5.pdf' },
    notes: DEX_NOTE,
    verified: false,
  },
  {
    id: 'dexfarm',
    ingredient: 'dexamfetamine',
    name: 'Dexfarm / Attenfarm',
    strengths: '5, 10, 20 mg tablets',
    stepMg: 5,
    start: { youth: '5 mg once or twice daily', adult: 'not licensed' },
    titration: { youth: T_NS, adult: T_NL },
    max: { youth: DEX_MAX, adult: NL },
    source: { label: 'Dexfarm SmPC (Läkemedelsverket, Sweden)', url: 'https://docetp.mpa.se/LMF/Dexfarm%20tablet%20ENG%20SmPC_09001bee83df7121.pdf' },
    notes: DEX_NOTE,
    verified: false,
  },
  {
    id: 'dexamfetamine-sea',
    ingredient: 'dexamfetamine',
    name: 'Dexamfetamine Sea Pharma',
    strengths: '5, 10, 20 mg tablets',
    stepMg: 5,
    start: { youth: 'not stated', adult: 'not licensed' },
    titration: { youth: T_NS, adult: T_NL },
    max: { youth: DEX_MAX, adult: NL },
    source: { label: 'Dexamfetamin Sea Pharma SmPC (Läkemedelsverket, Sweden)', url: 'https://docetp.mpa.se/LMF/Dexamfetamin%20Sea%20Pharma%20tablet%20ENG%20SmPC_09001bee84036d4e.pdf' },
    notes: DEX_NOTE,
    verified: false,
  },
  {
    id: 'dexamfetamine-waymade',
    ingredient: 'dexamfetamine',
    name: 'Dexamfetamine Waymade (all variants)',
    strengths: '5 mg tablets',
    stepMg: 5,
    start: { youth: '5 mg once or twice daily', adult: 'not licensed' },
    titration: { youth: t('+5 mg weekly', 5), adult: T_NL },
    max: { youth: DEX_MAX, adult: NL },
    source: { label: 'Dexamfetaminesulfaat Waymade SmPC (CBG, Netherlands)', url: 'https://www.geneesmiddeleninformatiebank.nl/smpc/h130466_smpc.pdf' },
    notes: DEX_NOTE,
    verified: false,
  },
  {
    id: 'dexamfetamine-other',
    ingredient: 'dexamfetamine',
    name: 'Adhesa; Dexamfetaminesulfaat DMB; Dexamfetamine Taw Pharma (1 mg/mL solution)',
    strengths: '5 mg tablets; 1 mg/mL',
    stepMg: 1,
    ...notChecked(),
    source: null,
    notes: 'Not checked; adult licensing unknown.',
    verified: false,
  },

  // --- Methylphenidate ----------------------------------------------------
  {
    id: 'ritalin-tablets',
    ingredient: 'methylphenidate',
    name: 'Ritalin tablets / Rilatine tablets',
    strengths: '10 mg tablets',
    stepMg: 5,
    start: { youth: '5 mg once or twice daily', adult: 'not licensed (SE)' },
    titration: { youth: t('+5–10 mg weekly', 10), adult: T_NL },
    max: { youth: { kind: 'mg', mg: 60 }, adult: { kind: 'notLicensed', note: 'not licensed for adults (SE)' } },
    source: { label: 'Ritalin tablets SmPC (Läkemedelsverket, Sweden)', url: 'https://docetp.mpa.se/LMF/Ritalin%20tablet%20SmPC_09001bee807a7d62.pdf' },
    notes: `Sweden's Ritalin tablets are not approved for adults; the UK version (not EU) is. In Germany, only Ritalin LA and Ritalin Adult are approved for adults. ${FOOTNOTE_4}`,
    verified: false,
  },
  {
    id: 'ritalin-la',
    ingredient: 'methylphenidate',
    name: 'Ritalin LA / Ritalin Uno / Rilatine MR',
    strengths: '10, 20, 30, 40, 60 mg capsules',
    stepMg: 10,
    start: { youth: '5 mg IR once or twice daily, or LA 10 mg (20 mg possible)', adult: '20 mg (10 mg possible)' },
    titration: { youth: t('+5–10 mg weekly', 10), adult: t('≤ +20 mg weekly', 20) },
    max: { youth: { kind: 'mg', mg: 60 }, adult: { kind: 'mg', mg: 80 } },
    source: { label: 'Ritalin LA Fachinformation (Germany)', url: 'https://fachinfo.de/fi/pdf/010445/ritalin-la' },
    notes: `Includes SE/NO "Ritalin" capsules. In Germany, one of only two Ritalin products approved for adults (with Ritalin Adult). ${FOOTNOTE_4}`,
    verified: false,
  },
  {
    id: 'ritalin-adult',
    ingredient: 'methylphenidate',
    name: 'Ritalin Adult',
    strengths: '10, 20, 30, 40 mg capsules',
    stepMg: 10,
    start: { youth: 'not licensed', adult: '20 mg (10 mg possible)' },
    titration: { youth: T_NL, adult: t('≤ +20 mg weekly', 20) },
    max: { youth: NL, adult: { kind: 'mg', mg: 80 } },
    source: { label: 'Ritalin Adult Fachinformation (Germany)', url: 'https://fachinfo.de/pdf/015153' },
    notes: 'In Germany, one of only two Ritalin products approved for adults (with Ritalin LA).',
    verified: false,
  },
  {
    id: 'concerta',
    ingredient: 'methylphenidate',
    name: 'Concerta (incl. LP, XL)',
    strengths: '18, 27, 36, 54 mg prolonged-release tablets',
    stepMg: 9,
    start: { youth: '18 mg', adult: '18 mg' },
    titration: { youth: t('+18 mg ~weekly', 18), adult: t('+18 mg ~weekly', 18) },
    max: { youth: { kind: 'mg', mg: 54 }, adult: { kind: 'mg', mg: 72 } },
    source: { label: 'Concerta SmPC (Läkemedelsverket, Sweden)', url: 'https://docetp.mpa.se/LMF/Concerta%20prolonged-release%20tablet%20SmPC_09001bee807a39a3.pdf' },
    verified: false,
  },
  {
    id: 'equasym-xl',
    ingredient: 'methylphenidate',
    name: 'Equasym XL / Quasym (incl. variants, L.P.)',
    strengths: '10–60 mg capsules',
    stepMg: 10,
    start: { youth: '5 mg once or twice daily, or XL 10 mg', adult: 'not licensed (IE)' },
    titration: { youth: t('+5–10 mg weekly', 10), adult: T_NL },
    max: { youth: { kind: 'mg', mg: 60 }, adult: { kind: 'notLicensed', note: 'not licensed for adults (IE)' } },
    source: { label: 'Equasym XL SmPC (HPRA, Ireland)', url: 'https://assets.hpra.ie/products/Human/28741/Licence_PA23211-001-006_29052026110123.pdf' },
    verified: false,
  },
  {
    id: 'medikinet-mr',
    ingredient: 'methylphenidate',
    name: 'Medikinet MR capsules (incl. retard, CR, MR, XL)',
    strengths: '5–60 mg capsules',
    stepMg: 5,
    start: { youth: '5 mg once or twice daily, or MR 10 mg', adult: '10 mg' },
    titration: { youth: t('+5–10 mg weekly', 10), adult: t('+10 mg weekly', 10) },
    max: { youth: { kind: 'mg', mg: 60 }, adult: { kind: 'perKg', mgPerKg: 1, capMg: 80 } },
    source: { label: 'Medikinet MR SmPC (HPRA, Ireland)', url: 'https://assets.hpra.ie/products/Human/28666/Licence_PA1555-001-001_12082025145718.pdf' },
    notes: 'Adult maximum depends on body weight: 1 mg/kg, never above 80 mg.',
    verified: false,
  },
  {
    id: 'medikinet-tablets',
    ingredient: 'methylphenidate',
    name: 'Medikinet tablets / Medicebran',
    strengths: '5, 10, 20 mg tablets',
    stepMg: 5,
    start: { youth: '5 mg once or twice daily', adult: 'not licensed' },
    titration: { youth: t('+5–10 mg weekly', 10), adult: T_NL },
    max: { youth: { kind: 'mg', mg: 60 }, adult: NL },
    source: { label: 'Medikinet tablets SmPC (Läkemedelsverket, Sweden)', url: 'https://docetp.mpa.se/LMF/Medikinet%20tablet%20SmPC_09001bee807a4930.pdf' },
    verified: false,
  },
  {
    id: 'medikinet-adult',
    ingredient: 'methylphenidate',
    name: 'Medikinet adult',
    strengths: '5–60 mg capsules',
    stepMg: 5,
    start: { youth: 'not licensed', adult: '10 mg' },
    titration: { youth: T_NL, adult: T_NS },
    max: { youth: NL, adult: { kind: 'perKg', mgPerKg: 1, capMg: 80 } },
    source: { label: 'Medikinet adult Fachinformation (Germany)', url: 'https://fachinfo.de/pdf/013066' },
    notes: 'Adult maximum depends on body weight: 1 mg/kg, never above 80 mg.',
    verified: false,
  },
  {
    id: 'medanef',
    ingredient: 'methylphenidate',
    name: 'Medanef / Methylphenidate Mylan',
    strengths: '5, 10, 20 mg tablets',
    stepMg: 5,
    start: { youth: '5 mg once or twice daily', adult: 'not licensed' },
    titration: { youth: t('+5–10 mg weekly', 10), adult: T_NL },
    max: { youth: { kind: 'mg', mg: 60 }, adult: NL },
    source: { label: 'Medanef SmPC (Läkemedelsverket, Sweden)', url: 'https://docetp.mpa.se/LMF/Medanef%20tablet%20ENG%20SmPC_09001bee84da7d09.pdf' },
    verified: false,
  },
  {
    id: 'methylphenidate-pr-generics',
    ingredient: 'methylphenidate',
    name: 'Kinecteen; Methylphenidate Sandoz/Hexal; Methylphenidat-HCl-ratiopharm; -neuraxpharm; Methylphenaxiro',
    strengths: '18–54 mg prolonged-release tablets',
    stepMg: 9,
    ...notChecked(FOOTNOTE_5),
    source: { label: 'Methylphenidate STADA SmPC (footnote ⁵)', url: 'https://docetp.mpa.se/LMF/Methylphenidate%20STADA%20prolonged-release%20tablet%20SmPC_09001bee823b5af1.pdf' },
    verified: false,
  },
  {
    id: 'methylphenidate-caps-generics',
    ingredient: 'methylphenidate',
    name: 'Methysym / Methylphenidate Aristo; Metiphenal / Metynor / Methylfenidaat XR EG; Methylphenidat-HCl MEDICE',
    strengths: '10–60 mg capsules',
    stepMg: 10,
    ...notChecked(),
    source: null,
    verified: false,
  },
  {
    id: 'methylphenidate-other-generics',
    ingredient: 'methylphenidate',
    name: 'Rubifen; Methylphenidat Alternova, AL, 1A Pharma, TAD, Zentiva',
    strengths: 'various',
    stepMg: 5,
    ...notChecked(),
    source: null,
    verified: false,
  },

  // --- Non-stimulants (not in the team's sheet; from UK emc labels) --------
  {
    id: 'atomoxetine',
    ingredient: 'atomoxetine',
    name: 'Strattera (atomoxetine)',
    strengths: '10, 18, 25, 40, 60, 80, 100 mg capsules',
    stepMg: 10,
    start: { youth: 'not checked', adult: '40 mg' },
    titration: { youth: T_NC, adult: t('after at least 7 days at 40 mg; maintenance 80–100 mg', null) },
    max: { youth: NC, adult: { kind: 'mg', mg: 100 } },
    source: { label: 'Strattera SmPC (emc, UK)', url: 'https://www.medicines.org.uk/emc/product/7433/smpc' },
    notes: "Not in the team's stimulant overview; collected separately.",
    verified: false,
  },
  {
    id: 'guanfacine',
    ingredient: 'guanfacine',
    name: 'Intuniv (guanfacine, prolonged-release)',
    strengths: '1, 2, 3, 4 mg tablets',
    stepMg: 1,
    start: { youth: '1 mg', adult: 'not licensed' },
    titration: { youth: t('+1 mg weekly or slower', 1), adult: T_NL },
    max: { youth: { kind: 'mg', mg: 7, note: '7 mg only for adolescents of 58.5 kg or more' }, adult: NL },
    source: { label: 'Intuniv SmPC (emc, UK)', url: 'https://www.medicines.org.uk/emc/product/5099/smpc' },
    notes: "Licensed for ages 6–17 only. Not in the team's stimulant overview; collected separately.",
    verified: false,
  },

  // --- Anything else ------------------------------------------------------
  {
    id: 'other',
    ingredient: 'other',
    name: 'Other / not listed',
    strengths: '',
    stepMg: 5,
    start: { youth: '', adult: '' },
    titration: { youth: T_NS, adult: T_NS },
    max: { youth: NS, adult: NS },
    source: null,
    verified: false,
  },
];

export const OTHER_MEDICATION_ID = 'other';

/** Ids used by the first version of this catalog. */
const LEGACY_IDS: Record<string, string> = {
  'methylphenidate-mr': 'medikinet-mr',
  'methylphenidate-oros': 'concerta',
  'methylphenidate-ir': 'ritalin-tablets',
  lisdexamfetamine: 'elvanse-adult',
  dexamfetamine: 'attentin',
};

export function findMedication(id: string | undefined): Medication | undefined {
  if (!id) return undefined;
  return MEDICATIONS.find((m) => m.id === (LEGACY_IDS[id] ?? id));
}

export function medicationsFor(ingredient: Ingredient): Medication[] {
  return MEDICATIONS.filter((m) => m.ingredient === ingredient);
}

/**
 * Best match for a free-text medication name, so plans written before the
 * catalog existed (e.g. "Methylphenidate (demo)") still get a dose step.
 */
export function matchMedication(name: string | undefined): Medication {
  const n = (name ?? '').toLowerCase();
  const byKeyword: [string, string][] = [
    ['concerta', 'concerta'],
    ['elvanse adult', 'elvanse-adult'],
    ['aduvanz', 'elvanse-adult'],
    ['elvanse', 'elvanse'],
    ['tyvense', 'elvanse'],
    ['lisdexamf', 'elvanse-adult'],
    ['attentin', 'attentin'],
    ['dexatin', 'dexatin'],
    ['dexfarm', 'dexfarm'],
    ['dexamf', 'attentin'],
    ['ritalin adult', 'ritalin-adult'],
    ['ritalin', 'ritalin-la'],
    ['medikinet adult', 'medikinet-adult'],
    ['medikinet', 'medikinet-mr'],
    ['equasym', 'equasym-xl'],
    ['medanef', 'medanef'],
    ['methylphenid', 'ritalin-la'],
    ['atomox', 'atomoxetine'],
    ['strattera', 'atomoxetine'],
    ['guanf', 'guanfacine'],
    ['intuniv', 'guanfacine'],
  ];
  const hit = byKeyword.find(([k]) => n.includes(k));
  return findMedication(hit?.[1]) ?? findMedication(OTHER_MEDICATION_ID)!;
}

export interface LabelLimit {
  /** Maximum per day to warn above; null when none applies or none is known. */
  maxMg: number | null;
  /** The product is not licensed for this age group: any dose is off-label. */
  notLicensed: boolean;
  /** One line for the editor, e.g. "Label maximum (adults): 80 mg per day". */
  summary: string;
  note?: string;
}

/**
 * The label limit for one product and age group. For weight-based limits
 * (1 mg/kg, never above 80 mg) the weight gives the exact maximum; without it
 * the absolute cap is used.
 */
export function labelLimitFor(med: Medication, age: AgeGroup, weightKg?: number | null): LabelLimit {
  const max = med.max[age];
  const who = AGE_GROUP_LABELS[age];
  switch (max.kind) {
    case 'mg':
      return { maxMg: max.mg, notLicensed: false, summary: `Label maximum (${who}): ${max.mg} mg per day`, note: max.note };
    case 'perKg': {
      const byWeight = weightKg ? Math.min(max.capMg, Math.floor(max.mgPerKg * weightKg)) : max.capMg;
      return {
        maxMg: byWeight,
        notLicensed: false,
        summary: weightKg
          ? `Label maximum (${who}): ${byWeight} mg per day (${max.mgPerKg} mg/kg × ${weightKg} kg, never above ${max.capMg} mg)`
          : `Label maximum (${who}): ${max.mgPerKg} mg/kg, never above ${max.capMg} mg per day`,
      };
    }
    case 'notLicensed':
      return { maxMg: null, notLicensed: true, summary: `Not licensed for ${who}`, note: max.note };
    case 'notChecked':
      return { maxMg: null, notLicensed: false, summary: 'Label not checked: no maximum known', note: max.note };
    case 'notStated':
      return { maxMg: null, notLicensed: false, summary: 'No label maximum known' };
  }
}
