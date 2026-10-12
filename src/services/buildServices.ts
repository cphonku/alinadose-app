import type { DocumentStore } from '../data/DocumentStore';
import type { LutealineRepository } from '../data/LutealineRepository';
import { getCycleDay, type CycleContext } from '../domain/cycle';
import { cycleContextFrom } from '../domain/dailyRecords';
import { toIsoDate } from '../domain/dates';
import type { KeyValueStore } from './auth/AuthService';
import { DemoAuthService } from './auth/DemoAuthService';
import type { BiosensorService } from './biosensor/BiosensorService';
import { MockBiosensorService } from './biosensor/MockBiosensorService';
import type { RemotePlanService } from './plans/RemotePlanService';

export interface AppServices {
  store: DocumentStore;
  repository: LutealineRepository;
  auth: DemoAuthService;
  biosensor: BiosensorService;
  /** Where physician plans come from (demo relay for now). */
  remotePlans: RemotePlanService;
}

/**
 * Wires the services together. Swapping the mock biosensor, demo auth or the
 * demo plan server for real implementations happens here.
 */
export function buildServices(
  store: DocumentStore,
  repository: LutealineRepository,
  kv: KeyValueStore,
  remotePlans: RemotePlanService,
): AppServices {
  // The mock needs the cycle position to generate realistic values; the
  // cycle data is re-read from storage before every measurement.
  let cycle: CycleContext = { periodStarts: [] };
  const mock = new MockBiosensorService({
    delayMs: 1800,
    cycleContext: (at) => {
      const info = getCycleDay(toIsoDate(at), cycle);
      return info && { cycleDay: info.cycleDay, cycleLength: info.cycleLength };
    },
  });
  const biosensor: BiosensorService = {
    source: mock.source,
    measure: async (req) => {
      const data = await repository.loadPatientData();
      cycle = data ? cycleContextFrom(data) : { periodStarts: [] };
      return mock.measure(req);
    },
  };

  return { store, repository, auth: new DemoAuthService(kv), biosensor, remotePlans };
}
