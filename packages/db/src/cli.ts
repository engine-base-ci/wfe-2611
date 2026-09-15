// pnpm db:migrate / ci:rls-enabled / ci:no-vendor-sql の入口（tsx で実行）
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "./migrate.js";
import { noVendorSql, rlsEnabled } from "./ci.js";
import { runMatrix } from "./matrix.js";
import { seedAccessMatrix } from "./seeds.js";
import { readFileSync } from "node:fs";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const url = process.env["DATABASE_URL"] ?? "";
const cmd = process.argv[2];

async function main(): Promise<number> {
  if (cmd === "no-vendor-sql") {
    const r = noVendorSql(pkg);
    console.log(r.ok ? "[G5] ベンダー固有 SQL なし" : `[G5] ベンダー固有 SQL:\n  ${r.hits.join("\n  ")}`);
    return r.ok ? 0 : 1;
  }
  if (!url) {
    console.error("DATABASE_URL が無い");
    return 1;
  }
  if (cmd === "migrate") {
    const r = await migrate(url, pkg);
    console.log(`migration 適用 ${r.applied.length}（${r.applied.join(", ") || "なし"}）／ 済み ${r.skipped.length}`);
    return 0;
  }
  if (cmd === "rls-enabled") {
    const r = await rlsEnabled(url);
    console.log(
      r.ok
        ? `[G4] RLS 有効（enable＋force）: ${r.tables} 表`
        : `[G4] RLS が無い・force でない表: ${r.missing.join(", ")}`,
    );
    return r.ok ? 0 : 1;
  }
  if (cmd === "access-matrix") {
    const file = process.argv[3] ?? join(pkg, "..", "..", "07_qa", "test-plan", "access-matrix.json");
    const cases = JSON.parse(readFileSync(file, "utf8")).cases;
    const admin = new pg.Pool({ connectionString: url, max: 2 });
    const app = new pg.Pool({ connectionString: url.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"), max: 2 });
    try {
      const r = await runMatrix(app, admin, cases, seedAccessMatrix);
      const tables = new Set(r.skipped.map((x) => x.table)).size;
      console.log(
        `[G33] 実行 ${r.executed}／PASS ${r.passed}／FAIL ${r.failed.length}／未 migration の表 ${tables}（その場合は担当 T-D-* で流す）`,
      );
      for (const f of r.failed.slice(0, 20))
        console.log(`  ★ ${f.case.table} ${f.case.policy} ${f.case.case} → ${f.got}（期待 ${f.case.expected}）`);
      return r.failed.length ? 1 : 0;
    } finally {
      await app.end();
      await admin.end();
    }
  }
  console.error("usage: cli.ts migrate | rls-enabled | no-vendor-sql | access-matrix [file]");
  return 1;
}
main().then(
  (c) => process.exit(c),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
