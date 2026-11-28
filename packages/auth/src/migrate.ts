// 認証の表（schema kaname_auth）を Better Auth の定義から作る。pnpm db:migrate が db の migration の後に呼ぶ。
import { getMigrations } from "better-auth/db/migration";
import pg from "pg";
import { createAuth } from "./index.js";

/** 管理者の接続で走らせる（schema と表を作る）。実行時の認証は kaname_auth で接続する */
export async function migrateAuth(adminDatabaseUrl: string): Promise<string[]> {
  const appPool = new pg.Pool({ connectionString: adminDatabaseUrl, max: 1 });
  const { auth, pool } = createAuth({
    authDatabaseUrl: adminDatabaseUrl,
    appPool,
    secret: "migrate-only-secret-not-used-000000",
    baseURL: "http://localhost",
  });
  try {
    const m = await getMigrations(auth.options);
    const created = m.toBeCreated.map((t) => t.table);
    await m.runMigrations();
    return created;
  } finally {
    await pool.end();
    await appPool.end();
  }
}
