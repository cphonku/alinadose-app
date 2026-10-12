import type { RecordMeta } from '../domain/models';

export const COLLECTIONS = [
  'profile',
  'periodStarts',
  'hormoneReadings',
  'questionnaires',
  'medicationLogs',
  'dosingPlans',
  'cycleAdjustments',
] as const;

export type Collection = (typeof COLLECTIONS)[number];

/** Optional calendar date stored alongside a record for range queries. */
export type StoredRecord = RecordMeta & { date?: string };

/**
 * Minimal persistence API: records are stored as JSON documents per
 * collection. Implemented by SQLite on device and in memory for tests.
 */
export interface DocumentStore {
  all<T extends StoredRecord>(collection: Collection): Promise<T[]>;
  get<T extends StoredRecord>(collection: Collection, id: string): Promise<T | null>;
  put<T extends StoredRecord>(collection: Collection, record: T): Promise<void>;
  putMany<T extends StoredRecord>(collection: Collection, records: T[]): Promise<void>;
  delete(collection: Collection, id: string): Promise<void>;
  clear(): Promise<void>;
}

/** Deep copy so callers can never mutate stored records by reference. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class MemoryDocumentStore implements DocumentStore {
  private data = new Map<Collection, Map<string, StoredRecord>>();

  private table(c: Collection) {
    let t = this.data.get(c);
    if (!t) this.data.set(c, (t = new Map()));
    return t;
  }

  async all<T extends StoredRecord>(c: Collection): Promise<T[]> {
    return [...this.table(c).values()].map((r) => clone(r) as T);
  }
  async get<T extends StoredRecord>(c: Collection, id: string): Promise<T | null> {
    const r = this.table(c).get(id);
    return r ? (clone(r) as T) : null;
  }
  async put<T extends StoredRecord>(c: Collection, record: T): Promise<void> {
    this.table(c).set(record.id, clone(record));
  }
  async putMany<T extends StoredRecord>(c: Collection, records: T[]): Promise<void> {
    for (const r of records) await this.put(c, r);
  }
  async delete(c: Collection, id: string): Promise<void> {
    this.table(c).delete(id);
  }
  async clear(): Promise<void> {
    this.data.clear();
  }
}
