import type { LutealineRepository } from '../../data/LutealineRepository';
import type { DosingPlan } from '../../domain/models';
import type { RemotePlanService } from './RemotePlanService';

export type SyncResult =
  | { status: 'newPlan'; plan: DosingPlan }
  | { status: 'upToDate' }
  | { status: 'notConfigured' }
  | { status: 'noShareCode' }
  | { status: 'error'; message: string };

/**
 * Asks the plan server for the patient's latest plan. A plan the app has not
 * seen yet is stored as *pending* until the patient confirms it.
 */
export async function syncPlan(repository: LutealineRepository, remotePlans: RemotePlanService): Promise<SyncResult> {
  if (!remotePlans.configured) return { status: 'notConfigured' };
  const profile = await repository.getProfile();
  if (!profile?.shareCode) return { status: 'noShareCode' };
  try {
    const remote = await remotePlans.fetchLatest(profile.shareCode);
    if (!remote) return { status: 'upToDate' };
    const plan = await repository.receiveRemotePlan(remote);
    return plan ? { status: 'newPlan', plan } : { status: 'upToDate' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Sync failed' };
  }
}
