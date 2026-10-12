import type { DocumentStore } from '../data/DocumentStore';
import type { LutealineRepository } from '../data/LutealineRepository';
import { getCycleDay } from '../domain/cycle';
import { toIsoDate } from '../domain/dates';
import type { KeyValueStore } from './auth/AuthService';
import { DemoAuthService } from './auth/DemoAuthService';
import type { BiosensorService } from './biosensor/BiosensorService';
import { MockBiosensorService } from './biosensor/MockBiosensorService';

export interface AppServices {
  store: DocumentStore;
  repository: LutealineRepository;
  auth: DemoAuthService;
  biosensor: BiosensorService;
}

/**
 * Wires the services together. Swapping the mock biosensor or demo auth for
 * real implementations happens here.
 */
export function buildServices(
  store: DocumentStore,
  repository: LutealineRepository,
  kv: KeyValueStore,
): AppServices {
  // The mock needs the cycle position to generate realistic values; the
  // cycle data is re-read from storage before every measurement.
  let cycle: { starts: string[]; typical: number } = { starts: [], typical: 28 };
  const mock = new MockBiosensorService({
    delayMs: 1800,
    cycleContext: (at) => {
      const info = getCycleDay(toIsoDate(at), cycle.starts, cycle.typical);
      return info && { cycleDay: info.cycleDay, cycleLength: info.cycleLength };
    },
  });
  const biosensor: BiosensorService = {
    source: mock.source,
    measure: async (req) => {
      const profile = await repository.getProfile();
      cycle = { starts: await repository.listPeriodStarts(), typical: profile?.typicalCycleLength ?? 28 };
      return mock.measure(req);
    },
  };

  return { store, repository, auth: new DemoAuthService(kv), biosensor };
}
