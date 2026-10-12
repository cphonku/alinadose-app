import type { DosingPlanDraft } from '../../domain/models';
import { normalizePatientCode, type RemotePlan, type RemotePlanService } from './RemotePlanService';

/** In-memory plan server, for tests. */
export class MemoryRemotePlanService implements RemotePlanService {
  readonly configured = true;
  private plans = new Map<string, RemotePlan>();

  constructor(private readonly clock: () => Date = () => new Date()) {}

  async fetchLatest(patientCode: string): Promise<RemotePlan | null> {
    return this.plans.get(normalizePatientCode(patientCode)) ?? null;
  }

  async publish(patientCode: string, draft: DosingPlanDraft): Promise<RemotePlan> {
    const code = normalizePatientCode(patientCode);
    const plan: RemotePlan = {
      ...draft,
      patientCode: code,
      version: (this.plans.get(code)?.version ?? 0) + 1,
      publishedAt: this.clock().toISOString(),
    };
    this.plans.set(code, plan);
    return plan;
  }
}
