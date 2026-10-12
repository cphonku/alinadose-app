import type { SampleType } from '../../domain/models';

/**
 * Calibration for the split-TEV progesterone assay.
 *
 * The reporter signal rises with progesterone following a four-parameter
 * logistic (4PL) curve:
 *
 *   signal = bottom + (top - bottom) / (1 + (ec50 / c) ^ hill)
 *
 * ALL VALUES ARE PLACEHOLDERS until the wet lab provides real calibration
 * data. Update them here only — nothing else should hard-code them.
 */
export interface CalibrationCurve {
  id: string;
  sampleType: SampleType;
  unit: string;
  bottom: number;
  top: number;
  ec50: number;
  hill: number;
  /** Concentrations outside this range are reported as clamped values. */
  minConcentration: number;
  maxConcentration: number;
}

export const CALIBRATIONS: Record<SampleType, CalibrationCurve> = {
  // Salivary progesterone: roughly 10–50 pg/mL follicular, up to ~300 pg/mL mid-luteal.
  saliva: {
    id: 'placeholder-saliva-v1',
    sampleType: 'saliva',
    unit: 'pg/mL',
    bottom: 50,
    top: 1000,
    ec50: 150,
    hill: 1.2,
    minConcentration: 1,
    maxConcentration: 2000,
  },
  // Urine is typically measured as the metabolite PdG. Placeholder scale in ng/mL.
  urine: {
    id: 'placeholder-urine-v1',
    sampleType: 'urine',
    unit: 'ng/mL',
    bottom: 50,
    top: 1000,
    ec50: 3000,
    hill: 1.2,
    minConcentration: 50,
    maxConcentration: 40000,
  },
};

export function signalFromConcentration(c: number, cal: CalibrationCurve): number {
  if (c <= 0) return cal.bottom;
  return cal.bottom + (cal.top - cal.bottom) / (1 + Math.pow(cal.ec50 / c, cal.hill));
}

/** Inverse 4PL: concentration from a measured reporter signal, clamped to the valid range. */
export function concentrationFromSignal(signal: number, cal: CalibrationCurve): number {
  const span = cal.top - cal.bottom;
  const fraction = (signal - cal.bottom) / span;
  if (fraction <= 0) return cal.minConcentration;
  if (fraction >= 1) return cal.maxConcentration;
  const c = cal.ec50 / Math.pow(1 / fraction - 1, 1 / cal.hill);
  return Math.min(cal.maxConcentration, Math.max(cal.minConcentration, c));
}
