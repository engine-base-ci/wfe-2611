// K-969 運営が 1 社の中を見る（openPeek・POST /api/v1/ops/workspaces/:id/peeks／closePeek・DELETE /api/v1/ops/peeks/:id）と、
//   見ている間の上の帯（getServiceStatusForMember の bands の kind peek・K-955 の app.member_peek_band を差し替える）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-1006（OpsPeek の 5 欄）。開く・閉じるは運営の記録と会社の記録の両方に残す（app.record_ops_audit・操作は K-1011 の表の peek.open・peek.close）。
//   帯は 2 つ：運営の側（見ている運営の人が x-tenant-id で顧客の画面を開いたとき・notice_id に許可の id＝closePeek に渡す id）と、
//   顧客の側（その会社の人・notice_id は null・題「運営が中を見ています」）。本人確認の取り直しは土台（ops-act.harness.ts）の偽のログインで書く
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { startOpsAct, STEP, type OpsAct } from "./ops-act.harness.js";
import { isFlat, OPS_TENANT, type Json, type Ws } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

let t: OpsAct;
let opsAll: Person;
let opsOther: Person;
let opsNoPeek: Person;
let w: Ws;
let other: Ws;

beforeAll(async () => {
  t = await startOpsAct("k969", ["ops-peek", "service-status-member"]);
  opsAll = await t.ops("高本");
  opsOther = await t.ops("佐野");
  opsNoPeek = await t.ops("お金だけ", ["money"]);
  w = await t.ws("ミナト企画");
  other = await t.ws("ハル工房");
});
afterAll(async () => {
  await t.close();
});

const BODY = { reason: "問い合わせ「承認したのに動かない」の調べ", minutes: 60 };
const open = async (wsId: string, body: unknown = BODY, who: Person = opsAll, step: number | undefined = STEP) => {
  const r = await t.act(who, "POST", `/ops/workspaces/${wsId}/peeks`, body, { stepUpAgoSec: step });
  return { r, b: await t.json(r) };
};
const close = async (id: string, who: Person = opsAll) => {
  const r = await t.act(who, "DELETE", `/ops/peeks/${id}`, undefined, { stepUpAgoSec: STEP });
  return { r, b: await t.json(r) };
};
const grants = (tenant: string) =>
  t.n("select count(*) as n from support_access_grants where tenant_id = $1 and deleted_at is null", [tenant]);
const opsLog = (tenant: string, action: string) =>
  t.n("select count(*) as n from ops_audit_events where target_tenant_id = $1 and action = $2", [tenant, action]);
const wsLog = (tenant: string, action: string) =>
  t.n("select count(*) as n from audit_events where tenant_id = $1 and action = $2 and actor_role = 'ops'", [
    tenant,
    action,
  ]);
const bandsOf = async (who: Person, tenant?: string) => {
  const r = await t.act(who, "GET", "/service-status", undefined, tenant ? { tenant } : {});
  return { r, b: await t.json(r) };
};
const peekBand = (b: Json) =>
  ((b.data as { bands?: Json[] } | undefined)?.bands ?? []).filter((x) => x["kind"] === "peek");
const closeAll = (tenant: string) =>
  t.f.admin.query("update support_access_grants set closed_at = now() where tenant_id = $1 and closed_at is null", [
    tenant,
  ]);

