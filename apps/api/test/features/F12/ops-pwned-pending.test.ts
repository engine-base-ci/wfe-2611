// K-1110 確定前に去った申し込みの照合落ち（listOpsPwned の 1 行・ackOpsPwnedPending・POST /api/v1/ops/pwned/pending/ack）。
//   テストの名前の頭の行 ID（K1110-…）は 11_tickets/K-1110.md の表の行に 1 対 1 で結ぶ。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   代表の答え 2026-11-23（D-156.69）：確定しないまま去った申し込みの照合落ちも運営の一覧に出す。まとめて 1 行（workspace・member は null・数と時刻だけ）。
//   確定前に去った＝照合落ちの印（K-1018 の pwned_unchecked_at）があり・確定していない（consumed_at が空）・期限が切れた・まだ確かめていない。
//   申し込みの行は kaname_auth.pending_signup に直に置き、メールの頭（run）で見分けて後で消す。全体の数は共用の DB なので「差」で見る。
//   どの試験も最初に、今ある確定前の行をまとめて確かめてから始める（ほかの試験の期限切れの行が数に混ざらないように）
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { startOpsWs, isFlat, OPS_TENANT, type Json, type OpsWs } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

const NOTHING_TO_ACK = "E-OPS-026";
const ROW_KEYS = ["count", "last_at", "member", "workspace"];
const ACK_KEYS = ["acknowledged_at", "remaining"];
const ACK = "/ops/pwned/pending/ack";

let t: OpsWs;
let opsAll: Person;
let opsMoneyOnly: Person;

beforeAll(async () => {
  t = await startOpsWs("k1110", ["ops-pwned", "ops-workspaces"]);
  opsAll = await t.ops("佐野");
  opsMoneyOnly = await t.ops("お金だけ", ["money"]);
});
/** 今ある確定前の行を確かめた状態から始める（無ければ 409 で何もしない） */
beforeEach(async () => {
  await t.call(opsAll, "POST", ACK, {});
});
afterAll(async () => {
  await t.f.admin.query("delete from kaname_auth.pending_signup where email like $1", [`${t.run}-%`]);
  // 運営の記録は追記専用（0003_audit.sql）で消さない。記録の数は各試験の前の数との差で見る
  await t.close();
});

type Row = Record<string, unknown>;
/** 申し込みを 1 つ置く。印の時刻は secsAgo 秒前・期限は expiresAgo 秒前（負なら先） */
const pending = async (
  o: { secsAgo?: number; expiresAgo?: number; consumed?: boolean; unchecked?: boolean; email?: string } = {},
) => {
  const email = o.email ?? `${t.run}-${randomUUID().slice(0, 8)}@example.test`;
  await t.f.admin.query(
    `insert into kaname_auth.pending_signup (email, name, company_name, pw_iv, pw_tag, pw_data, token_hash, expires_at, consumed_at, pwned_unchecked_at)
     values ($1, '登録した人の名前', '登録した会社の名前', 'iv', 'tag', 'data', $2, now() - make_interval(secs => $3),
             case when $4 then now() else null end, case when $5 then now() - make_interval(secs => $6) else null end)
     on conflict (email) do update set expires_at = excluded.expires_at, consumed_at = excluded.consumed_at,
             pwned_unchecked_at = excluded.pwned_unchecked_at`,
    [email, `h-${randomUUID()}`, o.expiresAgo ?? 60, o.consumed ?? false, o.unchecked ?? true, o.secsAgo ?? 120],
  );
  return email;
};
const list = async (who: Person | null = opsAll) => {
  const r = await t.call(who, "GET", "/ops/pwned");
  return { r, b: await t.json(r) };
};
const pendingRow = async (): Promise<Row | undefined> =>
  ((await list()).b.data as Row[]).find((x) => x["workspace"] === null);
const ack = async (who: Person | null = opsAll, body: unknown = {}) => {
  const r = await t.call(who, "POST", ACK, body);
  return { r, b: (await t.json(r)) as Json };
};
const unchecked = async () =>
  Number((((await t.json(await t.call(opsAll, "GET", "/ops/shell"))).data as Row)["pwned"] as Row)["unchecked"]);
const audits = () =>
  t.n(
    "select count(*) as n from ops_audit_events where action = 'pwned.acknowledge_pending' and target_tenant_id = $1",
    [OPS_TENANT],
  );
const opsAcks = () =>
  t.n("select count(*) as n from security_events where tenant_id = $1 and kind_id = 'pwned_check_acknowledged'", [
    OPS_TENANT,
  ]);
