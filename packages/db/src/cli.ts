// pnpm db:migrate / ci:rls-enabled / ci:no-vendor-sql の入口（tsx で実行）
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "./migrate.js";
import { MIGRATIONS } from "./index.js";
import { noVendorSql, rlsEnabled } from "./ci.js";
import { runMatrix } from "./matrix.js";
import { seedAccessMatrix } from "./seeds.js";
import { readFileSync } from "node:fs";
import pg from "pg";
import { adminDatabaseUrl, requireEnv, rolePasswords } from "@kaname/config";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const cmd = process.argv[2];
// 管理者の接続（staging／本番は DATABASE_ADMIN_URL・ローカルは superuser の DATABASE_URL）。DB に触らない検査（no-vendor-sql）では読まない
const url = cmd === "no-vendor-sql" ? null : (adminDatabaseUrl() ?? requireEnv("DATABASE_URL"));

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
    const r = await migrate(url, pkg, rolePasswords());
    console.log(
      `migration 適用 ${r.applied.length}（${r.applied.join(", ") || "なし"}）／ 済み ${r.skipped.length}／ 役割のパスワード ${r.passwords.join(", ") || "既定のまま"}`,
    );
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
  if (cmd === "fresh-migrate") {
    // G12：まっさらな DB に全 migration＋policy（＋認証の表は packages/auth の cli）を当て、記録と RLS を確かめて捨てる
    const name = `kaname_ci_${Date.now().toString(36)}`;
    const adminUrl = new URL(url);
    const dbName = adminUrl.pathname.slice(1);
    adminUrl.pathname = "/postgres";
    const admin = new pg.Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    try {
      await admin.query(`create database "${name}"`);
      const fresh = new URL(url);
      fresh.pathname = `/${name}`;
      const r = await migrate(fresh.toString(), pkg);
      const rls = await rlsEnabled(fresh.toString());
      const ok = r.applied.length === MIGRATIONS.length && rls.ok;
      console.log(
        `[G12] fresh DB ${name}: migration ${r.applied.length}/${MIGRATIONS.length} 適用・RLS ${rls.ok ? "全表 OK" : "不足 " + rls.missing.join(",")}（元 DB ${dbName} は触らない）`,
      );
      await admin.query(`drop database "${name}"`);
      return ok ? 0 : 1;
    } finally {
      await admin.end();
    }
  }
  if (cmd === "access-matrix") {
    // この検査は種を入れ替えるために会社・層・メンバー・権限を truncate する。
    // 触っている DB でそれをやると、人が手で作った会社だけが消えて利用者は残り、
    // 「登録済みなのに会社が無い」使えない口座になる。だから毎回 捨てる DB を作ってそこで回す。
    // 引数は「cli.ts access-matrix [file]」か「--matrix file」。pnpm の渡す "--" は読み飛ばす（G33 が "--" をファイルと読んでいた）
    const rest = process.argv.slice(3).filter((x) => x !== "--");
    const at = rest.indexOf("--matrix");
    const file =
      (at >= 0 ? rest[at + 1] : rest[0]) ?? join(pkg, "..", "..", "07_qa", "test-plan", "access-matrix.json");
    const cases = JSON.parse(readFileSync(file, "utf8")).cases;
    const name = `kaname_matrix_${Date.now().toString(36)}`;
    const adminUrl = new URL(url);
    adminUrl.pathname = "/postgres";
    const root = new pg.Client({ connectionString: adminUrl.toString() });
    await root.connect();
    await root.query(`create database "${name}"`);
    const scratch = new URL(url);
    scratch.pathname = `/${name}`;
    const scratchUrl = scratch.toString();
    await migrate(scratchUrl, pkg);
    const admin = new pg.Pool({ connectionString: scratchUrl, max: 2 });
    const app = new pg.Pool({ connectionString: scratchUrl.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@"), max: 2 });
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
      await root.query(`drop database "${name}"`).catch(() => undefined);
      await root.end();
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
