// K-995 照合が使えなかった登録の回収（listOpsPwned・GET /api/v1/ops/pwned／ackOpsPwned・POST /api/v1/ops/workspaces/:id/pwned/ack）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   代表の答え 2026-11-23（D-156.35）：運営のワークスペースの一覧の上に帯「パスワードの照合が使えなかった登録が N 件あります」→
//   一覧の小窓（日時・ワークスペース・人）と「確かめた」。確かめた後にまた落ちたら、また 1 通メール（D-128.146）。
//   1 行は会社ごと（security_events の pwned_check_unavailable が、その会社の最後の pwned_check_acknowledged より後にある会社）。
//   数え方は K-963 の getOpsShell の pwned.unchecked と同じ（0086 と同じ見方）。会社の出来事は登録の確定のときに K-1018 が書く。
//   確定前に去った申し込みの 1 行（workspace・member が null・K-1110 が足す）があっても読めるよう、workspace は null を許して読む（K-1110 が切る段で直した）。
//   全社の数は共用の DB の全部を数えるので「足す前と足した後の差」で見る。一覧は名前の頭（run）で自分の会社だけを見る（ops-ws.harness.ts の注）
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { startOpsWs, isFlat, OPS_TENANT, type Json, type OpsWs, type Ws } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

const NOTHING_TO_ACK = "E-OPS-026"; // この葉で足す番号（確かめる物が無い）
const ROW_KEYS = ["count", "last_at", "member", "workspace"];
const ACK_KEYS = ["acknowledged_at", "remaining"];

let t: OpsWs;
let opsAll: Person;
let opsMoneyOnly: Person;

beforeAll(async () => {
  t = await startOpsWs("k995", ["ops-pwned", "ops-workspaces"]);
  opsAll = await t.ops("佐野");
  opsMoneyOnly = await t.ops("お金だけ", ["money"]);
});
/** 照合落ちのまま残る会社（except のほか・運営の会社を除く）に、確かめた印を管理者の接続で 1 行ずつ書く（出来事の表は追記専用なので足すだけ） */
const ackOthers = (where: string, p: unknown[]) =>
  t.f.admin.query(
    `insert into security_events (tenant_id, kind_id, detail, occurred_at)
     select e.tenant_id, 'pwned_check_acknowledged', '{}'::jsonb, greatest(now(), max(e.occurred_at) + interval '1 second')
       from security_events e
      where e.kind_id = 'pwned_check_unavailable' and e.tenant_id <> $1 and ${where}
      group by e.tenant_id`,
    [OPS_TENANT, ...p],
  );
afterAll(async () => {
  // この回の会社を確かめた印にして、後の回・後のファイルの「確かめていない数」を汚さない
  await ackOthers("e.tenant_id in (select id from tenants where name like $2)", [`${t.run} %`]);
  await t.close();
});

type Row = Record<string, unknown>;
const list = async (who: Person | null = opsAll) => {
  const r = await t.call(who, "GET", "/ops/pwned");
  return { r, b: await t.json(r) };
};
/** 自分が作った会社の行だけ（名前の頭 run） */
const mine = async (who: Person = opsAll): Promise<Row[]> => {
  const { r, b } = await list(who);
  expect(r.status, JSON.stringify(b)).toBe(200);
  return (b.data as Row[]).filter((x) => String((x["workspace"] as Row | null)?.["name"] ?? "").startsWith(t.run));
};
const rowOf = (rows: Row[], w: Ws) => rows.find((x) => (x["workspace"] as Row | null)?.["id"] === w.tenantId);
const ack = async (tenant: string, who: Person | null = opsAll, body: unknown = {}) => {
  const r = await t.call(who, "POST", `/ops/workspaces/${tenant}/pwned/ack`, body);
  return { r, b: (await t.json(r)) as Json };
};
const unchecked = async () =>
  Number((((await t.json(await t.call(opsAll, "GET", "/ops/shell"))).data as Row)["pwned"] as Row)["unchecked"]);
const acks = (tenant: string) =>
  t.n("select count(*) as n from security_events where tenant_id = $1 and kind_id = 'pwned_check_acknowledged'", [
    tenant,
  ]);