describe("K-969 中を見るを開く", () => {
  it("K969-API-001 開く：201・答えは id・workspace_id・reason・expires_at・closed_at の 5 欄。期限は今から 60 分・閉じた時刻は null。許可の行は開いた人の ops_members.id・理由つき", async () => {
    const before = Date.now();
    const { r, b } = await open(w.tenantId);
    expect(r.status, JSON.stringify(b)).toBe(201);
    const d = b.data as Json;
    expect(Object.keys(d).sort()).toEqual(["closed_at", "expires_at", "id", "reason", "workspace_id"]);
    expect([d["workspace_id"], d["reason"], d["closed_at"]]).toEqual([w.tenantId, BODY.reason, null]);
    const exp = new Date(String(d["expires_at"])).getTime();
    expect(Math.abs(exp - (before + 60 * 60_000))).toBeLessThan(30_000);
    const g = (await t.row<{ om: string; reason: string; inq: string | null }>(
      "select ops_member_id as om, reason, inquiry_id as inq from support_access_grants where id = $1",
      [d["id"]],
    ))!;
    expect([g.om, g.reason, g.inq]).toEqual([await t.opsMemberId(opsAll), BODY.reason, null]);
    await closeAll(w.tenantId);
  });

  it("K969-API-002 記録：開くと運営の記録と会社の記録に peek.open が 1 行ずつ。対象は support_access_grants とその id・grant_id も同じ id・payload は target_label（会社名）と reason", async () => {
    const [o0, w0] = [await opsLog(w.tenantId, "peek.open"), await wsLog(w.tenantId, "peek.open")];
    const { r, b } = await open(w.tenantId);
    expect(r.status).toBe(201);
    const id = (b.data as Json)["id"];
    expect([await opsLog(w.tenantId, "peek.open"), await wsLog(w.tenantId, "peek.open")]).toEqual([o0 + 1, w0 + 1]);
    const e = (await t.row<{ ty: string; tid: string; gid: string; p: Json }>(
      "select target_type as ty, target_id as tid, grant_id as gid, payload as p from ops_audit_events where target_tenant_id = $1 and action = 'peek.open' order by occurred_at desc limit 1",
      [w.tenantId],
    ))!;
    expect([e.ty, e.tid, e.gid, e.p["target_label"], e.p["reason"]]).toEqual([
      "support_access_grants",
      id,
      id,
      w.name,
      BODY.reason,
    ]);
    await closeAll(w.tenantId);
  });

  it("K969-API-003 問い合わせを付ける：その会社の問い合わせなら許可の行に入る。別の会社の・無い・消した問い合わせは 404（欄なし）で許可を作らない", async () => {
    const q = await t.inquiry(w, { state: "open" });
    const { r, b } = await open(w.tenantId, { ...BODY, inquiry_id: q });
    expect(r.status).toBe(201);
    expect(
      (await t.row<{ q: string }>("select inquiry_id as q from support_access_grants where id = $1", [
        (b.data as Json)["id"],
      ]))!.q,
    ).toBe(q);
    await closeAll(w.tenantId);
    const gone = await t.inquiry(w, { state: "open" });
    await t.f.admin.query("update inquiries set deleted_at = now() where id = $1", [gone]);
    const otherQ = await t.inquiry(other, { state: "open" });
    const g0 = await grants(w.tenantId);
    for (const id of [otherQ, gone, randomUUID()]) {
      const x = await open(w.tenantId, { ...BODY, inquiry_id: id });
      expect(x.r.status, id).toBe(404);
      expect(isFlat(x.b)).toBe(true);
    }
    expect(await grants(w.tenantId)).toBe(g0);
  });

  it("K969-API-004 もう開いている：同じ人が同じ会社をもう一度開くと 409・E-OPS-001（欄なし）で増えない。別の運営の人は開ける", async () => {
    expect((await open(w.tenantId)).r.status).toBe(201);
    const g0 = await grants(w.tenantId);
    const again = await open(w.tenantId);
    expect(again.r.status).toBe(409);
    expect(again.b["code"]).toBe("E-OPS-001");
    expect(isFlat(again.b)).toBe(true);
    expect(await grants(w.tenantId)).toBe(g0);
    expect((await open(w.tenantId, BODY, opsOther)).r.status).toBe(201);
    await closeAll(w.tenantId);
  });

  it("K969-API-005 会社が無い・見えない：運営の会社・無い uuid は 404（欄なし）で何も書かない", async () => {
    for (const id of [OPS_TENANT, randomUUID()]) {
      const x = await open(id);
      expect(x.r.status, id).toBe(404);
      expect(isFlat(x.b)).toBe(true);
    }
    expect(await t.n("select count(*) as n from support_access_grants where tenant_id = $1", [OPS_TENANT])).toBe(0);
  });

  it("K969-API-006 本人確認：取り直していない・16 分前は 403 STEP_UP_REQUIRED で許可も記録も作らない。14 分前なら開ける", async () => {
    const [g0, o0] = [await grants(w.tenantId), await opsLog(w.tenantId, "peek.open")];
    for (const step of [undefined, 16 * 60]) {
      const x = await open(w.tenantId, BODY, opsAll, step);
      expect(x.r.status, String(step)).toBe(403);
      expect(x.b["code"]).toBe("STEP_UP_REQUIRED");
    }
    expect([await grants(w.tenantId), await opsLog(w.tenantId, "peek.open")]).toEqual([g0, o0]);
    expect((await open(w.tenantId, BODY, opsAll, 14 * 60)).r.status).toBe(201);
    await closeAll(w.tenantId);
  });

  it("K969-API-007 入口：ログインなし 401・会社の人（管理者でも）403・中を見る（peek）を持たない運営の人 403。許可を作らない", async () => {
    const g0 = await grants(w.tenantId);
    expect((await t.act(null, "POST", `/ops/workspaces/${w.tenantId}/peeks`, BODY)).status).toBe(401);
    expect((await open(w.tenantId, BODY, w.admin)).r.status).toBe(403);
    expect((await open(w.tenantId, BODY, opsNoPeek)).r.status).toBe(403);
    expect(await grants(w.tenantId)).toBe(g0);
  });

  it("K969-API-008 形の誤り：minutes が 0・61・小数・無い、reason が空・201 字・無い、知らない欄、inquiry_id が uuid でない、道の :id が uuid でないは 422。許可を作らない", async () => {
    const g0 = await grants(w.tenantId);
    const bad: unknown[] = [
      { ...BODY, minutes: 0 },
      { ...BODY, minutes: 61 },
      { ...BODY, minutes: 1.5 },
      { reason: BODY.reason },
      { ...BODY, reason: "" },
      { ...BODY, reason: "あ".repeat(201) },
      { minutes: 60 },
      { ...BODY, expires_at: "2099-01-01T00:00:00Z" },
      { ...BODY, inquiry_id: "abc" },
    ];
    for (const body of bad) expect((await open(w.tenantId, body)).r.status, JSON.stringify(body)).toBe(422);
    expect((await open("abc")).r.status).toBe(422);
    expect(await grants(w.tenantId)).toBe(g0);
  });
});

