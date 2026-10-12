import { estimateOvulationDay } from '../../domain/cycle';
import type { SampleType } from '../../domain/models';
import { clamp, createRng, gaussian } from '../../domain/random';
import {
  interpretSignal,
  type BiosensorRequest,
  type BiosensorResult,
  type BiosensorService,
} from './BiosensorService';
import { CALIBRATIONS, signalFromConcentration } from './calibration';

/** Rough physiological ranges used only to generate synthetic data. */
const SYNTHETIC_RANGE: Record<SampleType, { baseline: number; peak: number }> = {
  saliva: { baseline: 25, peak: 280 },
  urine: { baseline: 700, peak: 9000 },
};

/**
 * Relative progesterone level (0–1) across the cycle: low in the follicular
 * phase, rising after ovulation and peaking ~7 days later (mid-luteal).
 */
export function relativeProgesterone(cycleDay: number, cycleLength: number): number {
  const peakDay = estimateOvulationDay(cycleLength) + 7;
  const sd = 3.2;
  return Math.exp(-((cycleDay - peakDay) ** 2) / (2 * sd * sd));
}

export function syntheticProgesterone(
  cycleDay: number,
  cycleLength: number,
  sampleType: SampleType,
  rng: () => number,
): number {
  const { baseline, peak } = SYNTHETIC_RANGE[sampleType];
  const level = baseline + (peak - baseline) * relativeProgesterone(cycleDay, cycleLength);
  // ~12% biological/sampling noise.
  return Math.max(1, level * (1 + 0.12 * gaussian(rng)));
}

/** Synthetic reporter signal for a cycle day, including ~3% assay noise. */
export function syntheticReporterSignal(
  cycleDay: number,
  cycleLength: number,
  sampleType: SampleType,
  rng: () => number,
): number {
  const cal = CALIBRATIONS[sampleType];
  const c = syntheticProgesterone(cycleDay, cycleLength, sampleType, rng);
  const signal = signalFromConcentration(c, cal) * (1 + 0.03 * gaussian(rng));
  return clamp(signal, 0, cal.top * 1.1);
}

export interface MockBiosensorOptions {
  /** Where in the cycle the patient is at a given moment (from cycle tracking). */
  cycleContext: (at: Date) => { cycleDay: number; cycleLength: number } | null;
  seed?: number;
  /** Simulated time for "developing" the test, in ms. 0 in tests. */
  delayMs?: number;
}

/** Produces plausible synthetic readings. Never real patient data. */
export class MockBiosensorService implements BiosensorService {
  readonly source = 'mock' as const;
  private readonly rng: () => number;

  constructor(private readonly options: MockBiosensorOptions) {
    this.rng = createRng(options.seed ?? Date.now());
  }

  async measure({ sampleType, at = new Date() }: BiosensorRequest): Promise<BiosensorResult> {
    if (this.options.delayMs) await new Promise((r) => setTimeout(r, this.options.delayMs));
    const ctx = this.options.cycleContext(at) ?? { cycleDay: 1, cycleLength: 28 };
    const day = Math.min(ctx.cycleDay, ctx.cycleLength);
    const signal = syntheticReporterSignal(day, ctx.cycleLength, sampleType, this.rng);
    return interpretSignal(signal, sampleType, at, this.source);
  }
}
