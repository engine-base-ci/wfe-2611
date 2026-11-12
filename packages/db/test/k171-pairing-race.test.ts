// K-171：PC をつなぐコードを同時に出しても、アカウントで生きたコードは 1 つだけ（app.bridge_code_new の取り合い）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";
import { seedAccessMatrix } from "../src/seeds.js";

const URL = process.env["DATABASE_URL"]!;
const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const admin = new pg.Pool({ connectionString: URL, max: 20 });
let S: Awaited<ReturnType<typeof seedAccessMatrix>>;

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

async function newMember(tenant: string, authUser: string | null): Promise<string> {
  const scope = await admin.query<{ scope_id: string }>("select scope_id from members where tenant_id = $1 limit 1", [
    tenant,
  ]);
  const r = await admin.query<{ id: string }>(
    "insert into members (tenant_id, scope_id, kind_id, display_name, auth_user_id) values ($1, $2, 'human', 'K171', $3) returning id",
    [tenant, scope.rows[0]!.scope_id, authUser],
  );
  return r.rows[0]!.id;
}

/** 1 つ目の取引でコードを出して確定しないまま、2 つ目を別の接続から出し、1 つ目を確定する。
 *  鍵が無い実装では 2 つ目が待たずに 1 つ目の見えない行を残したまま足すので、必ず 2 つ生きる（たまたま通ることが無い） */
async function overlap(
  first: { tenant: string; member: string },
  second: { tenant: string; member: string },
): Promise<void> {
  const c = await admin.connect();
  try {
    await c.query("begin");
    await c.query("select app.bridge_code_new($1, $2, $3)", [first.tenant, first.member, hash(randomUUID())]);
    const later = admin.query("select app.bridge_code_new($1, $2, $3)", [
      second.tenant,
      second.member,
      hash(randomUUID()),
    ]);
    await new Promise((r) => setTimeout(r, 300));
    await c.query("commit");
    await later;
  } finally {
    c.release();
  }
}

/** 別々の接続から同時に出す（同じ接続では順に流れて取り合いにならない） */
async function issueAtOnce(calls: { tenant: string; member: string }[]): Promise<void> {
  await Promise.all(
    calls.map(({ tenant, member }) =>
      admin.query("select app.bridge_code_new($1, $2, $3)", [tenant, member, hash(randomUUID())]),
    ),
  );
}

async function liveCodes(members: string[]): Promise<number> {
  const r = await admin.query<{ n: string }>(
    "select count(*)::text as n from bridge_pairing_codes where member_id = any($1::uuid[]) and used_at is null and deleted_at is null",
    [members],
  );
  return Number(r.rows[0]!.n);
}

beforeAll(async () => {
  await migrate(URL, pkg);
  const c = await admin.connect();
  try {
    S = await seedAccessMatrix(c);
  } finally {
    c.release();
  }
});
afterAll(async () => {
  await admin.end();
});

describe("K-171 コードの取り合い", () => {
  it("K171-DB-001 同じ人のコードを重ねて出す（確定前に 2 つ目）・同時に 6 回出すと、生きたコードは 1 行だけで、残り 7 行は無効になる", async () => {
    const m = await newMember(S.tenantA, null);
    await overlap({ tenant: S.tenantA, member: m }, { tenant: S.tenantA, member: m });
    expect(await liveCodes([m])).toBe(1);
    await issueAtOnce(Array.from({ length: 6 }, () => ({ tenant: S.tenantA, member: m })));
    expect(await liveCodes([m])).toBe(1);
    const dead = await admin.query(
      "select 1 from bridge_pairing_codes where member_id = $1 and deleted_at is not null",
      [m],
    );
    expect(dead.rowCount).toBe(7);
  });

  it("K171-DB-002 同じアカウント（auth_user_id が同じ）の別の会社の人が同時に出すと、アカウントで生きたコードは 1 行だけ", async () => {
    const au = randomUUID();
    const a = await newMember(S.tenantA, au);
    const b = await newMember(S.tenantB, au);
    await overlap({ tenant: S.tenantA, member: a }, { tenant: S.tenantB, member: b });
    expect(await liveCodes([a, b])).toBe(1);
  });

  it("K171-DB-003 別のアカウントの 2 人が同時に出すと、それぞれ 1 行ずつ生きる", async () => {
    const a = await newMember(S.tenantA, randomUUID());
    const b = await newMember(S.tenantA, randomUUID());
    await issueAtOnce([
      { tenant: S.tenantA, member: a },
      { tenant: S.tenantA, member: b },
    ]);
    expect(await liveCodes([a])).toBe(1);
    expect(await liveCodes([b])).toBe(1);
  });

  it("K171-DB-004 鍵を取った取引が途中で失敗して戻っても、次の発行は待たずに通り、生きたコードは 1 行", async () => {
    const m = await newMember(S.tenantA, null);
    const c = await admin.connect();
    try {
      await c.query("begin");
      await c.query("select app.bridge_code_new($1, $2, $3)", [S.tenantA, m, hash(randomUUID())]);
      await expect(c.query("select 1 / 0")).rejects.toThrow();
      await c.query("rollback");
    } finally {
      c.release();
    }
    const t = Date.now();
    await admin.query("select app.bridge_code_new($1, $2, $3)", [S.tenantA, m, hash(randomUUID())]);
    expect(Date.now() - t).toBeLessThan(2000);
    expect(await liveCodes([m])).toBe(1);
  });
});
