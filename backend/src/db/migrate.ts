import fs from "node:fs";
import path from "node:path";
import { pool } from "./index";

export async function migrate() {
  const client = await pool.connect();
  try {
    // 1. Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Read migration files
    const migrationsDir = path.resolve(import.meta.dir, "../../db/migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log("[db] No migrations directory found, skipping migrations.");
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    // 3. Query already applied migrations
    const { rows } = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations"
    );
    const applied = new Set(rows.map((r) => r.filename));

    // 4. Run pending migrations in transactions
    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      console.log(`[db] Applying migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`[db] Applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[db] Migration failed: ${file}`);
        throw err;
      }
    }
  } finally {
    client.release();
  }
}
