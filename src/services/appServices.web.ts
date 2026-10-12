import { MemoryDocumentStore } from '../data/DocumentStore';
import { LutealineRepository } from '../data/LutealineRepository';
import { MemoryKeyValueStore } from './auth/AuthService';
import { buildServices, type AppServices } from './buildServices';
import { HttpRemotePlanService, planServerUrl } from './plans/HttpRemotePlanService';
import { MemoryRemotePlanService } from './plans/MemoryRemotePlanService';
import { IS_PREVIEW } from './preview';

export type { AppServices } from './buildServices';

/**
 * Web preview only: in-memory storage, cleared on page reload.
 * In the shareable preview there is no plan relay, so the physician portal and
 * the patient app share an in-memory plan server within the same browser tab.
 */
export async function createAppServices(): Promise<AppServices> {
  const store = new MemoryDocumentStore();
  const remotePlans = IS_PREVIEW ? new MemoryRemotePlanService() : new HttpRemotePlanService(planServerUrl('web'));
  return buildServices(store, new LutealineRepository(store), new MemoryKeyValueStore(), remotePlans);
}
