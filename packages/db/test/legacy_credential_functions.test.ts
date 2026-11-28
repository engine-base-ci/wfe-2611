// K-371「前の預けたログイン情報とブラウザの DB の関数を消す」の試験（本物の DB・migration を全部当てた後）。
//   消す 8 つ：前の道すじ（/api/auth-ext/vault・/bridge/credentials・/bridge/code・K-358 が消す）と前のブラウザの道（/agent/browser・/agent/browser-check・K-367 が消す）
//   だけが呼んでいた関数。残す関数（契約の口が今も呼ぶ物と、K-354・K-355 の新しい関数）は消さない。
//   行 ID（K371-DB-…・K371-SRC-…）は 11_tickets/K-371.md の表と 1 対 1。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { migrate } from "../src/migrate.js";
import { MIGRATIONS } from "../src/index.js";

const DB_URL = process.env["DATABASE_URL"]!;
const here = dirname(fileURLToPath(import.meta.url));
const PKG = join(here, "..");
const ROOT = join(PKG, "..", "..");
const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });

/** 消す関数（名前と、最後の版の引数の型） */
const GONE: readonly { name: string; args: string }[] = [
  { name: "my_credentials", args: "uuid" },
  { name: "bridge_credential", args: "uuid, uuid, uuid" },
  { name: "credential_login_check_retry", args: "uuid, uuid" },
  { name: "agent_answer_code", args: "uuid, uuid, text, text" },
  { name: "bridge_take_code", args: "uuid, uuid, text" },
  { name: "bridge_login_check_result", args: "uuid, uuid, text, text" },
  { name: "agent_set_browser", args: "uuid, text" },
  { name: "agent_browser_check", args: "uuid, text" },
];
const sig = (f: { name: string; args: string }) => `app.${f.name}(${f.args})`;
/** 残す関数：今も口が呼ぶ（預ける K-352・Bridge の窓 K-366・会話の画面の PC の様子）と、新しい関数（K-354・K-355） */
const KEPT_SIGS = [
  "app.credential_login_check_enqueue(uuid, uuid)",
  "app.credential_service(text, text)",
  "app.bridge_set_browser(uuid, text)",
  "app.bridge_state(uuid)",
];
const KEPT_NAMES = [
  "bridge_credential_for_job",
  "credential_check_start",
  "credential_check_answer",
  "bridge_credential_check_report",
];

const FILE = MIGRATIONS.filter((m) => /^\d{14}_drop_legacy_credential_functions\.sql$/.test(m));
const body = () => readFileSync(join(PKG, "migrations", FILE[0]!), "utf8");
const exists = async (s: string) =>
  (await admin.query<{ p: string | null }>("select to_regprocedure($1)::text as p", [s])).rows[0]!.p !== null;

beforeAll(async () => {
  await migrate(DB_URL, PKG);
});
afterAll(async () => {
  await admin.end();
});

