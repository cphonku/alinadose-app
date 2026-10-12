import type { DosingPlanDraft } from '../../domain/models';
import {
  normalizePatientCode,
  RemotePlanError,
  type RemotePlan,
  type RemotePlanService,
} from './RemotePlanService';

/**
 * REST client for the plan server (currently the demo relay in
 * server/plan-relay.mjs). Endpoints:
 *   GET /api/patients/:code/plan  → 200 RemotePlan | 404
 *   PUT /api/patients/:code/plan  → 200 RemotePlan (body: DosingPlanDraft)
 */
export class HttpRemotePlanService implements RemotePlanService {
  readonly configured: boolean;

  constructor(
    private readonly baseUrl: string | null,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {
    this.configured = !!baseUrl;
  }

  private url(code: string): string {
    if (!this.baseUrl) throw new RemotePlanError('notConfigured', 'No plan server configured');
    return `${this.baseUrl.replace(/\/$/, '')}/api/patients/${encodeURIComponent(normalizePatientCode(code))}/plan`;
  }

  private async request(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await this.fetchFn(url, init);
    } catch {
      throw new RemotePlanError('network', 'Could not reach the plan server');
    }
  }

  async fetchLatest(patientCode: string): Promise<RemotePlan | null> {
    const res = await this.request(this.url(patientCode));
    if (res.status === 404) return null;
    if (!res.ok) throw new RemotePlanError('server', `Plan server error (${res.status})`);
    return (await res.json()) as RemotePlan;
  }

  async publish(patientCode: string, draft: DosingPlanDraft): Promise<RemotePlan> {
    const res = await this.request(this.url(patientCode), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (res.status === 400) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new RemotePlanError('invalid', body.error ?? 'The plan was rejected');
    }
    if (!res.ok) throw new RemotePlanError('server', `Plan server error (${res.status})`);
    return (await res.json()) as RemotePlan;
  }
}

/** Plan server URL from EXPO_PUBLIC_PLAN_SERVER_URL; on web, the local demo relay by default. */
export function planServerUrl(platform: string): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_PLAN_SERVER_URL;
  if (fromEnv) return fromEnv;
  return platform === 'web' ? 'http://localhost:8787' : null;
}
