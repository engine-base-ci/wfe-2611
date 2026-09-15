// pnpm db:migrate / ci:rls-enabled / ci:no-vendor-sql の入口（tsx で実行）
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "./migrate.js";
import { noVendorSql, rlsEnabled } from "./ci.js";

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
  console.error("usage: cli.ts migrate | rls-enabled | no-vendor-sql");
  return 1;
}
main().then(
  (c) => process.exit(c),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