describe("K-371 前の DB の関数を消す", () => {
  it("K371-DB-001 消す 8 つの関数（my_credentials・bridge_credential・credential_login_check_retry・agent_answer_code・bridge_take_code・bridge_login_check_result・agent_set_browser・agent_browser_check）は、どの引数の形でも app に無い", async () => {
    const left = await admin.query<{ proname: string }>(
      "select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = any($1)",
      [GONE.map((f) => f.name)],
    );
    expect(left.rows.map((r) => r.proname)).toEqual([]);
  });

  it("K371-DB-002 残す関数は在り、kaname_app が呼べる：credential_login_check_enqueue・credential_service・bridge_set_browser・bridge_state と、新しい bridge_credential_for_job・credential_check_start・credential_check_answer・bridge_credential_check_report。確かめの仕事が止まったときの引き金（bridge_jobs_login_check_stopped）も在る", async () => {
    for (const s of KEPT_SIGS) {
      expect(await exists(s), `${s} が無い`).toBe(true);
      const ok = await admin.query<{ ok: boolean }>(
        "select has_function_privilege('kaname_app', $1, 'execute') as ok",
        [s],
      );
      expect(ok.rows[0]!.ok, `${s} を kaname_app が呼べない`).toBe(true);
    }
    const names = await admin.query<{ proname: string }>(
      "select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = any($1)",
      [KEPT_NAMES],
    );
    expect(names.rows.map((r) => r.proname).sort()).toEqual([...KEPT_NAMES].sort());
    const trg = await admin.query(
      "select 1 from pg_trigger where tgname = 'bridge_jobs_login_check_stopped' and not tgisinternal",
    );
    expect(trg.rowCount).toBe(1);
  });

  it("K371-DB-003 migration は 1 本（名前 <時刻 14 けた>_drop_legacy_credential_functions.sql・K-327 の時刻の名前・並びに載り、ファイルが在る）で、中身は 8 つの drop function if exists app.…(引数) だけ（cascade を使わない）", () => {
    expect(FILE.length).toBe(1);
    expect(existsSync(join(PKG, "migrations", FILE[0]!))).toBe(true);
    const sql = body().replace(/--[^\n]*/g, "");
    const drops = [...sql.matchAll(/drop function if exists (app\.[a-z_]+\([^)]*\))\s*;/gi)].map((m) =>
      m[1]!.replace(/\s+/g, " "),
    );
    expect(drops.sort()).toEqual(GONE.map(sig).sort());
    expect(sql).not.toMatch(/\bcascade\b/i);
    expect(sql.replace(/drop function if exists app\.[a-z_]+\([^)]*\)\s*;/gi, "").trim()).toBe("");
  });

  it("K371-DB-004 もう一度当てても誤りにならず（if exists）、残す関数は消えない", async () => {
    await admin.query(body());
    for (const s of KEPT_SIGS) expect(await exists(s), `${s} が消えた`).toBe(true);
  });

  it("K371-DB-005 手順 S1 の失敗：消す途中で誤り（関数に頼る物がある）なら取引ごと戻り、8 つのどれも消えない（migration の 1 本は 1 つの取引）", async () => {
    const c = await admin.connect();
    try {
      await c.query("begin");
      for (const f of GONE) {
        const params = f.args
          .split(", ")
          .map((t, i) => `p${i} ${t}`)
          .join(", ");
        await c.query(`create function app.${f.name}(${params}) returns int language sql as 'select 1'`);
      }
      await c.query("create view public.k371_dep as select app.agent_browser_check(null::uuid, null::text) as v");
      await c.query("savepoint s1");
      await expect(c.query(body())).rejects.toThrow(/depend/);
      await c.query("rollback to savepoint s1");
      for (const f of GONE) {
        const r = await c.query<{ p: string | null }>("select to_regprocedure($1)::text as p", [sig(f)]);
        expect(r.rows[0]!.p, `${sig(f)} が消えている`).not.toBeNull();
      }
    } finally {
      await c.query("rollback");
      c.release();
    }
    expect(await exists("app.agent_browser_check(uuid, text)")).toBe(false);
  });
});

// ---- 使う所が残っていない（ファイルを読む） ----

const DIRS = [
  "apps/api/src",
  "apps/api/test",
  "apps/bridge/src",
  "apps/bridge/test",
  "apps/web/app",
  "apps/web/features",
  "apps/web/lib",
  "apps/web/components",
  "apps/web/tests",
  "packages",
  "scripts",
  "05_flow",
];
const SKIP = new Set(["node_modules", "dist", ".next", "migrations"]);
const SELF = relative(ROOT, fileURLToPath(import.meta.url));

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    if (SKIP.has(n)) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|mjs|js|py|sql|json)$/.test(n) ? [p] : [];
  });
}

describe("K-371 使う所", () => {
  it("K371-SRC-001 製品のコード・試験・道具（apps・packages・scripts・05_flow。migration とこの試験を除く）のどこにも、消す 8 つの関数の名前（app.<名前>）が無い", () => {
    const re = new RegExp(`app\\.(${GONE.map((f) => f.name).join("|")})\\b`);
    const all = DIRS.flatMap((d) => files(join(ROOT, d)));
    expect(all.length).toBeGreaterThan(100);
    const hits = all
      .map((f) => relative(ROOT, f))
      .filter((f) => f !== SELF && re.test(readFileSync(join(ROOT, f), "utf8")));
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
