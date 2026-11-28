// K-52（メールを確かめる）の片付けの関数の権限（3 回目のレビュー：認証の接続 kaname_auth に app のスキーマを使わせない）。
//   行 ID（K52-API-049〜051）は 11_tickets/K-52.md の表のマスに 1 対 1 で結ぶ。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   前提にする形：確定の途中の片付けに使う 2 つの関数は kaname_auth のスキーマに置く
//     kaname_auth.drop_half_made_company(uuid, text) … 作りかけの会社に印を付けて中身を片付ける（守りは関数の中で 3 重・D-128.167）
//     kaname_auth.auth_user_has_members(text)        … その本人の会社の人が、どこかの会社に残っているか
//   どちらも public からは execute を外し、kaname_auth だけに渡す。kaname_auth には app のスキーマの usage を渡さない
//   （渡すと、public に execute が残っている app の関数 ─ 例 app.bridge_pair_new ─ を認証の接続から呼べてしまう）。
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate } from "../src/migrate.js";

const DB_URL = process.env["DATABASE_URL"]!;
const APP_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const AUTH_URL = DB_URL.replace(/\/\/[^@]*@/, "//kaname_auth:kaname_auth@");
const here = dirname(fileURLToPath(import.meta.url));
const DROP = "kaname_auth.drop_half_made_company(uuid, text)";
const HAS = "kaname_auth.auth_user_has_members(text)";
const TENANT_OF = "kaname_auth.half_made_tenant_of(text)"; // 片付ける会社を members.auth_user_id から引く（M-C）

const admin = new pg.Pool({ connectionString: DB_URL, max: 2 });
let authPool: pg.Pool;
let appPool: pg.Pool;
/** 呼んで落ちたら、その文言を返す（落ちなければ null） */
const fails = async (pool: pg.Pool, sql: string, p: unknown[] = []) => {
  try {
    await pool.query(sql, p);
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
};
const priv = async (sql: string, p: unknown[]) => (await admin.query<{ ok: boolean }>(sql, p)).rows[0]!.ok;

beforeAll(async () => {
  await migrate(DB_URL, join(here, ".."));
  authPool = new pg.Pool({ connectionString: AUTH_URL, max: 1 });
  appPool = new pg.Pool({ connectionString: APP_URL, max: 1 });
});

afterAll(async () => {
  await authPool?.end();
  await appPool?.end();
  await admin.end();
});

describe("K-52 片付けの関数の権限（認証の接続 kaname_auth）", () => {
  it("K52-API-049 kaname_auth は app のスキーマを使えない（usage が無い）。public に execute が残る app の関数（app.bridge_pair_new）も、認証の接続からは呼べない", async () => {
    expect(
      await priv("select has_schema_privilege('kaname_auth', 'app', 'usage') as ok", []),
      "kaname_auth に app のスキーマの usage を渡さない",
    ).toBe(false);
    const before = Number(
      (await admin.query<{ n: string }>("select count(*) as n from app.bridge_pairings")).rows[0]!.n,
    );
    expect(
      await fails(authPool, "select app.bridge_pair_new($1::uuid, $2::uuid)", [randomUUID(), randomUUID()]),
      "認証の接続から app の関数を呼べない",
    ).toMatch(/permission denied/);
    const after = Number(
      (await admin.query<{ n: string }>("select count(*) as n from app.bridge_pairings")).rows[0]!.n,
    );
    expect(after, "呼べていない（接続コードの行が増えない）").toBe(before);
  });

  it("K52-API-050 kaname_auth は kaname_auth.drop_half_made_company と kaname_auth.auth_user_has_members だけは呼べる（無い会社・無い本人で呼ぶと何も片付けない）", async () => {
    for (const fn of [DROP, HAS])
      expect(
        await priv("select has_function_privilege('kaname_auth', $1, 'execute') as ok", [fn]),
        `${fn} を kaname_auth が呼べる`,
      ).toBe(true);
    const nobody = `k52-nobody-${randomUUID()}`;
    const n = await authPool.query<{ n: number }>("select kaname_auth.drop_half_made_company($1::uuid, $2) as n", [
      randomUUID(),
      nobody,
    ]);
    expect(n.rows[0]!.n, "無い会社では何も片付けない").toBe(0);
    const has = await authPool.query<{ has: boolean }>("select kaname_auth.auth_user_has_members($1) as has", [nobody]);
    expect(has.rows[0]!.has).toBe(false);
  });

  it("K52-API-051 public からは 2 つの関数を呼べない（execute を外す）。アプリの接続（kaname_app）からも呼べない", async () => {
    for (const fn of [DROP, HAS]) {
      expect(
        await priv("select has_function_privilege('public', $1, 'execute') as ok", [fn]),
        `${fn} の execute を public に残さない`,
      ).toBe(false);
      expect(
        await priv("select has_function_privilege('kaname_app', $1, 'execute') as ok", [fn]),
        `${fn} を kaname_app が呼べない`,
      ).toBe(false);
    }
    expect(
      await fails(appPool, "select kaname_auth.drop_half_made_company($1::uuid, $2)", [randomUUID(), "x"]),
    ).toMatch(/permission denied/);
    expect(await fails(appPool, "select kaname_auth.auth_user_has_members($1)", ["x"])).toMatch(/permission denied/);
  });

  it("K52-API-052 kaname_auth.half_made_tenant_of（片付ける会社を members.auth_user_id から引く）は kaname_auth からは呼べる（無い本人では null）。public と kaname_app からは呼べない", async () => {
    expect(
      await priv("select has_function_privilege('kaname_auth', $1, 'execute') as ok", [TENANT_OF]),
      `${TENANT_OF} を kaname_auth が呼べる`,
    ).toBe(true);
    const r = await authPool.query<{ t: string | null }>("select kaname_auth.half_made_tenant_of($1) as t", [
      `k52-nobody-${randomUUID()}`,
    ]);
    expect(r.rows[0]!.t, "無い本人では会社を返さない").toBeNull();
    expect(
      await priv("select has_function_privilege('public', $1, 'execute') as ok", [TENANT_OF]),
      `${TENANT_OF} の execute を public に残さない`,
    ).toBe(false);
    expect(
      await priv("select has_function_privilege('kaname_app', $1, 'execute') as ok", [TENANT_OF]),
      `${TENANT_OF} を kaname_app が呼べない`,
    ).toBe(false);
    expect(await fails(appPool, "select kaname_auth.half_made_tenant_of($1)", ["x"])).toMatch(/permission denied/);
  });
});