const opsAudit = (tenant: string) =>
  t.n("select count(*) as n from ops_audit_events where target_tenant_id = $1 and action = 'pwned.acknowledge'", [
    tenant,
  ]);
/** 照合が使えなかった出来事を、今より secs 秒あとの時刻で置く（確かめた印より後にする） */
const failLater = (w: Ws, secs: number) =>
  t.f.admin.query(
    "insert into security_events (tenant_id, kind_id, member_id, detail, occurred_at) values ($1, 'pwned_check_unavailable', $2, '{}'::jsonb, now() + make_interval(secs => $3))",
    [w.tenantId, w.admin.id, secs],
  );

describe("K-995 照合が使えなかった登録の一覧（listOpsPwned）", () => {
  it("K995-API-001 1 行は会社ごとの 4 欄（workspace・member・last_at・count）。人はその会社の出来事の人（管理者）の名前・並びは last_at の新しい順・count は確かめた印より後の出来事の数", async () => {
    const a = await t.ws("山田工務店");
    const b = await t.ws("北村デザイン");
    await t.pwned(a);
    await t.pwned(a);
    await failLater(b, 2);
    const rows = await mine();
    const ra = rowOf(rows, a)!;
    const rb = rowOf(rows, b)!;
    expect(Object.keys(ra).sort()).toEqual(ROW_KEYS);
    expect(ra["workspace"]).toEqual({ id: a.tenantId, name: a.name });
    expect(ra["member"]).toEqual({ id: a.admin.id, name: "管理者 山田工務店" });
    expect(ra["count"]).toBe(2);
    expect(rb["count"]).toBe(1);
    expect(rows.indexOf(rb)).toBeLessThan(rows.indexOf(ra));
    expect(Number.isNaN(Date.parse(String(ra["last_at"])))).toBe(false);
  });

  it("K995-API-002 確かめた会社・運営の会社・作りかけ・消した会社は出ない。一覧の行の数は getOpsShell の pwned.unchecked の増えた分と同じ", async () => {
    const before = await unchecked();
    const open = await t.ws("出る");
    const done = await t.ws("確かめ済み");
    const half = await t.ws("作りかけ");
    const gone = await t.ws("消した");
    for (const w of [open, done, half, gone]) await t.pwned(w);
    await failLater(done, -1);
    await t.f.admin.query(
      "insert into security_events (tenant_id, kind_id, detail) values ($1, 'pwned_check_acknowledged', '{}'::jsonb)",
      [done.tenantId],
    );
    await t.f.admin.query("update tenants set half_made_at = now() where id = $1", [half.tenantId]);
    await t.f.admin.query("update tenants set deleted_at = now() where id = $1", [gone.tenantId]);
    const rows = await mine();
    expect(rowOf(rows, open)).toBeDefined();
    for (const w of [done, half, gone]) expect(rowOf(rows, w), w.name).toBeUndefined();
    const all = (await list()).b.data as Row[];
    expect(all.some((x) => (x["workspace"] as Row | null)?.["id"] === OPS_TENANT)).toBe(false);
    expect((await unchecked()) - before).toBe(1);
  });

  it("K995-API-003 答えに出来事の中身（理由・メール）を入れない。人の名前だけ", async () => {
    const w = await t.ws("中身");
    await t.f.admin.query(
      "insert into security_events (tenant_id, kind_id, member_id, detail) values ($1, 'pwned_check_unavailable', $2, $3)",
      [w.tenantId, w.admin.id, { reason: "HTTP 503 secret-reason", email: "leak@example.test" }],
    );
    const { b } = await list();
    const text = JSON.stringify(b);
    expect(text).not.toContain("secret-reason");
    expect(text).not.toContain("leak@example.test");
  });
});

