// K-967 運営が本人確認のメールを送り直す（resendOpsVerification・POST /api/v1/ops/workspaces/:id/members/:mid/resend-verification）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-1006（空の体で { sent_at }）。メールは関門 C6（@kaname/notify の NotifyGateway）の中で、認証の部品の本人確認のメール
//   （auth.api.sendVerificationEmail）を送る。部品の口は土台（ops-ws.harness.ts）の偽物で、呼ばれた宛先を数え、わざと落とせる。
//   運営がしたことは運営の記録と会社の記録の両方に残す（app.record_ops_audit・D-128.108・操作の名前は K-1011 の表の verification.resend）
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { startOpsWs, isFlat, OPS_TENANT, type Json, type OpsWs, type Ws } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

let t: OpsWs;
let opsAll: Person;
let opsNoInquiry: Person;
let w: Ws;

beforeAll(async () => {
  t = await startOpsWs("k967", ["ops-resend-verification"]);
  opsAll = await t.ops("佐野");
  opsNoInquiry = await t.ops("お金だけ", ["money"]);
  w = await t.ws("ミナト企画");
});
afterAll(async () => {
  await t.close();
});

const resend = async (wsId: string, mid: string, who: Person = opsAll, body: unknown = {}) => {
  const r = await t.call(who, "POST", `/ops/workspaces/${wsId}/members/${mid}/resend-verification`, body);
  return { r, b: await t.json(r) };
};
const emailOf = async (p: Person) =>
  (await t.row<{ e: string }>(
    'select u.email as e from members m join kaname_auth."user" u on u.id = m.auth_user_id where m.id = $1',
    [p.id],
  ))!.e;
const opsRows = (tenant: string) =>
  t.n("select count(*) as n from ops_audit_events where target_tenant_id = $1 and action = 'verification.resend'", [
    tenant,
  ]);
const wsRows = (tenant: string) =>
  t.n(
    "select count(*) as n from audit_events where tenant_id = $1 and action = 'verification.resend' and actor_role = 'ops'",
    [tenant],
  );
const sentBefore = () => t.mail.calls.length;

