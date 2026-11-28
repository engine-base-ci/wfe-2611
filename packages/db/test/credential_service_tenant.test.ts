// K-348「預けたログイン情報のまわりの、会社をまたぐ結びつきを DB で止める」の試験（本物の DB・migration を全部当てた後）。
//   app.credential_service は、その会社の行と運営の行だけを引く（運営の行を先に・仮の形・代表の答え待ち）。
//   credentials.service_id は、同じ会社か運営の台帳の行にだけ結べる（引き金・errcode 23514）。
//   行 ID（K348-DB-…）は 11_tickets/K-348.md の表と 1 対 1。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { MIGRATIONS } from "../src/index.js";
import { seedAccessMatrix } from "../src/seeds.js";

const DB_URL = process.env["DATABASE_URL"]!;
const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const admin = new pg.Pool({ connectionString: DB_URL, max: 3 });
const T = 60_000;
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;
let OPS = "";
const tag = randomBytes(4).toString("hex");
const made: { services: string[]; creds: string[] } = { services: [], creds: [] };

beforeAll(async () => {
  await migrate(DB_URL, PKG);
  const c = await admin.connect();
  try {
    S = await seedAccessMatrix(c);
  } finally {
    c.release();
  }
  OPS = (await admin.query<{ id: string }>("select app.ops_tenant_id()::text as id")).rows[0]!.id;
}, T);
afterAll(async () => {
  // 実装の前（引き金が無い）は DB-005 の挿し込みが通って行が残るので、作った台帳の行を指す credentials もまとめて消す
  await admin.query("delete from credentials where id = any($1::uuid[]) or service_id = any($2::uuid[])", [
    made.creds,
    made.services,
  ]);
  if (made.services.length)
    await admin.query("delete from service_registry where id = any($1::uuid[])", [made.services]);
  await admin.end();
});

/** 台帳の行を 1 つ作る（tenant の会社の行） */
async function service(tenant: string, name: string, domain: string, verdict: string): Promise<string> {
  const id = (
    await admin.query<{ id: string }>(
      "insert into service_registry (tenant_id, name, domain, automation_verdict_id) values ($1, $2, $3, $4) returning id",
      [tenant, name, domain, verdict],
    )
  ).rows[0]!.id;
  made.services.push(id);
  return id;
}
/** 会社 A の預けたログイン情報の行を 1 つ作る（service_id は null） */
async function credA(): Promise<string> {
  const id = (
    await admin.query<{ id: string }>(
      "insert into credentials (tenant_id, scope_id, owner_member_id, service_name, kind_id, vault_ref, created_by) values ($1, $2, $3, $4, 'basic', $5, $3) returning id",
      [S.tenantA, S.scopeRootA, S.bossA, `k348-${tag}`, `sec_k348_${tag}`],
    )
  ).rows[0]!.id;
  made.creds.push(id);
  return id;
}
/** 会社の文脈（tenant が null なら文脈なし）で credential_service を呼ぶ */
async function lookup(tenant: string | null, name: string | null, domain: string | null): Promise<string | null> {
  const c = await admin.connect();
  try {
    await c.query("begin");
    if (tenant) await c.query("select set_config('app.tenant_id', $1, true)", [tenant]);
    const r = await c.query<{ id: string | null }>("select app.credential_service($1, $2)::text as id", [name, domain]);
    return r.rows[0]!.id;
  } finally {
    await c.query("rollback");
    c.release();
  }
}
const serviceOf = async (id: string) =>
  (await admin.query<{ s: string | null }>("select service_id::text as s from credentials where id = $1", [id]))
    .rows[0]!.s;
const migrationSql = (): string => {
  const name = MIGRATIONS.find((m) => /^\d{14}_credential_service_tenant\.sql$/.test(m));
  expect(name, "migration <時刻 14 けた>_credential_service_tenant.sql が一覧に無い").toBeTruthy();
  const p = join(PKG, "migrations", name!);
  expect(existsSync(p)).toBe(true);
  return readFileSync(p, "utf8");
};
const pgCode = (e: unknown) => (e as { code?: string } | null)?.code;