describe("K-995 確かめた（ackOpsPwned）", () => {
  it("K995-API-004 確かめると 200・鍵は acknowledged_at と remaining。その会社に確かめた印が 1 行（人は空・運営の人の id は detail）・一覧から消え・外枠の数が 1 減る", async () => {
    const w = await t.ws("佐々木 恵");
    await t.pwned(w);
    const before = await unchecked();
    const a0 = await acks(w.tenantId);
    const { r, b } = await ack(w.tenantId);
    expect(r.status, JSON.stringify(b)).toBe(200);
    const d = b.data as Row;
    expect(Object.keys(d).sort()).toEqual(ACK_KEYS);
    expect(Number.isInteger(d["remaining"])).toBe(true);
    expect(await acks(w.tenantId)).toBe(a0 + 1);
    const ev = await t.row<{ member_id: string | null; detail: Row }>(
      "select member_id, detail from security_events where tenant_id = $1 and kind_id = 'pwned_check_acknowledged' order by occurred_at desc limit 1",
      [w.tenantId],
    );
    expect(ev!.member_id).toBeNull();
    expect(ev!.detail["ops_member_id"]).toBe(opsAll.id);
    expect(rowOf(await mine(), w)).toBeUndefined();
    expect(await unchecked()).toBe(before - 1);
    expect(d["remaining"]).toBe(before - 1);
  });

  it("K995-API-005 記録：運営の記録に pwned.acknowledge が 1 行（対象 security_events・target_label はワークスペースの名前）・会社の記録にも残る", async () => {
    const w = await t.ws("記録");
    await t.pwned(w);
    expect((await ack(w.tenantId)).r.status).toBe(200);
    expect(await opsAudit(w.tenantId)).toBe(1);
    const a = await t.row<{ target_type: string; payload: Row; ops_member_id: string }>(
      "select target_type, payload, ops_member_id from ops_audit_events where target_tenant_id = $1 and action = 'pwned.acknowledge'",
      [w.tenantId],
    );
    expect(a!.target_type).toBe("security_events");
    expect(a!.payload["target_label"]).toBe(w.name);
    expect(
      await t.n("select count(*) as n from audit_events where tenant_id = $1 and action like '%pwned.acknowledge%'", [
        w.tenantId,
      ]),
    ).toBe(1);
  });

  it("K995-API-006 もう確かめた会社・出来事の無い会社をもう一度確かめると 409・E-OPS-026・欄なし。印も記録も増えない", async () => {
    const w = await t.ws("二度目");
    await t.pwned(w);
    expect((await ack(w.tenantId)).r.status).toBe(200);
    const none = await t.ws("出来事なし");
    for (const id of [w.tenantId, none.tenantId]) {
      const a0 = await acks(id);
      const { r, b } = await ack(id);
      expect(r.status, id).toBe(409);
      expect(b["code"]).toBe(NOTHING_TO_ACK);
      expect(isFlat(b)).toBe(true);
      expect(await acks(id)).toBe(a0);
    }
    expect(await opsAudit(w.tenantId)).toBe(1);
  });

  it("K995-API-007 ほかの会社が残っている間は運営の会社に印を書かない。最後の 1 社を確かめて remaining が 0 になったときだけ、運営の会社にも確かめた印を 1 行書く（落ち始めのメールがまた出る・D-128.146）", async () => {
    const a = await t.ws("先に確かめる");
    const b = await t.ws("後に確かめる");
    await t.pwned(a);
    await t.pwned(b);
    // 共用の DB の、この 2 社のほかの確かめていない会社（前の試験・前の回の会社）を先に確かめた印にして、0 の筋を必ず通す
    await ackOthers("e.tenant_id <> all($2::uuid[])", [[a.tenantId, b.tenantId]]);
    // 確定前の申し込みの 1 行も remaining に入る（K-1110 が carry で足した）。まとめて確かめた印にしておく（無ければ 409 で何もしない）
    await t.call(opsAll, "POST", "/ops/pwned/pending/ack", {});
    const ops0 = await acks(OPS_TENANT);
    const ra = await ack(a.tenantId);
    expect(ra.r.status).toBe(200);
    expect((ra.b.data as Row)["remaining"]).toBe(1);
    expect(await acks(OPS_TENANT)).toBe(ops0);
    const rb = await ack(b.tenantId);
    expect(rb.r.status).toBe(200);
    expect((rb.b.data as Row)["remaining"]).toBe(0);
    expect(await unchecked()).toBe(0);
    expect(await acks(OPS_TENANT)).toBe(ops0 + 1);
  });

  it("K995-API-008 時間の流れ：確かめた後にまた落ちると、その会社がまた一覧に出る（count 1・last_at は新しい出来事の時刻）", async () => {
    const w = await t.ws("また落ちた");
    await t.pwned(w);
    expect((await ack(w.tenantId)).r.status).toBe(200);
    expect(rowOf(await mine(), w)).toBeUndefined();
    await failLater(w, 1);
    const r = rowOf(await mine(), w)!;
    expect(r["count"]).toBe(1);
    expect(Date.parse(String(r["last_at"]))).toBeGreaterThan(Date.now() - 60_000);
  });

  it("K995-API-009 指す会社が無い・見えない：無い uuid・運営の会社・作りかけ・消した会社は 404・欄なし。印も記録も増えない", async () => {
    const half = await t.ws("作りかけ 2");
    const gone = await t.ws("消した 2");
    await t.pwned(half);
    await t.pwned(gone);
    await t.f.admin.query("update tenants set half_made_at = now() where id = $1", [half.tenantId]);
    await t.f.admin.query("update tenants set deleted_at = now() where id = $1", [gone.tenantId]);
    const ops0 = await acks(OPS_TENANT);
    for (const id of [randomUUID(), OPS_TENANT, half.tenantId, gone.tenantId]) {
      const { r, b } = await ack(id);
      expect(r.status, id).toBe(404);
      expect(isFlat(b)).toBe(true);
    }
    expect(await acks(half.tenantId)).toBe(0);
    expect(await acks(gone.tenantId)).toBe(0);
    expect(await acks(OPS_TENANT)).toBe(ops0);
  });

  it("K995-API-010 形の誤り：:id が uuid でない・体に知らない欄・体が配列は 422。印が増えない", async () => {
    const w = await t.ws("形");
    await t.pwned(w);
    expect((await ack("not-a-uuid")).r.status).toBe(422);
    expect((await ack(w.tenantId, opsAll, { tenant_id: w.tenantId })).r.status).toBe(422);
    expect((await ack(w.tenantId, opsAll, [])).r.status).toBe(422);
    expect(await acks(w.tenantId)).toBe(0);
  });

  it("K995-API-011 入口：ログインなしは 401・会社の管理者は 403（一覧も確かめたも）。運営の人ならできることに依らず使える（お金だけの人も一覧と確かめたが 200）", async () => {
    const w = await t.ws("入口");
    await t.pwned(w);
    expect((await list(null)).r.status).toBe(401);
    expect((await ack(w.tenantId, null)).r.status).toBe(401);
    expect((await list(w.admin)).r.status).toBe(403);
    expect((await ack(w.tenantId, w.admin)).r.status).toBe(403);
    expect(await acks(w.tenantId)).toBe(0);
    expect(rowOf(await mine(opsMoneyOnly), w)).toBeDefined();
    expect((await ack(w.tenantId, opsMoneyOnly)).r.status).toBe(200);
  });

  it("K995-API-012 失敗：印を書けない（DB が落ちる）と 503・E-PAGE-003。運営の記録も増えず、一覧に残る", async () => {
    const w = await t.ws("落ちる");
    await t.pwned(w);
    const restore = await t.breakWrites("security_events", { tenant_id: w.tenantId });
    try {
      const { r, b } = await ack(w.tenantId);
      expect(r.status).toBe(503);
      expect(b["code"]).toBe("E-PAGE-003");
    } finally {
      await restore();
    }
    expect(await opsAudit(w.tenantId)).toBe(0);
    expect(rowOf(await mine(), w)).toBeDefined();
  });

  it("K995-API-013 上限：上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数。429 のときは印を書かない", async () => {
    const w = await t.ws("上限");
    await t.pwned(w);
    t.f.limits["ackOpsPwned"] = 1;
    try {
      const ip = "203.0.113.195";
      const send = () =>
        t.f.req("POST", `/ops/workspaces/${w.tenantId}/pwned/ack`, { headers: opsAll.auth, body: {}, ip });
      expect((await send()).status).toBe(200);
      await failLater(w, 1);
      const a0 = await acks(w.tenantId);
      const r = await send();
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
      expect(await acks(w.tenantId)).toBe(a0);
    } finally {
      delete t.f.limits["ackOpsPwned"];
    }
  });
});