describe("K-969 中を見るを閉じる", () => {
  it("K969-API-009 閉じる：200・closed_at が入った 5 欄。記録に peek.close が両方 1 行。閉じた後は、その人が顧客の口を読むと 403（見られない）", async () => {
    const id = String(((await open(w.tenantId)).b.data as Json)["id"]);
    expect((await bandsOf(opsAll, w.tenantId)).r.status).toBe(200);
    const [o0, w0] = [await opsLog(w.tenantId, "peek.close"), await wsLog(w.tenantId, "peek.close")];
    const { r, b } = await close(id);
    expect(r.status, JSON.stringify(b)).toBe(200);
    const d = b.data as Json;
    expect([d["id"], d["workspace_id"], d["closed_at"] === null]).toEqual([id, w.tenantId, false]);
    expect([await opsLog(w.tenantId, "peek.close"), await wsLog(w.tenantId, "peek.close")]).toEqual([o0 + 1, w0 + 1]);
    expect((await bandsOf(opsAll, w.tenantId)).r.status).toBe(403);
  });

  it("K969-API-010 閉じる：ほかの運営の人が開いた許可・無い id は 404（欄なし）で閉じない", async () => {
    const id = String(((await open(w.tenantId, BODY, opsOther)).b.data as Json)["id"]);
    for (const x of [id, randomUUID()]) {
      const c = await close(x);
      expect(c.r.status, x).toBe(404);
      expect(isFlat(c.b)).toBe(true);
    }
    expect(
      (await t.row<{ c: string | null }>("select closed_at as c from support_access_grants where id = $1", [id]))!.c,
    ).toBeNull();
    await closeAll(w.tenantId);
  });

  it("K969-API-011 もう閉じた・期限が切れた許可を閉じると 409・E-OPS-002（欄なし）。2 回目の閉じるも同じで、記録は増えない", async () => {
    const id = String(((await open(w.tenantId)).b.data as Json)["id"]);
    expect((await close(id)).r.status).toBe(200);
    const expired = await t.grant(w.tenantId, opsAll, { minutesLeft: -1 });
    const o0 = await opsLog(w.tenantId, "peek.close");
    for (const x of [id, expired]) {
      const c = await close(x);
      expect(c.r.status, x).toBe(409);
      expect(c.b["code"]).toBe("E-OPS-002");
      expect(isFlat(c.b)).toBe(true);
    }
    expect(await opsLog(w.tenantId, "peek.close")).toBe(o0);
  });

  it("K969-API-012 同時に 2 回閉じる：片方だけ 200・もう片方は 409 E-OPS-002。記録の peek.close は 1 行だけ増える", async () => {
    const id = String(((await open(w.tenantId)).b.data as Json)["id"]);
    const o0 = await opsLog(w.tenantId, "peek.close");
    const both = await Promise.all([close(id), close(id)]);
    expect(both.map((x) => x.r.status).sort()).toEqual([200, 409]);
    expect(await opsLog(w.tenantId, "peek.close")).toBe(o0 + 1);
  });
});