const ackedAt = async (email: string) =>
  (await t.row<{ a: string | null }>("select pwned_acked_at as a from kaname_auth.pending_signup where email = $1", [
    email,
  ]))!.a;
/** 一覧に残っている会社の照合落ちを全部確かめる（最後の 1 つの試験の準備） */
const ackAllWorkspaces = async () => {
  for (const x of (await list()).b.data as Row[]) {
    const w = x["workspace"] as Row | null;
    if (w) await t.call(opsAll, "POST", `/ops/workspaces/${w["id"]}/pwned/ack`, {});
  }
};

describe("K-1110 一覧と数", () => {
  it("K1110-API-001 一覧の 1 行：確定前に去った照合落ちを 2 つ置くと、workspace・member が null の行がちょうど 1 つ・4 欄・count が 2・last_at は新しい方の印", async () => {
    await pending({ secsAgo: 300 });
    await pending({ secsAgo: 30 });
    const rows = ((await list()).b.data as Row[]).filter((x) => x["workspace"] === null);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(Object.keys(r).sort()).toEqual(ROW_KEYS);
    expect([r["workspace"], r["member"], r["count"]]).toEqual([null, null, 2]);
    expect(Date.now() - Date.parse(String(r["last_at"]))).toBeLessThan(60_000);
  });

  it("K1110-API-002 数えない申し込み：確定した・期限の内・照合できた・確かめた後の印 は count が増えない", async () => {
    await pending({ consumed: true });
    await pending({ expiresAgo: -600 });
    await pending({ unchecked: false });
    expect(await pendingRow()).toBeUndefined();
  });

  it("K1110-API-003 外枠の数：確定前の行が無い状態から 1 つ置くと pwned.unchecked が 1 増え、2 つ目では増えない", async () => {
    const before = await unchecked();
    await pending();
    expect(await unchecked()).toBe(before + 1);
    await pending();
    expect(await unchecked()).toBe(before + 1);
  });
});

describe("K-1110 まとめて確かめた", () => {
  it("K1110-API-004 まとめて確かめた：200・鍵 2 つ・印の時刻が入る・一覧から消える・remaining は外枠の数・記録が 1 行（count・メールの字なし）", async () => {
    const e1 = await pending();
    const e2 = await pending();
    const a0 = await audits();
    const { r, b } = await ack();
    expect(r.status, JSON.stringify(b)).toBe(200);
    const d = b.data as Row;
    expect(Object.keys(d).sort()).toEqual(ACK_KEYS);
    expect(await ackedAt(e1)).not.toBeNull();
    expect(await ackedAt(e2)).not.toBeNull();
    expect(await pendingRow()).toBeUndefined();
    expect(d["remaining"]).toBe(await unchecked());
    expect(await audits()).toBe(a0 + 1);
    const p = (await t.row<{ payload: Row }>(
      "select payload from ops_audit_events where action = 'pwned.acknowledge_pending' and target_tenant_id = $1 order by occurred_at desc limit 1",
      [OPS_TENANT],
    ))!.payload;
    expect(p["count"]).toBe(2);
    expect(JSON.stringify(p)).not.toContain(t.run);
  });

  it("K1110-API-005 また落ちた：確かめた後、同じメールの印を新しい時刻にすると count 1 で出直す", async () => {
    const e = await pending({ secsAgo: 600 });
    expect((await ack()).r.status).toBe(200);
    expect(await pendingRow()).toBeUndefined();
    await pending({ email: e, secsAgo: -1 });
    expect((await pendingRow())?.["count"]).toBe(1);
  });

  it("K1110-API-006 何も無い：409・E-OPS-026・欄なし・記録が増えない", async () => {
    const a0 = await audits();
    const { r, b } = await ack();
    expect([r.status, b["code"]]).toEqual([409, NOTHING_TO_ACK]);
    expect(isFlat(b)).toBe(true);
    expect(await audits()).toBe(a0);
  });

  it("K1110-API-007 最後の 1 つ：会社の照合落ちを全部確かめた後に確定前の行を確かめて remaining が 0 なら、運営の会社に確かめた印が 1 行増える", async () => {
    await ackAllWorkspaces();
    await pending();
    const o0 = await opsAcks();
    const { r, b } = await ack();
    expect(r.status).toBe(200);
    const left = (b.data as Row)["remaining"] as number;
    expect(left).toBe(await unchecked());
    expect(await opsAcks()).toBe(left === 0 ? o0 + 1 : o0);
  });

  it("K1110-API-008 会社が残る・会社の確かめた：照合落ちの会社が 1 つ残る間は remaining 1 で印が増えない。確定前の行が残る間は、最後の会社を確かめても K-995 の remaining は 1 で印が増えない", async () => {
    await ackAllWorkspaces();
    const w = await t.ws("残る会社");
    await t.pwned(w);
    await pending();
    const o0 = await opsAcks();
    const a = await ack();
    expect((a.b.data as Row)["remaining"]).toBe(1);
    expect(await opsAcks()).toBe(o0);
    await pending();
    const c = await t.call(opsAll, "POST", `/ops/workspaces/${w.tenantId}/pwned/ack`, {});
    expect(c.status).toBe(200);
    expect(((await t.json(c)).data as Row)["remaining"]).toBe(1);
    expect(await opsAcks()).toBe(o0);
  });

  it("K1110-API-009 形の誤り：知らない欄・配列・字の体は 422・印は変わらない", async () => {
    const e = await pending();
    for (const body of [{ all: true }, [], "x"])
      expect((await ack(opsAll, body)).r.status, JSON.stringify(body)).toBe(422);
    expect(await ackedAt(e)).toBeNull();
  });

  it("K1110-API-010 入口：ログインなし 401・会社の管理者 403・お金だけの運営の人は 200（ops:any）", async () => {
    await pending();
    expect((await ack(null)).r.status).toBe(401);
    const w = await t.ws("会社の人");
    expect((await ack(w.admin)).r.status).toBe(403);
    expect((await ack(opsMoneyOnly)).r.status).toBe(200);
  });
});

