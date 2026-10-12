import { MemoryDocumentStore } from '../data/DocumentStore';
import { LutealineRepository } from '../data/LutealineRepository';
import { MemoryKeyValueStore } from './auth/AuthService';
import { buildServices, type AppServices } from './buildServices';

export type { AppServices } from './buildServices';

/** Web preview only: in-memory storage, cleared on page reload. */
export async function createAppServices(): Promise<AppServices> {
  const store = new MemoryDocumentStore();
  return buildServices(store, new LutealineRepository(store), new MemoryKeyValueStore());
}
