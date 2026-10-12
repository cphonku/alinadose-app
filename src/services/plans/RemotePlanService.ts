import type { DosingPlanDraft } from '../../domain/models';

/** A plan as published by the physician on the plan server. */
export interface RemotePlan extends DosingPlanDraft {
  patientCode: string;
  /** Increases by one every time the physician publishes. */
  version: number;
  /** ISO timestamp. */
  publishedAt: string;
}

export class RemotePlanError extends Error {
  constructor(
    public readonly code: 'notConfigured' | 'network' | 'invalid' | 'server',
    message: string,
  ) {
    super(message);
    this.name = 'RemotePlanError';
  }
}

/**
 * Where physicians publish plans and patients fetch them. The patient is
 * identified only by their share code; no other patient data is sent.
 *
 * DEMO STAGE: the real backend (hosting region, physician accounts,
 * encryption, consent) is decided together with the team's GDPR measures.
 * Any backend just needs to implement this interface.
 */
export interface RemotePlanService {
  /** False when no plan server is configured; the app then works offline only. */
  readonly configured: boolean;
  /** Latest published plan for a patient, or null if none was published yet. */
  fetchLatest(patientCode: string): Promise<RemotePlan | null>;
  /** Physician side: publish a new version of the patient's plan. */
  publish(patientCode: string, draft: DosingPlanDraft): Promise<RemotePlan>;
}

/** Normalizes what patients type, e.g. " lut-4f7k2 " → "LUT-4F7K2". */
export function normalizePatientCode(code: string): string {
  return code.trim().toUpperCase();
}
