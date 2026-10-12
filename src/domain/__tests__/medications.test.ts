import { findMedication, labelLimitFor, matchMedication, MEDICATIONS, medicationsFor } from '../../content/medications';

const med = (id: string) => findMedication(id)!;

describe('medication catalog', () => {
  it('has unique ids, sane steps and sources for every checked limit', () => {
    expect(new Set(MEDICATIONS.map((m) => m.id)).size).toBe(MEDICATIONS.length);
    for (const m of MEDICATIONS) {
      expect(m.stepMg).toBeGreaterThan(0);
      for (const age of ['adult', 'youth'] as const) {
        const max = m.max[age];
        if (max.kind === 'mg') {
          expect(max.mg % m.stepMg).toBe(0);
          expect(m.source?.url).toMatch(/^https:\/\//);
        }
      }
    }
  });

  it('matches the team overview (EU_ADHD_stimulant_dosing.xlsx)', () => {
    expect(labelLimitFor(med('concerta'), 'adult').maxMg).toBe(72);
    expect(labelLimitFor(med('concerta'), 'youth').maxMg).toBe(54);
    expect(med('concerta').titration.adult.maxStepMg).toBe(18);
    expect(labelLimitFor(med('ritalin-la'), 'adult').maxMg).toBe(80);
    expect(labelLimitFor(med('ritalin-la'), 'youth').maxMg).toBe(60);
    expect(med('ritalin-la').titration.adult.text).toBe('≤ +20 mg weekly');
    expect(labelLimitFor(med('elvanse-adult'), 'adult').maxMg).toBe(70);
    expect(labelLimitFor(med('elvanse-adult'), 'youth').notLicensed).toBe(true);
    expect(labelLimitFor(med('attentin'), 'youth')).toMatchObject({ maxMg: 20, note: 'usually 20 mg (rarely 40 mg)' });
    expect(labelLimitFor(med('attentin'), 'adult').notLicensed).toBe(true);
    expect(labelLimitFor(med('lisdexamfetamine-generics'), 'adult')).toMatchObject({ maxMg: null, notLicensed: false });
  });

  it('applies weight-based limits (1 mg/kg, never above 80 mg)', () => {
    expect(labelLimitFor(med('medikinet-adult'), 'adult').maxMg).toBe(80);
    expect(labelLimitFor(med('medikinet-adult'), 'adult', 64).maxMg).toBe(64);
    expect(labelLimitFor(med('medikinet-adult'), 'adult', 95).maxMg).toBe(80);
    expect(labelLimitFor(med('medikinet-mr'), 'youth').maxMg).toBe(60);
  });

  it('groups products by active ingredient', () => {
    expect(medicationsFor('lisdexamfetamine').map((m) => m.id)).toContain('elvanse-adult');
    expect(medicationsFor('dexamfetamine').every((m) => m.ingredient === 'dexamfetamine')).toBe(true);
  });

  it('matches free-text names and ids from older plans', () => {
    expect(matchMedication('Methylphenidate (demo)').id).toBe('ritalin-la');
    expect(matchMedication('Concerta 36 mg').id).toBe('concerta');
    expect(matchMedication('Elvanse Adult').id).toBe('elvanse-adult');
    expect(matchMedication('Medikinet adult').id).toBe('medikinet-adult');
    expect(matchMedication('Something else').id).toBe('other');
    expect(findMedication('methylphenidate-oros')!.id).toBe('concerta');
    expect(findMedication('nope')).toBeUndefined();
  });
});
