// K-1011 運営が 1 社の問い合わせと記録を読む（listOpsWorkspaceInquiries・GET /api/v1/ops/workspaces/:id/inquiries／
//   listOpsWorkspaceAudit・GET /api/v1/ops/workspaces/:id/audit）。K-966 から分けた葉。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-1006 の「画面が使う答えの形」（問い合わせ 7 欄・記録 7 欄）。記録は 1 社の記録タブで運営の誰が何をしたか（D-125.129・D-128.108）。
//   運営の記録の行は、書く口の葉（K-967〜K-970・K-978・K-981 ほか）が入るまで app.record_ops_audit を運営の文脈で直に呼んで置く
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { startOpsWs, isFlat, AUDIT_KEYS, INQ_KEYS, OPS_TENANT, type OpsWs, type Ws } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

let t: OpsWs;
let opsAll: Person;
let opsNoInquiry: Person;
let w: Ws;

beforeAll(async () => {
  t = await startOpsWs("k1011", ["ops-workspace-log"]);
  opsAll = await t.ops("佐野");
  opsNoInquiry = await t.ops("お金だけ", ["money"]);
  w = await t.ws("ミナト企画", { members: 2 });
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const get = async (path: string, who: Person = opsAll) => {
  const r = await t.call(who, "GET", path);
  return { r, b: await t.json(r) };
};
const inq = (id: string, who?: Person) => get(`/ops/workspaces/${id}/inquiries`, who);
const audit = (id: string, q = "", who?: Person) => get(`/ops/workspaces/${id}/audit${q}`, who);
/** 運営の記録を 1 行置く（運営の文脈で app.record_ops_audit・会社の記録にも同時に書かれる）。時刻をずらせる */
const record = async (
  ws: Ws,
  action: string,
  o: { by?: Person; payload?: Record<string, unknown>; at?: string } = {},
): Promise<string> => {
  const by = o.by ?? opsAll;
  const ctx: TenantContext = { tenantId: null, userId: by.id, role: "ops" };
  const id = await withTenant(t.f.pool, ctx, async (c) => {
    const r = await c.query<{ id: string }>(
      "select app.record_ops_audit($1, $2, 'tenants', $1::text, null, $3) as id",
      [ws.tenantId, action, o.payload ?? {}],
    );
    return r.rows[0]!.id;
  });
  if (o.at) await t.f.admin.query("update ops_audit_events set occurred_at = $2 where id = $1", [id, o.at]);
  return id;
};

describe("K-1011 1 社の問い合わせ（listOpsWorkspaceInquiries）", () => {
  it("K1011-API-001 1 行は 7 欄。その会社の問い合わせだけが作った時刻の新しい順に、題・何について・聞いた人・担当・状態（運営の側の 4 つ）で並ぶ", async () => {
    const x = await t.ws("問い合わせ", { members: 2 });
    const a = await t.inquiry(x, { state: "open", title: "古い" });
    await t.f.admin.query("update inquiries set created_at = now() - interval '1 day' where id = $1", [a]);
    const b = await t.inquiry(x, { state: "waiting", title: "新しい", assignee: opsAll });
    const other = await t.ws("別の会社");
    await t.inquiry(other, { state: "open", title: "別の会社の問い合わせ" });
    const { r, b: body } = await inq(x.tenantId);
    expect(r.status).toBe(200);
    const rows = body.data as Row[];
    for (const e of rows) expect(Object.keys(e).sort()).toEqual(INQ_KEYS);
    expect(rows.map((e) => e["id"])).toEqual([b, a]);
    expect(rows[0]).toMatchObject({
      title: "新しい",
      topic: "trouble",
      asker_name: "管理者 問い合わせ",
      owner_name: "運営 佐野",
      state: "waiting",
    });
    expect(rows[1]).toMatchObject({ owner_name: null, state: "open" });
  });

  it("K1011-API-002 済み・後でも出る。消した問い合わせは出ない。内容（本文・やり取り）は答えに無い", async () => {
    const x = await t.ws("済み");
    const done = await t.inquiry(x, { state: "done" });
    const later = await t.inquiry(x, { state: "later" });
    const gone = await t.inquiry(x, { state: "open" });
    await t.f.admin.query("update inquiries set deleted_at = now() where id = $1", [gone]);
    const rows = (await inq(x.tenantId)).b.data as Row[];
    expect(rows.map((e) => e["id"]).sort()).toEqual([done, later].sort());
    expect(JSON.stringify(rows)).not.toMatch(/"body"|messages/);
  });

  it("K1011-API-003 できること：問い合わせ（inquiry）を持たない運営の人は 403。記録は運営の人なら誰でも 200", async () => {
    expect((await inq(w.tenantId, opsNoInquiry)).r.status).toBe(403);
    expect((await audit(w.tenantId, "", opsNoInquiry)).r.status).toBe(200);
  });
});

describe("K-1011 1 社の記録（listOpsWorkspaceAudit）", () => {
  it("K1011-API-004 1 行は 7 欄。その会社への運営の操作だけが新しい順に、した人の名前・操作の名前と字・対象の字・理由で並ぶ", async () => {
    const x = await t.ws("記録");
    await record(x, "peek.open", {
      payload: { reason: "問い合わせ「承認したのに動かない」の確かめ" },
      at: "2026-11-02T00:40:00Z",
    });
    await record(x, "verification.resend", { payload: { target_label: "山本 由美" }, at: "2026-11-03T00:00:00Z" });
    const other = await t.ws("別の会社の記録");
    await record(other, "workspace.resume");
    const { r, b } = await audit(x.tenantId);
    expect(r.status).toBe(200);
    const rows = b.data as Row[];
    for (const e of rows) expect(Object.keys(e).sort()).toEqual(AUDIT_KEYS);
    expect(rows.map((e) => e["action"])).toEqual(["verification.resend", "peek.open"]);
    expect(rows[0]).toMatchObject({
      actor_name: "運営 佐野",
      action_label: "本人確認のメールを送り直した",
      target_label: "山本 由美",
      reason: null,
    });
    expect(rows[1]).toMatchObject({
      action_label: "中を見た",
      target_label: null,
      reason: "問い合わせ「承認したのに動かない」の確かめ",
    });
    expect(new Date(String(rows[1]!["at"])).toISOString()).toBe("2026-11-02T00:40:00.000Z");
  });

  it("K1011-API-005 操作の字：決まった 19 の操作はそれぞれの字（書く口の葉の名前とそろえた・D-156.48）、知らない操作は「運営の操作」", async () => {
    const x = await t.ws("操作の字");
    const want: Record<string, string> = {
      "peek.open": "中を見た",
      "peek.close": "中を見るのを閉じた",
      "workspace.stop_scheduled": "止める日を決めた",
      "workspace.stop": "止めた",
      "workspace.resume": "再開した",
      "verification.resend": "本人確認のメールを送り直した",
      "plan.change": "代わりにプランを変えた",
      "invoice.issue": "請求書を出した",
      "payment.record": "入金を記録した",
      "notice.send": "お知らせを送った",
      "inquiry.take": "問い合わせの担当を取った",
      "inquiry.release": "問い合わせの担当を外した",
      "inquiry.done": "問い合わせを済みにした",
      "inquiry.reopen": "問い合わせを開き直した",
      "inquiry.later": "問い合わせを後でにした",
      "inquiry.reply": "問い合わせに返した",
      "inquiry.note": "社内メモを書いた",
      "invoice.overdue_notice": "期限を過ぎた知らせを出した",
      "pwned.acknowledge": "照合が使えなかった登録を確かめた",
      "something.new": "運営の操作",
    };
    for (const a of Object.keys(want)) await record(x, a);
    const rows = (await audit(x.tenantId)).b.data as Row[];
    for (const [a, label] of Object.entries(want))
      expect(rows.find((e) => e["action"] === a)?.["action_label"], a).toBe(label);
  });

  it("K1011-API-006 from・to（日本時間の日付・両端を含む）で絞る。from が to より後なら 200 で空", async () => {
    const x = await t.ws("期間");
    await record(x, "peek.open", { at: "2026-10-31T14:59:00Z" }); // 日本時間 10/31 23:59
    await record(x, "peek.close", { at: "2026-10-31T15:00:00Z" }); // 日本時間 11/01 00:00
    await record(x, "workspace.resume", { at: "2026-11-30T14:59:00Z" }); // 日本時間 11/30 23:59
    await record(x, "workspace.stop", { at: "2026-11-30T15:00:00Z" }); // 日本時間 12/01 00:00
    const acts = async (q: string) => ((await audit(x.tenantId, q)).b.data as Row[]).map((e) => e["action"]);
    expect(await acts("?from=2026-11-01&to=2026-11-30")).toEqual(["workspace.resume", "peek.close"]);
    expect(await acts("?from=2026-12-01")).toEqual(["workspace.stop"]);
    expect(await acts("?to=2026-10-31")).toEqual(["peek.open"]);
    const back = await audit(x.tenantId, "?from=2026-12-01&to=2026-11-01");
    expect(back.r.status).toBe(200);
    expect(back.b.data).toEqual([]);
  });

  it("K1011-API-007 limit：既定は 50 件まで・limit=2 は新しい 2 件。cursor は形だけ（付けても答えは同じ）", async () => {
    const x = await t.ws("件数");
    for (let i = 0; i < 52; i++)
      await record(x, "notice.send", { at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString() });
    expect(((await audit(x.tenantId)).b.data as Row[]).length).toBe(50);
    const two = (await audit(x.tenantId, "?limit=2")).b.data as Row[];
    expect(two.map((e) => new Date(String(e["at"])).getUTCMinutes())).toEqual([51, 50]);
    expect((await audit(x.tenantId, "?limit=2&cursor=3")).b.data).toEqual(two);
  });

  it("K1011-API-008 形の誤り（契約）：from・to が日付でない・limit が範囲の外・知らない問い合わせの名前は 422", async () => {
    for (const q of ["?from=11/01", "?to=2026-13-01", "?limit=0", "?limit=101", "?actor=1"]) {
      const { r } = await audit(w.tenantId, q);
      expect(r.status, q).toBe(422);
    }
  });
});

describe("K-1011 守りと失敗", () => {
  it("K1011-API-009 指す会社が無い・見えない：運営の会社・無い uuid・作りかけは 2 本とも 404・欄なし。道の id の形の誤りは 422", async () => {
    const half = await t.ws("作りかけ");
    await t.f.admin.query("update tenants set half_made_at = now() where id = $1", [half.tenantId]);
    for (const id of [OPS_TENANT, randomUUID(), half.tenantId]) {
      for (const f of [inq, (i: string) => audit(i)]) {
        const { r, b } = await f(id);
        expect(r.status, id).toBe(404);
        expect(isFlat(b)).toBe(true);
      }
    }
    for (const path of ["/ops/workspaces/abc/inquiries", "/ops/workspaces/abc/audit"])
      expect((await t.call(opsAll, "GET", path)).status, path).toBe(422);
  });

  it("K1011-API-010 入口：ログインなしは 2 本とも 401・会社の人（その会社の管理者でも）は 403", async () => {
    for (const p of [`/ops/workspaces/${w.tenantId}/inquiries`, `/ops/workspaces/${w.tenantId}/audit`]) {
      expect((await t.call(null, "GET", p)).status).toBe(401);
      expect((await t.call(w.admin, "GET", p)).status).toBe(403);
    }
  });

  it("K1011-API-011 関数の中の 2 層目（G-02）：会社の人の文脈で直に呼ぶと 42501。読んでも運営の記録は増えない", async () => {
    const asMember: TenantContext = { tenantId: w.tenantId, userId: w.admin.id, role: "member" };
    for (const sql of [
      "select app.ops_workspace_inquiries($1)",
      "select app.ops_workspace_audit($1, null, null, 50)",
    ]) {
      const e = await withTenant(t.f.pool, asMember, (c) => c.query(sql, [w.tenantId])).then(
        () => null,
        (x: { code?: string }) => x,
      );
      expect(e?.code, sql).toBe("42501");
    }
    const before = await t.n("select count(*) as n from ops_audit_events where target_tenant_id = $1", [w.tenantId]);
    await inq(w.tenantId);
    await audit(w.tenantId);
    expect(await t.n("select count(*) as n from ops_audit_events where target_tenant_id = $1", [w.tenantId])).toBe(
      before,
    );
  });

  it("K1011-API-012 DB が落ちる（関数が無い）：2 本とも 503・E-PAGE-003 で、関数の名前を出さない", async () => {
    await t.f.admin.query("alter function app.ops_workspace_inquiries(uuid) rename to ops_wsi_k1011_saved");
    await t.f.admin.query(
      "alter function app.ops_workspace_audit(uuid, date, date, integer) rename to ops_wsa_k1011_saved",
    );
    try {
      for (const f of [inq, (i: string) => audit(i)]) {
        const { r, b } = await f(w.tenantId);
        expect(r.status).toBe(503);
        expect(b["code"]).toBe("E-PAGE-003");
        expect(JSON.stringify(b)).not.toMatch(/ops_workspace|ops_ws/);
      }
    } finally {
      await t.f.admin.query("alter function app.ops_wsi_k1011_saved(uuid) rename to ops_workspace_inquiries");
      await t.f.admin.query(
        "alter function app.ops_wsa_k1011_saved(uuid, date, date, integer) rename to ops_workspace_audit",
      );
    }
  });

  it("K1011-API-013 上限：listOpsWorkspaceAudit を上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数", async () => {
    t.f.limits["listOpsWorkspaceAudit"] = 1;
    try {
      const ip = "203.0.113.111";
      const call = () => t.f.req("GET", `/ops/workspaces/${w.tenantId}/audit`, { headers: opsAll.auth, ip });
      expect((await call()).status).toBe(200);
      const r = await call();
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.f.limits["listOpsWorkspaceAudit"];
    }
  });
});
