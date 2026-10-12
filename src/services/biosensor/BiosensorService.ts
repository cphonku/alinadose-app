import type { SampleType } from '../../domain/models';
import { CALIBRATIONS, concentrationFromSignal } from './calibration';

export interface BiosensorRequest {
  sampleType: SampleType;
  /** Defaults to now. */
  at?: Date;
}

export interface BiosensorResult {
  measuredAt: string;
  sampleType: SampleType;
  reporterSignal: number;
  progesterone: number;
  unit: string;
  source: 'mock' | 'camera';
  calibrationId: string;
}

/**
 * Reads the reporter signal of the split-TEV progesterone test.
 * The real implementation will analyse a camera image of the test;
 * until the biosensor exists, MockBiosensorService is used.
 */
export interface BiosensorService {
  readonly source: BiosensorResult['source'];
  measure(request: BiosensorRequest): Promise<BiosensorResult>;
}

/** Shared by all implementations: turn a raw reporter signal into a result. */
export function interpretSignal(
  reporterSignal: number,
  sampleType: SampleType,
  measuredAt: Date,
  source: BiosensorResult['source'],
): BiosensorResult {
  const cal = CALIBRATIONS[sampleType];
  return {
    measuredAt: measuredAt.toISOString(),
    sampleType,
    reporterSignal: round(reporterSignal, 1),
    progesterone: round(concentrationFromSignal(reporterSignal, cal), 1),
    unit: cal.unit,
    source,
    calibrationId: cal.id,
  };
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
