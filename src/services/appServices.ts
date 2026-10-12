import { openDatabaseAsync } from 'expo-sqlite';
import { LutealineRepository } from '../data/LutealineRepository';
import { SqliteDocumentStore, migrate } from '../data/SqliteDocumentStore';
import { getCycleDay } from '../domain/cycle';
import { toIsoDate } from '../domain/dates';
import type { DocumentStore } from '../data/DocumentStore';
import { DemoAuthService } from './auth/DemoAuthService';
import { secureKeyValueStore } from './auth/SecureKeyValueStore';
import type { BiosensorService } from './biosensor/BiosensorService';
import { MockBiosensorService } from './biosensor/MockBiosensorService';

export interface AppServices {
  store: DocumentStore;
  repository: LutealineRepository;
  auth: DemoAuthService;
  biosensor: BiosensorService;
}

const DATABASE_NAME = 'lutealine.db';

/**
 * Creates the app's services. The UI gets everything from here, so swapping
 * the mock biosensor or demo auth for real implementations happens in one place.
 */
export async function createAppServices(): Promise<AppServices> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await migrate(db);
  const store = new SqliteDocumentStore(db);
  const repository = new LutealineRepository(store);

  // The mock needs the cycle position to generate realistic values; the
  // cycle data is re-read from storage before every measurement.
  let cycleCache: { starts: string[]; typical: number } = { starts: [], typical: 28 };
  const refreshCycle = async () => {
    const profile = await repository.getProfile();
    cycleCache = {
      starts: await repository.listPeriodStarts(),
      typical: profile?.typicalCycleLength ?? 28,
    };
  };
  await refreshCycle();

  const mock = new MockBiosensorService({
    delayMs: 1500,
    cycleContext: (at) => {
      const info = getCycleDay(toIsoDate(at), cycleCache.starts, cycleCache.typical);
      return info && { cycleDay: info.cycleDay, cycleLength: info.cycleLength };
    },
  });
  const biosensor: BiosensorService = {
    source: mock.source,
    measure: async (req) => {
      await refreshCycle();
      return mock.measure(req);
    },
  };

  return { store, repository, auth: new DemoAuthService(secureKeyValueStore), biosensor };
}
