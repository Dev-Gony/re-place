import { Pool, type QueryResult, type QueryResultRow } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  rePlacePool?: Pool;
};

function getPool() {
  if (globalForDb.rePlacePool) return globalForDb.rePlacePool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  const pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
    application_name: "re-place-web",
  });
  // Idle clients can fail independently of a request. Do not log credentials.
  pool.on("error", () => {
    console.error("[Re:Place] idle database connection failed");
  });
  // One pool per warm process, including production. Never a new pool per query.
  globalForDb.rePlacePool = pool;
  return pool;
}

export function queryDb<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, [...values]);
}
