/** Values accepted by the D1 prepared-statement binding API. */
export type SqlValue = string | number | boolean | null;

/** Execute a typed single-row query against a D1 binding. */
export async function first<T>(
  db: D1Database,
  sql: string,
  parameters: readonly SqlValue[] = [],
): Promise<T | null> {
  return db
    .prepare(sql)
    .bind(...parameters)
    .first<T>();
}

/** Execute a typed multi-row query against a D1 binding. */
export async function all<T>(
  db: D1Database,
  sql: string,
  parameters: readonly SqlValue[] = [],
): Promise<T[]> {
  const result = await db
    .prepare(sql)
    .bind(...parameters)
    .all<T>();
  return result.results;
}

/** Execute a D1 write query with bound parameters. */
export function run(db: D1Database, sql: string, parameters: readonly SqlValue[] = []) {
  return db
    .prepare(sql)
    .bind(...parameters)
    .run();
}

/** Serialize the JSON string arrays stored by D1's TEXT columns. */
export function serializeStringArray(values: readonly string[]): string {
  return JSON.stringify(values);
}

/** Safely deserialize persisted JSON string arrays, treating legacy/corrupt values as empty. */
export function parseStringArray(value: string | null): string[] {
  if (value === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : [];
  } catch {
    return [];
  }
}