describe("K-348 台帳のサービスを引く関数（会社の行と運営の行だけ）", () => {
  it(
    "K348-DB-001 別の会社の台帳にだけ在る宛先・名前は、会社 A の文脈で null",
    async () => {
      const d = `k348-b-${tag}.example`;
      const n = `K348B名${tag}`;
      await service(S.tenantB, n, d, "api");
      expect(await lookup(S.tenantA, null, d)).toBeNull();
      expect(await lookup(S.tenantA, n, null)).toBeNull();
    },
    T,
  );
  it(
    "K348-DB-002 運営の台帳の行は、会社 A の文脈でその id（仮・代表の答え待ち）",
    async () => {
      const d = `k348-ops-${tag}.example`;
      const id = await service(OPS, `K348運営${tag}`, d, "forbidden");
      expect(await lookup(S.tenantA, null, d)).toBe(id);
    },
    T,
  );
  it(
    "K348-DB-003 自分の会社の行は、会社 A の文脈でその id・会社 B の文脈で null",
    async () => {
      const d = `k348-a-${tag}.example`;
      const id = await service(S.tenantA, `K348A${tag}`, d, "api");
      expect(await lookup(S.tenantA, null, d)).toBe(id);
      expect(await lookup(S.tenantB, null, d)).toBeNull();
    },
    T,
  );
  it(
    "K348-DB-004 運営と自分の会社の両方に同じ宛先：会社の行を先に作っても運営の行の id（仮・代表の答え待ち）",
    async () => {
      const d = `k348-both-${tag}.example`;
      await service(S.tenantA, `K348両A${tag}`, d, "api");
      const ops = await service(OPS, `K348両運営${tag}`, d, "forbidden");
      expect(await lookup(S.tenantA, null, d)).toBe(ops);
    },
    T,
  );
  it(
    "K348-DB-010 会社の文脈が無い接続：会社 A の行だけの宛先は null・運営の行の宛先はその id（仮・代表の答え待ち）",
    async () => {
      const da = `k348-noctx-a-${tag}.example`;
      const dops = `k348-noctx-ops-${tag}.example`;
      await service(S.tenantA, `K348無A${tag}`, da, "api");
      const ops = await service(OPS, `K348無運営${tag}`, dops, "api");
      expect(await lookup(null, null, da)).toBeNull();
      expect(await lookup(null, null, dops)).toBe(ops);
    },
    T,
  );
});

describe("K-348 credentials.service_id の会社の一致（引き金）", () => {
  it(
    "K348-DB-005 会社 A の行を会社 B の台帳の行に結んで insert すると 23514 の誤りで、行は増えない",
    async () => {
      const b = await service(S.tenantB, `K348挿B${tag}`, `k348-ins-${tag}.example`, "api");
      const before = (
        await admin.query<{ n: string }>("select count(*)::text as n from credentials where tenant_id = $1", [
          S.tenantA,
        ])
      ).rows[0]!.n;
      let err: unknown = null;
      try {
        await admin.query(
          "insert into credentials (tenant_id, scope_id, owner_member_id, service_name, service_id, kind_id, vault_ref, created_by) values ($1, $2, $3, $4, $5, 'basic', $6, $3)",
          [S.tenantA, S.scopeRootA, S.bossA, `k348-ins-${tag}`, b, `sec_k348_ins_${tag}`],
        );
      } catch (e) {
        err = e;
      }
      expect(pgCode(err)).toBe("23514");
      expect(String((err as Error).message)).toContain("同じ会社か運営");
      const after = (
        await admin.query<{ n: string }>("select count(*)::text as n from credentials where tenant_id = $1", [
          S.tenantA,
        ])
      ).rows[0]!.n;
      expect(after).toBe(before);
    },
    T,
  );
  it(
    "K348-DB-006 service_id が null の会社 A の行を、会社 B の台帳の行に update すると 23514 の誤りで、null のまま",
    async () => {
      const b = await service(S.tenantB, `K348更B${tag}`, `k348-upd-${tag}.example`, "api");
      const id = await credA();
      let err: unknown = null;
      try {
        await admin.query("update credentials set service_id = $2 where id = $1", [id, b]);
      } catch (e) {
        err = e;
      }
      expect(pgCode(err)).toBe("23514");
      expect(await serviceOf(id)).toBeNull();
    },
    T,
  );
  it(
    "K348-DB-007 会社 A の行は、自分の会社の行・運営の行・null に結べる（仮・代表の答え待ち）",
    async () => {
      const a = await service(S.tenantA, `K348可A${tag}`, `k348-ok-a-${tag}.example`, "api");
      const ops = await service(OPS, `K348可運営${tag}`, `k348-ok-ops-${tag}.example`, "api");
      const id = await credA();
      await admin.query("update credentials set service_id = $2 where id = $1", [id, a]);
      expect(await serviceOf(id)).toBe(a);
      await admin.query("update credentials set service_id = $2 where id = $1", [id, ops]);
      expect(await serviceOf(id)).toBe(ops);
      await admin.query("update credentials set service_id = null where id = $1", [id]);
      expect(await serviceOf(id)).toBeNull();
    },
    T,
  );
});

