import { openDatabaseAsync } from 'expo-sqlite';
import { LutealineRepository } from '../data/LutealineRepository';
import { SqliteDocumentStore, migrate } from '../data/SqliteDocumentStore';
import { secureKeyValueStore } from './auth/SecureKeyValueStore';
import { buildServices, type AppServices } from './buildServices';
import { HttpRemotePlanService, planServerUrl } from './plans/HttpRemotePlanService';

export type { AppServices } from './buildServices';

const DATABASE_NAME = 'lutealine.db';

/**
 * Native (iOS/Android): data in SQLite, the account in secure storage.
 * The web build (appServices.web.ts) keeps everything in memory for previews.
 */
export async function createAppServices(): Promise<AppServices> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await migrate(db);
  const store = new SqliteDocumentStore(db);
  return buildServices(store, new LutealineRepository(store), secureKeyValueStore, new HttpRemotePlanService(planServerUrl('native')));
}
