import type { RecordMeta } from '../domain/models';

/** Current version of the stored record shapes in src/domain/models.ts. */
export const RECORD_SCHEMA_VERSION = 1;

/** Random RFC 4122 v4-style id. Uniqueness on one device is all we need. */
export function newId(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(random() * 16);
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function newMeta(now: Date = new Date(), random?: () => number): RecordMeta {
  const ts = now.toISOString();
  return { id: newId(random), createdAt: ts, updatedAt: ts, schemaVersion: RECORD_SCHEMA_VERSION };
}

export function touch<T extends RecordMeta>(record: T, now: Date = new Date()): T {
  return { ...record, updatedAt: now.toISOString() };
}