describe("K-969 見ている間の帯", () => {
  it("K969-API-013 運営の側の帯：開いた人が x-tenant-id でその会社の稼働状況を読むと peek の帯が 1 つ。notice_id は許可の id（closePeek に渡す）・題は会社名・state は理由・from は開いた時刻・to は期限・closable false・more 0", async () => {
    const d = (await open(w.tenantId)).b.data as Json;
    const { r, b } = await bandsOf(opsAll, w.tenantId);
    expect(r.status, JSON.stringify(b)).toBe(200);
    const p = peekBand(b);
    expect(p.length).toBe(1);
    expect([p[0]!["notice_id"], p[0]!["title"], p[0]!["state"], p[0]!["closable"], p[0]!["more"]]).toEqual([
      d["id"],
      w.name,
      BODY.reason,
      false,
      0,
    ]);
    expect(new Date(String(p[0]!["to"])).getTime()).toBe(new Date(String(d["expires_at"])).getTime());
    expect(Number.isNaN(new Date(String(p[0]!["from"])).getTime())).toBe(false);
    await closeAll(w.tenantId);
  });

  it("K969-API-014 顧客の側の帯：その会社の人には notice_id null・題「運営が中を見ています」・state は理由・to は期限の peek の帯が 1 つ。別の会社の人には出ない", async () => {
    const d = (await open(w.tenantId)).b.data as Json;
    const mine = peekBand((await bandsOf(w.admin)).b);
    expect(mine.length).toBe(1);
    expect([mine[0]!["notice_id"], mine[0]!["title"], mine[0]!["state"], mine[0]!["closable"]]).toEqual([
      null,
      "運営が中を見ています",
      BODY.reason,
      false,
    ]);
    expect(new Date(String(mine[0]!["to"])).getTime()).toBe(new Date(String(d["expires_at"])).getTime());
    expect(peekBand((await bandsOf(other.admin)).b)).toEqual([]);
    await closeAll(w.tenantId);
  });

  it("K969-API-015 切り替わりの直後（G-12）：閉じた直後と期限が切れた直後は、顧客の側の peek の帯が無い。2 人が開いていれば期限の遅い 1 つと more 1", async () => {
    const id = String(((await open(w.tenantId)).b.data as Json)["id"]);
    expect((await close(id)).r.status).toBe(200);
    expect(peekBand((await bandsOf(w.admin)).b)).toEqual([]);
    await t.grant(w.tenantId, opsAll, { minutesLeft: -1 });
    expect(peekBand((await bandsOf(w.admin)).b)).toEqual([]);
    await t.grant(w.tenantId, opsAll, { minutesLeft: 10 });
    await t.grant(w.tenantId, opsOther, { minutesLeft: 40, reason: "障害の調べ" });
    const two = peekBand((await bandsOf(w.admin)).b);
    expect(two.length).toBe(1);
    expect([two[0]!["state"], two[0]!["more"]]).toEqual(["障害の調べ", 1]);
    await closeAll(w.tenantId);
  });
});

describe("K-969 守りと失敗", () => {
  it("K969-DB-001 2 層目：会社の人の文脈で app.ops_peek_open・app.ops_peek_close を直に呼ぶと 42501。どちらも security definer で PUBLIC は呼べない", async () => {
    const c = await t.f.pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('app.role', 'member', true), set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true)",
        [w.tenantId, w.admin.id],
      );
      await expect(c.query("select app.ops_peek_open($1, 'x', 10, null)", [w.tenantId])).rejects.toMatchObject({
        code: "42501",
      });
      await c.query("rollback");
    } finally {
      c.release();
    }
    const fns = await t.f.admin.query<{ name: string; definer: boolean; pub: boolean }>(
      `select p.proname as name, p.prosecdef as definer, has_function_privilege('public', p.oid, 'execute') as pub
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'app' and p.proname in ('ops_peek_open', 'ops_peek_close') order by 1`,
    );
    expect(fns.rows.map((x) => [x.name, x.definer, x.pub])).toEqual([
      ["ops_peek_close", true, false],
      ["ops_peek_open", true, false],
    ]);
  });

  it("K969-API-016 記録を書けない（DB が落ちる）：503・E-PAGE-003 で許可も残らない（同じ取引で戻る）。ログに理由の字が出ない", async () => {
    const g0 = await grants(w.tenantId);
    const restore = await t.breakWrites("ops_audit_events", { target_tenant_id: w.tenantId });
    const logs: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => void logs.push(a.map(String).join(" "));
    try {
      const { r, b } = await open(w.tenantId);
      expect(r.status).toBe(503);
      expect(b["code"]).toBe("E-PAGE-003");
    } finally {
      console.error = orig;
      await restore();
    }
    expect(await grants(w.tenantId)).toBe(g0);
    expect(logs.join("\n")).not.toContain(BODY.reason);
  });

  it("K969-API-017 上限：openPeek を上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数。429 では許可を作らない", async () => {
    t.f.limits["openPeek"] = 1;
    try {
      expect((await open(other.tenantId)).r.status).toBe(201);
      const g0 = await grants(w.tenantId);
      const x = await open(w.tenantId);
      expect(x.r.status).toBe(429);
      const s = x.b["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
      expect(await grants(w.tenantId)).toBe(g0);
    } finally {
      delete t.f.limits["openPeek"];
      await closeAll(other.tenantId);
    }
  });
});