describe("K-967 本人確認のメールを送り直す", () => {
  it("K967-API-001 まだ確かめていない人：201・{ sent_at } の 1 欄。その人のメールに部品の本人確認のメールが 1 通・C6 の送った記録（notifications）が 1 行", async () => {
    const p = await t.member(w, "山本 由美", { verified: false });
    const n0 = sentBefore();
    const nf = await t.n("select count(*) as n from notifications where tenant_id = $1 and member_id = $2", [
      w.tenantId,
      p.id,
    ]);
    const { r, b } = await resend(w.tenantId, p.id);
    expect(r.status, JSON.stringify(b)).toBe(201);
    const d = b.data as Json;
    expect(Object.keys(d)).toEqual(["sent_at"]);
    expect(Number.isNaN(new Date(String(d["sent_at"])).getTime())).toBe(false);
    expect(t.mail.calls.slice(n0)).toEqual([{ email: await emailOf(p) }]);
    expect(
      await t.n(
        "select count(*) as n from notifications where tenant_id = $1 and member_id = $2 and channel_id = 'email' and event_kind_id = 'ops.verification_resend'",
        [w.tenantId, p.id],
      ),
    ).toBe(nf + 1);
  });

  it("K967-API-002 運営の記録と会社の記録に 1 行ずつ（操作 verification.resend・対象 members・payload の target_label はその人の名前）。メールの値は記録に入らない", async () => {
    const p = await t.member(w, "木下 翔", { verified: false });
    const [o0, w0] = [await opsRows(w.tenantId), await wsRows(w.tenantId)];
    expect((await resend(w.tenantId, p.id)).r.status).toBe(201);
    expect([await opsRows(w.tenantId), await wsRows(w.tenantId)]).toEqual([o0 + 1, w0 + 1]);
    const e = (await t.row<{ ty: string; id: string; p: Record<string, unknown>; by: string }>(
      "select target_type as ty, target_id as id, payload as p, ops_member_id as by from ops_audit_events where target_tenant_id = $1 and action = 'verification.resend' order by occurred_at desc limit 1",
      [w.tenantId],
    ))!;
    expect([e.ty, e.id, e.by, e.p["target_label"]]).toEqual(["members", p.id, opsAll.id, "木下 翔"]);
    expect(JSON.stringify(e.p)).not.toContain(await emailOf(p));
  });

  it("K967-API-003 もう確かめた人：409・E-CONF-039（欄なし）。メールも記録も増えない", async () => {
    const p = await t.member(w, "湊 さくら", { verified: true });
    const [n0, o0] = [sentBefore(), await opsRows(w.tenantId)];
    const { r, b } = await resend(w.tenantId, p.id);
    expect(r.status).toBe(409);
    expect(b["code"]).toBe("E-CONF-039");
    expect(isFlat(b)).toBe(true);
    expect([sentBefore(), await opsRows(w.tenantId)]).toEqual([n0, o0]);
  });

  it("K967-API-004 その会社のメンバーでない・抜けた・認証の人が無い（AI 社員）・無い uuid の :mid は 404（欄なし）。メールも記録も増えない", async () => {
    const other = await t.ws("別の会社");
    const outsider = await t.member(other, "別の会社の人", { verified: false });
    const gone = await t.member(w, "抜けた人", { verified: false });
    await t.f.admin.query("update tenant_memberships set status = 'left' where member_id = $1", [gone.id]);
    const ai = await t.member(w, "AI 社員", { authEmail: null });
    const [n0, o0] = [sentBefore(), await opsRows(w.tenantId)];
    for (const mid of [outsider.id, gone.id, ai.id, randomUUID()]) {
      const { r, b } = await resend(w.tenantId, mid);
      expect(r.status, mid).toBe(404);
      expect(isFlat(b)).toBe(true);
    }
    expect([sentBefore(), await opsRows(w.tenantId)]).toEqual([n0, o0]);
  });

  it("K967-API-005 指す会社が無い・見えない：運営の会社・無い uuid・作りかけは 404（欄なし）", async () => {
    const half = await t.ws("作りかけ");
    const p = await t.member(half, "作りかけの人", { verified: false });
    await t.f.admin.query("update tenants set half_made_at = now() where id = $1", [half.tenantId]);
    for (const [ws, mid] of [
      [OPS_TENANT, opsAll.id],
      [randomUUID(), p.id],
      [half.tenantId, p.id],
    ] as const) {
      const { r, b } = await resend(ws, mid);
      expect(r.status, ws).toBe(404);
      expect(isFlat(b)).toBe(true);
    }
  });

  it("K967-API-006 形の誤り：道の :id・:mid が uuid でない・体に知らない欄・体が配列は 422。何も送らない", async () => {
    const p = await t.member(w, "形", { verified: false });
    const n0 = sentBefore();
    const bad: [string, string, unknown][] = [
      ["abc", p.id, {}],
      [w.tenantId, "abc", {}],
      [w.tenantId, p.id, { email: "x@example.test" }],
      [w.tenantId, p.id, []],
    ];
    for (const [ws, mid, body] of bad) {
      const r = await t.call(opsAll, "POST", `/ops/workspaces/${ws}/members/${mid}/resend-verification`, body);
      expect(r.status, `${ws} ${mid} ${JSON.stringify(body)}`).toBe(422);
    }
    expect(sentBefore()).toBe(n0);
  });

  it("K967-API-007 入口：ログインなし 401・会社の人（その会社の管理者でも）403・問い合わせ（inquiry）を持たない運営の人 403。何も送らない", async () => {
    const p = await t.member(w, "入口", { verified: false });
    const n0 = sentBefore();
    expect(
      (await t.call(null, "POST", `/ops/workspaces/${w.tenantId}/members/${p.id}/resend-verification`, {})).status,
    ).toBe(401);
    expect((await resend(w.tenantId, p.id, w.admin)).r.status).toBe(403);
    expect((await resend(w.tenantId, p.id, opsNoInquiry)).r.status).toBe(403);
    expect(sentBefore()).toBe(n0);
  });

  it("K967-API-008 送り出しが落ちる（G-15）：503・E-PAGE-003 で「送った」と言わない。運営の記録も会社の記録も送った記録（notifications）も残らない（同じ取引で戻る）", async () => {
    const p = await t.member(w, "落ちる", { verified: false });
    const [o0, w0] = [await opsRows(w.tenantId), await wsRows(w.tenantId)];
    const nf0 = await t.n("select count(*) as n from notifications where tenant_id = $1 and member_id = $2", [
      w.tenantId,
      p.id,
    ]);
    t.mail.fail = true;
    try {
      const { r, b } = await resend(w.tenantId, p.id);
      expect(r.status).toBe(503);
      expect(b["code"]).toBe("E-PAGE-003");
      expect(JSON.stringify(b)).not.toMatch(/sent_at|試験で落とした/);
    } finally {
      t.mail.fail = false;
    }
    expect([await opsRows(w.tenantId), await wsRows(w.tenantId)]).toEqual([o0, w0]);
    expect(
      await t.n("select count(*) as n from notifications where tenant_id = $1 and member_id = $2", [w.tenantId, p.id]),
    ).toBe(nf0);
  });

  it("K967-API-009 記録を書けない（DB が落ちる）：503・E-PAGE-003。メールを送らない（記録を書いてから送る）", async () => {
    const p = await t.member(w, "記録が落ちる", { verified: false });
    const n0 = sentBefore();
    const restore = await t.breakWrites("ops_audit_events", { target_tenant_id: w.tenantId });
    try {
      const { r, b } = await resend(w.tenantId, p.id);
      expect(r.status).toBe(503);
      expect(b["code"]).toBe("E-PAGE-003");
    } finally {
      await restore();
    }
    expect(sentBefore()).toBe(n0);
  });

  it("K967-API-010 操作の揺れ：同じ人に 2 回押すと 2 回とも 201 で、メール 2 通・記録 2 行（1 回目を押した後に届かなかった人のため）", async () => {
    const p = await t.member(w, "二度押し", { verified: false });
    const [n0, o0] = [sentBefore(), await opsRows(w.tenantId)];
    expect((await resend(w.tenantId, p.id)).r.status).toBe(201);
    expect((await resend(w.tenantId, p.id)).r.status).toBe(201);
    expect([sentBefore() - n0, (await opsRows(w.tenantId)) - o0]).toEqual([2, 2]);
  });

  it("K967-API-011 ログに宛先・リンクを出さない：送ったときのログに、その人のメールの字が無い", async () => {
    const p = await t.member(w, "ログ", { verified: false });
    const mail = await emailOf(p);
    const out: string[] = [];
    const spies = (["log", "info", "warn", "error"] as const).map((k) =>
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => {
        out.push(a.map(String).join(" "));
      }),
    );
    try {
      t.mail.fail = true;
      await resend(w.tenantId, p.id);
      t.mail.fail = false;
      await resend(w.tenantId, p.id);
    } finally {
      t.mail.fail = false;
      for (const s of spies) s.mockRestore();
    }
    expect(out.join("\n")).not.toContain(mail);
  });

  it("K967-API-012 上限：60/分/人を上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数。429 のときは送らない", async () => {
    const p = await t.member(w, "上限", { verified: false });
    t.f.limits["resendOpsVerification"] = 1;
    try {
      const ip = "203.0.113.167";
      const send = () =>
        t.f.req("POST", `/ops/workspaces/${w.tenantId}/members/${p.id}/resend-verification`, {
          headers: opsAll.auth,
          body: {},
          ip,
        });
      expect((await send()).status).toBe(201);
      const n0 = sentBefore();
      const r = await send();
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
      expect(sentBefore()).toBe(n0);
    } finally {
      delete t.f.limits["resendOpsVerification"];
    }
  });
});