describe("K-348 migration の中身", () => {
  it(
    "K348-DB-008 前から在る違反の行は、migration の中身をもう一度流すと service_id が null に（自分の会社の結びつきは残る・引き金と関数は在る）",
    async () => {
      const sql = migrationSql();
      const b = await service(S.tenantB, `K348前B${tag}`, `k348-old-b-${tag}.example`, "api");
      const a = await service(S.tenantA, `K348前A${tag}`, `k348-old-a-${tag}.example`, "api");
      const c = await admin.connect();
      try {
        await c.query("begin");
        await c.query("drop trigger if exists credentials_service_tenant on credentials");
        const bad = (
          await c.query<{ id: string }>(
            "insert into credentials (tenant_id, scope_id, owner_member_id, service_name, service_id, kind_id, vault_ref, created_by) values ($1, $2, $3, 'k348-old-bad', $4, 'basic', 'sec_k348_old_bad', $3) returning id",
            [S.tenantA, S.scopeRootA, S.bossA, b],
          )
        ).rows[0]!.id;
        const good = (
          await c.query<{ id: string }>(
            "insert into credentials (tenant_id, scope_id, owner_member_id, service_name, service_id, kind_id, vault_ref, created_by) values ($1, $2, $3, 'k348-old-good', $4, 'basic', 'sec_k348_old_good', $3) returning id",
            [S.tenantA, S.scopeRootA, S.bossA, a],
          )
        ).rows[0]!.id;
        await c.query(sql);
        const sv = async (id: string) =>
          (await c.query<{ s: string | null }>("select service_id::text as s from credentials where id = $1", [id]))
            .rows[0]!.s;
        expect(await sv(bad)).toBeNull();
        expect(await sv(good)).toBe(a);
        const trg = await c.query(
          "select 1 from pg_trigger where tgname = 'credentials_service_tenant' and tgrelid = 'credentials'::regclass and not tgisinternal",
        );
        expect(trg.rowCount).toBe(1);
        const src = await c.query<{ s: string }>(
          "select prosrc as s from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app' and p.proname = 'credential_service'",
        );
        expect(src.rows[0]!.s).toContain("ops_tenant_id");
      } finally {
        await c.query("rollback");
        c.release();
      }
    },
    T,
  );
  it(
    "K348-DB-009 手順 S1 の失敗：migration の中身の後に誤りを足すと、印まで戻した後は違反の行が残ったまま・引き金は無いまま（取引ごと戻る）",
    async () => {
      const sql = migrationSql();
      const b = await service(S.tenantB, `K348失B${tag}`, `k348-fail-b-${tag}.example`, "api");
      const c = await admin.connect();
      try {
        await c.query("begin");
        await c.query("drop trigger if exists credentials_service_tenant on credentials");
        const bad = (
          await c.query<{ id: string }>(
            "insert into credentials (tenant_id, scope_id, owner_member_id, service_name, service_id, kind_id, vault_ref, created_by) values ($1, $2, $3, 'k348-fail-bad', $4, 'basic', 'sec_k348_fail_bad', $3) returning id",
            [S.tenantA, S.scopeRootA, S.bossA, b],
          )
        ).rows[0]!.id;
        await c.query("savepoint k348_s1");
        await expect(c.query(`${sql}\n;select 1/0;`)).rejects.toThrow(/division by zero/);
        await c.query("rollback to savepoint k348_s1");
        const s = (
          await c.query<{ s: string | null }>("select service_id::text as s from credentials where id = $1", [bad])
        ).rows[0]!.s;
        expect(s).toBe(b);
        const trg = await c.query(
          "select 1 from pg_trigger where tgname = 'credentials_service_tenant' and tgrelid = 'credentials'::regclass and not tgisinternal",
        );
        expect(trg.rowCount).toBe(0);
      } finally {
        await c.query("rollback");
        c.release();
      }
      const left = await admin.query("select 1 from credentials where service_name = 'k348-fail-bad'");
      expect(left.rowCount).toBe(0);
    },
    T,
  );
});
