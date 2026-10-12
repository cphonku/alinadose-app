import type { SQLiteDatabase } from 'expo-sqlite';
import { COLLECTIONS, type Collection, type DocumentStore, type StoredRecord } from './DocumentStore';

/** Bump when the table layout changes and add a migration step below. */
const DATABASE_VERSION = 1;

/**
 * One table per collection. The record itself is stored as JSON in `data`;
 * `date` and timestamps are duplicated into columns for indexing and so the
 * data can be exported or inspected without parsing every row.
 */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    const tables = COLLECTIONS.map(
      (c) => `
      CREATE TABLE IF NOT EXISTS ${c} (
        id TEXT PRIMARY KEY NOT NULL,
        date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_${c}_date ON ${c}(date);`,
    ).join('\n');
    await db.execAsync(`PRAGMA journal_mode = WAL;\n${tables}`);
    version = 1;
  }
  // Future migrations: if (version === 1) { ...; version = 2; }

  await db.execAsync(`PRAGMA user_version = ${version}`);
}

export class SqliteDocumentStore implements DocumentStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async all<T extends StoredRecord>(c: Collection): Promise<T[]> {
    const rows = await this.db.getAllAsync<{ data: string }>(
      `SELECT data FROM ${c} ORDER BY date, created_at`,
    );
    return rows.map((r) => JSON.parse(r.data) as T);
  }

  async get<T extends StoredRecord>(c: Collection, id: string): Promise<T | null> {
    const row = await this.db.getFirstAsync<{ data: string }>(`SELECT data FROM ${c} WHERE id = ?`, id);
    return row ? (JSON.parse(row.data) as T) : null;
  }

  async put<T extends StoredRecord>(c: Collection, record: T): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO ${c} (id, date, created_at, updated_at, schema_version, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      record.id,
      record.date ?? null,
      record.createdAt,
      record.updatedAt,
      record.schemaVersion,
      JSON.stringify(record),
    );
  }

  async putMany<T extends StoredRecord>(c: Collection, records: T[]): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      for (const r of records) await this.put(c, r);
    });
  }

  async delete(c: Collection, id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM ${c} WHERE id = ?`, id);
  }

  async clear(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      for (const c of COLLECTIONS) await this.db.runAsync(`DELETE FROM ${c}`);
    });
  }
}
