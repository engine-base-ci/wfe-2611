// migration の適用（関門 C2 の中）。migrations/NNNN_*.sql → 同番号の policies/NNNN_*.sql の順に、未適用だけを 1 トランザクションで流す。
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { MIGRATIONS, checkMigrationOrder } from "./index.js";

export interface MigrateResult {
  applied: string[];
  skipped: string[];
  /** 環境変数からパスワードを入れ替えた役割（T-F-18：migration の直書きは開発の既定。staging／本番は KANAME_*_DB_PASSWORD） */
  passwords: string[];
}
export const ROLE_PASSWORD_ENV: Record<string, string> = {
  kaname_app: "KANAME_APP_DB_PASSWORD",
  kaname_auth: "KANAME_AUTH_DB_PASSWORD",
};
/** 役割のパスワードを環境から入れる（無い名前は触らない・役割が無ければ触らない）。migration に平文のまま頼らないため */
export async function applyRolePasswords(
  client: pg.Client,
  env: Record<string, string | undefined>,
): Promise<string[]> {
  const done: string[] = [];
  for (const [role, key] of Object.entries(ROLE_PASSWORD_ENV)) {
    const pw = env[key];
    if (!pw) continue;
    const r = await client.query("select 1 from pg_roles where rolname = $1", [role]);
    if (!r.rowCount) continue;
    await client.query(`alter role ${role} with password ${client.escapeLiteral(pw)}`);
    done.push(role);
  }
  return done;
}

export async function migrate(
  databaseUrl: string,
  dir: string,
  env: Record<string, string | undefined> = {}, // 役割のパスワード（packages/config の rolePasswords() を渡す。ここでは環境を直接読まない）
): Promise<MigrateResult> {
  const order = checkMigrationOrder(MIGRATIONS);
  if (!order.ok) throw new Error(`migration の並びが崩れている: ${order.reason}`);
  const files = readdirSync(join(dir, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const unknown = files.filter((f) => !(MIGRATIONS as readonly string[]).includes(f));
  if (unknown.length) throw new Error(`MIGRATIONS に無い migration ファイル: ${unknown.join(", ")}（index.ts に足す）`);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const applied: string[] = [];
  const skipped: string[] = [];
  let passwords: string[];
  try {
    await client.query("create schema if not exists app");
    await client.query(
      "create table if not exists app.schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const done = new Set(
      (await client.query<{ name: string }>("select name from app.schema_migrations")).rows.map((r) => r.name),
    );
    for (const name of MIGRATIONS) {
      if (done.has(name)) {
        skipped.push(name);
        continue;
      }
      await client.query("begin");
      try {
        await client.query(readFileSync(join(dir, "migrations", name), "utf8"));
        const policy = join(dir, "policies", name);
        if (existsSync(policy)) await client.query(readFileSync(policy, "utf8"));
        await client.query("insert into app.schema_migrations (name) values ($1) on conflict do nothing", [name]);
        await client.query("commit");
        applied.push(name);
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }
    passwords = await applyRolePasswords(client, env);
  } finally {
    await client.end();
  }
  return { applied, skipped, passwords };
}
