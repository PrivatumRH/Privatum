import { Pool, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/privatum";

export const pool = new Pool({
  connectionString,
});

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]) {
  return pool.query<T>(text, params);
}