describe("K-1110 失敗と揺れ", () => {
  it("K1110-API-011 書けない：記録の表への書き込みを落とすと 503・E-PAGE-003・印の時刻は空のまま・一覧に残る", async () => {
    const e = await pending();
    const restore = await t.breakWrites("ops_audit_events", { ops_member_id: opsAll.id });
    try {
      const { r, b } = await ack();
      expect([r.status, b["code"]]).toEqual([503, "E-PAGE-003"]);
    } finally {
      await restore();
    }
    expect(await ackedAt(e)).toBeNull();
    expect(await pendingRow()).toBeDefined();
  });

  it("K1110-API-012 同時に 2 人：200 と 409 E-OPS-026 が 1 つずつ・記録は 1 行", async () => {
    await pending();
    const a0 = await audits();
    const [x, y] = await Promise.all([ack(opsAll), ack(opsMoneyOnly)]);
    expect([x.r.status, y.r.status].sort()).toEqual([200, 409]);
    expect([x.b["code"], y.b["code"]].filter(Boolean)).toEqual([NOTHING_TO_ACK]);
    expect(await audits()).toBe(a0 + 1);
  });

  it("K1110-API-013 上限：上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数", async () => {
    await pending();
    t.f.limits["ackOpsPwnedPending"] = 1;
    try {
      const ip = "203.0.113.210";
      const send = () => t.f.req("POST", ACK, { headers: opsAll.auth, body: {}, ip });
      expect((await send()).status).toBe(200);
      const r = await send();
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.f.limits["ackOpsPwnedPending"];
    }
  });

  it("K1110-API-014 中身を出さない：一覧の答えと記録の payload に、申し込みのメール・名前・会社名の字が無い", async () => {
    const e = await pending();
    const text = JSON.stringify((await list()).b);
    for (const s of [e, "登録した人の名前", "登録した会社の名前"]) expect(text).not.toContain(s);
    expect((await ack()).r.status).toBe(200);
    const p = (await t.row<{ payload: Row }>(
      "select payload from ops_audit_events where action = 'pwned.acknowledge_pending' and target_tenant_id = $1 order by occurred_at desc limit 1",
      [OPS_TENANT],
    ))!.payload;
    for (const s of [e, "登録した人の名前", "登録した会社の名前"]) expect(JSON.stringify(p)).not.toContain(s);
  });
});

describe("K-1110 DB", () => {
  it("K1110-DB-001 2 層目：会社の人の文脈で app.ops_pwned_pending_ack を直に呼ぶと 42501・PUBLIC は app.pwned_pending と app.ops_pwned_unchecked を呼べない", async () => {
    const w = await t.ws("2 層目");
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.admin.id],
      );
      await expect(c.query("select app.ops_pwned_pending_ack()")).rejects.toMatchObject({ code: "42501" });
    } finally {
      await c.query("rollback");
      c.release();
    }
    for (const fn of ["app.pwned_pending()", "app.ops_pwned_unchecked()"]) {
      const ok = await t.row<{ ok: boolean }>("select has_function_privilege('public', $1, 'execute') as ok", [fn]);
      expect(ok!.ok, fn).toBe(false);
    }
  });
});
