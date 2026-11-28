// CI ゲート G4（RLS 全テーブル有効）・G5（ベンダー固有 SQL の検出）。pnpm ci:rls-enabled / pnpm ci:no-vendor-sql が呼ぶ。
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

export async function rlsEnabled(databaseUrl: string): Promise<{ ok: boolean; missing: string[]; tables: number }> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const r = await client.query<{ tablename: string; rowsecurity: boolean; forcerowsecurity: boolean }>(
      "select c.relname as tablename, c.relrowsecurity as rowsecurity, c.relforcerowsecurity as forcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1",
    );
    const missing = r.rows.filter((x) => !x.rowsecurity || !x.forcerowsecurity).map((x) => x.tablename);
    return { ok: missing.length === 0, missing, tables: r.rows.length };
  } finally {
    await client.end();
  }
}

export const VENDOR_SQL = [
  /auth\.uid\s*\(/i,
  /pgsodium/i,
  /supabase_vault/i,
  /pg_graphql/i,
  /\bsupabase_functions\b/i,
  /\bauth\.jwt\s*\(/i,
];

export function noVendorSql(dir: string): { ok: boolean; hits: string[] } {
  const hits: string[] = [];
  for (const sub of ["migrations", "policies"]) {
    for (const f of readdirSync(join(dir, sub)).filter((x) => x.endsWith(".sql"))) {
      const lines = readFileSync(join(dir, sub, f), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (line.trimStart().startsWith("--")) return;
        for (const re of VENDOR_SQL) if (re.test(line)) hits.push(`${sub}/${f}:${i + 1} ${line.trim().slice(0, 80)}`);
      });
    }
  }
  return { ok: hits.length === 0, hits };
}
