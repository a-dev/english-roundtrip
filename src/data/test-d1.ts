import { Database } from 'bun:sqlite';

type Query = {
  get(...values: unknown[]): unknown;
  all(...values: unknown[]): unknown[];
  run(...values: unknown[]): { changes: number; lastInsertRowid: number | bigint };
};

/** A minimal D1 adapter backed by Bun's in-memory SQLite for repository tests. */
export class TestD1 {
  readonly #sqlite = new Database(':memory:');

  async migrate(): Promise<void> {
    const migration = await Bun.file(new URL('./migrations/0001_init.sql', import.meta.url)).text();
    this.#sqlite.exec(migration);
  }

  asD1(): D1Database {
    const sqlite = this.#sqlite;

    return {
      prepare(sql: string) {
        let values: unknown[] = [];
        const query = sqlite.query(sql) as unknown as Query;
        const statement = {
          bind(...parameters: unknown[]) {
            values = parameters;
            return statement;
          },
          async first<T>(): Promise<T | null> {
            return (query.get(...values) ?? null) as T | null;
          },
          async all<T>(): Promise<{ results: T[]; success: true; meta: Record<string, never> }> {
            return { results: query.all(...values) as T[], success: true, meta: {} };
          },
          async run(): Promise<{
            success: true;
            meta: { changes: number; last_row_id: number | bigint };
          }> {
            const result = query.run(...values);
            return {
              success: true,
              meta: { changes: result.changes, last_row_id: result.lastInsertRowid },
            };
          },
        };

        return statement;
      },
    } as unknown as D1Database;
  }

  close(): void {
    this.#sqlite.close();
  }
}
